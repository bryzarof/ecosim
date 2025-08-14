'use strict';

import { terrain, soilMoisture, plant, animals, speciesConfig, WORLD_W, WORLD_H, BIOME, idx } from './worldConfig.js';

export function runSelfTests(state, applyActionAt, TOOL, defaultGenes){
  const tests = [];
  const add = (name, pass, info='') => tests.push({ name, pass, info });

  // Tamaños de buffers del mundo
  add('terrain tamaño', terrain.length === WORLD_W*WORLD_H);
  add('soilMoisture tamaño', soilMoisture.length === WORLD_W*WORLD_H);
  // Asegura rango [0,1] en plantas
  add('plant [0,1]', (()=>{ for (let i=0;i<plant.length;i++){ const v=plant[i]; if(!(v>=0 && v<=1)) return false; } return true; })());
  add('soilMoisture [0,1]', (()=>{ for (let i=0;i<soilMoisture.length;i++){ const v=soilMoisture[i]; if(!(v>=0 && v<=1)) return false; } return true; })());

  // Poblaciones iniciales
  const h0 = animals.filter(a=>a.sp==='HERB').length;
  const c0 = animals.filter(a=>a.sp==='CARN').length;
  const r0 = animals.filter(a=>a.sp==='RODENT').length;
  const w0 = animals.filter(a=>a.sp==='WOLF').length;
  const p0 = animals.filter(a=>a.sp==='POLLINATOR').length;
  add('HERB_START', h0 === speciesConfig.HERB.start, `h0=${h0}`);
  add('CARN_START', c0 === speciesConfig.CARN.start, `c0=${c0}`);
  add('RODENT_START', r0 === speciesConfig.RODENT.start, `r0=${r0}`);
  add('WOLF_START', w0 === speciesConfig.WOLF.start, `w0=${w0}`);
  add('POLL_START', p0 === speciesConfig.POLLINATOR.start, `p0=${p0}`);

  // UI básica presente
  add('Toolbar presente', !!document.getElementById('toolbar'));

  // Pruebas de herramientas (sobre un tile de GRASS real si existe)
  const findGrassTile = ()=>{
    for(let yy=0; yy<WORLD_H; yy++){
      for(let xx=0; xx<WORLD_W; xx++){
        if (terrain[idx(xx,yy)]===BIOME.GRASS) return {x:xx,y:yy};
      }
    }
    return {x:5,y:5}; // Fallback (poco probable no hallar GRASS)
  };
  const {x:gx,y:gy} = findGrassTile();
  const idG = idx(gx,gy); const oldPlant=plant[idG];
  applyActionAt(state,gx,gy,TOOL.FOOD); add('Comida aumenta planta', plant[idG] >= oldPlant);

  // Verifica FIX de RNG: defaultGenes sin rng debe funcionar y estar en rango
  let okGenes = true; let g;
  try { g = defaultGenes('HERB'); } catch(e){ okGenes = false; }
  add('defaultGenes() sin rng no falla', okGenes);
  if (okGenes){
    add('speedMul rango', g.speedMul>=0.75 && g.speedMul<=1.35, `v=${g.speedMul.toFixed(3)}`);
    add('metabolismMul rango', g.metabolismMul>=0.7 && g.metabolismMul<=1.5, `v=${g.metabolismMul.toFixed(3)}`);
    add('visionMul rango', g.visionMul>=0.7 && g.visionMul<=1.6, `v=${g.visionMul.toFixed(3)}`);
    add('lifespan rango', g.lifespan>=160 && g.lifespan<=240, `v=${g.lifespan}`);
  }

  // Añadir animal mediante herramienta debe incrementar población
  const before = animals.length;
  applyActionAt(state,gx,gy,TOOL.ADD_HERB);
  add('ADD_HERB incrementa población', animals.length === before+1, `before=${before} now=${animals.length}`);

  // Cambios de terreno por herramientas
  applyActionAt(state,gx,gy,TOOL.WATER);   add('Agua cambia a WATER', terrain[idG] === BIOME.WATER);
  applyActionAt(state,gx,gy,TOOL.BARRIER); add('Barrera cambia a BARRIER', terrain[idG] === BIOME.BARRIER);

  // Reporte visual breve
  const passed = tests.filter(t=>t.pass).length;
  const el = document.createElement('div'); el.className = 'tests'; el.innerHTML = `<b>Self-tests:</b> ${passed}/${tests.length} OK`;
  document.body.appendChild(el);
  console.group('%cSelf-tests Fase 4','color:#60a5fa');
  tests.forEach(t=>console[t.pass? 'log': 'error'](`${t.pass?'✔':'✖'} ${t.name}${t.info? ' — '+t.info:''}`));
  console.groupEnd();
}
