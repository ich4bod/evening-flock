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
