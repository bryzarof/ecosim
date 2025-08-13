'use strict';

import { WORLD_W, WORLD_H, BIOME, plant, terrain, soilMoisture, idx, clamp } from './worldConfig.js';

export function seededRandom(seed) {
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
export function generateTerrain() {
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

export function generateSoilMoisture() {
  const rng = seededRandom(4242);
  const n1 = valueNoise2D(WORLD_W, WORLD_H, 8, rng);
  const n2 = valueNoise2D(WORLD_W, WORLD_H, 4, rng);
  for (let i = 0; i < soilMoisture.length; i++) {
    soilMoisture[i] = clamp(n1[i] * 0.7 + n2[i] * 0.3, 0, 1);
  }
}
