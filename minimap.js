export function initMinimap(state){
  const cvs = document.getElementById('minimap');
  if(!cvs) return;
  cvs.width = cvs.clientWidth * state.DPR;
  cvs.height = cvs.clientHeight * state.DPR;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  state.minimap = { cvs, ctx };

  cvs.addEventListener('click', e => {
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * state.WORLD_W;
    const my = (e.clientY - rect.top) / rect.height * state.WORLD_H;
    const viewW = window.innerWidth / (state.TILE * state.scale);
    const viewH = window.innerHeight / (state.TILE * state.scale);
    state.camX = Math.max(0, Math.min(state.WORLD_W - viewW, mx - viewW/2));
    state.camY = Math.max(0, Math.min(state.WORLD_H - viewH, my - viewH/2));
    if (state.applyCamera) state.applyCamera();
  });
}

export function updateMinimap(state){
  const mm = state.minimap; if(!mm) return;
  const { cvs, ctx } = mm;
  const { WORLD_W, WORLD_H, terrain, BIOME, animals, COLORS } = state;
  const w = cvs.width, h = cvs.height;
  const tileW = w / WORLD_W, tileH = h / WORLD_H;
  ctx.clearRect(0,0,w,h);
  for(let y=0;y<WORLD_H;y++){
    for(let x=0;x<WORLD_W;x++){
      const t = terrain[state.idx(x,y)];
      let color = COLORS.GRASS1;
      if(t===BIOME.WATER) color = COLORS.WATER;
      else if(t===BIOME.DIRT) color = COLORS.DIRT;
      else if(t===BIOME.BARRIER) color = COLORS.BARRIER;
      ctx.fillStyle = color;
      ctx.fillRect(x*tileW, y*tileH, tileW, tileH);
    }
  }
  const spColor = {
    HERB:'#a3e635',
    CARN:'#ef4444',
    RODENT:'#fde68a',
    WOLF:'#9ca3af',
    POLLINATOR:'#facc15'
  };
  for(const a of animals){
    ctx.fillStyle = spColor[a.sp] || '#fff';
    ctx.fillRect(a.x*tileW-1, a.y*tileH-1, 2,2);
  }
}
