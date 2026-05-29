import { defineDemo } from "@faka/demo-director";

export default defineDemo({
  name: "main",
  startUrl: "/?demo=1",
  output: "dist/demo/main.mp4",
  server: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
  },
  format: {
    width: 1080,
    height: 1350,
    fps: 30,
    duration: { min: 10, max: 45 },
    crop: "social-4x5",
    cursor: "hidden",
    browserChrome: false,
  },
  steps: async ({ page, gesture, expect }) => {
    await expect(page.locator("body")).toBeVisible();
    await gesture.wait(2000);
  },
});
