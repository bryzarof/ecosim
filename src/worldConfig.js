'use strict';

export const TILE = 10;             // Tamaño del tile en píxeles en el lienzo
export const WORLD_W = 100;         // Número de tiles horizontales
export const WORLD_H = 60;          // Número de tiles verticales
export const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // Densidad de píxeles

// Ciclo día/noche (24h simuladas en X segundos)
export const DAY_LENGTH_SEC = 120;  // Aumenta/disminuye para acelerar o frenar el ciclo

// Estados de clima
export const WEATHER = { CLEAR:0, RAIN:1, DROUGHT:2 };
export const WEATHER_NAMES = ['Despejado','Lluvia','Sequía'];

// Tipos de terreno por tile (mapa discreto)
export const BIOME = { WATER:0, DIRT:1, GRASS:2, BARRIER:3 };

// Paleta de colores para el render
export const COLORS = {
  WATER: '#1e40af',
  SHORE: '#2563eb',
  DIRT:  '#6b4226',
  GRASS0:'#14532d',
  GRASS1:'#166534',
  GRASS2:'#22c55e',
  BARRIER:'#64748b'
};

// Campos escalares del mundo
export const plant = new Float32Array(WORLD_W * WORLD_H);
export const terrain = new Uint8Array(WORLD_W * WORLD_H);
export const soilMoisture = new Float32Array(WORLD_W * WORLD_H);

// Per-tile crowding counters grouped by size class
export const crowdSmall = new Float32Array(WORLD_W * WORLD_H);
export const crowdMedium = new Float32Array(WORLD_W * WORLD_H);
export const crowdLarge = new Float32Array(WORLD_W * WORLD_H);
export const pollinatorBoost = new Uint8Array(WORLD_W * WORLD_H);

// Size thresholds and crowding control parameters
export const SMALL_LIMIT = 0.30;      // radius < SMALL_LIMIT => small
export const LARGE_LIMIT = 0.36;      // radius >= LARGE_LIMIT => large
export const CROWD_THRESH = { small:6, medium:4, large:2 };
export const CROWD_DECAY = 0.6;       // decay factor applied each step

// Configuración de especies y poblaciones iniciales
// Cada especie define parámetros básicos y dieta de recursos o presas
export const speciesConfig = {
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
export const animals = [];

// Spatial grid for neighborhood queries (optimizes nearest searches)
export const GRID_SIZE = 10; // tiles per cell
export const GRID_W = Math.ceil(WORLD_W / GRID_SIZE);
export const GRID_H = Math.ceil(WORLD_H / GRID_SIZE);
export const cellIndex = (gx, gy)=> gy*GRID_W + gx;
export const grid = Array.from({length: GRID_W*GRID_H}, () => []);

// Utilidades cortas para índices y límites
export const idx = (x,y)=> y*WORLD_W + x;                   // Indexa (x,y) en arreglos lineales
export const clamp = (v, a, b)=> Math.max(a, Math.min(b, v)); // Limita v al rango [a,b]
