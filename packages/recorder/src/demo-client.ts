import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import type { DemoHooksClient } from "./types.js";

export function createDemoClient(page: Page, root: string): DemoHooksClient {
  return {
    reset: () => callDemoHook(page, "reset"),
    seed: (name, payload) => callDemoHook(page, "seed", name, payload),
    ready: (key, timeoutMs) => waitForDemoReady(page, key, timeoutMs),
    disableDebug: () => callDemoHook(page, "disableDebug"),
    screenshotFrame: async (name) => {
      const dir = resolve(root, "dist/demo/frames");
      await mkdir(dir, { recursive: true });
      await page.screenshot({ path: resolve(dir, `${name}.png`) });
    },
  };
}

async function callDemoHook(page: Page, method: "reset" | "seed" | "disableDebug", ...args: unknown[]) {
  await page.evaluate(
    async ({ hookMethod, hookArgs }) => {
      const demo = window.__demo;
      if (!demo || typeof demo[hookMethod] !== "function") {
        throw new Error(`window.__demo.${hookMethod} is not installed`);
      }
      await demo[hookMethod](...hookArgs);
    },
    { hookMethod: method, hookArgs: args },
  );
}

async function waitForDemoReady(page: Page, key: string, timeoutMs = 10_000) {
  await page.waitForFunction(
    async (readyKey) => {
      if (!window.__demo?.ready) throw new Error("window.__demo.ready is not installed");
      await window.__demo.ready(readyKey);
      return true;
    },
    key,
    { timeout: timeoutMs },
  );
}

declare global {
  interface Window {
    __demo?: {
      reset?: (...args: unknown[]) => Promise<void> | void;
      seed?: (...args: unknown[]) => Promise<void> | void;
      ready?: (key: string) => Promise<void> | void;
      disableDebug?: (...args: unknown[]) => Promise<void> | void;
    };
  }
}
