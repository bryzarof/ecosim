export function setTool(state, t){
  state.activeTool = t;
  for (const btn of state.toolbar.querySelectorAll('button[data-tool]'))
    btn.classList.toggle('active', btn.dataset.tool===t);
}

function getTileFromEvent(state, e){
  const rect = state.cvs.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / (state.TILE * (rect.width / (state.WORLD_W*state.TILE))));
  const y = Math.floor((e.clientY - rect.top) / (state.TILE * (rect.height / (state.WORLD_H*state.TILE))));
  return {x: state.clamp(Math.floor(x),0,state.WORLD_W-1), y: state.clamp(Math.floor(y),0,state.WORLD_H-1)};
}

function handleAt(state, e){
  const {x,y} = getTileFromEvent(state,e);
  applyActionAt(state,x,y,state.activeTool);
}

export function applyActionAt(state,x,y,action){
  const id = state.idx(x,y);
  switch(action){
    case state.TOOL.ADD_HERB:
      state.animals.push({
        sp: state.SPECIES.HERB, x:x+0.5, y:y+0.5, dir:Math.random()*Math.PI*2,
        speed: state.HERB.baseSpeed, wobble: 0.4, r:0.32, energy:1.0, cooldown:0, age:0,
        genes: state.defaultGenes(state.SPECIES.HERB)
      });
      break;
    case state.TOOL.ADD_CARN:
      state.animals.push({
        sp: state.SPECIES.CARN, x:x+0.5, y:y+0.5, dir:Math.random()*Math.PI*2,
        speed: state.CARN.baseSpeed, wobble: 0.4, r:0.36, energy:1.2, cooldown:0, age:0,
        genes: state.defaultGenes(state.SPECIES.CARN)
      });
      break;
    case state.TOOL.ERASER: {
      const r=2; const r2=r*r;
      for (let i=state.animals.length-1;i>=0;i--){
        const a=state.animals[i];
        const dx=a.x-(x+0.5), dy=a.y-(y+0.5);
        if (dx*dx+dy*dy < r2) state.animals.splice(i,1);
      }
      break; }
    case state.TOOL.FOOD:
      if (state.terrain[id]===state.BIOME.GRASS){ state.plant[id] = state.clamp(state.plant[id] + 0.35, 0, 1); }
      break;
    case state.TOOL.WATER:
      state.terrain[id] = state.BIOME.WATER; state.plant[id] = 0;
      break;
    case state.TOOL.BARRIER:
      state.terrain[id] = state.BIOME.BARRIER; state.plant[id] = 0;
      break;
    case state.TOOL.INSPECT: {
      const nearest = nearestAnimalTo(state,x+0.5,y+0.5,3);
      if (nearest){
        console.log('Animal', {sp:nearest.sp===state.SPECIES.HERB?'HERB':'CARN', x:nearest.x, y:nearest.y, energy:nearest.energy, age:nearest.age, genes:nearest.genes});
      }
      break; }
  }
}

function nearestAnimalTo(state,x,y,maxR){
  let best=null, bestD=maxR*maxR;
  for(const a of state.animals){
    const dx=a.x-x, dy=a.y-y; const d=dx*dx+dy*dy;
    if (d<bestD){ bestD=d; best=a; }
  }
  return best;
}

export function setupUI(state){
  state.toolbar.querySelectorAll('button[data-tool]').forEach(btn=>{
    btn.addEventListener('click', ()=> setTool(state, btn.dataset.tool));
  });

  let dragging=false;
  state.cvs.addEventListener('mousedown', e=>{ dragging=true; handleAt(state,e); });
  state.cvs.addEventListener('mousemove', e=>{ if(dragging) handleAt(state,e); });
  window.addEventListener('mouseup', ()=> dragging=false);
  state.cvs.addEventListener('click', e=>{ if(!dragging) handleAt(state,e); });

  window.addEventListener('keydown', (e)=>{
    const map = { '1':'inspect','2':'add_herb','3':'eraser','4':'food','5':'water','6':'barrier' };
    if(map[e.key]) setTool(state, map[e.key]);
    else if(e.key==='f' || e.key==='F') state.triggerFireCenter();
    else if(e.key==='m' || e.key==='M') state.strikeMeteor();
    else if(e.key==='p' || e.key==='P') state.plague(state.SPECIES.HERB,0.35);
    else if(e.key==='o' || e.key==='O') state.plague(state.SPECIES.CARN,0.5);
  });

  document.getElementById('evtFire').addEventListener('click', state.triggerFireCenter);
  document.getElementById('evtMeteor').addEventListener('click', state.strikeMeteor);
  document.getElementById('evtPlagueH').addEventListener('click', ()=> state.plague(state.SPECIES.HERB,0.35));
  document.getElementById('evtPlagueC').addEventListener('click', ()=> state.plague(state.SPECIES.CARN,0.5));
}
