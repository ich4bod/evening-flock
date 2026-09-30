import { seed, step } from './engine.mjs';

const canvas = document.querySelector('#flock');
const context = canvas.getContext('2d');
const pauseButton = document.querySelector('#pause');
const resetButton = document.querySelector('#reset');
const hawkButton = document.querySelector('#hawk');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const defaults = { separation: 18, alignment: 0.08, cohesion: 0.004 };

let birds = seed();
let weights = { ...defaults };
let manuallyPaused = reduceMotion.matches;
let predator = null;
let activePointerId = null;
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
  if (predator) {
    context.beginPath();
    context.arc(predator.x, predator.y, 160, 0, Math.PI * 2);
    context.strokeStyle = '#e9755c';
    context.lineWidth = 2;
    context.stroke();
    context.beginPath();
    context.moveTo(predator.x - 5, predator.y - 5);
    context.lineTo(predator.x + 5, predator.y + 5);
    context.moveTo(predator.x + 5, predator.y - 5);
    context.lineTo(predator.x - 5, predator.y + 5);
    context.strokeStyle = '#283346';
    context.lineWidth = 3;
    context.stroke();
  }
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
      birds = step(birds, weights, predator);
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
function clearPredator(releaseCapture = false) {
  const pointerId = activePointerId;
  activePointerId = null;
  predator = null;
  if (releaseCapture && pointerId !== null && canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
  draw();
}

function setPredatorFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  predator = {
    x: Math.max(0, Math.min(worldWidth, ((event.clientX - rect.left) / rect.width) * worldWidth)),
    y: Math.max(0, Math.min(worldHeight, ((event.clientY - rect.top) / rect.height) * worldHeight)),
  };
  draw();
}

hawkButton.addEventListener('click', () => {
  const enabled = hawkButton.getAttribute('aria-pressed') !== 'true';
  hawkButton.setAttribute('aria-pressed', String(enabled));
  canvas.style.touchAction = enabled ? 'none' : '';
  if (!enabled) clearPredator(true);
});
canvas.addEventListener('pointerdown', (event) => {
  if (hawkButton.getAttribute('aria-pressed') !== 'true' || !event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  setPredatorFromPointer(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (event.pointerId === activePointerId) setPredatorFromPointer(event);
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  canvas.addEventListener(eventName, (event) => {
    if (event.pointerId === activePointerId) clearPredator();
  });
}
resetButton.addEventListener('click', () => {
  clearPredator(true);
  birds = seed();
  draw();
});
document.addEventListener('visibilitychange', () => {
  accumulator = 0;
  lastTime = null;
  if (document.hidden) clearPredator(true);
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
    return JSON.parse(JSON.stringify({ birds, weights, paused: isPaused(), predator }));
  },
};
requestAnimationFrame(animate);
