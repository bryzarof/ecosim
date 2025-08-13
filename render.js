export function render(state){
  const { ctx, WORLD_W, WORLD_H, TILE, terrain, plant, BIOME, animals, speciesConfig, weatherState, WEATHER, fire, sprites } = state;
  let { flashTimer } = state;

  // Pre-rendered terrain layer for performance
  if (state.redrawTerrain || !state.terrainCanvas){
    const tcv = state.terrainCanvas || (state.terrainCanvas = document.createElement('canvas'));
    tcv.width = WORLD_W*TILE;
    tcv.height = WORLD_H*TILE;
    const tctx = tcv.getContext('2d');
    for(let y=0; y<WORLD_H; y++){
      for(let x=0; x<WORLD_W; x++){
        const id = state.idx(x,y);
        const t = terrain[id];
        let img = sprites.terrain.grass;
        if (t === BIOME.WATER) img = sprites.terrain.water;
        else if (t === BIOME.DIRT) img = sprites.terrain.dirt;
        else if (t === BIOME.BARRIER) img = sprites.terrain.barrier;
        tctx.drawImage(img, x*TILE, y*TILE, TILE, TILE);
      }
    }
    state.redrawTerrain = false;
  }
  ctx.drawImage(state.terrainCanvas,0,0);

  // Plant sprites with growth-based scaling
  for(let y=0; y<WORLD_H; y++){
    for(let x=0; x<WORLD_W; x++){
      if (terrain[state.idx(x,y)] !== BIOME.GRASS) continue;
      const p = plant[state.idx(x,y)];
      if (p < 0.05) continue;
      const size = TILE * (0.3 + p*0.7);
      const px = x*TILE + (TILE-size)/2;
      const py = y*TILE + (TILE-size)/2;
      ctx.drawImage(sprites.plant, px, py, size, size);
    }
  }

  // Animated animal sprites
  const frame = Math.floor(state.simTime*6)%2;
  for(const a of animals){
    if (state.hiddenSpecies[a.sp]) continue;
    const imgSet = sprites[a.sp.toLowerCase()] || sprites.herb;
    const img = imgSet[frame];
    const size = a.r*2*TILE;
    ctx.save();
    ctx.translate(a.x*TILE, a.y*TILE);
    ctx.rotate(a.dir);
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  }

  // Time-of-day and weather color overlays
  const night = 1 - state.daylightFactor();
  if (night > 0.02){ ctx.globalAlpha = 0.55*night; ctx.fillStyle = '#06080e'; ctx.fillRect(0,0,WORLD_W*TILE, WORLD_H*TILE); ctx.globalAlpha=1; }

  if (weatherState===WEATHER.RAIN){
    ctx.globalAlpha = 0.15; ctx.fillStyle = '#0ea5e9'; ctx.fillRect(0,0,WORLD_W*TILE, WORLD_H*TILE); ctx.globalAlpha = 0.4; ctx.strokeStyle = '#93c5fd';
    for(let i=0;i<120;i++){ const x = Math.random()*WORLD_W*TILE; const y = Math.random()*WORLD_H*TILE; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+2,y+8); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else if (weatherState===WEATHER.DROUGHT){
    ctx.globalAlpha = 0.15; ctx.fillStyle = '#f59e0b'; ctx.fillRect(0,0,WORLD_W*TILE, WORLD_H*TILE); ctx.globalAlpha = 1;
  }

  if (fire){
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#fb923c';
    ctx.beginPath(); ctx.arc(fire.x*TILE, fire.y*TILE, fire.r*TILE, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (flashTimer>0){ flashTimer -= 1/60; ctx.globalAlpha = Math.max(0, flashTimer/0.3); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,WORLD_W*TILE, WORLD_H*TILE); ctx.globalAlpha = 1; }
  state.flashTimer = flashTimer;
}
