import { initRadialMenu } from './src/ui/radialMenu.js';
import { saveSettings } from './src/state/persistence.js';
import { TOOL } from './main.js';

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
    case TOOL.ADD_HERB: {
      const cfg = state.speciesConfig.HERB;
      state.animals.push({
        sp: 'HERB', x:x+0.5, y:y+0.5, dir:Math.random()*Math.PI*2,
        speed: cfg.baseSpeed, wobble: 0.4, r:cfg.radius, energy:cfg.addEnergy ?? cfg.initEnergy, cooldown:0, age:0,
        genes: state.defaultGenes('HERB')
      });
      break; }
    case TOOL.ADD_CARN: {
      const cfg = state.speciesConfig.CARN;
      state.animals.push({
        sp: 'CARN', x:x+0.5, y:y+0.5, dir:Math.random()*Math.PI*2,
        speed: cfg.baseSpeed, wobble: 0.4, r:cfg.radius, energy:cfg.addEnergy ?? cfg.initEnergy, cooldown:0, age:0,
        genes: state.defaultGenes('CARN')
      });
      break; }
    case TOOL.ADD_RODENT: {
      const cfg = state.speciesConfig.RODENT;
      state.animals.push({
        sp: 'RODENT', x:x+0.5, y:y+0.5, dir:Math.random()*Math.PI*2,
        speed: cfg.baseSpeed, wobble: 0.4, r:cfg.radius, energy:cfg.addEnergy ?? cfg.initEnergy, cooldown:0, age:0,
        genes: state.defaultGenes('RODENT')
      });
      break; }
    case TOOL.ADD_WOLF: {
      const cfg = state.speciesConfig.WOLF;
      state.animals.push({
        sp: 'WOLF', x:x+0.5, y:y+0.5, dir:Math.random()*Math.PI*2,
        speed: cfg.baseSpeed, wobble: 0.4, r:cfg.radius, energy:cfg.addEnergy ?? cfg.initEnergy, cooldown:0, age:0,
        genes: state.defaultGenes('WOLF')
      });
      break; }
    case TOOL.ADD_POLLINATOR: {
      const cfg = state.speciesConfig.POLLINATOR;
      state.animals.push({
        sp: 'POLLINATOR', x:x+0.5, y:y+0.5, dir:Math.random()*Math.PI*2,
        speed: cfg.baseSpeed, wobble: 0.4, r:cfg.radius, energy:cfg.addEnergy ?? cfg.initEnergy, cooldown:0, age:0,
        genes: state.defaultGenes('POLLINATOR')
      });
      break; }
    case TOOL.ERASER: {
      const r=2; const r2=r*r;
      for (let i=state.animals.length-1;i>=0;i--){
        const a=state.animals[i];
        const dx=a.x-(x+0.5), dy=a.y-(y+0.5);
        if (dx*dx+dy*dy < r2) state.animals.splice(i,1);
      }
      break; }
    case TOOL.FOOD:
      if (state.terrain[id]===state.BIOME.GRASS){ state.plant[id] = state.clamp(state.plant[id] + 0.35, 0, 1); }
      break;
    case TOOL.WATER:
      state.terrain[id] = state.BIOME.WATER; state.plant[id] = 0; state.redrawTerrain = true;
      break;
    case TOOL.BARRIER:
      state.terrain[id] = state.BIOME.BARRIER; state.plant[id] = 0; state.redrawTerrain = true;
      break;
    case TOOL.INSPECT: {
      const nearest = nearestAnimalTo(state,x+0.5,y+0.5,3);
      if (nearest){
        console.log('Animal', {sp:nearest.sp, x:nearest.x, y:nearest.y, energy:nearest.energy, age:nearest.age, genes:nearest.genes});
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
  const toolButtons = Array.from(state.toolbar.querySelectorAll('button[data-tool]'));
  toolButtons.forEach(btn=>{
    btn.addEventListener('click', ()=> setTool(state, btn.dataset.tool));
  });

  let dragging=false;
  state.cvs.addEventListener('mousedown', e=>{ dragging=true; handleAt(state,e); });
  state.cvs.addEventListener('mousemove', e=>{ if(dragging) handleAt(state,e); });
  window.addEventListener('mouseup', ()=> dragging=false);
  state.cvs.addEventListener('click', e=>{ if(!dragging) handleAt(state,e); });

  window.addEventListener('keydown', (e)=>{
    const num = parseInt(e.key,10);
    if(num>=1 && num<=toolButtons.length){
      setTool(state, toolButtons[num-1].dataset.tool);
    } else if(e.key==='f' || e.key==='F') state.triggerFireCenter();
    else if(e.key==='m' || e.key==='M') state.strikeMeteor();
    else if(e.key==='p' || e.key==='P') state.plague('HERB',0.35);
    else if(e.key==='o' || e.key==='O') state.plague('CARN',0.5);
  });

  document.getElementById('evtFire').addEventListener('click', state.triggerFireCenter);
  document.getElementById('evtMeteor').addEventListener('click', state.strikeMeteor);
  document.getElementById('evtPlagueH').addEventListener('click', ()=> state.plague('HERB',0.35));
  document.getElementById('evtPlagueC').addEventListener('click', ()=> state.plague('CARN',0.5));

  const radialRoot = document.getElementById('radialMenu');
  if(radialRoot){
    initRadialMenu(radialRoot,[
      { label:'\uD83D\uDD0D', onSelect:()=> setTool(state, TOOL.INSPECT) },
      { label:'\uD83D\uDC07', onSelect:()=> setTool(state, TOOL.ADD_HERB) },
      { label:'\uD83E\uDD8A', onSelect:()=> setTool(state, TOOL.ADD_CARN) },
      { label:'\uD83D\uDC00', onSelect:()=> setTool(state, TOOL.ADD_RODENT) },
      { label:'\uD83D\uDC3A', onSelect:()=> setTool(state, TOOL.ADD_WOLF) },
      { label:'\uD83D\uDC1D', onSelect:()=> setTool(state, TOOL.ADD_POLLINATOR) },
      { label:'\uD83C\uDF3F', onSelect:()=> setTool(state, TOOL.FOOD) }
    ]);
  }

  const panel = document.getElementById('speciesPanel');
  if (panel){
    panel.querySelectorAll('.sp').forEach(row=>{
      const sp = row.dataset.sp;
      const spawnT = row.querySelector('.spawn-toggle');
      const visT = row.querySelector('.vis-toggle');
      const sRate = row.querySelector('.spawnRate');
      const rMul = row.querySelector('.reproThresholdMul');
      const mMul = row.querySelector('.mortalityMul');

      if (spawnT){
        spawnT.checked = state.spawnEnabled[sp];
        spawnT.addEventListener('change',()=>{
          state.spawnEnabled[sp] = spawnT.checked;
          saveSettings(state.settings);
        });
      }
      if (visT){
        visT.checked = !state.hiddenSpecies[sp];
        visT.addEventListener('change',()=>{
          state.hiddenSpecies[sp] = !visT.checked;
          saveSettings(state.settings);
        });
      }
      if (sRate){
        sRate.value = state.spawnRate[sp];
        sRate.addEventListener('input',()=>{
          state.spawnRate[sp] = parseFloat(sRate.value);
          saveSettings(state.settings);
        });
      }
      if (rMul){
        rMul.value = state.reproThresholdMul[sp];
        rMul.addEventListener('input',()=>{
          state.reproThresholdMul[sp] = parseFloat(rMul.value);
          saveSettings(state.settings);
        });
      }
      if (mMul){
        mMul.value = state.mortalityMul[sp];
        mMul.addEventListener('input',()=>{
          state.mortalityMul[sp] = parseFloat(mMul.value);
          saveSettings(state.settings);
        });
      }
    });
  }
}
