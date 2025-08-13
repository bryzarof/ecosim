'use strict';

export function seededRandom(seed) {
  // PRNG congruencial lineal reproducible
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xfffffff) / 0xfffffff; // Devuelve [0,1)
  };
}

export function valueNoise2D(width, height, gridStep, rng) {
  // Genera ruido 2D por interpolación bilineal de una grilla de valores aleatorios
  const gw = Math.ceil(width / gridStep) + 2;
  const gh = Math.ceil(height / gridStep) + 2;
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      grid[gy * gw + gx] = rng();
    }
  }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const gy = Math.floor(y / gridStep);
    const fy = (y / gridStep) - gy; // Fracción vertical entre celdas
    for (let x = 0; x < width; x++) {
      const gx = Math.floor(x / gridStep);
      const fx = (x / gridStep) - gx; // Fracción horizontal
      // Cuatro esquinas de la celda
      const a = grid[gy * gw + gx];
      const b = grid[gy * gw + gx + 1];
      const c = grid[(gy + 1) * gw + gx];
      const d = grid[(gy + 1) * gw + gx + 1];
      // Suavizado cúbico (curva S) para evitar artefactos
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const i1 = a + (b - a) * sx; // Interpola horizontal arriba
      const i2 = c + (d - c) * sx; // Interpola horizontal abajo
      out[y * width + x] = i1 + (i2 - i1) * sy; // Interpola vertical
    }
  }
  return out;
}

