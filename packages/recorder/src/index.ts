export { defineDemo, loadScenario, validateScenario } from "./loader.js";
export { recordScenario } from "./recorder.js";
export { doctorBinaries, inspectVideo, generateFrameSheet, assertVideoMatches } from "./ffmpeg.js";
export type {
  DemoContext,
  DemoHooksClient,
  DemoReport,
  DemoScenario,
  DragOptions,
  GestureController,
  TapOptions,
  VideoInspection,
} from "./types.js";
