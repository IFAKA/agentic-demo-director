import { pathToFileURL } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import type { DemoScenario } from "./types.js";

export function defineDemo(scenario: DemoScenario) {
  return scenario;
}

export async function loadScenario(path: string): Promise<DemoScenario> {
  const importPath = path.endsWith(".ts") ? await transpileScenario(path) : path;
  const module = (await import(pathToFileURL(importPath).href)) as { default?: DemoScenario };
  if (!module.default) throw new Error(`Scenario ${path} must export a default defineDemo(...) value.`);
  validateScenario(module.default);
  return module.default;
}

export function validateScenario(scenario: DemoScenario) {
  if (!scenario.name) throw new Error("Scenario is missing name.");
  if (!scenario.startUrl) throw new Error(`${scenario.name} is missing startUrl.`);
  if (!scenario.server?.url) throw new Error(`${scenario.name} is missing server.url.`);
  if (typeof scenario.steps !== "function") throw new Error(`${scenario.name} is missing steps function.`);
}

async function transpileScenario(path: string) {
  const source = await readFile(path, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: path,
  });
  const outputPath = resolve(process.cwd(), ".demo-director-cache", `${basenameWithoutTs(path)}.${Date.now()}.mjs`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, transpiled.outputText);
  return outputPath;
}

function basenameWithoutTs(path: string) {
  return path.split(/[\\/]/).pop()?.replace(/\.ts$/, "") ?? "scenario";
}
