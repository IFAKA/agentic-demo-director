import type { Locator, Page } from "@playwright/test";
import type { DragOptions, GestureController, TapOptions } from "./types.js";

export async function installGestureOverlay(page: Page) {
  await page.addStyleTag({
    content: `
      [data-demo-director-overlay] {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483647;
        overflow: hidden;
      }
      .demo-director-ripple {
        position: absolute;
        width: 56px;
        height: 56px;
        margin: -28px 0 0 -28px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.35);
        border: 2px solid rgba(255, 255, 255, 0.92);
        box-shadow: 0 0 22px rgba(0, 0, 0, 0.18);
        animation: demo-director-ripple 760ms ease-out forwards;
      }
      .demo-director-dot {
        position: absolute;
        width: 30px;
        height: 30px;
        margin: -15px 0 0 -15px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.96);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
      }
      .demo-director-trail {
        position: absolute;
        height: 4px;
        border-radius: 999px;
        transform-origin: left center;
        background: linear-gradient(90deg, rgba(255,255,255,0.72), rgba(255,255,255,0.05));
      }
      @keyframes demo-director-ripple {
        0% { transform: scale(0.45); opacity: 0; }
        15% { opacity: 1; }
        100% { transform: scale(1.65); opacity: 0; }
      }
    `,
  });
  await page.evaluate(() => {
    if (document.querySelector("[data-demo-director-overlay]")) return;
    const overlay = document.createElement("div");
    overlay.setAttribute("data-demo-director-overlay", "true");
    document.documentElement.append(overlay);
    window.__demoDirectorGesture = {
      tap(x: number, y: number) {
        const ripple = document.createElement("div");
        ripple.className = "demo-director-ripple";
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        overlay.append(ripple);
        window.setTimeout(() => ripple.remove(), 820);
      },
      drag(points: Array<{ x: number; y: number }>, durationMs: number) {
        if (points.length === 0) return;
        const dot = document.createElement("div");
        dot.className = "demo-director-dot";
        overlay.append(dot);
        const start = points[0];
        const end = points[points.length - 1];
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const trail = document.createElement("div");
        trail.className = "demo-director-trail";
        trail.style.left = `${start.x}px`;
        trail.style.top = `${start.y}px`;
        trail.style.width = `${length}px`;
        trail.style.transform = `rotate(${angle}rad)`;
        overlay.append(trail);
        const startedAt = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - startedAt) / durationMs);
          const index = Math.max(0, Math.min(points.length - 1, Math.floor(progress * (points.length - 1))));
          const point = points[index] ?? end;
          dot.style.left = `${point.x}px`;
          dot.style.top = `${point.y}px`;
          if (progress < 1) requestAnimationFrame(tick);
          else {
            dot.remove();
            window.setTimeout(() => trail.remove(), 250);
          }
        };
        requestAnimationFrame(tick);
      },
    };
  });
}

export function createGestureController(page: Page): GestureController {
  return {
    tap: (locator, options) => tap(page, locator, options),
    click: (locator, options) => tap(page, locator, options),
    drag: (options) => drag(page, options),
    type: async (locator, text, options) => {
      await locator.fill(text);
      if (options?.afterMs) await page.waitForTimeout(options.afterMs);
    },
    wait: (ms) => page.waitForTimeout(ms),
  };
}

async function tap(page: Page, locator: Locator, options: TapOptions = {}) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Tap target is not visible");
  const point = {
    x: box.x + box.width * (options.xRatio ?? 0.5),
    y: box.y + box.height * (options.yRatio ?? 0.5),
  };
  await page.evaluate(({ x, y }) => window.__demoDirectorGesture?.tap(x, y), point);
  await page.waitForTimeout(options.beforeMs ?? 140);
  await locator.click({ force: true });
  await page.waitForTimeout(options.afterMs ?? 650);
}

async function drag(page: Page, options: DragOptions) {
  const sourceBox = await options.from.boundingBox();
  const targetBox = await options.to.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Drag targets are not visible");
  const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  const end = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
  const durationMs = options.durationMs ?? 850;
  const points = interpolate(start, end, 18);
  await page.evaluate(
    ({ points: browserPoints, duration }) => window.__demoDirectorGesture?.drag(browserPoints, duration),
    { points, duration: durationMs },
  );
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(options.holdMs ?? 240);
  for (const point of points.slice(1)) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(durationMs / points.length);
  }
  await page.waitForTimeout(options.releaseMs ?? 160);
  await page.mouse.up();
}

function interpolate(start: { x: number; y: number }, end: { x: number; y: number }, steps: number) {
  return Array.from({ length: steps }, (_, index) => {
    const progress = index / (steps - 1);
    return {
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    };
  });
}

declare global {
  interface Window {
    __demoDirectorGesture?: {
      tap(x: number, y: number): void;
      drag(points: Array<{ x: number; y: number }>, durationMs: number): void;
    };
  }
}
