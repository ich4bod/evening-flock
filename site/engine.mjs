const WIDTH = 1000;
const HEIGHT = 600;
const DEFAULT_WEIGHTS = { separation: 18, alignment: 0.08, cohesion: 0.004 };

export function seed() {
  return Array.from({ length: 80 }, (_, i) => ({
    x: (137 * i + 71) % WIDTH,
    y: (83 * i + 37) % HEIGHT,
    vx: 2 * Math.cos(0.7 * i),
    vy: 2 * Math.sin(0.7 * i),
  }));
}

export function seedScene(name) {
  const pairedFlights = {
    'paired-same': [1, 1],
    'paired-opposed': [1, -1],
    'paired-rest': [0, 0],
  }[name];
  if (pairedFlights) {
    return Array.from({ length: 80 }, (_, i) => {
      const j = i % 40;
      const t = 2 * Math.PI * j / 40;
      const centerX = i < 40 ? 350 : 650;
      const k = i < 40 ? pairedFlights[0] : pairedFlights[1];
      return {
        x: centerX + 110 * Math.cos(t),
        y: 300 + 110 * Math.sin(t),
        vx: -2 * k * Math.sin(t),
        vy: 2 * k * Math.cos(t),
      };
    });
  }
  const pairedGrids = {
    'grids-approach': [2, -2],
    'grids-together': [2, 2],
    'grids-rest': [0, 0],
  }[name];
  if (pairedGrids) {
    return Array.from({ length: 80 }, (_, i) => {
      const j = i % 40;
      return {
        x: 160 + (i < 40 ? 0 : 520) + 35 * (j % 8),
        y: 180 + 60 * Math.floor(j / 8),
        vx: i < 40 ? pairedGrids[0] : pairedGrids[1],
        vy: 0,
      };
    });
  }
  if (name === 'crowded') {
    return Array.from({ length: 80 }, (_, i) => ({
      x: 464 + (i % 10) * 8,
      y: 272 + Math.floor(i / 10) * 8,
      vx: 2,
      vy: 0,
    }));
  }
  if (name === 'still') {
    return Array.from({ length: 80 }, (_, i) => ({
      x: 320 + (i % 10) * 40,
      y: 160 + Math.floor(i / 10) * 40,
      vx: 0,
      vy: 0,
    }));
  }
  if (name === 'lanes') {
    return Array.from({ length: 80 }, (_, i) => {
      const j = i % 40;
      return {
        x: i < 40 ? 200 + (j % 20) * 24 : 800 - (j % 20) * 24,
        y: (i < 40 ? 260 : 320) + Math.floor(j / 20) * 20,
        vx: i < 40 ? 2 : -2,
        vy: 0,
      };
    });
  }
  if (name === 'seam') {
    return Array.from({ length: 80 }, (_, i) => {
      const j = i % 40;
      const left = i < 40;
      return {
        x: (left ? 20 : 896) + (j % 8) * 12,
        y: 252 + Math.floor(j / 8) * 24,
        vx: left ? -2 : 2,
        vy: 0,
      };
    });
  }
  if (name === 'overtaking') {
    return Array.from({ length: 80 }, (_, i) => {
      const j = i % 40;
      const left = i < 40;
      return {
        x: (left ? 200 : 500) + (j % 8) * 12,
        y: 220 + Math.floor(j / 8) * 24,
        vx: left ? 3 : 1,
        vy: 0,
      };
    });
  }
  if (name === 'crossing') {
    return Array.from({ length: 80 }, (_, i) => {
      const j = i % 40;
      return i < 40
        ? { x: 260 + 6 * j, y: 300, vx: 2, vy: 0 }
        : { x: 500, y: 60 + 6 * j, vx: 0, vy: 2 };
    });
  }
  if (name === 'ring') {
    return Array.from({ length: 80 }, (_, i) => {
      const t = 2 * Math.PI * i / 80;
      return {
        x: 500 + 180 * Math.cos(t),
        y: 300 + 180 * Math.sin(t),
        vx: -2 * Math.sin(t),
        vy: 2 * Math.cos(t),
      };
    });
  }
  if (['inward-ring', 'outward-ring', 'counter-ring'].includes(name)) {
    const radial = name === 'inward-ring' ? -2 : name === 'outward-ring' ? 2 : 0;
    const tangent = name === 'counter-ring' ? -2 : 0;
    return Array.from({ length: 80 }, (_, i) => {
      const t = 2 * Math.PI * i / 80;
      return {
        x: 500 + 180 * Math.cos(t),
        y: 300 + 180 * Math.sin(t),
        vx: radial * Math.cos(t) - tangent * Math.sin(t),
        vy: radial * Math.sin(t) + tangent * Math.cos(t),
      };
    });
  }
  if (name !== 'two-flocks' && name !== 'head-on') return seed();
  return Array.from({ length: 80 }, (_, i) => {
    const j = i % 40;
    const left = i < 40;
    return {
      x: name === 'two-flocks'
        ? (left ? 250 : 750) + (j % 8 - 3.5) * 12
        : left ? 200 + (j % 8) * 12 : 800 - (j % 8) * 12,
      y: name === 'two-flocks'
        ? 300 + (Math.floor(j / 8) - 2) * 12
        : 200 + Math.floor(j / 8) * 35,
      vx: left ? 2 : -2,
      vy: 0,
    };
  });
}

export function shearFlight(birds) {
  return birds.map(bird => {
    const vx = bird.vx + (bird.y < 300 ? 1 : -1);
    const vy = bird.vy;
    const speed = Math.hypot(vx, vy);
    const scale = speed > 3 ? 3 / speed : 1;
    return { x: bird.x, y: bird.y, vx: vx * scale, vy: vy * scale };
  });
}

export function gust(birds, dx, dy = 0) {
  return birds.map(bird => {
    let vx = bird.vx + dx;
    let vy = bird.vy + dy;
    const speed = Math.hypot(vx, vy);
    if (speed > 3) {
      const scale = 3 / speed;
      vx *= scale;
      vy *= scale;
    }
    return { x: bird.x, y: bird.y, vx, vy };
  });
}

export function reverseFlight(birds) {
  return birds.map(bird => ({ x: bird.x, y: bird.y, vx: -bird.vx, vy: -bird.vy }));
}

export function restFlight(birds) {
  return birds.map(bird => ({ x: bird.x, y: bird.y, vx: 0, vy: 0 }));
}

export function quarterTurn(birds, direction) {
  return birds.map(bird => direction === 1
    ? { x: bird.x, y: bird.y, vx: -bird.vy, vy: bird.vx }
    : { x: bird.x, y: bird.y, vx: bird.vy, vy: -bird.vx });
}

export function quarterTurnFlight(birds) {
  return birds.map(bird => ({
    ...bird,
    vx: Object.is(-bird.vy, -0) ? 0 : -bird.vy,
    vy: Object.is(bird.vx, -0) ? 0 : bird.vx,
  }));
}

export function mirrorFlight(birds, axis) {
  if (axis !== 'x' && axis !== 'y') throw new RangeError('axis must be x or y');
  return birds.map(bird => {
    const vx = axis === 'x' ? -bird.vx : bird.vx;
    const vy = axis === 'y' ? -bird.vy : bird.vy;
    return {
      ...bird,
      vx: Object.is(vx, -0) ? 0 : vx,
      vy: Object.is(vy, -0) ? 0 : vy,
    };
  });
}

export function step(birds, weights = DEFAULT_WEIGHTS, predator = null, neighborRadius = 80) {
  return birds.map((bird, index) => {
    let separationX = 0;
    let separationY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let displacementX = 0;
    let displacementY = 0;
    let neighbors = 0;

    for (let otherIndex = 0; otherIndex < birds.length; otherIndex++) {
      if (otherIndex === index) continue;
      const other = birds[otherIndex];
      let dx = other.x - bird.x;
      let dy = other.y - bird.y;
      if (dx > WIDTH / 2) dx -= WIDTH;
      else if (dx < -WIDTH / 2) dx += WIDTH;
      if (dy > HEIGHT / 2) dy -= HEIGHT;
      else if (dy < -HEIGHT / 2) dy += HEIGHT;

      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared === 0) continue;
      const distance = Math.sqrt(distanceSquared);
      if (distance < neighborRadius) {
        neighbors++;
        velocityX += other.vx;
        velocityY += other.vy;
        displacementX += dx;
        displacementY += dy;
        if (distance < 24) {
          separationX -= dx / distanceSquared;
          separationY -= dy / distanceSquared;
        }
      }
    }

    let alignmentX = 0;
    let alignmentY = 0;
    let cohesionX = 0;
    let cohesionY = 0;
    if (neighbors > 0) {
      alignmentX = velocityX / neighbors - bird.vx;
      alignmentY = velocityY / neighbors - bird.vy;
      cohesionX = displacementX / neighbors;
      cohesionY = displacementY / neighbors;
    }

    let vx = bird.vx
      + weights.separation * separationX
      + weights.alignment * alignmentX
      + weights.cohesion * cohesionX;
    let vy = bird.vy
      + weights.separation * separationY
      + weights.alignment * alignmentY
      + weights.cohesion * cohesionY;
    if (predator) {
      let dx = bird.x - predator.x;
      let dy = bird.y - predator.y;
      if (dx > WIDTH / 2) dx -= WIDTH;
      else if (dx < -WIDTH / 2) dx += WIDTH;
      if (dy > HEIGHT / 2) dy -= HEIGHT;
      else if (dy < -HEIGHT / 2) dy += HEIGHT;
      const distance = Math.hypot(dx, dy);
      if (distance < 160) {
        const magnitude = 0.8 * (1 - distance / 160);
        if (distance === 0) vx += magnitude;
        else {
          vx += (dx / distance) * magnitude;
          vy += (dy / distance) * magnitude;
        }
      }
    }
    const speed = Math.hypot(vx, vy);
    if (speed > 3) {
      const scale = 3 / speed;
      vx *= scale;
      vy *= scale;
    }

    return {
      x: ((bird.x + vx) % WIDTH + WIDTH) % WIDTH,
      y: ((bird.y + vy) % HEIGHT + HEIGHT) % HEIGHT,
      vx,
      vy,
    };
  });
}
