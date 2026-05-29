---
name: demo-director
description: Record deterministic app demo videos from reusable TypeScript scenarios. Use for requests like "make the demo video", "record product demo", "make launch video", "demo recording", or "generate app walkthrough".
---

# Demo Director

Use this skill when the user wants an app demo video generated or tuned.

## Workflow

1. Inspect the app structure, framework, package manager, routes, and existing `demo/*.demo.ts` files.
2. If a scenario exists, reuse it. Do not freestyle browser actions every run.
3. If missing, initialize a minimal setup with `demo-director init`, then edit the generated scenario.
4. Prefer stable selectors by role, label, text, or `data-testid`.
5. Prefer app demo hooks over arbitrary waits:
   - `demo.reset()`
   - `demo.seed(name)`
   - `demo.ready(key)`
   - `demo.disableDebug()`
6. Keep hooks demo-only. Gate them behind `?demo=1`, route-specific demo mode, or a public demo env flag. Never expose demo hooks in normal production behavior.
7. Use `gesture.tap` and `gesture.drag` for visible touch interactions. Do not hand-author one-off gesture animations in scenarios.
8. Run the recorder:
   - `npm run demo:record`
   - or `demo-director record demo/main.demo.ts`
9. Validate with `demo-director inspect dist/demo/main.mp4`.
10. Inspect `dist/demo/main.frames.jpg` before declaring the demo complete.
11. Treat natural-language tweaks as deterministic scenario/config edits, then rerun and revalidate.
12. Stage explicit files only. Never use `git add .` or `git add -A`.

## Defaults

- Output: `dist/demo/<name>.mp4`
- Frame sheet: `dist/demo/<name>.frames.jpg`
- Report: `dist/demo/<name>.report.json`
- Viewport: `390x844`, device scale factor `3`, mobile touch enabled
- Final format: `1080x1350`, `30fps`
- Crop: `social-4x5`
- Cursor: hidden
- Browser chrome: hidden
- Gesture preset: mobile polished tap ripple and drag trail

## Scenario Shape

```ts
import { defineDemo } from "@faka/demo-director";

export default defineDemo({
  name: "main",
  startUrl: "/demo/main?demo=1",
  output: "dist/demo/main.mp4",
  server: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
  },
  format: {
    width: 1080,
    height: 1350,
    fps: 30,
    duration: { min: 20, max: 40 },
    crop: "social-4x5",
    cursor: "hidden",
    browserChrome: false,
  },
  setup: async ({ demo }) => {
    await demo.reset();
    await demo.disableDebug();
    await demo.seed("happy-path");
  },
  steps: async ({ page, gesture, demo, expect }) => {
    await demo.ready("home-loaded");
    await gesture.tap(page.getByRole("button", { name: "Start" }));
    await expect(page.getByText("Success")).toBeVisible();
  },
});
```

