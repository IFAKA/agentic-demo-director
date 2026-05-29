const workbench = document.querySelector(".demo-workbench");
const steps = Array.from(document.querySelectorAll(".demo-step"));
const dots = Array.from(document.querySelectorAll(".demo-progress span"));
const title = document.querySelector("[data-demo-title]");
const status = document.querySelector("[data-demo-status]");
const video = document.querySelector(".output-step video");

const labels = [
  ["Terminal", "typing"],
  ["Scenario", "writing"],
  ["Tweak", "patching"],
  ["Recorder", "running"],
  ["Output", "done"],
];

const streams = [
  [
    ["request", "make the launch demo video"],
    ["request-detail", "Show recording, delete one clip, generate, and end on videos."],
    ["planning", "Planning route, stable selectors, fixture media, gestures, and final validation..."],
  ],
  [
    [
      "scenario",
      `export default defineDemo({
  startUrl: "/demo/launch?scene=intro",
  output: "dist/demo/main.mp4",
  steps: async ({ page, gesture, expect }) => {
    await gesture.tap(startRecording)
    await gesture.drag(deleteClip)
    await expect(videosList).toBeVisible()
  }
})`,
    ],
  ],
  [
    ["tweak", "make the delete slower"],
    [
      "patch",
      `- await gesture.drag(deleteClip)
+ await gesture.drag(deleteClip, {
+   durationMs: 950,
+   holdMs: 320
+ })`,
    ],
  ],
  [
    ["record-1", "start dev server and open a fresh browser context"],
    ["record-2", "run scenario with tap and drag overlay"],
    ["record-3", "compose final 4x5 MP4 with ffmpeg"],
    ["record-4", "validate 1080x1350, 30fps, duration, report"],
  ],
  [],
];

const holdDurations = [1300, 1800, 1700, 1900, 0];
let currentStep = 0;
let timer;
let runId = 0;

workbench?.addEventListener("click", () => {
  playFromStart();
});

playFromStart();

async function playFromStart() {
  runId += 1;
  const activeRun = runId;
  window.clearTimeout(timer);
  currentStep = 0;
  clearStreams();
  renderStep();
  await runCurrentStep(activeRun);
}

async function runCurrentStep(activeRun) {
  if (activeRun !== runId) return;
  await streamStep(currentStep, activeRun);
  if (activeRun !== runId) return;
  if (currentStep >= steps.length - 1) return;
  timer = window.setTimeout(async () => {
    currentStep += 1;
    renderStep();
    await runCurrentStep(activeRun);
  }, holdDurations[currentStep]);
}

async function streamStep(stepIndex, activeRun) {
  const entries = streams[stepIndex] ?? [];
  for (const [target, text] of entries) {
    await typeInto(target, text, activeRun);
    markRunDot(target);
    if (activeRun !== runId) return;
    await wait(260);
  }
}

async function typeInto(targetName, text, activeRun) {
  const element = document.querySelector(`[data-stream="${targetName}"]`);
  if (!element) return;
  element.textContent = "";
  for (const char of text) {
    if (activeRun !== runId) return;
    element.textContent += char;
    await wait(char === "\n" ? 80 : 22);
  }
}

function renderStep() {
  steps.forEach((step, index) => step.classList.toggle("is-active", index === currentStep));
  dots.forEach((dot, index) => dot.classList.toggle("is-active", index === currentStep));
  if (title && status) {
    title.textContent = labels[currentStep][0];
    status.textContent = labels[currentStep][1];
  }
  if (video) {
    if (currentStep === steps.length - 1) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }
}

function clearStreams() {
  document.querySelectorAll("[data-stream]").forEach((element) => {
    element.textContent = "";
  });
  document.querySelectorAll("[data-run-dot]").forEach((element) => {
    element.classList.remove("is-complete");
  });
}

function markRunDot(targetName) {
  const match = targetName.match(/^record-(\\d)$/);
  if (!match) return;
  const dot = document.querySelector(`[data-run-dot="${Number(match[1]) - 1}"]`);
  dot?.classList.add("is-complete");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
