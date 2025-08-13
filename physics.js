export function step(state, dt){
  state.simTime += dt;
  state.worldTime += dt;
  state.advanceWeather(dt);

  if (state.fire){
    state.fire.t -= dt;
    if (state.fire.t <= 0) state.fire = null;
  }

  state.accPlant += dt;
  while (state.accPlant >= 0.5){
    state.accPlant -= 0.5;
    state.growPlants();
  }

  applyCrowdingDecay(state);
  rebuildSpatialGrid(state);
  updateAnimals(state, dt);
}

function applyCrowdingDecay(state) {
  const totalTiles = state.WORLD_W * state.WORLD_H;
  const cSmall = state.crowdSmall;
  const cMed = state.crowdMedium;
  const cLarge = state.crowdLarge;
  for (let i = 0; i < totalTiles; i++) {
    cSmall[i] *= state.CROWD_DECAY;
    cMed[i] *= state.CROWD_DECAY;
    cLarge[i] *= state.CROWD_DECAY;
  }
}

function rebuildSpatialGrid(state) {
  const grid = state.grid;
  const cSmall = state.crowdSmall;
  const cMed = state.crowdMedium;
  const cLarge = state.crowdLarge;
  for (let i = 0; i < grid.length; i++) grid[i].length = 0;
  for (const a of state.animals) {
    const gx = Math.floor(a.x / state.GRID_SIZE);
    const gy = Math.floor(a.y / state.GRID_SIZE);
    const gi = state.cellIndex(gx, gy);
    grid[gi].push(a);

    const ti = state.idx(Math.floor(a.x), Math.floor(a.y));
    if (a.r < state.SMALL_LIMIT) cSmall[ti] += 1;
    else if (a.r < state.LARGE_LIMIT) cMed[ti] += 1;
    else cLarge[ti] += 1;
  }
}

function updateAnimals(state, dt) {
  const cSmall = state.crowdSmall;
  const cMed = state.crowdMedium;
  const cLarge = state.crowdLarge;
  for (let i = state.animals.length - 1; i >= 0; i--) {
    const a = state.animals[i];
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.age += dt;

    if (a.age > a.genes.lifespan) {
      state.animals.splice(i, 1);
      continue;
    }

    const cfg = state.speciesConfig[a.sp];
    const night = state.isNight();
    const speedNightMul = night ? (cfg.nightSpeedMul || 1.0) : 1.0;
    const visionNightMul = night ? (cfg.nightVisionMul || 1.0) : 1.0;

    const effSpeed = (a.speed * a.genes.speedMul) * speedNightMul;
    const hungerRate = cfg.hungerRate * a.genes.metabolismMul * (state.mortalityMul[a.sp] || 1);

    a.energy -= hungerRate * dt;
    const vision = (cfg.vision * a.genes.visionMul) * visionNightMul;
    const diet = cfg.diet || {};
    const preySpecies = Object.keys(diet).filter(k => k !== 'PLANT');
    const prey = preySpecies.length ? state.nearestOfSpecies(a, preySpecies, vision) : null;

    const predators = [];
    for (const [sp, scfg] of Object.entries(state.speciesConfig)) {
      if (scfg.diet && scfg.diet[a.sp]) predators.push(sp);
    }
    const threat = predators.length ? state.nearestOfSpecies(a, predators, vision) : null;

    const tx = Math.floor(a.x);
    const ty = Math.floor(a.y);
    const tid = state.idx(tx, ty);
    let crowdCount, crowdThresh, crowdArr;
    if (a.r < state.SMALL_LIMIT) {
      crowdCount = cSmall[tid];
      crowdThresh = state.CROWD_THRESH.small;
      crowdArr = cSmall;
    } else if (a.r < state.LARGE_LIMIT) {
      crowdCount = cMed[tid];
      crowdThresh = state.CROWD_THRESH.medium;
      crowdArr = cMed;
    } else {
      crowdCount = cLarge[tid];
      crowdThresh = state.CROWD_THRESH.large;
      crowdArr = cLarge;
    }
    const overcrowded = crowdCount > crowdThresh;

    if (threat) {
      const ang = Math.atan2(a.y - threat.y, a.x - threat.x);
      a.dir = ang + (Math.random() - 0.5) * 0.6;
    } else if (prey) {
      const ang = Math.atan2(prey.y - a.y, prey.x - a.x);
      a.dir = ang + (Math.random() - 0.5) * 0.2;
    } else {
      a.dir += (Math.random() - 0.5) * a.wobble * dt * (cfg.wanderFactor || 1.5);
    }

    // Bias movement away from crowded tiles
    if (overcrowded) {
      const neigh = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let bestAng = null;
      let best = crowdCount;
      for (const [dx, dy] of neigh) {
        const nx = state.clamp(tx + dx, 0, state.WORLD_W - 1);
        const ny = state.clamp(ty + dy, 0, state.WORLD_H - 1);
        const c = crowdArr[state.idx(nx, ny)];
        if (c < best) {
          best = c;
          bestAng = Math.atan2(dy, dx);
        }
      }
      if (bestAng !== null) {
        a.dir = a.dir * 0.7 + bestAng * 0.3;
      }
    }

    state.moveCreature(a, dt, effSpeed);
    state.clampInside(a);
    state.eatPlant(a);

    if (prey && state.dist2(a, prey) < (a.r * state.TILE + prey.r * state.TILE) * (a.r * state.TILE + prey.r * state.TILE)) {
      const dietEntry = cfg.diet[prey.sp];
      if (dietEntry) a.energy += state.speciesConfig[prey.sp].preyEnergy;
      const idxPrey = state.animals.indexOf(prey);
      if (idxPrey !== -1) state.animals.splice(idxPrey, 1);
    }

    handleReproduction(state, a, cfg, crowdCount, crowdThresh, overcrowded);

    if (a.energy <= 0) {
      state.animals.splice(i, 1);
    }
  }
}

function handleReproduction(state, a, cfg, crowdCount, crowdThresh, overcrowded) {
  const thresh = cfg.reproThreshold * (state.reproThresholdMul[a.sp] || 1);
  if (a.energy > thresh && a.cooldown <= 0 && state.spawnEnabled[a.sp]) {
    let chance = state.spawnRate[a.sp] || 1;
    if (overcrowded) chance *= crowdThresh / crowdCount;
    chance = Math.min(1, Math.max(0, chance));
    if (Math.random() < chance) {
      state.reproduce(a, a.sp);
      a.energy -= cfg.reproCost;
      a.cooldown = cfg.reproCooldown;
    }
  }
}
