const workbench = document.querySelector(".demo-workbench");
const replayButton = document.querySelector(".restart-note");
const steps = Array.from(document.querySelectorAll(".demo-step"));
const dots = Array.from(document.querySelectorAll(".demo-progress button"));
const title = document.querySelector("[data-demo-title]");
const status = document.querySelector("[data-demo-status]");
const video = document.querySelector(".output-step video");
const openingScene = document.querySelector("[data-opening-scene]");
const installLink = document.querySelector("[data-install-link]");
const installPanel = document.querySelector("[data-install-panel]");
const copyInstallButton = document.querySelector("[data-copy-install]");
const guidedCursor = document.querySelector("[data-guided-cursor]");
const guideTrail = document.querySelector("[data-guide-trail]");
const guideTrailMask = document.querySelector("[data-guide-trail-mask]");
const cursorAttention = document.querySelector("[data-cursor-attention]");
const openingStorageKey = "agentic-demo-director-opening-v1";
const installCommand = "npx github:faka/agentic-demo-director install-skill";

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
    ["request", "create demo video"],
    ["request-detail", "Need: show recording, delete one clip, end on the videos list."],
    ["planning", "Checking demo/main.demo.ts, initializing if missing, then running doctor..."],
  ],
  [
    [
      "scenario",
      `export default defineDemo({
  startUrl: "/demo/launch?scene=intro",
  output: "dist/launch-video/idlediary-launch-4x5.mp4",
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
    ["record-4", "write dist/demo/main.mp4, frame sheet, and report"],
  ],
  [],
];

const finalIntroHold = 1800;
const charDelay = 14;
const lineBreakDelay = 52;
const recordCharDelay = 8;
const promptCharDelay = 44;
const recognitionDelay = 900;
const developerTextReadingWordsPerMinute = 200;
const minimumHold = 1400;
const maximumHold = 4300;
const recordStepHold = 900;
const editorGeneratedPause = 900;
const workbenchTransitionOut = 260;
const workbenchTransitionIn = 320;
let currentStep = 0;
let timer;
let guideTimer;
let guideAnimations = [];
let runId = 0;
let introCancelled = false;
let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

replayButton?.addEventListener("click", () => {
  playFromStart();
});

dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    playFromStep(Number(dot.dataset.jumpStep));
  });
});

installLink?.addEventListener("click", handleInstallClick);
copyInstallButton?.addEventListener("click", handleCopyInstall);
document.addEventListener("pointermove", updateLastPointer, { passive: true });

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
  clearWindowTransition();
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
    await advanceToStep(currentStep + 1, activeRun);
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
  const streamCharDelay = isRecordStream(targetName)
    ? recordCharDelay
    : isPromptStream(targetName)
      ? promptCharDelay
      : charDelay;
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

function isRecordStream(targetName) {
  return targetName.startsWith("record-");
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

async function advanceToStep(nextStep, activeRun) {
  const targetStep = clampStep(nextStep);
  if (activeRun !== runId) return;

  if (prefersReducedMotion() || currentStep === targetStep) {
    currentStep = targetStep;
    renderStep();
    return;
  }

  clearWindowTransition();
  workbench?.classList.add("is-window-exiting");
  await wait(workbenchTransitionOut);
  if (activeRun !== runId) return;

  currentStep = targetStep;
  renderStep();
  workbench?.classList.remove("is-window-exiting");
  workbench?.classList.add("is-window-entering");
  await wait(workbenchTransitionIn);
  if (activeRun !== runId) return;

  clearWindowTransition();
}

function getStepHoldDuration(stepIndex) {
  if (stepIndex >= steps.length - 1 || isEditorStep(stepIndex)) return 0;
  if (steps[stepIndex]?.dataset.step === "4") return recordStepHold;
  const text = (streams[stepIndex] ?? []).map(([, value]) => value).join("\n");
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const readingMs = (wordCount / developerTextReadingWordsPerMinute) * 60_000;
  return Math.min(maximumHold, Math.max(minimumHold, Math.round(recognitionDelay + readingMs)));
}

function getPostStreamPause(stepIndex) {
  return isEditorStep(stepIndex) ? editorGeneratedPause : 0;
}

function isEditorStep(stepIndex) {
  return steps[stepIndex]?.classList.contains("editor-step");
}

function clearWindowTransition() {
  workbench?.classList.remove("is-window-exiting", "is-window-entering");
}

function handleInstallClick(event) {
  const quickStart = document.querySelector("#quick-start");
  if (!quickStart) return;

  event.preventDefault();
  updateLastPointer(event);
  quickStart.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  queueInstallGuide();
}

function queueInstallGuide() {
  window.clearTimeout(guideTimer);
  cancelGuideAnimations();
  installPanel?.classList.remove("is-guiding", "is-copied");
  void installPanel?.offsetWidth;

  if (prefersReducedMotion()) {
    copyInstallButton?.focus({ preventScroll: true });
    installPanel?.classList.add("is-guiding");
    return;
  }

  guideTimer = window.setTimeout(() => {
    waitForScrollSettled(() => startInstallGuide(lastPointer));
  }, 120);
}

async function handleCopyInstall() {
  await copyText(installCommand);
  window.clearTimeout(guideTimer);
  cancelGuideAnimations();
  installPanel?.classList.remove("is-guiding");
  installPanel?.classList.add("is-copied");
  copyInstallButton?.classList.add("is-copied");
  copyInstallButton?.setAttribute("aria-label", "Install command copied");

  window.setTimeout(() => {
    installPanel?.classList.remove("is-copied");
    copyInstallButton?.classList.remove("is-copied");
    copyInstallButton?.setAttribute("aria-label", "Copy install command");
  }, 1900);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.inset = "0 auto auto 0";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
  }
}

function updateLastPointer(event) {
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
  lastPointer = { x: event.clientX, y: event.clientY };
}

function waitForScrollSettled(onSettled) {
  const startedAt = performance.now();
  let previousY = window.scrollY;
  let stableSince = performance.now();

  function check() {
    const now = performance.now();
    const currentY = window.scrollY;
    if (Math.abs(currentY - previousY) > 1) {
      previousY = currentY;
      stableSince = now;
    }

    const hasSettled = now - stableSince > 120;
    const hasWaitedLongEnough = now - startedAt > 180;
    if (hasSettled && hasWaitedLongEnough) {
      onSettled();
      return;
    }

    guideTimer = window.setTimeout(check, 40);
  }

  check();
}

function startInstallGuide(startPoint) {
  if (!copyInstallButton || !installPanel || !guidedCursor || !guideTrail || !guideTrailMask || !cursorAttention) return;
  const buttonRect = copyInstallButton.getBoundingClientRect();
  const endPoint = {
    x: buttonRect.left + buttonRect.width * 0.48,
    y: buttonRect.top + buttonRect.height * 0.54,
  };
  const path = getGuidePath(startPoint, endPoint);
  const pathData = [
    `M ${startPoint.x.toFixed(1)} ${startPoint.y.toFixed(1)}`,
    `C ${path.controlA.x.toFixed(1)} ${path.controlA.y.toFixed(1)}, ${path.controlB.x.toFixed(1)} ${path.controlB.y.toFixed(1)}, ${path.midPoint.x.toFixed(1)} ${path.midPoint.y.toFixed(1)}`,
    `S ${path.controlC.x.toFixed(1)} ${path.controlC.y.toFixed(1)}, ${endPoint.x.toFixed(1)} ${endPoint.y.toFixed(1)}`,
  ].join(" ");
  guideTrail.setAttribute("d", pathData);
  guideTrailMask.setAttribute("d", pathData);
  guidedCursor.querySelector("svg")?.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
  installPanel.classList.add("is-guiding");

  const cursor = guidedCursor.querySelector("span");
  const length = guideTrail.getTotalLength();
  guideTrailMask.style.strokeDasharray = `${length}px`;
  guideTrailMask.style.strokeDashoffset = `${length}px`;
  guideTrail.style.strokeDasharray = "1 11";
  cursorAttention.style.transform = `translate(${startPoint.x}px, ${startPoint.y}px)`;

  const duration = 2150;
  const cueDuration = 420;
  const motionDelay = cueDuration;
  const cueAnimation = cursorAttention.animate(
    [
      { opacity: 0, transform: `translate(${startPoint.x}px, ${startPoint.y}px) scale(0.84)` },
      { opacity: 0.48, transform: `translate(${startPoint.x}px, ${startPoint.y}px) scale(1.08)`, offset: 0.54 },
      { opacity: 0, transform: `translate(${startPoint.x}px, ${startPoint.y}px) scale(1.38)` },
    ],
    {
      duration: cueDuration,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      fill: "both",
    },
  );
  const cursorAnimation = cursor?.animate(buildCursorKeyframes(guideTrail, length), {
    delay: motionDelay,
    duration,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    fill: "both",
  });

  const trailRevealAnimation = guideTrailMask.animate(
    [
      { strokeDashoffset: `${length}px` },
      { strokeDashoffset: `${length * 0.82}px`, offset: 0.18 },
      { strokeDashoffset: `${length * 0.44}px`, offset: 0.58 },
      { strokeDashoffset: `${length * 0.1}px`, offset: 0.84 },
      { strokeDashoffset: "0px", offset: 0.98 },
      { strokeDashoffset: "0px" },
    ],
    {
      delay: motionDelay,
      duration,
      easing: "linear",
      fill: "both",
    },
  );

  const trailFadeAnimation = guideTrail.animate(
    [
      { opacity: 0 },
      { opacity: 0, offset: 0.08 },
      { opacity: 0.48, offset: 0.2 },
      { opacity: 0.4, offset: 0.86 },
      { opacity: 0 },
    ],
    {
      delay: motionDelay,
      duration,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      fill: "both",
    },
  );

  guideAnimations = [cueAnimation, cursorAnimation, trailRevealAnimation, trailFadeAnimation].filter(Boolean);
  cursorAnimation?.addEventListener("finish", () => {
    installPanel.classList.remove("is-guiding");
  });
}

function getGuidePath(startPoint, endPoint) {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normal = { x: -dy / distance, y: dx / distance };
  const arc = Math.min(150, Math.max(46, distance * 0.11));
  const direction = endPoint.y < startPoint.y ? -1 : 1;
  const curve = arc * direction;
  const midPoint = {
    x: startPoint.x + dx * 0.58 + normal.x * curve * 0.42,
    y: startPoint.y + dy * 0.44 + normal.y * curve * 0.42,
  };

  const controlA = {
    x: startPoint.x + dx * 0.16 + normal.x * curve * 0.64,
    y: startPoint.y + dy * 0.08 + normal.y * curve * 0.64,
  };
  const controlB = {
    x: startPoint.x + dx * 0.43 + normal.x * curve * 0.08,
    y: startPoint.y + dy * 0.58 + normal.y * curve * 0.08,
  };
  const controlC = {
    x: startPoint.x + dx * 0.94 - normal.x * curve * 0.16,
    y: startPoint.y + dy * 0.88 - normal.y * curve * 0.16,
  };

  return {
    controlA,
    controlB,
    controlC,
    midPoint,
  };
}

function buildCursorKeyframes(pathElement, length) {
  const samples = [
    [0, 0, 0, 0.86],
    [0.05, 0.06, 0.46, 0.94],
    [0.17, 0.22, 0.5, 1],
    [0.34, 0.44, 0.48, 0.99],
    [0.54, 0.66, 0.46, 0.97],
    [0.74, 0.84, 0.44, 0.94],
    [0.88, 0.97, 0.42, 0.9],
    [0.95, 1, 0.4, 0.88],
    [0.99, 0.996, 0.34, 0.91],
    [1, 1, 0, 0.9],
  ];

  return samples.map(([offset, progress, opacity, scale], index) => {
    const point = pathElement.getPointAtLength(length * progress);
    const nextPoint = pathElement.getPointAtLength(length * Math.min(1, progress + 0.015));
    const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * (180 / Math.PI);
    const cursorAngle = Math.max(-18, Math.min(-3, angle * 0.18 - 8));
    const hoverY = index % 2 === 0 ? -1.5 : 1;
    return cursorKeyframe({ x: point.x, y: point.y + hoverY }, cursorAngle, offset, opacity, scale);
  });
}

function cursorKeyframe(point, rotation, offset, opacity, scale) {
  return {
    offset,
    opacity,
    transform: `translate(${point.x}px, ${point.y}px) rotate(${rotation}deg) scale(${scale})`,
  };
}

function cancelGuideAnimations() {
  guideAnimations.forEach((animation) => animation.cancel());
  guideAnimations = [];
  installPanel?.classList.remove("is-guiding");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
