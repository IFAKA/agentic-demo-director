import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { createDemoClient } from "./demo-client.js";
import { assertVideoMatches, composeFinal, defaultOutputPath, generateFrameSheet, inspectVideo } from "./ffmpeg.js";
import { createGestureController, installGestureOverlay } from "./gesture.js";
import type { DemoReport, DemoScenario } from "./types.js";
import { joinUrl, waitForHttp } from "./utils.js";

export async function recordScenario(scenario: DemoScenario, options: { root: string }): Promise<DemoReport> {
  const root = options.root;
  const outputPath = defaultOutputPath(root, scenario);
  const takesDir = resolve(root, "dist/demo/takes");
  const rawTakePath = resolve(takesDir, `${scenario.name}.raw.mp4`);
  const frameSheetPath = outputPath.replace(/\.mp4$/i, ".frames.jpg");
  const reportPath = outputPath.replace(/\.mp4$/i, ".report.json");
  await mkdir(takesDir, { recursive: true });

  const server = await startServerIfNeeded(scenario, root);
  const browser = await chromium.launch();
  const stepTimings: Array<{ label: string; durationMs: number }> = [];
  try {
    const viewport = scenario.viewport ?? { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true };
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor ?? 3,
      isMobile: viewport.isMobile ?? true,
      hasTouch: viewport.hasTouch ?? true,
      locale: "en-US",
      timezoneId: "America/New_York",
      colorScheme: "light",
      reducedMotion: "no-preference",
      recordVideo: { dir: takesDir, size: { width: viewport.width, height: viewport.height } },
    });
    const page = await context.newPage();
    if (scenario.format?.cursor === "hidden") {
      await page.addStyleTag({ content: "* { cursor: none !important; }" });
    }
    const appUrl = joinUrl(scenario.server.url, scenario.startUrl);
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await installGestureOverlay(page);
    const demo = createDemoClient(page, root);
    const gesture = createGestureController(page);
    const contextArg = { page, gesture, demo, expect };
    await timeStep(stepTimings, "setup", () => scenario.setup?.(contextArg));
    await timeStep(stepTimings, "steps", () => scenario.steps(contextArg));
    const video = page.video();
    await context.close();
    if (!video) throw new Error("Playwright did not produce a raw take.");
    await video.saveAs(rawTakePath);
    await composeFinal(rawTakePath, outputPath, scenario);
    const inspection = await inspectVideo(outputPath);
    assertVideoMatches(inspection, scenario);
    await generateFrameSheet(outputPath, frameSheetPath);
    const report: DemoReport = {
      ...inspection,
      scenario: scenario.name,
      appUrl,
      rawTakePath,
      frameSheetPath,
      outputPath,
      stepTimings,
    };
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    await browser.close();
    server?.kill("SIGTERM");
  }
}

async function startServerIfNeeded(scenario: DemoScenario, root: string): Promise<ChildProcess | undefined> {
  const readyUrl = joinUrl(scenario.server.url, scenario.server.readyPath ?? scenario.startUrl);
  if (scenario.server.reuseExisting || !scenario.server.command) {
    await waitForHttp(readyUrl, scenario.server.timeoutMs);
    return undefined;
  }
  const [command, ...args] = scenario.server.command.split(" ");
  const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: process.env });
  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  await waitForHttp(readyUrl, scenario.server.timeoutMs);
  return child;
}

async function timeStep(
  stepTimings: Array<{ label: string; durationMs: number }>,
  label: string,
  callback: () => Promise<void> | void,
) {
  const startedAt = Date.now();
  await callback();
  stepTimings.push({ label, durationMs: Date.now() - startedAt });
}
