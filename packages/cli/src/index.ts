#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
  if (!command || command === "--help" || command === "-h") {
    printHelp();
  } else if (command === "install-skill") {
    await installSkill(args);
  } else if (command === "init") {
    await initDemo(args);
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
    await doctorProject(args[0] ?? "demo/main.demo.ts");
  } else {
    printHelp();
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

type SkillTarget = "global" | "project" | "none";
type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

async function initDemo(args: string[]) {
  const options = parseInitOptions(args);
  const packageJsonPath = resolve(process.cwd(), "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;
  packageJson.scripts = {
    ...packageJson.scripts,
    "demo:doctor": "demo-director doctor demo/main.demo.ts",
    "demo:record": "demo-director record demo/main.demo.ts",
    "demo:inspect": "demo-director inspect dist/demo/main.mp4",
  };
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    "@faka/demo-director": "github:faka/agentic-demo-director",
  };
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  if (options.skill !== "none") {
    await installSkill([`--${options.skill}`]);
  }

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
    duration: { min: 1, max: 45 },
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

  const packageManager = await detectPackageManager(process.cwd());
  if (options.install) {
    console.log(`Installing dependencies with ${packageManager}...`);
    await runInstall(packageManager, process.cwd());
  } else {
    console.log(`Skipped install. Run: ${installCommand(packageManager)}`);
  }
}

async function installSkill(args: string[]) {
  const target = parseSkillTarget(args);
  if (target === "none") return;

  const source = resolve(packageRoot(), "skills/demo-director/SKILL.md");
  const destination =
    target === "global"
      ? resolve(homedir(), ".codex/skills/demo-director/SKILL.md")
      : resolve(process.cwd(), ".codex/skills/demo-director/SKILL.md");

  const content = await readFile(source, "utf8");
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content);
  console.log(`Installed demo-director skill to ${destination}`);
  if (target === "global") {
    console.log("Restart Codex to pick up new skills.");
  }
}

async function doctorProject(scenarioPath: string) {
  const checks: Array<{ name: string; run: () => Promise<void>; fix: string }> = [
    {
      name: "package.json",
      run: async () => {
        await readPackageJson();
      },
      fix: "Run this from an app project root that has package.json.",
    },
    {
      name: "package scripts",
      run: async () => {
        const packageJson = await readPackageJson();
        const scripts = packageJson.scripts ?? {};
        for (const script of ["demo:doctor", "demo:record", "demo:inspect"]) {
          if (!scripts[script]) throw new Error(`Missing npm script: ${script}`);
        }
      },
      fix: "Run: npx github:faka/agentic-demo-director init --skill none",
    },
    {
      name: "@faka/demo-director dependency",
      run: async () => {
        const packageJson = await readPackageJson();
        const version =
          packageJson.dependencies?.["@faka/demo-director"] ?? packageJson.devDependencies?.["@faka/demo-director"];
        if (!version) throw new Error("Missing @faka/demo-director dependency.");
      },
      fix: "Run: npx github:faka/agentic-demo-director init --skill none",
    },
    {
      name: "ffmpeg and ffprobe",
      run: doctorBinaries,
      fix: "Install ffmpeg. macOS: brew install ffmpeg. Ubuntu: sudo apt-get install ffmpeg.",
    },
    {
      name: "Playwright package",
      run: async () => {
        const requireFromProject = createRequire(resolve(process.cwd(), "package.json"));
        requireFromProject.resolve("@playwright/test/package.json");
      },
      fix: "Run: npm install -D @faka/demo-director@github:faka/agentic-demo-director",
    },
    {
      name: "Playwright Chromium browser",
      run: async () => {
        const { chromium } = await import("@playwright/test");
        const browser = await chromium.launch();
        await browser.close();
      },
      fix: "Run: npx playwright install chromium",
    },
    {
      name: "demo scenario",
      run: async () => {
        const absoluteScenarioPath = resolve(process.cwd(), scenarioPath);
        const scenario = await loadScenario(absoluteScenarioPath);
        validateScenario(scenario);
      },
      fix: "Create demo/main.demo.ts or run: npx github:faka/agentic-demo-director init --skill none",
    },
  ];

  const failures: Array<{ name: string; message: string; fix: string }> = [];
  for (const check of checks) {
    try {
      await check.run();
      console.log(`ok ${check.name}`);
    } catch (error) {
      failures.push({
        name: check.name,
        message: error instanceof Error ? error.message : String(error),
        fix: check.fix,
      });
      console.log(`fail ${check.name}`);
    }
  }

  if (failures.length) {
    console.error("\nDemo Director doctor found issues:");
    for (const failure of failures) {
      console.error(`\n${failure.name}: ${failure.message}`);
      console.error(`Fix: ${failure.fix}`);
    }
    process.exit(1);
  }

  console.log("Demo Director doctor ok");
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

function parseInitOptions(args: string[]) {
  let skill: SkillTarget = "project";
  let install = true;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--no-install") {
      install = false;
    } else if (arg === "--skill") {
      skill = parseSkillValue(args[index + 1]);
      index += 1;
    } else if (arg.startsWith("--skill=")) {
      skill = parseSkillValue(arg.slice("--skill=".length));
    } else {
      throw new Error(`Unknown init option: ${arg}`);
    }
  }
  return { skill, install };
}

function parseSkillTarget(args: string[]): SkillTarget {
  if (args.includes("--project")) return "project";
  if (args.includes("--global")) return "global";
  return "global";
}

function parseSkillValue(value: string | undefined): SkillTarget {
  if (value === "global" || value === "project" || value === "none") return value;
  throw new Error("Expected --skill global, --skill project, or --skill none.");
}

async function detectPackageManager(root: string): Promise<PackageManager> {
  if (await pathExists(resolve(root, "pnpm-lock.yaml"))) return "pnpm";
  if (await pathExists(resolve(root, "yarn.lock"))) return "yarn";
  if ((await pathExists(resolve(root, "bun.lockb"))) || (await pathExists(resolve(root, "bun.lock")))) return "bun";
  return "npm";
}

function installCommand(packageManager: PackageManager) {
  if (packageManager === "pnpm") return "pnpm install";
  if (packageManager === "yarn") return "yarn install";
  if (packageManager === "bun") return "bun install";
  return "npm install";
}

function runInstall(packageManager: PackageManager, cwd: string) {
  const [installBinary, ...installArgs] = installCommand(packageManager).split(" ");
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(installBinary, installArgs, { cwd, stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${installCommand(packageManager)} failed with ${code}`));
    });
  });
}

async function readPackageJson() {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  return JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function packageRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

function requiredArg(value: string | undefined, usage: string) {
  if (!value) throw new Error(usage);
  return value;
}

function printHelp() {
  console.log(`demo-director

Commands:
  install-skill [--global|--project]
  init [--skill global|project|none] [--no-install]
  record <scenario>
  inspect <video>
  doctor [scenario]
`);
}
