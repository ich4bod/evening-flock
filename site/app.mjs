import { seed, step } from './engine.mjs';

const canvas = document.querySelector('#flock');
const context = canvas.getContext('2d');
const pauseButton = document.querySelector('#pause');
const resetButton = document.querySelector('#reset');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const defaults = { separation: 18, alignment: 0.08, cohesion: 0.004 };

let birds = seed();
let weights = { ...defaults };
let manuallyPaused = reduceMotion.matches;
let lastTime = null;
let accumulator = 0;
const fixedStep = 1000 / 60;
const worldWidth = 1000;
const worldHeight = 600;

function isPaused() {
  return manuallyPaused || document.hidden;
}

function updatePauseButton() {
  pauseButton.textContent = manuallyPaused ? 'Resume' : 'Pause';
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  draw();
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const sx = rect.width / worldWidth;
  const sy = rect.height / worldHeight;
  context.setTransform(canvas.width / worldWidth, 0, 0, canvas.height / worldHeight, 0, 0);
  context.clearRect(0, 0, worldWidth, worldHeight);
  context.fillStyle = '#fff7e7';
  for (const bird of birds) {
    context.save();
    context.translate(bird.x, bird.y);
    context.rotate(Math.atan2(bird.vy, bird.vx));
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-4, -3);
    context.lineTo(-2, 0);
    context.lineTo(-4, 3);
    context.closePath();
    context.fill();
    context.restore();
  }
}

function animate(now) {
  if (lastTime === null) lastTime = now;
  const elapsed = Math.max(0, now - lastTime);
  lastTime = now;
  if (!isPaused()) {
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= fixedStep && steps < 5) {
      birds = step(birds, weights);
      accumulator -= fixedStep;
      steps++;
    }
    if (steps === 5 && accumulator >= fixedStep) accumulator = 0;
  }
  draw();
  requestAnimationFrame(animate);
}

pauseButton.addEventListener('click', () => {
  manuallyPaused = !manuallyPaused;
  accumulator = 0;
  lastTime = null;
  updatePauseButton();
});
resetButton.addEventListener('click', () => {
  birds = seed();
  draw();
});
document.addEventListener('visibilitychange', () => {
  accumulator = 0;
  lastTime = null;
});
window.addEventListener('resize', resizeCanvas);
if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas);
reduceMotion.addEventListener?.('change', () => {
  // A preference change affects the initial choice only, not a visitor's manual pause choice.
});
updatePauseButton();
resizeCanvas();
window.__flock = {
  state() {
    return JSON.parse(JSON.stringify({ birds, weights, paused: isPaused(), predator: null }));
  },
};
requestAnimationFrame(animate);
