import { seed, seedScene, step, gust } from './engine.mjs?v=10';

const canvas = document.querySelector('#flock');
const context = canvas.getContext('2d');
const pauseButton = document.querySelector('#pause');
const stepButton = document.querySelector('#step');
const paceButtons = {
  quarter: document.querySelector('#pace-quarter'),
  half: document.querySelector('#pace-half'),
  full: document.querySelector('#pace-full'),
};
const resetButton = document.querySelector('#reset');
const trailsButton = document.querySelector('#trails');
const ruleInputs = {
  separation: document.querySelector('#separation'),
  alignment: document.querySelector('#alignment'),
  cohesion: document.querySelector('#cohesion'),
};
const ruleOutputs = {
  separation: document.querySelector('#separation-value'),
  alignment: document.querySelector('#alignment-value'),
  cohesion: document.querySelector('#cohesion-value'),
};
const restoreRulesButton = document.querySelector('#restore-rules');
const hawkButton = document.querySelector('#hawk');
const neighborsButton = document.querySelector('#neighbors');
const turnArrowButton = document.querySelector('#turn-arrow');
const neighborLinksButton = document.querySelector('#neighbor-links');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const defaults = { separation: 18, alignment: 0.08, cohesion: 0.004 };
const recipes = {
  coast: { separation: 0, alignment: 0, cohesion: 0 },
  apart: { separation: 36, alignment: 0, cohesion: 0 },
  flock: { separation: 18, alignment: 0.08, cohesion: 0.004 },
};
const recipeButtons = Object.fromEntries(Object.keys(recipes).map(name => [
  name,
  document.querySelector(`#recipe-${name}`),
]));

let birds = seed();
let trails = false;
let trailFrames = [];
let weights = { ...defaults };
let manuallyPaused = reduceMotion.matches;
let predator = null;
let lensEnabled = false;
let lensSelection = null;
let turnArrow = false;
let neighborLinks = false;
let activePointerId = null;
let lastTime = null;
let accumulator = 0;
let pace = 1;
const fixedStep = 1000 / 60;
const worldWidth = 1000;
const worldHeight = 600;

function advanceFlock() {
  birds = step(birds, weights, predator);
  if (trails) {
    trailFrames.push(birds.map(({ x, y }) => ({ x, y })));
    if (trailFrames.length > 12) trailFrames.shift();
  }
}

function isPaused() {
  return manuallyPaused || document.hidden;
}

for (const [name, button] of Object.entries(paceButtons)) {
  button.addEventListener('click', () => {
    pace = { quarter: 0.25, half: 0.5, full: 1 }[name];
    accumulator = 0;
    lastTime = null;
    for (const [selectedName, selectedButton] of Object.entries(paceButtons)) {
      selectedButton.setAttribute('aria-pressed', String(selectedName === name));
    }
  });
}

function updatePauseButton() {
  pauseButton.textContent = manuallyPaused ? 'Resume' : 'Pause';
  stepButton.disabled = !(manuallyPaused && !document.hidden);
}

function formatRuleValue(name, value) {
  if (name === 'alignment') return Number(value).toFixed(2);
  if (name === 'cohesion') return Number(value).toFixed(3);
  return String(Number(value));
}

function updateRuleOutput(name) {
  ruleOutputs[name].textContent = formatRuleValue(name, ruleInputs[name].value);
}

function updateSelectedRecipe() {
  for (const [name, recipe] of Object.entries(recipes)) {
    const selected = Object.keys(recipe).every(key => weights[key] === recipe[key]);
    recipeButtons[name].setAttribute('aria-pressed', String(selected));
  }
}

function applyWeights(nextWeights) {
  weights = { ...nextWeights };
  for (const name of Object.keys(ruleInputs)) {
    ruleInputs[name].value = String(weights[name]);
    updateRuleOutput(name);
  }
  updateSelectedRecipe();
}

for (const name of Object.keys(ruleInputs)) {
  ruleInputs[name].addEventListener('input', () => {
    weights[name] = Number(ruleInputs[name].value);
    updateRuleOutput(name);
    updateSelectedRecipe();
  });
}
for (const [name, button] of Object.entries(recipeButtons)) {
  button.addEventListener('click', () => applyWeights(recipes[name]));
}
restoreRulesButton.addEventListener('click', () => applyWeights(defaults));

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  draw();
}

function lensSnapshot() {
  if (lensSelection === null || !birds[lensSelection]) return null;
  const selected = birds[lensSelection];
  const neighbors = [];
  const close = [];
  const links = [];
  for (let index = 0; index < birds.length; index++) {
    if (index === lensSelection) continue;
    let dx = birds[index].x - selected.x;
    let dy = birds[index].y - selected.y;
    if (dx > worldWidth / 2) dx -= worldWidth;
    else if (dx < -worldWidth / 2) dx += worldWidth;
    if (dy > worldHeight / 2) dy -= worldHeight;
    else if (dy < -worldHeight / 2) dy += worldHeight;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared === 0) continue;
    if (distanceSquared < 80 * 80) {
      neighbors.push(index);
      links.push({ index, dx, dy, close: distanceSquared < 24 * 24 });
    }
    if (distanceSquared < 24 * 24) close.push(index);
  }
  const predicted = step(birds, weights, null)[lensSelection];
  return { index: lensSelection, neighbors, close, links, nextVelocity: { vx: predicted.vx, vy: predicted.vy } };
}

function drawNeighborLinks(lens) {
  const selected = birds[lens.index];
  for (const link of lens.links) {
    context.beginPath();
    for (const offsetX of [-worldWidth, 0, worldWidth]) {
      for (const offsetY of [-worldHeight, 0, worldHeight]) {
        const x = selected.x + offsetX;
        const y = selected.y + offsetY;
        context.moveTo(x, y);
        context.lineTo(x + link.dx, y + link.dy);
      }
    }
    context.strokeStyle = link.close ? '#ffd166' : '#e9755c';
    context.globalAlpha = link.close ? 0.65 : 0.35;
    context.lineWidth = 1;
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawLensRings() {
  const selected = birds[lensSelection];
  if (!selected) return;
  for (const [radius, color] of [[80, '#e9755c'], [24, '#ffd166']]) {
    context.beginPath();
    for (const offsetX of [-worldWidth, 0, worldWidth]) {
      for (const offsetY of [-worldHeight, 0, worldHeight]) {
        context.moveTo(selected.x + offsetX + radius, selected.y + offsetY);
        context.arc(selected.x + offsetX, selected.y + offsetY, radius, 0, Math.PI * 2);
      }
    }
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.stroke();
  }
}

function drawTurnArrow(lens) {
  const selected = birds[lens.index];
  const { vx, vy } = lens.nextVelocity;
  if (vx === 0 && vy === 0) return;
  const heading = Math.atan2(vy, vx);
  context.beginPath();
  for (const offsetX of [-worldWidth, 0, worldWidth]) {
    for (const offsetY of [-worldHeight, 0, worldHeight]) {
      const x = selected.x + offsetX;
      const y = selected.y + offsetY;
      const endX = x + 12 * vx;
      const endY = y + 12 * vy;
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      for (const angle of [heading - 0.5, heading + 0.5]) {
        context.moveTo(endX, endY);
        context.lineTo(endX - 6 * Math.cos(angle), endY - 6 * Math.sin(angle));
      }
    }
  }
  context.strokeStyle = '#ffd166';
  context.lineWidth = 2;
  context.stroke();
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const sx = rect.width / worldWidth;
  const sy = rect.height / worldHeight;
  context.setTransform(canvas.width / worldWidth, 0, 0, canvas.height / worldHeight, 0, 0);
  context.clearRect(0, 0, worldWidth, worldHeight);
  const frameCount = trailFrames.length;
  context.strokeStyle = '#fff7e7';
  context.lineWidth = 1.5;
  for (let segmentIndex = 0; segmentIndex < frameCount - 1; segmentIndex++) {
    context.globalAlpha = 0.08 + 0.22 * (segmentIndex / Math.max(1, frameCount - 1));
    const earlier = trailFrames[segmentIndex];
    const later = trailFrames[segmentIndex + 1];
    for (let birdIndex = 0; birdIndex < earlier.length; birdIndex++) {
      const from = earlier[birdIndex];
      const to = later[birdIndex];
      if (Math.abs(to.x - from.x) > 500 || Math.abs(to.y - from.y) > 300) continue;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
  }
  context.globalAlpha = 1;
  const lens = lensSnapshot();
  if (neighborLinks && lens) drawNeighborLinks(lens);
  if (lensSelection !== null) drawLensRings();
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
  if (turnArrow && lens) drawTurnArrow(lens);
  for (let birdIndex = 0; birdIndex < birds.length; birdIndex++) {
    const bird = birds[birdIndex];
    context.fillStyle = lens && birdIndex === lens.index ? '#e9755c' : '#fff7e7';
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
    accumulator += elapsed * pace;
    let steps = 0;
    while (accumulator >= fixedStep && steps < 5) {
      advanceFlock();
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
stepButton.addEventListener('click', () => {
  if (!manuallyPaused || document.hidden) return;
  advanceFlock();
  draw();
});
trailsButton.addEventListener('click', () => {
  trails = trailsButton.getAttribute('aria-pressed') !== 'true';
  trailFrames = [];
  trailsButton.setAttribute('aria-pressed', String(trails));
  draw();
});
neighborLinksButton.addEventListener('click', () => {
  neighborLinks = !neighborLinks;
  neighborLinksButton.setAttribute('aria-pressed', String(neighborLinks));
  draw();
});
turnArrowButton.addEventListener('click', () => {
  turnArrow = !turnArrow;
  turnArrowButton.setAttribute('aria-pressed', String(turnArrow));
  draw();
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

function selectNearestBird(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height || birds.length === 0) return;
  const x = ((event.clientX - rect.left) / rect.width) * worldWidth;
  const y = ((event.clientY - rect.top) / rect.height) * worldHeight;
  let nearest = 0;
  let nearestDistance = Infinity;
  for (let index = 0; index < birds.length; index++) {
    let dx = birds[index].x - x;
    let dy = birds[index].y - y;
    if (dx > worldWidth / 2) dx -= worldWidth;
    else if (dx < -worldWidth / 2) dx += worldWidth;
    if (dy > worldHeight / 2) dy -= worldHeight;
    else if (dy < -worldHeight / 2) dy += worldHeight;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < nearestDistance) {
      nearest = index;
      nearestDistance = distanceSquared;
    }
  }
  lensSelection = nearest;
  draw();
}

hawkButton.addEventListener('click', () => {
  const enabled = hawkButton.getAttribute('aria-pressed') !== 'true';
  hawkButton.setAttribute('aria-pressed', String(enabled));
  canvas.style.touchAction = enabled || lensEnabled ? 'none' : '';
  if (enabled) {
    lensEnabled = false;
    lensSelection = null;
    neighborsButton.setAttribute('aria-pressed', 'false');
    clearPredator(true);
  } else clearPredator(true);
});
neighborsButton.addEventListener('click', () => {
  lensEnabled = neighborsButton.getAttribute('aria-pressed') !== 'true';
  neighborsButton.setAttribute('aria-pressed', String(lensEnabled));
  if (lensEnabled) {
    hawkButton.setAttribute('aria-pressed', 'false');
    lensSelection = null;
    clearPredator(true);
  } else lensSelection = null;
  canvas.style.touchAction = lensEnabled || hawkButton.getAttribute('aria-pressed') === 'true' ? 'none' : '';
  draw();
});
canvas.addEventListener('keydown', (event) => {
  if (event.target !== canvas || !lensEnabled || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  lensSelection = lensSelection === null
    ? (direction === 1 ? 0 : 79)
    : (lensSelection + direction + 80) % 80;
  draw();
});
canvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  if (lensEnabled) {
    event.preventDefault();
    selectNearestBird(event);
    return;
  }
  if (hawkButton.getAttribute('aria-pressed') !== 'true') return;
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
function applyGust(dx) {
  birds = gust(birds, dx);
  clearPredator(true);
  trailFrames = [];
  accumulator = 0;
  lastTime = null;
  draw();
}

document.querySelector('#gust-west').addEventListener('click', () => applyGust(-1));
document.querySelector('#gust-east').addEventListener('click', () => applyGust(1));

function resetToBirds(nextBirds) {
  clearPredator(true);
  lensSelection = null;
  birds = nextBirds;
  trailFrames = [];
  accumulator = 0;
  lastTime = null;
  draw();
}

resetButton.addEventListener('click', () => resetToBirds(seed()));
for (const name of ['two-flocks', 'head-on']) {
  document.querySelector(`#sky-${name}`).addEventListener('click', () => resetToBirds(seedScene(name)));
}
document.addEventListener('visibilitychange', () => {
  accumulator = 0;
  lastTime = null;
  if (document.hidden) clearPredator(true);
  updatePauseButton();
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
    return JSON.parse(JSON.stringify({ birds, weights, paused: isPaused(), predator, trails, trailFrames, lens: lensSnapshot(), turnArrow, neighborLinks, pace }));
  },
};
requestAnimationFrame(animate);
