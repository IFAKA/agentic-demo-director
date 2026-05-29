#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  doctorBinaries,
  generateFrameSheet,
  inspectVideo,
  loadScenario,
  recordScenario,
  validateScenario,
} from "@faka/demo-director-recorder";

const [, , command, ...args] = process.argv;

try {
  if (command === "init") {
    await initDemo();
  } else if (command === "record") {
    const scenarioPath = requiredArg(args[0], "Usage: demo-director record demo/main.demo.ts");
    const absoluteScenarioPath = resolve(process.cwd(), scenarioPath);
    const scenario = await loadScenario(absoluteScenarioPath);
    const report = await recordScenario(scenario, { root: process.cwd() });
    console.log(`Recorded ${report.outputPath}`);
    console.log(`${report.width}x${report.height} ${report.fps.toFixed(2)}fps ${report.duration.toFixed(2)}s`);
  } else if (command === "inspect") {
    const videoPath = requiredArg(args[0], "Usage: demo-director inspect dist/demo/main.mp4");
    const absoluteVideoPath = resolve(process.cwd(), videoPath);
    const inspection = await inspectVideo(absoluteVideoPath);
    const frameSheet = absoluteVideoPath.replace(/\.mp4$/i, ".frames.jpg");
    await generateFrameSheet(absoluteVideoPath, frameSheet);
    console.log(JSON.stringify({ ...inspection, frameSheet }, null, 2));
  } else if (command === "doctor") {
    await doctorBinaries();
    if (args[0]) {
      const scenario = await loadScenario(resolve(process.cwd(), args[0]));
      validateScenario(scenario);
      console.log(`Scenario ok: ${scenario.name}`);
    }
    console.log("ffmpeg ok");
    console.log("ffprobe ok");
    console.log("Playwright package ok");
  } else {
    printHelp();
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

async function initDemo() {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  packageJson.scripts = {
    ...packageJson.scripts,
    "demo:record": "demo-director record demo/main.demo.ts",
    "demo:inspect": "demo-director inspect dist/demo/main.mp4",
    "demo:doctor": "demo-director doctor demo/main.demo.ts",
  };
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    "@faka/demo-director": "file:../agentic-demo-director/packages/cli",
  };
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await mkdir(resolve(process.cwd(), "demo"), { recursive: true });
  await writeStarterFile(
    "demo/main.demo.ts",
    `import { defineDemo } from "@faka/demo-director";

export default defineDemo({
  name: "main",
  startUrl: "/",
  output: "dist/demo/main.mp4",
  server: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
  },
  format: {
    width: 1080,
    height: 1350,
    fps: 30,
    duration: { min: 10, max: 45 },
    crop: "social-4x5",
    cursor: "hidden",
    browserChrome: false,
  },
  steps: async ({ page, gesture, expect }) => {
    await expect(page.locator("body")).toBeVisible();
    await gesture.wait(2000);
  },
});
`,
  );
  await writeStarterFile("demo/fixtures.ts", "export const fixtures = {};\n");
  await writeStarterFile(
    "demo/demo.config.ts",
    `export default {
  outputDir: "dist/demo",
};
`,
  );
  console.log("Created demo starter files and package scripts.");
}

async function writeStarterFile(path: string, content: string) {
  const absolute = resolve(process.cwd(), path);
  await mkdir(dirname(absolute), { recursive: true });
  try {
    await readFile(absolute, "utf8");
  } catch {
    await writeFile(absolute, content);
  }
}

function requiredArg(value: string | undefined, usage: string) {
  if (!value) throw new Error(usage);
  return value;
}

function printHelp() {
  console.log(`demo-director

Commands:
  init
  record <scenario>
  inspect <video>
  doctor [scenario]
`);
}
