const workbench = document.querySelector(".demo-workbench");
const replayButton = document.querySelector(".restart-note");
const steps = Array.from(document.querySelectorAll(".demo-step"));
const dots = Array.from(document.querySelectorAll(".demo-progress button"));
const title = document.querySelector("[data-demo-title]");
const status = document.querySelector("[data-demo-status]");
const video = document.querySelector(".output-step video");
const openingScene = document.querySelector("[data-opening-scene]");
const openingStorageKey = "agentic-demo-director-opening-v1";

const labels = [
  ["Terminal request", "typing"],
  ["Scenario editor", "streaming"],
  ["Tweak request", "typing"],
  ["Code changes", "patching"],
  ["Video generation", "running"],
  ["Video player", "done"],
];

const streams = [
  [
    ["request", "demo-director ask \"make the launch demo video\""],
    ["request-detail", "Need: show recording, delete one clip, end on the videos list."],
    ["planning", "Inspecting routes, demo hooks, fixture media, selectors, and final validation..."],
  ],
  [
    [
      "scenario",
      `export default defineDemo({
  startUrl: "/demo/launch?scene=intro",
  output: "dist/demo/main.mp4",
  format: { width: 1080, height: 1350, fps: 30 },
  steps: async ({ page, gesture, expect }) => {
    await gesture.tap(startRecording)
    await gesture.drag(deleteClip)
    await expect(videosList).toBeVisible()
  }
})`,
    ],
  ],
  [
    ["tweak", "demo-director ask \"make the delete slower\""],
    ["tweak-detail", "Need: keep the same story, but make the destructive gesture easier to follow."],
    ["tweak-planning", "Finding the generated gesture and preparing a minimal timing patch..."],
  ],
  [
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
    ["record-3", "record raw take, then compose final 4x5 MP4 with ffmpeg"],
    ["record-4", "validate 1080x1350, 30fps, duration, frame sheet, report"],
  ],
  [],
];

const finalIntroHold = 1800;
const charDelay = 14;
const lineBreakDelay = 52;
const promptCharDelay = 44;
const recognitionDelay = 900;
const wordsPerMinute = 220;
const codeLineAssimilation = 420;
const minimumHold = 1400;
const maximumHold = 4300;
const scenarioGeneratedPause = 900;
let currentStep = 0;
let timer;
let runId = 0;
let introCancelled = false;

replayButton?.addEventListener("click", () => {
  playFromStart();
});

dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    playFromStep(Number(dot.dataset.jumpStep));
  });
});

boot();

async function boot() {
  const shouldPlayOpening =
    openingScene &&
    !hasSeenOpening() &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!shouldPlayOpening) {
    playFromStart();
    return;
  }

  markOpeningSeen();
  introCancelled = false;
  addIntroCancelListeners();
  document.body.classList.add("is-opening");
  window.scrollTo({ top: 0, behavior: "auto" });
  await playOpeningSplash();
  if (introCancelled) return;
  await transitionToMicrodemo();
}

async function playFromStart(options = {}) {
  await playFromStep(0, options);
}

async function playFromStep(stepIndex, options = {}) {
  runId += 1;
  const activeRun = runId;
  window.clearTimeout(timer);
  currentStep = clampStep(stepIndex);
  clearStreams();
  renderStep();
  await runCurrentStep(activeRun, options);
}

async function runCurrentStep(activeRun, options = {}) {
  if (activeRun !== runId) return;
  await streamStep(currentStep, activeRun);
  if (activeRun !== runId) return;
  await wait(getPostStreamPause(currentStep));
  if (activeRun !== runId) return;
  if (currentStep >= steps.length - 1) {
    if (options.onComplete) {
      timer = window.setTimeout(() => {
        if (activeRun === runId) options.onComplete();
      }, finalIntroHold);
    }
    return;
  }
  timer = window.setTimeout(async () => {
    currentStep += 1;
    renderStep();
    await runCurrentStep(activeRun, options);
  }, getStepHoldDuration(currentStep));
}

async function playOpeningSplash() {
  await wait(480);
  if (introCancelled) return;
  openingScene?.classList.add("is-revealed");
  await wait(1320);
  if (introCancelled) return;
  openingScene?.classList.add("is-settling");
  await wait(500);
}

async function transitionToMicrodemo() {
  document.body.classList.add("is-intro-microdemo");
  openingScene?.classList.add("is-done");
  await wait(120);
  if (introCancelled) return;
  playFromStart({
    onComplete: () => {
      if (introCancelled) return;
      document.body.classList.remove("is-intro-microdemo");
      removeIntroCancelListeners();
    },
  });
  await wait(420);
  if (introCancelled) return;
  document.body.classList.remove("is-opening");
}

async function cancelIntro() {
  if (!document.body.classList.contains("is-opening") && !document.body.classList.contains("is-intro-microdemo")) {
    return;
  }

  introCancelled = true;
  window.clearTimeout(timer);
  runId += 1;
  openingScene?.classList.add("is-done");
  document.body.classList.remove("is-opening", "is-intro-microdemo");
  removeIntroCancelListeners();
  await playFromStart();
}

function addIntroCancelListeners() {
  openingScene?.addEventListener("click", cancelIntro);
  document.addEventListener("click", cancelIntro);
  document.addEventListener("keydown", handleIntroKeydown);
}

function removeIntroCancelListeners() {
  openingScene?.removeEventListener("click", cancelIntro);
  document.removeEventListener("click", cancelIntro);
  document.removeEventListener("keydown", handleIntroKeydown);
}

function handleIntroKeydown(event) {
  if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
    cancelIntro();
  }
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
  const streamCharDelay = isPromptStream(targetName) ? promptCharDelay : charDelay;
  renderStreamText(element, targetName, "");
  for (const char of text) {
    if (activeRun !== runId) return;
    renderStreamText(element, targetName, element.dataset.rawText + char);
    await wait(char === "\n" ? lineBreakDelay : streamCharDelay);
  }
}

function isPromptStream(targetName) {
  return targetName === "request" || targetName === "tweak";
}

function renderStreamText(element, targetName, text) {
  element.dataset.rawText = text;

  if (targetName !== "patch") {
    element.textContent = text;
    return;
  }

  element.innerHTML = text
    .split("\n")
    .map((line) => {
      const kind = line.startsWith("-") ? " is-delete" : line.startsWith("+") ? " is-add" : "";
      return `<span class="git-line${kind}">${escapeHtml(line) || "&nbsp;"}</span>`;
    })
    .join("");
}

function renderStep() {
  steps.forEach((step, index) => step.classList.toggle("is-active", index === currentStep));
  dots.forEach((dot, index) => dot.classList.toggle("is-active", index === currentStep));
  dots.forEach((dot, index) => dot.setAttribute("aria-current", index === currentStep ? "step" : "false"));
  workbench?.classList.toggle("is-output", currentStep === steps.length - 1);
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

function getStepHoldDuration(stepIndex) {
  if (stepIndex >= steps.length - 1) return 0;
  const text = (streams[stepIndex] ?? []).map(([, value]) => value).join("\n");
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const lineCount = text.split("\n").filter(Boolean).length;
  const readingMs = (wordCount / wordsPerMinute) * 60_000;
  const codeMs = lineCount * codeLineAssimilation;
  const contentMs = steps[stepIndex]?.classList.contains("editor-step") ? Math.max(readingMs, codeMs) : readingMs;
  return Math.min(maximumHold, Math.max(minimumHold, Math.round(recognitionDelay + contentMs)));
}

function getPostStreamPause(stepIndex) {
  return stepIndex === 1 ? scenarioGeneratedPause : 0;
}

function clampStep(stepIndex) {
  if (!Number.isFinite(stepIndex)) return 0;
  return Math.min(steps.length - 1, Math.max(0, stepIndex));
}

function clearStreams() {
  document.querySelectorAll("[data-stream]").forEach((element) => {
    renderStreamText(element, element.dataset.stream, "");
  });
  document.querySelectorAll("[data-run-dot]").forEach((element) => {
    element.classList.remove("is-complete");
  });
}

function markRunDot(targetName) {
  const match = targetName.match(/^record-(\d)$/);
  if (!match) return;
  const dot = document.querySelector(`[data-run-dot="${Number(match[1]) - 1}"]`);
  dot?.classList.add("is-complete");
}

function hasSeenOpening() {
  try {
    return window.sessionStorage.getItem(openingStorageKey) === "seen";
  } catch {
    return false;
  }
}

function markOpeningSeen() {
  try {
    window.sessionStorage.setItem(openingStorageKey, "seen");
  } catch {
    // Session storage can be unavailable in hardened browser contexts.
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
