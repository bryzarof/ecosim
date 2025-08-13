export function render(state){
  const { ctx, WORLD_W, WORLD_H, TILE, terrain, plant, COLORS, BIOME, animals, SPECIES, weatherState, WEATHER, fire } = state;
  let { flashTimer } = state;

  for(let y=0; y<WORLD_H; y++){
    for(let x=0; x<WORLD_W; x++){
      const id = state.idx(x,y);
      const t = terrain[id];
      if (t === BIOME.WATER){ ctx.fillStyle = COLORS.WATER; }
      else if (t === BIOME.DIRT){ ctx.fillStyle = COLORS.DIRT; }
      else if (t === BIOME.BARRIER){ ctx.fillStyle = COLORS.BARRIER; }
      else { const p = plant[id]; ctx.fillStyle = p > 0.66 ? COLORS.GRASS2 : (p > 0.33 ? COLORS.GRASS1 : COLORS.GRASS0); }
      ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
    }
  }

  ctx.globalAlpha = 0.08; ctx.fillStyle = COLORS.SHORE;
  for(let y=0; y<WORLD_H; y++){
    for(let x=0; x<WORLD_W; x++){
      if (terrain[state.idx(x,y)] !== BIOME.DIRT) continue;
      let nearWater=false;
      for(let dy=-1; dy<=1; dy++){
        for(let dx=-1; dx<=1; dx++){
          const nx=x+dx, ny=y+dy;
          if (nx<0||ny<0||nx>=WORLD_W||ny>=WORLD_H) continue;
          if (terrain[state.idx(nx,ny)]===BIOME.WATER){ nearWater=true; break; }
        }
        if(nearWater) break;
      }
      if (nearWater) ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
    }
  }
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.35; ctx.fillStyle = COLORS.GRASS2;
  for(let y=0; y<WORLD_H; y++){
    for(let x=0; x<WORLD_W; x++){
      if (terrain[state.idx(x,y)] !== BIOME.GRASS) continue;
      const p = plant[state.idx(x,y)]; if (p < 0.2) continue;
      const n = (p*3)|0;
      for(let i=0;i<n;i++){
        const ox = (Math.random()*0.8+0.1)*TILE; const oy = (Math.random()*0.8+0.1)*TILE;
        ctx.fillRect(x*TILE+ox, y*TILE+oy, 1, 2);
      }
    }
  }
  ctx.globalAlpha = 1;

  for(const a of animals){
    ctx.fillStyle = (a.sp===SPECIES.HERB) ? '#fef08a' : '#ef4444';
    const r = a.r * TILE;
    ctx.beginPath(); ctx.arc(a.x*TILE, a.y*TILE, r, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); const ear = r*0.7;
    ctx.moveTo(a.x*TILE + Math.cos(a.dir)*r, a.y*TILE + Math.sin(a.dir)*r);
    ctx.lineTo(a.x*TILE + Math.cos(a.dir+0.8)*ear, a.y*TILE + Math.sin(a.dir+0.8)*ear);
    ctx.lineTo(a.x*TILE + Math.cos(a.dir-0.8)*ear, a.y*TILE + Math.sin(a.dir-0.8)*ear);
    ctx.closePath(); ctx.fill();
  }

  const nightAlpha = 1 - state.daylightFactor();
  if (nightAlpha > 0.02){ ctx.fillStyle = `rgba(6, 8, 14, ${0.55*nightAlpha})`; ctx.fillRect(0,0,WORLD_W*TILE, WORLD_H*TILE); }

  if (weatherState===WEATHER.RAIN){
    ctx.globalAlpha = 0.4; ctx.strokeStyle = '#93c5fd';
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
