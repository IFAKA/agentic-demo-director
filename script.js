const workbench = document.querySelector(".demo-workbench");
const steps = Array.from(document.querySelectorAll(".demo-step"));
const dots = Array.from(document.querySelectorAll(".demo-progress span"));
const title = document.querySelector("[data-demo-title]");
const status = document.querySelector("[data-demo-status]");

const labels = [
  ["Demo request", "typing"],
  ["Scenario edit", "editing"],
  ["Recorder run", "recording"],
  ["Validated output", "done"],
];

let currentStep = 0;
let timer = window.setInterval(nextStep, 2100);

workbench?.addEventListener("click", () => {
  currentStep = 0;
  renderStep();
  window.clearInterval(timer);
  timer = window.setInterval(nextStep, 2100);
});

function nextStep() {
  currentStep = (currentStep + 1) % steps.length;
  renderStep();
}

function renderStep() {
  steps.forEach((step, index) => step.classList.toggle("is-active", index === currentStep));
  dots.forEach((dot, index) => dot.classList.toggle("is-active", index === currentStep));
  if (title && status) {
    title.textContent = labels[currentStep][0];
    status.textContent = labels[currentStep][1];
  }
}
