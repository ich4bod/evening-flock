import { seed, seedScene, step, gust, reverseFlight, restFlight, quarterTurn } from './engine.mjs?v=22';

const canvas = document.querySelector('#flock');
const context = canvas.getContext('2d');
const birdCensus = document.querySelector('#bird-census');
const birdLeftButton = document.querySelector('#bird-left');
const birdRightButton = document.querySelector('#bird-right');
const birdReverseButton = document.querySelector('#bird-reverse');
const birdRestButton = document.querySelector('#bird-rest');
const birdSlowerButton = document.querySelector('#bird-slower');
const birdFasterButton = document.querySelector('#bird-faster');
const birdBorrowButton = document.querySelector('#bird-borrow');
const birdNearestTowardButton = document.querySelector('#bird-nearest-toward');
const birdNearestAwayButton = document.querySelector('#bird-nearest-away');
const birdNearestSpeedButton = document.querySelector('#bird-nearest-speed');
const birdPositionCloserButton = document.querySelector('#bird-position-closer');
const birdPositionFartherButton = document.querySelector('#bird-position-farther');
const birdPositionHalfwayButton = document.querySelector('#bird-position-halfway');
const birdPositionSwapButton = document.querySelector('#bird-position-swap');
const birdPositionOrbitLeftButton = document.querySelector('#bird-position-orbit-left');
const pauseButton = document.querySelector('#pause');
const stepButton = document.querySelector('#step');
const paceButtons = {
  quarter: document.querySelector('#pace-quarter'),
  half: document.querySelector('#pace-half'),
  full: document.querySelector('#pace-full'),
};
const resetButton = document.querySelector('#reset');
const reverseFlightButton = document.querySelector('#reverse-flight');
const trailsButton = document.querySelector('#trails');
const selectedTrailButton = document.querySelector('#selected-trail');
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
const followNeighborButton = document.querySelector('#follow-neighbor');
const turnArrowButton = document.querySelector('#turn-arrow');
const coastArrowButton = document.querySelector('#coast-arrow');
const neighborLinksButton = document.querySelector('#neighbor-links');
const apartArrowButton = document.querySelector('#apart-arrow');
const gatherArrowButton = document.querySelector('#gather-arrow');
const alignmentArrowButton = document.querySelector('#alignment-arrow');
const reachButtons = {
  near: document.querySelector('#reach-near'),
  usual: document.querySelector('#reach-usual'),
  wide: document.querySelector('#reach-wide'),
};
const reachRadii = { near: 40, usual: 80, wide: 120 };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const defaults = { separation: 18, alignment: 0.08, cohesion: 0.004 };
const recipes = {
  coast: { separation: 0, alignment: 0, cohesion: 0 },
  apart: { separation: 36, alignment: 0, cohesion: 0 },
  align: { separation: 0, alignment: 0.08, cohesion: 0 },
  gather: { separation: 0, alignment: 0, cohesion: 0.004 },
  'apart-align': { separation: 18, alignment: 0.08, cohesion: 0 },
  'apart-gather': { separation: 18, alignment: 0, cohesion: 0.004 },
  'align-gather': { separation: 0, alignment: 0.08, cohesion: 0.004 },
  flock: { separation: 18, alignment: 0.08, cohesion: 0.004 },
};
const recipeButtons = Object.fromEntries(Object.keys(recipes).map(name => [
  name,
  document.querySelector(`#recipe-${name}`),
]));

let birds = seed();
let beatHistory = [];
let trails = false;
let selectedTrail = false;
let trailFrames = [];
let weights = { ...defaults };
let manuallyPaused = reduceMotion.matches;
let predator = null;
let lensEnabled = false;
let lensSelection = null;
let turnArrow = false;
let coastArrow = false;
let neighborLinks = false;
let apartArrow = false;
let gatherArrow = false;
let alignmentArrow = false;
let neighborRadius = 80;
let activePointerId = null;
let lastTime = null;
let accumulator = 0;
let pace = 1;
const fixedStep = 1000 / 60;
const worldWidth = 1000;
const worldHeight = 600;

function advanceFlock() {
  birds = step(birds, weights, predator, neighborRadius);
  if (trails) {
    trailFrames.push(birds.map(({ x, y }) => ({ x, y })));
    if (trailFrames.length > 12) trailFrames.shift();
  }
}

function isPaused() {
  return manuallyPaused || document.hidden;
}

for (const [name, button] of Object.entries(reachButtons)) {
  button.addEventListener('click', () => {
    neighborRadius = reachRadii[name];
    for (const [selectedName, selectedButton] of Object.entries(reachButtons)) {
      selectedButton.setAttribute('aria-pressed', String(selectedName === name));
    }
    draw();
  });
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

function selectedBirdCandidate(kind, selected) {
  if (kind === 'slower') return { vx: selected.vx * 0.5, vy: selected.vy * 0.5 };
  if (kind === 'faster') {
    const speed = Math.hypot(selected.vx, selected.vy);
    if (speed === 0 || speed >= 3) return null;
    const factor = Math.min(2, 3 / speed);
    return { vx: selected.vx * factor, vy: selected.vy * factor };
  }
  return null;
}

function nearestBirdCandidate(flock, selectedIndex, radius) {
  const selected = flock[selectedIndex];
  if (!selected) return null;
  let nearest = null;
  for (let index = 0; index < flock.length; index++) {
    if (index === selectedIndex) continue;
    let dx = flock[index].x - selected.x;
    let dy = flock[index].y - selected.y;
    if (dx > worldWidth / 2) dx -= worldWidth;
    else if (dx < -worldWidth / 2) dx += worldWidth;
    if (dy > worldHeight / 2) dy -= worldHeight;
    else if (dy < -worldHeight / 2) dy += worldHeight;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > 0 && distanceSquared < radius * radius
      && (!nearest || distanceSquared < nearest.distanceSquared)) {
      nearest = { index, dx, dy, distanceSquared };
    }
  }
  return nearest;
}

function nearestPositionCandidate(kind) {
  if (!['closer', 'farther', 'halfway', 'swap', 'orbit-left'].includes(kind) || lensSelection === null) return null;
  const selected = birds[lensSelection];
  if (!selected) return null;
  const nearest = nearestBirdCandidate(birds, lensSelection, neighborRadius);
  if (!nearest) return null;
  if (kind === 'swap') {
    const other = birds[nearest.index];
    return birds.map((bird, index) => index === lensSelection
      ? { ...bird, x: other.x, y: other.y }
      : index === nearest.index
        ? { ...bird, x: selected.x, y: selected.y }
        : bird);
  }
  if (kind === 'orbit-left') {
    const other = birds[nearest.index];
    const x = ((other.x - nearest.dy) % worldWidth + worldWidth) % worldWidth;
    const y = ((other.y + nearest.dx) % worldHeight + worldHeight) % worldHeight;
    return birds.map((bird, index) => index === lensSelection ? { ...bird, x, y } : bird);
  }
  const distance = Math.sqrt(nearest.distanceSquared);
  const factor = kind === 'halfway' ? 0.5
    : kind === 'farther' ? -12 / distance : Math.min(12, distance / 2) / distance;
  const x = ((selected.x + nearest.dx * factor) % worldWidth + worldWidth) % worldWidth;
  const y = ((selected.y + nearest.dy * factor) % worldHeight + worldHeight) % worldHeight;
  return birds.map((bird, index) => index === lensSelection ? { ...bird, x, y } : bird);
}

function borrowedFlightCandidate(flock, selectedIndex, radius) {
  const nearest = nearestBirdCandidate(flock, selectedIndex, radius);
  if (!nearest) return null;
  const bird = flock[nearest.index];
  return { vx: bird.vx, vy: bird.vy };
}

function nearestHeadingCandidate(kind) {
  if (!['toward', 'away', 'speed'].includes(kind) || lensSelection === null) return null;
  const selected = birds[lensSelection];
  if (!selected) return null;
  const speed = Math.hypot(selected.vx, selected.vy);
  if (speed === 0) return null;
  const nearest = nearestBirdCandidate(birds, lensSelection, neighborRadius);
  if (!nearest) return null;
  if (kind === 'speed') {
    const other = birds[nearest.index];
    const factor = Math.min(3, Math.hypot(other.vx, other.vy)) / speed;
    return { vx: selected.vx * factor, vy: selected.vy * factor };
  }
  const factor = (kind === 'away' ? -speed : speed) / Math.sqrt(nearest.distanceSquared);
  return { vx: nearest.dx * factor, vy: nearest.dy * factor };
}

function updateBirdEditEligibility() {
  const selected = lensSelection === null ? null : birds[lensSelection];
  const baseEligible = manuallyPaused && !document.hidden && lensEnabled && lensSelection !== null && selected;
  const eligible = baseEligible && (selected.vx !== 0 || selected.vy !== 0);
  const reverseEligible = eligible && (selected.vx !== 0 || selected.vy !== 0);
  const slowerCandidate = selected ? selectedBirdCandidate('slower', selected) : null;
  const fasterCandidate = selected ? selectedBirdCandidate('faster', selected) : null;
  const slowerEligible = manuallyPaused && !document.hidden && lensEnabled && lensSelection !== null
    && selected && slowerCandidate && (slowerCandidate.vx !== selected.vx || slowerCandidate.vy !== selected.vy);
  const fasterEligible = manuallyPaused && !document.hidden && lensEnabled && lensSelection !== null
    && selected && fasterCandidate && (fasterCandidate.vx !== selected.vx || fasterCandidate.vy !== selected.vy);
  const borrowCandidate = baseEligible ? borrowedFlightCandidate(birds, lensSelection, neighborRadius) : null;
  const borrowEligible = baseEligible && borrowCandidate
    && (borrowCandidate.vx !== selected.vx || borrowCandidate.vy !== selected.vy);
  birdLeftButton.disabled = !eligible;
  birdRightButton.disabled = !eligible;
  birdReverseButton.disabled = !reverseEligible;
  birdRestButton.disabled = !eligible;
  birdSlowerButton.disabled = !slowerEligible;
  birdFasterButton.disabled = !fasterEligible;
  birdBorrowButton.disabled = !borrowEligible;
  const nearestTowardCandidate = baseEligible ? nearestHeadingCandidate('toward') : null;
  birdNearestTowardButton.disabled = !baseEligible || !nearestTowardCandidate
    || (nearestTowardCandidate.vx === selected.vx && nearestTowardCandidate.vy === selected.vy);
  const nearestAwayCandidate = baseEligible ? nearestHeadingCandidate('away') : null;
  birdNearestAwayButton.disabled = !baseEligible || !nearestAwayCandidate
    || (nearestAwayCandidate.vx === selected.vx && nearestAwayCandidate.vy === selected.vy);
  const nearestSpeedCandidate = baseEligible ? nearestHeadingCandidate('speed') : null;
  birdNearestSpeedButton.disabled = !baseEligible || !nearestSpeedCandidate
    || (nearestSpeedCandidate.vx === selected.vx && nearestSpeedCandidate.vy === selected.vy);
  const positionCandidate = baseEligible ? nearestPositionCandidate('closer') : null;
  birdPositionCloserButton.disabled = !baseEligible || !positionCandidate
    || (positionCandidate[lensSelection].x === selected.x && positionCandidate[lensSelection].y === selected.y);
  const fartherCandidate = baseEligible ? nearestPositionCandidate('farther') : null;
  birdPositionFartherButton.disabled = !baseEligible || !fartherCandidate
    || (fartherCandidate[lensSelection].x === selected.x && fartherCandidate[lensSelection].y === selected.y);
  const halfwayCandidate = baseEligible ? nearestPositionCandidate('halfway') : null;
  birdPositionHalfwayButton.disabled = !baseEligible || !halfwayCandidate
    || (halfwayCandidate[lensSelection].x === selected.x && halfwayCandidate[lensSelection].y === selected.y);
  const swapCandidate = baseEligible ? nearestPositionCandidate('swap') : null;
  birdPositionSwapButton.disabled = !baseEligible || !swapCandidate
    || (swapCandidate[lensSelection].x === selected.x && swapCandidate[lensSelection].y === selected.y);
  const orbitLeftCandidate = baseEligible ? nearestPositionCandidate('orbit-left') : null;
  birdPositionOrbitLeftButton.disabled = !baseEligible || !orbitLeftCandidate
    || (orbitLeftCandidate[lensSelection].x === selected.x && orbitLeftCandidate[lensSelection].y === selected.y);
}

function moveSelectedBird(kind) {
  if (!['closer', 'farther', 'halfway', 'swap', 'orbit-left'].includes(kind) || !manuallyPaused || document.hidden || !lensEnabled
    || lensSelection === null || !birds[lensSelection]) return;
  const selected = birds[lensSelection];
  const candidate = nearestPositionCandidate(kind);
  if (!candidate || (candidate[lensSelection].x === selected.x && candidate[lensSelection].y === selected.y)) return;
  saveBeatSnapshot();
  birds = candidate;
  accumulator = 0;
  lastTime = null;
  draw();
}

function editSelectedBird(kind) {
  if (!['left', 'right', 'reverse', 'rest', 'slower', 'faster', 'borrow', 'nearest-toward', 'nearest-away', 'nearest-speed'].includes(kind) || !manuallyPaused || document.hidden || !lensEnabled
    || lensSelection === null || !birds[lensSelection]) return;
  const selected = birds[lensSelection];
  if (kind === 'nearest-toward' || kind === 'nearest-away' || kind === 'nearest-speed') {
    const candidate = nearestHeadingCandidate(kind === 'nearest-away' ? 'away' : kind === 'nearest-speed' ? 'speed' : 'toward');
    if (!candidate || (candidate.vx === selected.vx && candidate.vy === selected.vy)) return;
    saveBeatSnapshot();
    birds = birds.map((bird, index) => index === lensSelection
      ? { ...bird, vx: candidate.vx, vy: candidate.vy }
      : bird);
  } else if (kind === 'borrow') {
    const candidate = borrowedFlightCandidate(birds, lensSelection, neighborRadius);
    if (!candidate || (candidate.vx === selected.vx && candidate.vy === selected.vy)) return;
    saveBeatSnapshot();
    birds = birds.map((bird, index) => index === lensSelection
      ? { ...bird, vx: candidate.vx, vy: candidate.vy }
      : bird);
  } else if (kind === 'slower' || kind === 'faster') {
    const candidate = selectedBirdCandidate(kind, selected);
    if (!candidate || (candidate.vx === selected.vx && candidate.vy === selected.vy)) return;
    saveBeatSnapshot();
    birds = birds.map((bird, index) => index === lensSelection
      ? { ...bird, vx: candidate.vx, vy: candidate.vy }
      : bird);
  } else {
    if (selected.vx === 0 && selected.vy === 0) return;
    saveBeatSnapshot();
    birds = birds.map((bird, index) => index === lensSelection
      ? kind === 'rest'
        ? { ...bird, vx: 0, vy: 0 }
        : kind === 'reverse'
          ? { ...bird, vx: -bird.vx, vy: -bird.vy }
          : kind === 'right'
            ? { ...bird, vx: -bird.vy, vy: bird.vx }
            : { ...bird, vx: bird.vy, vy: -bird.vx }
      : bird);
  }
  accumulator = 0;
  lastTime = null;
  draw();
}

function updatePauseButton() {
  pauseButton.textContent = manuallyPaused ? 'Resume' : 'Pause';
  stepButton.disabled = !(manuallyPaused && !document.hidden);
  updateStepBack();
  updateBirdEditEligibility();
}

function updateStepBack() {
  document.querySelector('#step-back').disabled = !(manuallyPaused && !document.hidden && beatHistory.length > 0);
}

function clearBeatHistory() {
  beatHistory = [];
  updateStepBack();
}

function saveBeatSnapshot() {
  beatHistory.push({
    birds: birds.map(bird => ({ ...bird })),
    trailFrames: trailFrames.map(frame => frame.map(point => ({ ...point }))),
  });
  if (beatHistory.length > 24) beatHistory.shift();
  updateStepBack();
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
  let gatherX = 0;
  let gatherY = 0;
  let alignmentX = 0;
  let alignmentY = 0;
  let apartX = 0;
  let apartY = 0;
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
    if (distanceSquared < neighborRadius * neighborRadius) {
      if (distanceSquared < 24 * 24) {
        apartX -= dx / distanceSquared;
        apartY -= dy / distanceSquared;
      }
      neighbors.push(index);
      links.push({ index, dx, dy, close: distanceSquared < 24 * 24 });
      gatherX += dx;
      gatherY += dy;
      alignmentX += birds[index].vx;
      alignmentY += birds[index].vy;
    }
    if (distanceSquared < 24 * 24) close.push(index);
  }
  const predicted = step(birds, weights, null, neighborRadius)[lensSelection];
  return {
    index: lensSelection,
    neighbors,
    close,
    links,
    gatherVector: neighbors.length
      ? { vx: gatherX / neighbors.length, vy: gatherY / neighbors.length }
      : { vx: 0, vy: 0 },
    alignmentVector: neighbors.length
      ? { vx: alignmentX / neighbors.length - selected.vx, vy: alignmentY / neighbors.length - selected.vy }
      : { vx: 0, vy: 0 },
    apartVector: { vx: apartX, vy: apartY },
    coastVelocity: { vx: selected.vx, vy: selected.vy },
    nextVelocity: { vx: predicted.vx, vy: predicted.vy },
  };
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
  for (const [radius, color] of [[neighborRadius, '#e9755c'], [24, '#ffd166']]) {
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

function drawAlignmentArrow(lens) {
  const selected = birds[lens.index];
  const { vx, vy } = lens.alignmentVector;
  const length = Math.hypot(vx, vy);
  if (length === 0) return;
  const heading = Math.atan2(vy, vx);
  context.beginPath();
  for (const offsetX of [-worldWidth, 0, worldWidth]) {
    for (const offsetY of [-worldHeight, 0, worldHeight]) {
      const x = selected.x + offsetX;
      const y = selected.y + offsetY;
      const endX = x + 60 * vx / length;
      const endY = y + 60 * vy / length;
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      for (const angle of [heading - 0.5, heading + 0.5]) {
        context.moveTo(endX, endY);
        context.lineTo(endX - 6 * Math.cos(angle), endY - 6 * Math.sin(angle));
      }
    }
  }
  context.strokeStyle = '#a7d46f';
  context.lineWidth = 2;
  context.stroke();
}

function drawGatherArrow(lens) {
  const selected = birds[lens.index];
  const { vx, vy } = lens.gatherVector;
  const length = Math.hypot(vx, vy);
  if (length === 0) return;
  const heading = Math.atan2(vy, vx);
  context.beginPath();
  for (const offsetX of [-worldWidth, 0, worldWidth]) {
    for (const offsetY of [-worldHeight, 0, worldHeight]) {
      const x = selected.x + offsetX;
      const y = selected.y + offsetY;
      const endX = x + 60 * vx / length;
      const endY = y + 60 * vy / length;
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      for (const angle of [heading - 0.5, heading + 0.5]) {
        context.moveTo(endX, endY);
        context.lineTo(endX - 6 * Math.cos(angle), endY - 6 * Math.sin(angle));
      }
    }
  }
  context.strokeStyle = '#7bc9d6';
  context.lineWidth = 2;
  context.stroke();
}

function drawApartArrow(lens) {
  const selected = birds[lens.index];
  const { vx, vy } = lens.apartVector;
  const length = Math.hypot(vx, vy);
  if (length === 0) return;
  const heading = Math.atan2(vy, vx);
  context.beginPath();
  for (const offsetX of [-worldWidth, 0, worldWidth]) {
    for (const offsetY of [-worldHeight, 0, worldHeight]) {
      const x = selected.x + offsetX;
      const y = selected.y + offsetY;
      const endX = x + 60 * vx / length;
      const endY = y + 60 * vy / length;
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      for (const angle of [heading - 0.5, heading + 0.5]) {
        context.moveTo(endX, endY);
        context.lineTo(endX - 6 * Math.cos(angle), endY - 6 * Math.sin(angle));
      }
    }
  }
  context.strokeStyle = '#c2a4e8';
  context.lineWidth = 2;
  context.stroke();
}

function drawCoastArrow(lens) {
  const selected = birds[lens.index];
  const { vx, vy } = lens.coastVelocity;
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
  context.strokeStyle = '#fff7e7';
  context.lineWidth = 2;
  context.setLineDash([4, 3]);
  context.stroke();
  context.setLineDash([]);
}

function updateFollowNeighborEligibility(lens = lensSnapshot()) {
  followNeighborButton.disabled = !lensEnabled || !lens || lens.links.length === 0;
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
      if (selectedTrail && (lensSelection === null || !birds[lensSelection] || birdIndex !== lensSelection)) continue;
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
  birdCensus.hidden = !lensEnabled;
  const censusText = !lensEnabled
    ? ''
    : lens
      ? `Bird ${lens.index + 1} · Neighbors: ${lens.neighbors.length} · Too close: ${lens.close.length}`
      : 'Tap a bird, or use Left and Right in the sky.';
  if (birdCensus.textContent !== censusText) birdCensus.textContent = censusText;
  updateFollowNeighborEligibility(lens);
  updateBirdEditEligibility();
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
  if (coastArrow && lens) drawCoastArrow(lens);
  if (apartArrow && lensEnabled && lens) drawApartArrow(lens);
  if (turnArrow && lens) drawTurnArrow(lens);
  if (gatherArrow && lensEnabled && lens) drawGatherArrow(lens);
  if (alignmentArrow && lensEnabled && lens) drawAlignmentArrow(lens);
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
  if (!manuallyPaused) clearBeatHistory();
  updatePauseButton();
});
document.querySelector('#step-back').addEventListener('click', () => {
  if (!manuallyPaused || document.hidden || beatHistory.length === 0) return;
  const snapshot = beatHistory.pop();
  birds = snapshot.birds.map(bird => ({ ...bird }));
  trailFrames = snapshot.trailFrames.map(frame => frame.map(point => ({ ...point })));
  clearPredator(true);
  accumulator = 0;
  lastTime = null;
  updateStepBack();
  draw();
});
stepButton.addEventListener('click', () => {
  if (!manuallyPaused || document.hidden) return;
  saveBeatSnapshot();
  advanceFlock();
  draw();
});
birdLeftButton.addEventListener('click', () => editSelectedBird('left'));
birdRightButton.addEventListener('click', () => editSelectedBird('right'));
birdReverseButton.addEventListener('click', () => editSelectedBird('reverse'));
birdRestButton.addEventListener('click', () => editSelectedBird('rest'));
birdSlowerButton.addEventListener('click', () => editSelectedBird('slower'));
birdFasterButton.addEventListener('click', () => editSelectedBird('faster'));
birdBorrowButton.addEventListener('click', () => editSelectedBird('borrow'));
birdNearestTowardButton.addEventListener('click', () => editSelectedBird('nearest-toward'));
birdNearestAwayButton.addEventListener('click', () => editSelectedBird('nearest-away'));
birdNearestSpeedButton.addEventListener('click', () => editSelectedBird('nearest-speed'));
birdPositionCloserButton.addEventListener('click', () => moveSelectedBird('closer'));
birdPositionFartherButton.addEventListener('click', () => moveSelectedBird('farther'));
birdPositionHalfwayButton.addEventListener('click', () => moveSelectedBird('halfway'));
birdPositionSwapButton.addEventListener('click', () => moveSelectedBird('swap'));
birdPositionOrbitLeftButton.addEventListener('click', () => moveSelectedBird('orbit-left'));
trailsButton.addEventListener('click', () => {
  trails = trailsButton.getAttribute('aria-pressed') !== 'true';
  clearBeatHistory();
  trailFrames = [];
  trailsButton.setAttribute('aria-pressed', String(trails));
  draw();
});
selectedTrailButton.addEventListener('click', () => {
  selectedTrail = selectedTrailButton.getAttribute('aria-pressed') !== 'true';
  selectedTrailButton.setAttribute('aria-pressed', String(selectedTrail));
  draw();
});
neighborLinksButton.addEventListener('click', () => {
  neighborLinks = !neighborLinks;
  neighborLinksButton.setAttribute('aria-pressed', String(neighborLinks));
  draw();
});
apartArrowButton.addEventListener('click', () => {
  apartArrow = !apartArrow;
  apartArrowButton.setAttribute('aria-pressed', String(apartArrow));
  draw();
});
gatherArrowButton.addEventListener('click', () => {
  gatherArrow = !gatherArrow;
  gatherArrowButton.setAttribute('aria-pressed', String(gatherArrow));
  draw();
});
alignmentArrowButton.addEventListener('click', () => {
  alignmentArrow = !alignmentArrow;
  alignmentArrowButton.setAttribute('aria-pressed', String(alignmentArrow));
  draw();
});
turnArrowButton.addEventListener('click', () => {
  turnArrow = !turnArrow;
  turnArrowButton.setAttribute('aria-pressed', String(turnArrow));
  draw();
});
coastArrowButton.addEventListener('click', () => {
  coastArrow = !coastArrow;
  coastArrowButton.setAttribute('aria-pressed', String(coastArrow));
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
followNeighborButton.addEventListener('click', () => {
  if (!lensEnabled) return;
  const lens = lensSnapshot();
  if (!lens || lens.links.length === 0) {
    updateFollowNeighborEligibility(lens);
    return;
  }
  let nearest = lens.links[0];
  for (const link of lens.links.slice(1)) {
    const distanceSquared = link.dx * link.dx + link.dy * link.dy;
    const nearestDistanceSquared = nearest.dx * nearest.dx + nearest.dy * nearest.dy;
    if (distanceSquared < nearestDistanceSquared
      || (distanceSquared === nearestDistanceSquared && link.index < nearest.index)) nearest = link;
  }
  lensSelection = nearest.index;
  draw();
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
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') lensSelection = 0;
  else if (event.key === 'End') lensSelection = birds.length - 1;
  else {
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    lensSelection = lensSelection === null
      ? (direction === 1 ? 0 : 79)
      : (lensSelection + direction + 80) % 80;
  }
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
function applyGust(dx, dy = 0) {
  clearBeatHistory();
  birds = gust(birds, dx, dy);
  clearPredator(true);
  trailFrames = [];
  accumulator = 0;
  lastTime = null;
  draw();
}

document.querySelector('#gust-west').addEventListener('click', () => applyGust(-1));
document.querySelector('#gust-east').addEventListener('click', () => applyGust(1));
document.querySelector('#gust-north').addEventListener('click', () => applyGust(0, -1));
document.querySelector('#gust-south').addEventListener('click', () => applyGust(0, 1));

function applyReversal() {
  clearBeatHistory();
  birds = reverseFlight(birds);
  clearPredator(true);
  trailFrames = [];
  accumulator = 0;
  lastTime = null;
  draw();
}

function applyRest() {
  clearBeatHistory();
  birds = restFlight(birds);
  clearPredator(true);
  trailFrames = [];
  accumulator = 0;
  lastTime = null;
  draw();
}

function applyQuarterTurn(direction) {
  clearBeatHistory();
  birds = quarterTurn(birds, direction);
  clearPredator(true);
  trailFrames = [];
  accumulator = 0;
  lastTime = null;
  draw();
}

reverseFlightButton.addEventListener('click', applyReversal);
document.querySelector('#rest-flight').addEventListener('click', applyRest);
document.querySelector('#turn-counterclockwise').addEventListener('click', () => applyQuarterTurn(-1));
document.querySelector('#turn-clockwise').addEventListener('click', () => applyQuarterTurn(1));

function resetToBirds(nextBirds) {
  clearBeatHistory();
  clearPredator(true);
  lensSelection = null;
  birds = nextBirds;
  trailFrames = [];
  accumulator = 0;
  lastTime = null;
  draw();
}

resetButton.addEventListener('click', () => resetToBirds(seed()));
for (const name of ['two-flocks', 'head-on', 'ring', 'crossing', 'overtaking', 'seam', 'lanes', 'still', 'crowded']) {
  document.querySelector(`#sky-${name}`).addEventListener('click', () => resetToBirds(seedScene(name)));
}
document.addEventListener('visibilitychange', () => {
  accumulator = 0;
  lastTime = null;
  if (document.hidden) {
    clearBeatHistory();
    clearPredator(true);
  }
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
    return JSON.parse(JSON.stringify({ birds, weights, paused: isPaused(), predator, trails, selectedTrail, trailFrames, undoBeats: beatHistory.length, lens: lensSnapshot(), turnArrow, coastArrow, neighborLinks, apartArrow, neighborRadius, pace, gatherArrow, alignmentArrow }));
  },
};
requestAnimationFrame(animate);
