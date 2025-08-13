'use strict';
import { step } from './physics.js';
import { render } from './render.js';
import { setupUI, setTool, applyActionAt } from './ui.js';
import { sprites } from './sprites.js';
import { initHUD, updateHUD } from './hud.js';
import { initMinimap, updateMinimap } from './minimap.js';
import { initMainMenu } from './src/ui/mainMenu.js';
import { loadSettings, saveSettings } from './src/state/persistence.js';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/index.js';
import {
  TILE, WORLD_W, WORLD_H, DPR, DAY_LENGTH_SEC,
  WEATHER, WEATHER_NAMES, BIOME, COLORS,
  plant, terrain, soilMoisture,
  crowdSmall, crowdMedium, crowdLarge, pollinatorBoost,
  animals, SMALL_LIMIT, LARGE_LIMIT, CROWD_THRESH, CROWD_DECAY,
  GRID_SIZE, GRID_W, GRID_H, cellIndex, grid,
  idx, clamp, speciesConfig
} from './src/worldConfig.js';
import { generateTerrain, generateSoilMoisture } from './src/terrain.js';
import { seededRandom } from './src/utils/noise.js';
import {
  getWorldTime, setWorldTime,
  getSimTime, setSimTime,
  getWeatherState, setWeatherState,
  getWeatherTimer, setWeatherTimer,
  isNight, daylightFactor, advanceWeather
} from './src/weather.js';
import { runSelfTests } from './src/selfTests.js';

let state;

const speciesList = Object.keys(speciesConfig);
const spawnEnabled = Object.fromEntries(speciesList.map(s=>[s,true]));
const hiddenSpecies = Object.fromEntries(speciesList.map(s=>[s,false]));
const spawnRate = Object.fromEntries(speciesList.map(s=>[s,1]));
const reproThresholdMul = Object.fromEntries(speciesList.map(s=>[s,1]));
const mortalityMul = Object.fromEntries(speciesList.map(s=>[s,1]));

// Load persisted settings and merge with defaults
const settings = loadSettings();
if (settings.spawnEnabled) Object.assign(spawnEnabled, settings.spawnEnabled);
if (settings.hiddenSpecies) Object.assign(hiddenSpecies, settings.hiddenSpecies);
if (settings.spawnRate) Object.assign(spawnRate, settings.spawnRate);
if (settings.reproThresholdMul) Object.assign(reproThresholdMul, settings.reproThresholdMul);
if (settings.mortalityMul) Object.assign(mortalityMul, settings.mortalityMul);

// ==============================================================
//                         CANVAS SETUP
// ==============================================================
const cvs = /** @type {HTMLCanvasElement|null} */ (document.getElementById('sim'));
if (!(cvs instanceof HTMLCanvasElement)) {
  console.error('Canvas element with id "sim" not found');
  throw new Error('Canvas element with id "sim" not found');
}
const ctx = cvs.getContext('2d', { alpha:false });
if (!ctx) {
  console.error('Failed to get 2D context from canvas');
  throw new Error('Unable to acquire 2D context for canvas');
}

let camX = 0, camY = 0, scaleX = 1, scaleY = 1;

function resizeCanvas() {
  const worldPxW = WORLD_W * TILE;
  const worldPxH = WORLD_H * TILE;

  // Tamaño real del canvas acorde a la ventana y densidad de píxeles
  cvs.width = Math.floor(window.innerWidth * DPR);
  cvs.height = Math.floor(window.innerHeight * DPR);

  // Escala para ajustar el mundo al tamaño visible
  scaleX = window.innerWidth / worldPxW;
  scaleY = window.innerHeight / worldPxH;

  ctx.imageSmoothingEnabled = false;           // Look pixel-art
  ctx.setTransform(scaleX * DPR, 0, 0, scaleY * DPR, -camX * TILE * scaleX * DPR, -camY * TILE * scaleY * DPR);
  if (state) { state.scaleX = scaleX; state.scaleY = scaleY; }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ==============================================================
//                       POBLACIÓN / GENÉTICA
// ==============================================================
function spawnAnimals(){
  // Reinicia y spawnea poblaciones iniciales con RNG semillado para reproducibilidad
  animals.length = 0;
  const rng = seededRandom(42);
  for (const [name,cfg] of Object.entries(speciesConfig)){
    for(let i=0;i<cfg.start;i++) animals.push(spawnOne(rng, name));
  }
}

// Genera genes con RNG opcional; si no hay rngFn, usa Math.random
function defaultGenes(species, rngFn){
  const R = typeof rngFn === 'function' ? rngFn : Math.random;
  const base = speciesConfig[species].lifespan || 200;
  return {
    // Multiplicadores acotados respecto al valor base de la especie
    speedMul: clamp(0.95 + R()*0.10, 0.75, 1.35),
    metabolismMul: clamp(0.90 + R()*0.20, 0.70, 1.50),
    visionMul: clamp(0.90 + R()*0.20, 0.70, 1.60),
    lifespan: Math.floor(base * (0.8 + R()*0.4)) // 80%-120% del promedio
  };
}

function spawnOne(rng, species){
  // Busca hasta 50 intentos un tile GRASS para nacer
  let x=0,y=0;
  for(let t=0;t<50;t++){
    x = Math.floor(rng()*WORLD_W);
    y = Math.floor(rng()*WORLD_H);
    if (terrain[idx(x,y)] === BIOME.GRASS) break;
  }
  const cfg = speciesConfig[species];
  const genes = defaultGenes(species, rng); // Hereda/varía con RNG de spawn
  return {
    sp: species,                     // Especie
    x: x + 0.5, y: y + 0.5,          // Posición en coordenadas de tile (centro)
    dir: rng()*Math.PI*2,            // Dirección inicial en radianes
    speed: cfg.baseSpeed + rng()*0.35, // Velocidad base con ruido individual
    wobble: rng()*0.6 + 0.2,         // Zig-zag aleatorio
    r: cfg.radius + rng()*0.1,       // Radio de dibujo
    energy: cfg.initEnergy,
    cooldown: 0,                     // Tiempo hasta poder reproducirse de nuevo
    age: 0,                          // Edad acumulada
    genes                           // Objeto de genes
  };
}

// ==============================================================
//                        BUCLE DE SIMULACIÓN
// ==============================================================
let last = performance.now(); // Marca temporal del frame anterior
let accPlant = 0;             // Acumulador para paso de plantas (sub-steps)

// Eventos especiales globales
let fire = null;            // {x,y,r,t} incendio activo (centro, radio, tiempo restante)
const FIRE_DURATION = 8;    // Segundos que dura un incendio disparado
const METEOR_RADIUS = 6;    // Radio en tiles del impacto de meteorito


function growPlants(){
  // Regla local de crecimiento con factores: noche, clima, vecindad y agua cercana
  const night = isNight();

  // Pre-calcula tiles visitados por polinizadores (afecta crecimiento)
  pollinatorBoost.fill(0);
  for (const a of animals){
    if (a.sp !== 'POLLINATOR') continue;
    const tx = Math.floor(a.x);
    const ty = Math.floor(a.y);
    for(let dy=-1; dy<=1; dy++){
      for(let dx=-1; dx<=1; dx++){
        const nx = clamp(tx+dx, 0, WORLD_W-1);
        const ny = clamp(ty+dy, 0, WORLD_H-1);
        pollinatorBoost[idx(nx,ny)] = 1;
      }
    }
  }
  for(let y=0; y<WORLD_H; y++){
    for(let x=0; x<WORLD_W; x++){
      const id = idx(x,y);

      // Actualiza humedad del suelo
      let m = soilMoisture[id];
      if (state.weatherState===WEATHER.RAIN) m += 0.04;
      if (state.weatherState===WEATHER.DROUGHT) m -= 0.03;
      m -= 0.005; // evaporación base
      soilMoisture[id] = clamp(m, 0, 1);

      if (terrain[id] !== BIOME.GRASS) continue; // Solo crece en pasto
      let inc = 0.02;                            // Ritmo base
      if (state.weatherState===WEATHER.RAIN) inc += 0.03;     // Lluvia acelera
      if (state.weatherState===WEATHER.DROUGHT) inc -= 0.02;  // Sequía frena
      if (night) inc -= 0.005;                          // Noche penaliza un poco
      // Detecta agua en vecindad 8-conexa (beneficia crecimiento)
      let nearWater = false;
      for(let dy=-1; dy<=1; dy++){
        for(let dx=-1; dx<=1; dx++){
          const nx = x+dx, ny = y+dy;
          if (nx<0||ny<0||nx>=WORLD_W||ny>=WORLD_H) continue;
          if (terrain[idx(nx,ny)] === BIOME.WATER) { nearWater = true; break; }
        }
        if (nearWater) break;
      }
      if (nearWater) inc += 0.02;
      if (pollinatorBoost[id]) inc += 0.03; // Polinizadores aceleran crecimiento
      // Competencia local: reduce crecimiento proporcional al promedio de vecinos
      let neigh = 0, sum = 0;
      for(let dy=-1; dy<=1; dy++){
        for(let dx=-1; dx<=1; dx++){
          const nx = x+dx, ny = y+dy;
          if (nx<0||ny<0||nx>=WORLD_W||ny>=WORLD_H) continue;
          sum += plant[idx(nx,ny)];
          neigh++;
        }
      }
      const avg = sum / Math.max(1,neigh);
      inc *= (1 - 0.4*avg); // Más densidad vecina => menos crecimiento
      inc *= (0.7 + 0.6 * soilMoisture[id]);
      // Incendio (overlay lógico): resta vegetación dentro del radio
      if (fire){
        const d2 = (x-fire.x)*(x-fire.x)+(y-fire.y)*(y-fire.y);
        if (d2 < fire.r*fire.r) inc -= 0.15; // Quemado fuerte
      }
      plant[id] = clamp(plant[id] + inc, 0, 1);
      if (state.weatherState===WEATHER.DROUGHT) plant[id] = Math.max(0, plant[id] - 0.01);
    }
  }
}

// ==============================================================
//                          HELPERS
// ==============================================================
function moveCreature(a, dt, effSpeed){
  // Integración explícita simple (Euler): posición += dirección * velocidad
  const s = effSpeed * dt;
  a.x += Math.cos(a.dir)*s;
  a.y += Math.sin(a.dir)*s;
}
function clampInside(a){
  // Rebote contra bordes del mundo y evita entrar a agua/barrera
  if (a.x < 0.5) { a.x = 0.5; a.dir = Math.PI - a.dir; }
  if (a.x > WORLD_W-0.5) { a.x = WORLD_W-0.5; a.dir = Math.PI - a.dir; }
  if (a.y < 0.5) { a.y = 0.5; a.dir = -a.dir; }
  if (a.y > WORLD_H-0.5) { a.y = WORLD_H-0.5; a.dir = -a.dir; }
  const xi = Math.max(0, Math.min(WORLD_W-1, Math.floor(a.x)));
  const yi = Math.max(0, Math.min(WORLD_H-1, Math.floor(a.y)));
  const t = terrain[idx(xi,yi)];
  if (t === BIOME.WATER || t === BIOME.BARRIER){ a.dir += Math.PI*0.8; }
}
function eatPlant(a){
  // Consume planta si la especie tiene dieta de plantas
  const diet = speciesConfig[a.sp].diet.PLANT;
  if (!diet) return;
  const x = Math.floor(a.x), y = Math.floor(a.y);
  if (terrain[idx(x,y)]!==BIOME.GRASS) return;
  const id = idx(x,y);
  if (plant[id] > 0.05){
    const maxE = speciesConfig[a.sp].maxEnergy ?? Infinity;
    a.energy = Math.min(a.energy + diet.energy, maxE);
    plant[id] = Math.max(0, plant[id] - (diet.plantDelta || 0));
  }
}
function dist2(a,b){
  // Distancia al cuadrado (evita sqrt) en píxeles del canvas
  const dx = (a.x-b.x)*TILE, dy = (a.y-b.y)*TILE;
  return dx*dx + dy*dy;
}
function nearestOfSpecies(from, speciesList, visionTiles){
  // Busca el individuo más cercano de entre una lista de especies
  const targets = new Set(speciesList);
  const gSize = GRID_SIZE;
  const gx = Math.floor(from.x / gSize);
  const gy = Math.floor(from.y / gSize);
  const rad = Math.ceil(visionTiles / gSize);
  let best=null, bestD = (visionTiles*TILE)*(visionTiles*TILE);
  for(let yy=Math.max(0,gy-rad); yy<=Math.min(GRID_H-1,gy+rad); yy++){
    for(let xx=Math.max(0,gx-rad); xx<=Math.min(GRID_W-1,gx+rad); xx++){
      const cell = grid[cellIndex(xx,yy)];
      for(const b of cell){
        if (!targets.has(b.sp)) continue;
        const d2 = dist2(from,b);
        if (d2 < bestD){ bestD = d2; best = b; }
      }
    }
  }
  return best;
}
function mutate(val, sigma, min, max){
  // Mutación uniforme acotada (simple y robusta)
  const delta = (Math.random()*2-1) * sigma;
  return clamp(val + delta, min, max);
}
function reproduce(parent, species){
  // Reproducción asexual: hijo = padre +/- mutaciones pequeñas
  const g = parent.genes;
  const cfg = speciesConfig[species];
  const child = {
    sp: species,
    x: parent.x + (Math.random()-0.5)*0.6,
    y: parent.y + (Math.random()-0.5)*0.6,
    dir: Math.random()*Math.PI*2,
    speed: Math.max(0.35, parent.speed * (0.95 + Math.random()*0.1)),
    wobble: Math.max(0.1, parent.wobble * (0.95 + Math.random()*0.1)),
    r: Math.max(0.24, parent.r * (0.97 + Math.random()*0.06)),
    energy: cfg.offspringEnergy,
    cooldown: 3,
    age: 0,
    genes: {
      speedMul: mutate(g.speedMul, 0.06, 0.75, 1.35),
      metabolismMul: mutate(g.metabolismMul, 0.08, 0.7, 1.5),
      visionMul: mutate(g.visionMul, 0.1, 0.7, 1.6),
      lifespan: clamp(g.lifespan + Math.floor((Math.random()*2-1)*14), 140, 260)
    }
  };
  animals.push(child);
}

// ==============================================================
//                        INTERACCIÓN (FASE 4)
// ==============================================================
export const TOOL = {
  INSPECT: 'inspect',
  ADD_HERB: 'add_herb',
  ADD_CARN: 'add_carn',
  ADD_RODENT: 'add_rodent',
  ADD_WOLF: 'add_wolf',
  ADD_POLLINATOR: 'add_pollinator',
  ERASER: 'eraser',
  FOOD: 'food',
  WATER: 'water',
  BARRIER: 'barrier'
};

// Toolbar DOM
const toolbar = document.getElementById('toolbar');

// Atajos y entrada gestionados en ui.js

// ==============================================================
//                   EVENTOS ESPECIALES (FASE 4)
// ==============================================================
function triggerFireCenter(){
  // Activa un incendio centrado (overlay y efecto en growPlants)
  fire = { x: Math.floor(WORLD_W/2), y: Math.floor(WORLD_H/2), r: 8, t: FIRE_DURATION };
}
function strikeMeteor(){
  // Impacto aleatorio: arrasa vegetación y mata animales en radio
  const x = Math.floor(Math.random()*WORLD_W);
  const y = Math.floor(Math.random()*WORLD_H);
  for(let yy=Math.max(0,y-METEOR_RADIUS); yy<Math.min(WORLD_H,y+METEOR_RADIUS); yy++){
    for(let xx=Math.max(0,x-METEOR_RADIUS); xx<Math.min(WORLD_W,x+METEOR_RADIUS); xx++){
      const d2=(xx-x)*(xx-x)+(yy-y)*(yy-y);
      if (d2 < METEOR_RADIUS*METEOR_RADIUS){
        plant[idx(xx,yy)] = 0;
        if (terrain[idx(xx,yy)]===BIOME.GRASS) terrain[idx(xx,yy)] = BIOME.DIRT; // Cráter simple
      }
    }
  }
  for (let i=animals.length-1;i>=0;i--){
    const a=animals[i];
    const dx=a.x-(x+0.5), dy=a.y-(y+0.5);
    if (dx*dx+dy*dy < METEOR_RADIUS*METEOR_RADIUS) animals.splice(i,1);
  }
  // Flash visual breve para feedback
  flashTimer = 0.3;
  state.redrawTerrain = true;
}
function plague(species, ratio){
  // Elimina aleatoriamente un % (ratio) de la especie indicada
  const survivors = [];
  for(const a of animals){ if (a.sp!==species || Math.random()>ratio) survivors.push(a); }
  animals.length=0; animals.push(...survivors);
}

// ==============================================================
//                            RENDER
// ==============================================================
let flashTimer = 0; // Cuenta atrás del flash de meteorito

// Objeto de estado compartido entre módulos
state = {
  get simTime(){ return getSimTime(); },
  set simTime(v){ setSimTime(v); },
  get worldTime(){ return getWorldTime(); },
  set worldTime(v){ setWorldTime(v); },
  get weatherTimer(){ return getWeatherTimer(); },
  set weatherTimer(v){ setWeatherTimer(v); },
  get weatherState(){ return getWeatherState(); },
  set weatherState(v){ setWeatherState(v); },
  get accPlant(){ return accPlant; },
  set accPlant(v){ accPlant = v; },
  get flashTimer(){ return flashTimer; },
  set flashTimer(v){ flashTimer = v; },
  get fire(){ return fire; },
  set fire(v){ fire = v; },
  TILE, WORLD_W, WORLD_H, DAY_LENGTH_SEC,
  animals, plant, terrain, soilMoisture,
  speciesConfig,
  spawnEnabled, hiddenSpecies,
  spawnRate, reproThresholdMul, mortalityMul,
  idx, clamp, WEATHER, WEATHER_NAMES, BIOME, COLORS,
  TOOL, defaultGenes, advanceWeather, growPlants, isNight,
  nearestOfSpecies, moveCreature, clampInside,
  eatPlant, reproduce, dist2, daylightFactor,
  triggerFireCenter, strikeMeteor, plague,
  toolbar, cvs, ctx,
  camX, camY, scaleX, scaleY, DPR,
  applyCamera(){
    camX = state.camX;
    camY = state.camY;
    scaleX = state.scaleX;
    scaleY = state.scaleY;
    ctx.setTransform(scaleX * DPR, 0, 0, scaleY * DPR, -camX * TILE * scaleX * DPR, -camY * TILE * scaleY * DPR);
  },
  minimap:null,
  sprites,
  crowdSmall, crowdMedium, crowdLarge,
  CROWD_THRESH, CROWD_DECAY, SMALL_LIMIT, LARGE_LIMIT,
  terrainCanvas:null,
  redrawTerrain:true,
  grid, GRID_SIZE, GRID_W, GRID_H, cellIndex,
  activeTool: TOOL.INSPECT,
  hud:null,
  paused: settings.paused ?? false
};

// store settings in state for modules to access
state.settings = Object.assign({}, settings, {
  spawnEnabled,
  hiddenSpecies,
  spawnRate,
  reproThresholdMul,
  mortalityMul
});

// persist settings when leaving the page
window.addEventListener('beforeunload', () => saveSettings(state.settings));

// ==============================================================
//                        BUCLE PRINCIPAL
// ==============================================================
let frames=0, fps=0, fpsTime=0; // Medición de FPS a 0.5s
const $fps = document.getElementById('fps');
const $tick = document.getElementById('tick');
if (!$fps) console.error('Missing DOM element: #fps');
if (!$tick) console.error('Missing DOM element: #tick');
const debugPanel = document.getElementById('debugPanel');
document.getElementById('debugBtn').addEventListener('click', () => debugPanel.classList.toggle('hidden'));
window.addEventListener('keydown', e=>{ if(e.key==='d' || e.key==='D') debugPanel.classList.toggle('hidden'); });

const speciesPanel = document.getElementById('speciesPanel');
const speciesBtn = document.getElementById('speciesBtn');
speciesBtn.addEventListener('click', () => speciesPanel.classList.toggle('hidden'));

function loop(now){
  if (state.paused){ last = now; requestAnimationFrame(loop); return; }
  const dt = Math.min(0.05, (now - last)/1000); // Delta tiempo con tope (50ms) para estabilidad
  last = now;

  step(state, dt);    // Actualización de estado
  render(state);      // Dibujo de frame
  updateMinimap(state);

  // UI cada ~0.5s
  frames++; fpsTime += dt;
  if (fpsTime >= 0.5){
    fps = Math.round(frames / fpsTime);
    frames = 0; fpsTime = 0;
    if ($fps) $fps.textContent = `FPS: ${fps}`;
    if ($tick) $tick.textContent = `t: ${state.simTime.toFixed(1)}s`;
    updateHUD(state);
  }

  requestAnimationFrame(loop); // Agenda el próximo frame
}

// ==============================================================
//                           INIT
// ==============================================================
initMainMenu(state);
setupUI(state);
initHUD(state);
initMinimap(state);
generateTerrain();                 // Crea el mapa base
generateSoilMoisture();            // Inicializa humedad del suelo
spawnAnimals();                    // Población inicial
state.weatherTimer = 0; advanceWeather(0.01); // Forzar selección de clima inicial
setTool(state, TOOL.INSPECT);            // Herramienta por defecto
requestAnimationFrame((t)=>{ last=t; loop(t); }); // Arranque del bucle

// Animaciones de iconos de eventos
gsap.to('#evtFire', { rotation:-10, yoyo:true, repeat:-1, duration:0.6, transformOrigin:'50% 80%' });
gsap.to('#evtMeteor', { y:-4, yoyo:true, repeat:-1, duration:0.8 });
gsap.to('#evtPlagueH, #evtPlagueC', { scale:1.1, yoyo:true, repeat:-1, duration:1 });

runSelfTests(state, applyActionAt, TOOL, defaultGenes);
