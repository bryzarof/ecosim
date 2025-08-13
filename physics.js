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

    const base = (a.sp===state.SPECIES.HERB?state.HERB:state.CARN);
    const night = state.isNight();
    const speedNightMul = (a.sp===state.SPECIES.CARN) ? (night?1.1:1.0) : (night?0.9:1.0);
    const visionNightMul = (a.sp===state.SPECIES.CARN) ? (night?1.1:1.0) : (night?0.9:1.0);

    const effSpeed = (a.speed * a.genes.speedMul) * speedNightMul;
    const hungerRate = (a.sp===state.SPECIES.HERB?state.HERB.hungerRate:state.CARN.hungerRate) * a.genes.metabolismMul;

    if (a.sp === state.SPECIES.HERB){
      a.energy -= hungerRate * dt;
      const threat = state.nearestPredator(a, (base.vision * a.genes.visionMul) * visionNightMul);
      if (threat){
        const ang = Math.atan2(a.y - threat.y, a.x - threat.x);
        a.dir = ang + (Math.random()-0.5)*0.6;
      } else {
        a.dir += (Math.random()-0.5) * a.wobble * dt * 2.0;
      }
      state.moveCreature(a, dt, effSpeed);
      state.clampInside(a);
      state.eatPlant(a);
      if (a.energy > state.HERB.reproThreshold && a.cooldown<=0){
        state.reproduce(a, state.SPECIES.HERB);
        a.energy -= state.HERB.reproCost;
        a.cooldown = 5;
      }
    } else {
      a.energy -= hungerRate * dt;
      const prey = state.nearestHerbivore(a, (base.vision * a.genes.visionMul) * visionNightMul);
      if (prey){
        const ang = Math.atan2(prey.y - a.y, prey.x - a.x);
        a.dir = ang + (Math.random()-0.5)*0.2;
      } else {
        a.dir += (Math.random()-0.5) * a.wobble * dt * 1.3;
      }
      state.moveCreature(a, dt, effSpeed);
      state.clampInside(a);
      if (prey && state.dist2(a, prey) < (a.r*state.TILE + prey.r*state.TILE) * (a.r*state.TILE + prey.r*state.TILE)){
        a.energy += state.CARN.eatRate;
        const idxPrey = state.animals.indexOf(prey);
        if (idxPrey !== -1) state.animals.splice(idxPrey,1);
      }
      if (a.energy > state.CARN.reproThreshold && a.cooldown<=0){
        state.reproduce(a, state.SPECIES.CARN);
        a.energy -= state.CARN.reproCost;
        a.cooldown = 7;
      }
    }

    if (a.energy <= 0){ state.animals.splice(i,1); }
  }
}
