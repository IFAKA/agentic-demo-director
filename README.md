# Agentic Demo Director

Agentic Demo Director records deterministic product-demo videos from reusable TypeScript scenarios. It lets an agent or developer describe a demo once, then rerun it reliably with Playwright, ffmpeg, ffprobe, app demo hooks, and a gesture overlay.

This repo is distributed from GitHub for the current v1 flow. Install the Codex skill once per machine, then use it from any app project.

## Natural-Language Workflow

The main point is that the user should be able to ask for a demo in plain English:

```text
make the demo video
make the delete slower
hold success longer
end on the videos list
make it 4x5
```

The agent translates those requests into small deterministic edits in `demo/main.demo.ts`, then reruns the recorder and validates the output. The browser is not hand-piloted as a one-off performance; the scenario becomes reusable project code.

## What It Does

- Starts or connects to your app dev server.
- Opens a fresh Playwright browser context with stable mobile defaults.
- Runs a typed scenario file such as `demo/main.demo.ts`.
- Shows polished tap and drag gestures without app-specific animation code.
- Records a raw browser take.
- Composes a social video with ffmpeg.
- Validates dimensions, fps, codec, audio, and duration with ffprobe.
- Generates a contact sheet and JSON report for inspection.

Default output:

```text
dist/demo/main.mp4
dist/demo/main.frames.jpg
dist/demo/main.report.json
dist/demo/takes/
```

## Requirements

- Node.js 20 or newer
- npm
- Playwright browsers installed in the app repo
- `ffmpeg`
- `ffprobe`

On macOS:

```bash
brew install ffmpeg
npx playwright install chromium
```

## Recommended Setup

Install the Codex skill once per machine:

```bash
npx github:faka/agentic-demo-director install-skill
```

Restart Codex to pick up the new skill. After that, ask from inside any app project:

```text
create demo video
```

If `demo/main.demo.ts` is missing, the skill initializes the project with:

```bash
npx github:faka/agentic-demo-director init --skill none
```

## First Demo

Manual project initialization is also available:

```bash
npx github:faka/agentic-demo-director init --skill none
```

This adds `@faka/demo-director`, creates starter files, and adds package scripts:

```text
demo/
  main.demo.ts
  fixtures.ts
  demo.config.ts
```

Then edit `demo/main.demo.ts` to match your app:

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
  steps: async ({ page, gesture, expect }) => {
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    await gesture.tap(page.getByRole("button", { name: "Start" }));
    await expect(page.getByText("Success")).toBeVisible();
    await gesture.wait(1500);
  },
});
```

Run the demo:

```bash
npm run demo:doctor
npm run demo:record
npm run demo:inspect
```

Inspect the generated frame sheet before shipping:

```text
dist/demo/main.frames.jpg
```

## Scenario API

Scenario callbacks receive:

- `page`: Playwright page
- `gesture`: visible tap, click, drag, type, and wait helpers
- `demo`: optional app hooks for reset, seed, readiness, debug hiding, and screenshots
- `expect`: Playwright assertions

Use role, label, text, and `data-testid` selectors. Prefer `demo.ready("key")` over arbitrary waits when the app can expose readiness signals.

## Optional App Hooks

Apps can expose demo-only hooks through `@faka/demo-director-app-sdk`:

```ts
import { installDemoHooks } from "@faka/demo-director-app-sdk";

installDemoHooks({
  enabled: new URLSearchParams(window.location.search).get("demo") === "1",
  allowedSeeds: ["happy-path"],
  allowedReadyKeys: ["home-loaded"],
  reset: () => {
    localStorage.clear();
    sessionStorage.clear();
  },
  seed: async (name) => {
    if (name === "happy-path") {
      // Load deterministic fixtures.
    }
  },
  ready: async (key) => {
    if (key === "home-loaded") return;
  },
  disableDebug: () => {
    document.documentElement.dataset.demoDebugDisabled = "true";
  },
});
```

Never expose demo hooks in normal production behavior. Gate them behind query params, a demo route, or a demo environment flag.

## Commands

```bash
demo-director install-skill
demo-director install-skill --project
demo-director init --skill global|project|none
demo-director doctor demo/main.demo.ts
demo-director record demo/main.demo.ts
demo-director inspect dist/demo/main.mp4
```

For this repo:

```bash
npm install
npm run build
npm run demo-director -- doctor
```

## IdleDiary Example

IdleDiary is the first real integration. From `/Users/faka/code/projects/mobile/idlediary`:

```bash
npm run demo:record
```

The scenario records the launch flow, edits draft clips, generates a video, and ends on the videos list. The verified output is `1080x1350`, `30fps`, and roughly 31 seconds.

## Project Shape

- `packages/cli`: `demo-director` executable and public scenario exports.
- `packages/recorder`: scenario loader, Playwright automation, ffmpeg pipeline, reports.
- `packages/app-sdk`: demo-only browser hooks.
- `skills/demo-director`: Codex workflow for recording and tuning reusable demos.
- `examples/next-app`: starter scenario for a Next.js app.

## Current Status

This is a working GitHub-first v1, not a stable npm-published API. The next hardening steps are repeated app integrations, richer readiness hooks, and blank-frame checks.
