# Agentic Demo Director

A local demo-generation toolkit for turning app scenarios into deterministic product videos.

## Commands

```bash
npm install
npm run build
npm run demo-director -- doctor
npm run demo-director -- record ../idlediary/demo/main.demo.ts
npm run demo-director -- inspect ../idlediary/dist/demo/main.mp4
```

The CLI can also be linked into an app repo with:

```bash
npm install --save-dev ../agentic-demo-director/packages/cli
```

## Project Shape

- `packages/cli`: `demo-director` executable.
- `packages/recorder`: scenario API, Playwright automation, ffmpeg pipeline, reports.
- `packages/app-sdk`: demo-only browser hooks for app state, readiness, and overlays.
- `skills/demo-director`: Codex workflow for recording and tuning reusable demos.

