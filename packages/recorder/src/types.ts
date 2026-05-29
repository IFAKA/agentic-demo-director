import type { Expect, Locator, Page } from "@playwright/test";

export type CropPreset = "social-4x5" | "fit" | "fill";

export interface DemoScenario {
  name: string;
  startUrl: string;
  output?: string;
  server: {
    command?: string;
    url: string;
    reuseExisting?: boolean;
    readyPath?: string;
    timeoutMs?: number;
  };
  viewport?: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
    isMobile?: boolean;
    hasTouch?: boolean;
  };
  format?: {
    width?: number;
    height?: number;
    fps?: number;
    duration?: { min?: number; max?: number };
    crop?: CropPreset;
    cursor?: "hidden" | "visible";
    browserChrome?: boolean;
  };
  setup?: (context: DemoContext) => Promise<void> | void;
  steps: (context: DemoContext) => Promise<void> | void;
}

export interface DemoContext {
  page: Page;
  gesture: GestureController;
  demo: DemoHooksClient;
  expect: Expect;
}

export interface GestureController {
  tap(locator: Locator, options?: TapOptions): Promise<void>;
  click(locator: Locator, options?: TapOptions): Promise<void>;
  drag(options: DragOptions): Promise<void>;
  type(locator: Locator, text: string, options?: { afterMs?: number }): Promise<void>;
  wait(ms: number): Promise<void>;
}

export interface TapOptions {
  beforeMs?: number;
  afterMs?: number;
  xRatio?: number;
  yRatio?: number;
}

export interface DragOptions {
  from: Locator;
  to: Locator;
  holdMs?: number;
  durationMs?: number;
  releaseMs?: number;
  preset?: "drag-to-delete" | "default";
}

export interface DemoHooksClient {
  reset(): Promise<void>;
  seed(name: string, payload?: unknown): Promise<void>;
  ready(key: string, timeoutMs?: number): Promise<void>;
  disableDebug(): Promise<void>;
  screenshotFrame(name: string): Promise<void>;
}

export interface VideoInspection {
  path: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  hasAudio: boolean;
}

export interface DemoReport extends VideoInspection {
  scenario: string;
  appUrl: string;
  rawTakePath: string;
  frameSheetPath: string;
  outputPath: string;
  stepTimings: Array<{ label: string; durationMs: number }>;
}
