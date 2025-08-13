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

  // Rebuild spatial grid for faster neighborhood queries
  const grid = state.grid;
  for (let i=0;i<grid.length;i++) grid[i].length = 0;
  for (const a of state.animals){
    const gx = Math.floor(a.x / state.GRID_SIZE);
    const gy = Math.floor(a.y / state.GRID_SIZE);
    const gi = state.cellIndex(gx,gy);
    grid[gi].push(a);
  }

  for (let i=state.animals.length-1; i>=0; i--){
    const a = state.animals[i];
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.age += dt;

    if (a.age > a.genes.lifespan){ state.animals.splice(i,1); continue; }

    const cfg = state.speciesConfig[a.sp];
    const night = state.isNight();
    const speedNightMul = night ? (cfg.nightSpeedMul || 1.0) : 1.0;
    const visionNightMul = night ? (cfg.nightVisionMul || 1.0) : 1.0;

    const effSpeed = (a.speed * a.genes.speedMul) * speedNightMul;
    const hungerRate = cfg.hungerRate * a.genes.metabolismMul;

    a.energy -= hungerRate * dt;
    const vision = (cfg.vision * a.genes.visionMul) * visionNightMul;
    const threat = state.nearestPredator(a, vision);
    const prey = state.nearestPrey(a, vision);

    if (threat){
      const ang = Math.atan2(a.y - threat.y, a.x - threat.x);
      a.dir = ang + (Math.random()-0.5)*0.6;
    } else if (prey){
      const ang = Math.atan2(prey.y - a.y, prey.x - a.x);
      a.dir = ang + (Math.random()-0.5)*0.2;
    } else {
      a.dir += (Math.random()-0.5) * a.wobble * dt * (cfg.wanderFactor || 1.5);
    }

    state.moveCreature(a, dt, effSpeed);
    state.clampInside(a);
    state.eatPlant(a);

    if (prey && state.dist2(a, prey) < (a.r*state.TILE + prey.r*state.TILE) * (a.r*state.TILE + prey.r*state.TILE)){
      const diet = cfg.diet[prey.sp];
      if (diet) a.energy += diet.energy;
      const idxPrey = state.animals.indexOf(prey);
      if (idxPrey !== -1) state.animals.splice(idxPrey,1);
    }

    if (a.energy > cfg.reproThreshold && a.cooldown<=0){
      state.reproduce(a, a.sp);
      a.energy -= cfg.reproCost;
      a.cooldown = cfg.reproCooldown;
    }

    if (a.energy <= 0){ state.animals.splice(i,1); }
  }
}
