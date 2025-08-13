'use strict';
import { step } from './physics.js';
import { render } from './render.js';
import { setupUI, setTool, applyActionAt } from './ui.js';
import { sprites } from './sprites.js';
// ==============================================================
//                    PARÁMETROS DEL MUNDO
// ==============================================================
const TILE = 10;             // Tamaño del tile en píxeles en el lienzo
const WORLD_W = 100;         // Número de tiles horizontales
const WORLD_H = 60;          // Número de tiles verticales
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // Densidad de píxeles (cap 2x para rendimiento)

// Ciclo día/noche (24h simuladas en X segundos)
const DAY_LENGTH_SEC = 120;  // Aumenta/disminuye para acelerar o frenar el ciclo

// Estados de clima
const WEATHER = { CLEAR:0, RAIN:1, DROUGHT:2 };
const WEATHER_NAMES = ['Despejado','Lluvia','Sequía'];

// Tipos de terreno por tile (mapa discreto)
const BIOME = { WATER:0, DIRT:1, GRASS:2, BARRIER:3 };

// Paleta de colores para el render
const COLORS = {
  WATER: '#1e40af',
  SHORE: '#2563eb',
  DIRT:  '#6b4226',
  GRASS0:'#14532d',
  GRASS1:'#166534',
  GRASS2:'#22c55e',
  BARRIER:'#64748b'
};

// Campos escalares del mundo:
// - plant: densidad de vegetación 0..1 por tile
// - terrain: tipo de bioma por tile
// - soilMoisture: humedad del suelo 0..1 por tile
const plant = new Float32Array(WORLD_W * WORLD_H);
const terrain = new Uint8Array(WORLD_W * WORLD_H);
const soilMoisture = new Float32Array(WORLD_W * WORLD_H);

// Per-tile crowding counters grouped by size class
const crowdSmall = new Float32Array(WORLD_W * WORLD_H);
const crowdMedium = new Float32Array(WORLD_W * WORLD_H);
const crowdLarge = new Float32Array(WORLD_W * WORLD_H);
const pollinatorBoost = new Uint8Array(WORLD_W * WORLD_H);

// Size thresholds and crowding control parameters
const SMALL_LIMIT = 0.30;      // radius < SMALL_LIMIT => small
const LARGE_LIMIT = 0.36;      // radius >= LARGE_LIMIT => large
const CROWD_THRESH = { small:6, medium:4, large:2 };
const CROWD_DECAY = 0.6;       // decay factor applied each step

// Configuración de especies y poblaciones iniciales
// Cada especie define parámetros básicos y dieta de recursos o presas
const speciesConfig = {
  HERB: {
    start: 28,
    baseSpeed: 0.55,
    hungerRate: 0.015,           // Energía perdida por segundo
    vision: 6,
    preyEnergy: 0.9,
    fecundity: 1.6,
    size: 'medium',
    lifespan: 200,
    reproThreshold: 1.6,         // Energía mínima para reproducirse
    reproCost: 0.8,
    reproCooldown: 5,
    nightSpeedMul: 0.9,
    nightVisionMul: 0.9,
    maxEnergy: 2.5,
    radius: 0.32,
    initEnergy: 1.0,
    addEnergy: 1.0,
    offspringEnergy: 0.8,
    wanderFactor: 2.0,
    diet: { PLANT: { energy: 0.18, plantDelta: 0.22 } }
  },
  CARN: {
    start: 10,
    baseSpeed: 0.7,
    hungerRate: 0.02,
    vision: 9,
    preyEnergy: 1.2,
    fecundity: 2.2,
    size: 'medium',
    lifespan: 220,
    reproThreshold: 2.2,
    reproCost: 1.1,
    reproCooldown: 7,
    nightSpeedMul: 1.1,
    nightVisionMul: 1.1,
    radius: 0.36,
    initEnergy: 1.4,
    addEnergy: 1.2,
    offspringEnergy: 1.0,
    wanderFactor: 1.3,
    diet: { HERB: true }
  },
  RODENT: {
    start: 12,
    baseSpeed: 0.5,
    hungerRate: 0.02,
    vision: 5,
    preyEnergy: 0.8,
    fecundity: 1.2,
    size: 'small',
    lifespan: 180,
    reproThreshold: 1.2,
    reproCost: 0.6,
    reproCooldown: 5,
    nightSpeedMul: 0.9,
    nightVisionMul: 0.9,
    radius: 0.3,
    initEnergy: 0.9,
    offspringEnergy: 0.7,
    wanderFactor: 2.0,
    diet: { PLANT: { energy: 0.15, plantDelta: 0.2 } }
  },
  WOLF: {
    start: 4,
    baseSpeed: 0.8,
    hungerRate: 0.025,
    vision: 10,
    preyEnergy: 1.5,
    fecundity: 2.4,
    size: 'large',
    lifespan: 240,
    reproThreshold: 2.4,
    reproCost: 1.2,
    reproCooldown: 7,
    nightSpeedMul: 1.1,
    nightVisionMul: 1.1,
    radius: 0.38,
    initEnergy: 1.5,
    offspringEnergy: 1.1,
    wanderFactor: 1.3,
    diet: { HERB: true, RODENT: true }
  },
  POLLINATOR: {
    start: 16,
    baseSpeed: 0.5,
    hungerRate: 0.01,
    vision: 4,
    preyEnergy: 0.5,
    fecundity: 1.0,
    size: 'small',
    lifespan: 160,
    reproThreshold: 1.0,
    reproCost: 0.5,
    reproCooldown: 5,
    nightSpeedMul: 1.0,
    nightVisionMul: 1.0,
    radius: 0.28,
    initEnergy: 0.8,
    offspringEnergy: 0.6,
    wanderFactor: 2.0,
    diet: { PLANT: { energy: 0.05, plantDelta: 0.005 } }
  }
};

// Array dinámico de individuos; cada uno es un objeto con estado y genes
const animals = [];

const speciesList = Object.keys(speciesConfig);
const spawnEnabled = Object.fromEntries(speciesList.map(s=>[s,true]));
const hiddenSpecies = Object.fromEntries(speciesList.map(s=>[s,false]));
const spawnRate = Object.fromEntries(speciesList.map(s=>[s,1]));
const reproThresholdMul = Object.fromEntries(speciesList.map(s=>[s,1]));
const mortalityMul = Object.fromEntries(speciesList.map(s=>[s,1]));

// Spatial grid for neighborhood queries (optimizes nearest searches)
const GRID_SIZE = 10; // tiles per cell
const GRID_W = Math.ceil(WORLD_W / GRID_SIZE);
const GRID_H = Math.ceil(WORLD_H / GRID_SIZE);
const cellIndex = (gx, gy)=> gy*GRID_W + gx;
const grid = Array.from({length: GRID_W*GRID_H}, () => []);

// Utilidades cortas para índices y límites
const idx = (x,y)=> y*WORLD_W + x;                   // Indexa (x,y) en arreglos lineales
const clamp = (v, a, b)=> Math.max(a, Math.min(b, v)); // Limita v al rango [a,b]

// ==============================================================
//                         CANVAS SETUP
// ==============================================================
const cvs = document.getElementById('sim');
const ctx = cvs.getContext('2d', { alpha:false });

function resizeCanvas() {
  // Calcula escala para ajustar la simulación al tamaño de la ventana
  const worldPxW = WORLD_W * TILE;
  const worldPxH = WORLD_H * TILE;
  const scale = Math.min(window.innerWidth / worldPxW, window.innerHeight / worldPxH);

  // Ajusta el tamaño visible del lienzo respetando la relación de aspecto
  const cssW = worldPxW * scale;
  const cssH = worldPxH * scale;
  cvs.style.width = cssW + 'px';
  cvs.style.height = cssH + 'px';

  // Mantiene el buffer interno a resolución completa para nitidez y escala vía CSS
  cvs.width = Math.floor(worldPxW * DPR);
  cvs.height = Math.floor(worldPxH * DPR);
  ctx.imageSmoothingEnabled = false;           // Look pixel-art
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);      // 1 unidad lógica = 1 px del mundo
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ==============================================================
//                    RUIDO / MAPA DE ALTURA
// ==============================================================
function seededRandom(seed) {
  // PRNG congruencial lineal reproducible
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xfffffff) / 0xfffffff; // Devuelve [0,1)
  };
}

function valueNoise2D(width, height, gridStep, rng){
  // Genera ruido 2D por interpolación bilineal de una grilla de valores aleatorios
  const gw = Math.ceil(width / gridStep)+2;
  const gh = Math.ceil(height/ gridStep)+2;
  const grid = new Float32Array(gw*gh);
  for(let gy=0; gy<gh; gy++){
    for(let gx=0; gx<gw; gx++){
      grid[gy*gw+gx] = rng();
    }
  }
  const out = new Float32Array(width*height);
  for(let y=0; y<height; y++){
    const gy = Math.floor(y / gridStep);
    const fy = (y / gridStep) - gy;           // Fracción vertical entre celdas
    for(let x=0; x<width; x++){
      const gx = Math.floor(x / gridStep);
      const fx = (x / gridStep) - gx;         // Fracción horizontal
      // Cuatro esquinas de la celda
      const a = grid[gy*gw+gx];
      const b = grid[gy*gw+gx+1];
      const c = grid[(gy+1)*gw+gx];
      const d = grid[(gy+1)*gw+gx+1];
      // Suavizado cúbico (curva S) para evitar artefactos
      const sx = fx*fx*(3-2*fx);
      const sy = fy*fy*(3-2*fy);
      const i1 = a + (b-a)*sx;                // Interpola horizontal arriba
      const i2 = c + (d-c)*sx;                // Interpola horizontal abajo
      out[y*width+x] = i1 + (i2 - i1)*sy;     // Interpola vertical
    }
  }
  return out;
}

// Construye terreno base a partir de 2 octavas de ruido
function generateTerrain() {
  const rng = seededRandom(1337);
  const n1 = valueNoise2D(WORLD_W, WORLD_H, 8, rng);
  const n2 = valueNoise2D(WORLD_W, WORLD_H, 4, rng);

  for(let y=0; y<WORLD_H; y++){
    for(let x=0; x<WORLD_W; x++){
      // Altura sintética 0..1; umbrales definen agua/orilla/pasto
      const h = n1[idx(x,y)]*0.7 + n2[idx(x,y)]*0.3;
      if (h < 0.35) {
        terrain[idx(x,y)] = BIOME.WATER;  // Agua: no crecen plantas
        plant[idx(x,y)] = 0.0;
      } else if (h < 0.45) {
        terrain[idx(x,y)] = BIOME.DIRT;   // Orilla/playa
        plant[idx(x,y)] = 0.0;
      } else {
        terrain[idx(x,y)] = BIOME.GRASS;  // Zona fértil
        plant[idx(x,y)] = Math.max(0, (h-0.45)*1.4);
      }
    }
  }
}

function generateSoilMoisture() {
  const rng = seededRandom(4242);
  const n1 = valueNoise2D(WORLD_W, WORLD_H, 8, rng);
  const n2 = valueNoise2D(WORLD_W, WORLD_H, 4, rng);
  for (let i = 0; i < soilMoisture.length; i++) {
    soilMoisture[i] = clamp(n1[i] * 0.7 + n2[i] * 0.3, 0, 1);
  }
}

// ==============================================================
//                    TIEMPO DEL MUNDO Y CLIMA
// ==============================================================
let worldTime = 0; // Segundos simulados acumulados
let simTime = 0;   // Segundos de simulación para UI
let weatherState = WEATHER.CLEAR;
let weatherTimer = 0; // Cuenta atrás del estado de clima actual

function isNight(){
  // Noche cuando el tiempo normalizado está cerca de 0 o 1 (cuartos del día)
  const t = (worldTime % DAY_LENGTH_SEC) / DAY_LENGTH_SEC; // 0..1
  return (t < 0.25) || (t > 0.75);
}
function daylightFactor(){
  // Factor de luz ambiental (0..1) como seno; máximo a mediodía
  const t = (worldTime % DAY_LENGTH_SEC) / DAY_LENGTH_SEC;
  return 0.35 + 0.65 * Math.max(0, Math.sin(Math.PI * (t)));
}
function advanceWeather(dt){
  // Manejo semi-Markoviano simple: cuando expira el temporizador, elige un nuevo clima
  weatherTimer -= dt;
  if (weatherTimer <= 0){
    const r = Math.random();
    weatherState = (r < 0.55) ? WEATHER.CLEAR : (r < 0.85 ? WEATHER.RAIN : WEATHER.DROUGHT);
    // Duración base según estado con jitter aleatorio
    const base = weatherState===WEATHER.RAIN ? 18 : (weatherState===WEATHER.DROUGHT ? 20 : 24);
    const jitter = (Math.random()*0.6+0.7); // 0.7..1.3
    weatherTimer = base * jitter;
  }
}

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
      if (weatherState===WEATHER.RAIN) m += 0.04;
      if (weatherState===WEATHER.DROUGHT) m -= 0.03;
      m -= 0.005; // evaporación base
      soilMoisture[id] = clamp(m, 0, 1);

      if (terrain[id] !== BIOME.GRASS) continue; // Solo crece en pasto
      let inc = 0.02;                            // Ritmo base
      if (weatherState===WEATHER.RAIN) inc += 0.03;     // Lluvia acelera
      if (weatherState===WEATHER.DROUGHT) inc -= 0.02;  // Sequía frena
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
      if (weatherState===WEATHER.DROUGHT) plant[id] = Math.max(0, plant[id] - 0.01);
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
  const gSize = GRID_SIZE;
  const gx = Math.floor(from.x / gSize);
  const gy = Math.floor(from.y / gSize);
  const rad = Math.ceil(visionTiles / gSize);
  let best=null, bestD = (visionTiles*TILE)*(visionTiles*TILE);
  for(let yy=Math.max(0,gy-rad); yy<=Math.min(GRID_H-1,gy+rad); yy++){
    for(let xx=Math.max(0,gx-rad); xx<=Math.min(GRID_W-1,gx+rad); xx++){
      const cell = grid[cellIndex(xx,yy)];
      for(const b of cell){
        if (!speciesList.includes(b.sp)) continue;
        const d2 = dist2(from,b);
        if (d2 < bestD){ bestD = d2; best = b; }
      }
    }
  }
  return best;
}
function nearestPrey(pred, visionTiles){
  const diet = speciesConfig[pred.sp].diet;
  const preyList = Object.keys(diet).filter(k=>k!== 'PLANT');
  if (preyList.length===0) return null;
  return nearestOfSpecies(pred, preyList, visionTiles);
}
function nearestPredator(animal, visionTiles){
  const predators = [];
  for (const [sp,cfg] of Object.entries(speciesConfig)){
    if (cfg.diet && cfg.diet[animal.sp]) predators.push(sp);
  }
  if (predators.length===0) return null;
  return nearestOfSpecies(animal, predators, visionTiles);
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
const TOOL = { INSPECT:'inspect', ADD_HERB:'add_herb', ADD_CARN:'add_carn', ERASER:'eraser', FOOD:'food', WATER:'water', BARRIER:'barrier' };

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
const state = {
  get simTime(){ return simTime; },
  set simTime(v){ simTime = v; },
  get worldTime(){ return worldTime; },
  set worldTime(v){ worldTime = v; },
  get weatherTimer(){ return weatherTimer; },
  set weatherTimer(v){ weatherTimer = v; },
  get weatherState(){ return weatherState; },
  set weatherState(v){ weatherState = v; },
  get accPlant(){ return accPlant; },
  set accPlant(v){ accPlant = v; },
  get flashTimer(){ return flashTimer; },
  set flashTimer(v){ flashTimer = v; },
  get fire(){ return fire; },
  set fire(v){ fire = v; },
  TILE, WORLD_W, WORLD_H,
  animals, plant, terrain, soilMoisture,
  speciesConfig,
  spawnEnabled, hiddenSpecies,
  spawnRate, reproThresholdMul, mortalityMul,
  idx, clamp, WEATHER, WEATHER_NAMES, BIOME, COLORS,
  TOOL, defaultGenes, advanceWeather, growPlants, isNight,
  nearestPredator, nearestPrey, moveCreature, clampInside,
  eatPlant, reproduce, dist2, daylightFactor,
  triggerFireCenter, strikeMeteor, plague,
  toolbar, cvs, ctx,
  sprites,
  crowdSmall, crowdMedium, crowdLarge,
  CROWD_THRESH, CROWD_DECAY, SMALL_LIMIT, LARGE_LIMIT,
  terrainCanvas:null,
  redrawTerrain:true,
  grid, GRID_SIZE, GRID_W, GRID_H, cellIndex,
  activeTool: TOOL.INSPECT
};

// ==============================================================
//                        BUCLE PRINCIPAL
// ==============================================================
let frames=0, fps=0, fpsTime=0; // Medición de FPS a 0.5s
const $fps = document.getElementById('fps');
const $herb = document.getElementById('herbCount');
const $carn = document.getElementById('carnCount');
const $plant = document.getElementById('plantCount');
const $tick = document.getElementById('tick');
const $clock = document.getElementById('clock');
const $weather = document.getElementById('weather');
if (!$fps) console.error('Missing DOM element: #fps');
if (!$herb) console.error('Missing DOM element: #herbCount');
if (!$carn) console.error('Missing DOM element: #carnCount');
if (!$plant) console.error('Missing DOM element: #plantCount');
if (!$tick) console.error('Missing DOM element: #tick');
if (!$clock) console.error('Missing DOM element: #clock');
if (!$weather) console.error('Missing DOM element: #weather');
const debugPanel = document.getElementById('debugPanel');
document.getElementById('debugBtn').addEventListener('click', () => debugPanel.classList.toggle('hidden'));
window.addEventListener('keydown', e=>{ if(e.key==='d' || e.key==='D') debugPanel.classList.toggle('hidden'); });

function loop(now){
  const dt = Math.min(0.05, (now - last)/1000); // Delta tiempo con tope (50ms) para estabilidad
  last = now;

  step(state, dt);    // Actualización de estado
  render(state);      // Dibujo de frame

  // UI cada ~0.5s
  frames++; fpsTime += dt;
  if (fpsTime >= 0.5){
    fps = Math.round(frames / fpsTime);
    frames = 0; fpsTime = 0;
    const h = animals.filter(a=>a.sp==='HERB').length;
    const c = animals.filter(a=>a.sp==='CARN').length;
    if ($fps) $fps.textContent = `FPS: ${fps}`;
    if ($herb) $herb.textContent = h;
    if ($carn) $carn.textContent = c;
    if ($plant) $plant.textContent = countGreens();
    if ($tick) $tick.textContent = `t: ${simTime.toFixed(1)}s`;
    // Reloj 24h del día simulado
    const dayT = (worldTime % DAY_LENGTH_SEC) / DAY_LENGTH_SEC; // 0..1
    const hours = Math.floor(dayT * 24);
    const mins = Math.floor((dayT * 24 - hours) * 60);
    if ($clock) $clock.textContent = `Hora: ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
    if ($weather) $weather.textContent = `Clima: ${WEATHER_NAMES[weatherState]}`;
  }

  requestAnimationFrame(loop); // Agenda el próximo frame
}

function countGreens(){
  // Cuenta tiles de GRASS con densidad de planta > 0.33 (para UI)
  let c=0; for(let i=0;i<terrain.length;i++){ if (terrain[i]===BIOME.GRASS && plant[i]>0.33) c++; } return c;
}

// ==============================================================
//                           INIT
// ==============================================================
setupUI(state);
generateTerrain();                 // Crea el mapa base
generateSoilMoisture();            // Inicializa humedad del suelo
spawnAnimals();                    // Población inicial
state.weatherTimer = 0; advanceWeather(0.01); // Forzar selección de clima inicial
setTool(state, TOOL.INSPECT);            // Herramienta por defecto
requestAnimationFrame((t)=>{ last=t; loop(t); }); // Arranque del bucle

// ==============================================================
//                       SELF-TESTS (sanidad)
// ==============================================================
function runSelfTests(){
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
runSelfTests();

