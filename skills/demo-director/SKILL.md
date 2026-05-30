---
name: demo-director
description: Record deterministic app demo videos from reusable TypeScript scenarios. Use for requests like "make the demo video", "record product demo", "make launch video", "demo recording", or "generate app walkthrough".
---

# Demo Director

Use this skill when the user wants an app demo video generated or tuned.

## Workflow

1. Inspect the app structure, framework, package manager, routes, and existing `demo/*.demo.ts` files.
2. If `demo/main.demo.ts` exists, reuse it and edit it deterministically for the requested demo.
3. If no scenario exists, initialize the project automatically:
   ```bash
   npx github:faka/agentic-demo-director init --skill none
   ```
4. Prefer stable selectors by role, label, text, or `data-testid`.
5. Prefer app demo hooks over arbitrary waits:
   - `demo.reset()`
   - `demo.seed(name)`
   - `demo.ready(key)`
   - `demo.disableDebug()`
6. Keep hooks demo-only. Gate them behind `?demo=1`, route-specific demo mode, or a public demo env flag.
7. Use `gesture.tap` and `gesture.drag` for visible touch interactions.
8. Validate and record through package scripts:
   ```bash
   npm run demo:doctor
   npm run demo:record
   npm run demo:inspect
   ```
9. If `demo:doctor` fails, follow the exact fix instructions printed by the CLI, then rerun it.
10. Inspect `dist/demo/main.frames.jpg` before declaring the demo complete.
11. Treat natural-language tweaks as deterministic scenario/config edits, then rerun and revalidate.
12. Stage explicit files only. Never use `git add .` or `git add -A`.

## Outputs

- Video: `dist/demo/main.mp4`
- Frame sheet: `dist/demo/main.frames.jpg`
- Report: `dist/demo/main.report.json`
