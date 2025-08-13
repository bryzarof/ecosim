'use strict';

import { WORLD_W, WORLD_H, BIOME, plant, terrain, soilMoisture, idx, clamp } from './worldConfig.js';
import { seededRandom, valueNoise2D } from './utils/noise.js';

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
