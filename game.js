<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fase 4 · Simulador de Ecosistemas (Canvas)</title>
  <style>
    /*
      ===== Estilos base y responsive mínimos =====
      - Paleta oscura, tipografía del sistema
      - Layout fluido con contenedor centrado
      - Botones de toolbar con estados activos
    */
    :root { --bg:#0b0e12; --fg:#cbd5e1; --panel:#11161c; --accent:#60a5fa; }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; background: var(--bg); color: var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, "Apple Color Emoji","Segoe UI Emoji"; }
    .wrap { display:flex; flex-direction:column; gap:10px; padding:12px; max-width:1200px; margin:0 auto; }
    header { display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
    h1 { font-size:16px; margin:0; font-weight:600; color:#e2e8f0; }
    .panel { background:linear-gradient(180deg, #0f172a, #0b1220); border:1px solid #1f2937; border-radius:12px; padding:10px 12px; display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
    .tag { padding:4px 8px; border-radius:999px; border:1px solid #334155; color:#cbd5e1; font-size:12px; }
    .metrics { display:flex; gap:10px; align-items:center; font-variant-numeric:tabular-nums; flex-wrap:wrap; }
    canvas { width: 100%; height: auto; border-radius: 12px; display:block; background:#000; image-rendering: pixelated; }
    footer { opacity:.8; font-size:12px; }
    .hint { color:#94a3b8; font-size:12px; }
    .tests { position: fixed; right: 10px; top: 10px; background:#0b1220; border:1px solid #1f2937; border-radius:10px; padding:8px 10px; font-size:12px; color:#cbd5e1; box-shadow: 0 6px 20px rgba(0,0,0,.25); z-index:10; }
    .tests b { color:#e2e8f0; }
    .toolbar { display:flex; gap:8px; flex-wrap:wrap; }
    .btn { background:#0b1220; border:1px solid #1f2937; color:#cbd5e1; padding:6px 10px; border-radius:10px; font-size:12px; cursor:pointer; }
    .btn.active { border-color:#60a5fa; box-shadow: 0 0 0 2px #60a5fa33 inset; }
    .btn.danger { border-color:#f43f5e; color:#fecdd3; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Fase 4 · Interacción: Especies, Recursos y Eventos</h1>
      <div class="metrics">
        <span class="tag" id="fps">FPS: --</span>
        <span class="tag" id="count">Herbívoros: -- · Carnívoros: -- · Plantas densas: --</span>
        <span class="tag" id="clock">Hora: --:--</span>
        <span class="tag" id="weather">Clima: --</span>
        <span class="tag" id="tick">t: 0.0s</span>
      </div>
    </header>

    <div class="panel toolbar" id="toolbar">
      <span class="hint">Herramientas:</span>
      <!--
        Herramientas de interacción:
        - Inspeccionar: loguea al animal más cercano
        - Añadir Herb/Carn: spawnea individuos
        - Goma: elimina animales en un radio
        - Comida: incrementa densidad de plantas en un tile
        - Agua: cambia tile a agua (planta=0)
        - Barrera: obstáculo sólido (animales lo evitan)
      -->
      <button class="btn" data-tool="inspect">🔎 Inspeccionar</button>
      <button class="btn" data-tool="add_herb">➕ Herbívoro (1)</button>
      <button class="btn" data-tool="add_carn">➕ Carnívoro (2)</button>
      <button class="btn" data-tool="eraser">🧽 Goma (3)</button>
      <button class="btn" data-tool="food">🌿 Comida (4)</button>
      <button class="btn" data-tool="water">💧 Agua (5)</button>
      <button class="btn" data-tool="barrier">🧱 Barrera (6)</button>
      <span class="hint" style="margin-left:10px">Eventos:</span>
      <button class="btn" id="evtFire">🔥 Incendio (F)</button>
      <button class="btn" id="evtMeteor">☄️ Meteorito (M)</button>
      <button class="btn" id="evtPlagueH">🦠 Plaga Herb. (P)</button>
      <button class="btn" id="evtPlagueC">🦠 Plaga Carn. (O)</button>
    </div>

    <div class="panel">
      <span class="hint">Ciclo día/noche, clima (lluvia/sequía), genética heredable y herramientas de intervención. <b>FIX:</b> RNG opcional en genes para evitar <code>rng is not a function</code>.</span>
    </div>

    <canvas id="sim" width="1000" height="600"></canvas>

    <footer>
      Ajusta <code>WORLD_W</code>, <code>WORLD_H</code>, <code>TILE</code>, <code>DAY_LENGTH_SEC</code>. Usa las teclas 1–7 y F/M/P/O.
    </footer>
  </div>

  <script>
  'use strict';
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
  const plant = new Float32Array(WORLD_W * WORLD_H);
  const terrain = new Uint8Array(WORLD_W * WORLD_H);

  // Especies y población inicial
  const SPECIES = { HERB: 0, CARN: 1 };
  const HERB_START = 28;   // Población inicial de herbívoros
  const CARN_START = 10;   // Población inicial de carnívoros

  // Parámetros base de especies (tasa de hambre, visión, etc.)
  const HERB = {
    baseSpeed: 0.55,
    hungerRate: 0.015,     // Energía perdida por segundo
    eatRate: 0.18,         // Energía ganada por bocado de planta
    eatPlantDelta: 0.22,   // Reducción de vegetación por bocado
    reproThreshold: 1.6,   // Energía mínima para reproducirse
    reproCost: 0.8,
    vision: 6              // Alcance de visión en tiles
  };
  const CARN = {
    baseSpeed: 0.7,
    hungerRate: 0.02,
    eatRate: 0.9,          // Energía ganada por capturar presa
    reproThreshold: 2.2,
    reproCost: 1.1,
    vision: 9
  };

  // Array dinámico de individuos; cada uno es un objeto con estado y genes
  const animals = [];

  // Utilidades cortas para índices y límites
  const idx = (x,y)=> y*WORLD_W + x;                   // Indexa (x,y) en arreglos lineales
  const clamp = (v, a, b)=> Math.max(a, Math.min(b, v)); // Limita v al rango [a,b]

  // ==============================================================
  //                         CANVAS SETUP
  // ==============================================================
  const cvs = document.getElementById('sim');
  const ctx = cvs.getContext('2d', { alpha:false });

  function resizeCanvas() {
    // Calcula tamaño CSS y backing-store respetando DPR para nitidez
    const cssW = WORLD_W * TILE;
    const cssH = WORLD_H * TILE;
    cvs.style.width = cssW + 'px';
    cvs.style.height = cssH + 'px';
    // Escala el buffer interno según DPR para evitar borrosidad
    cvs.width = Math.floor(cssW * DPR);
    cvs.height = Math.floor(cssH * DPR);
    ctx.imageSmoothingEnabled = false;           // Look pixel-art
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);      // Mapea 1 unidad lógica = 1 px CSS
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
    for(let i=0;i<HERB_START;i++) animals.push(spawnOne(rng, SPECIES.HERB));
    for(let i=0;i<CARN_START;i++) animals.push(spawnOne(rng, SPECIES.CARN));
  }

  // Genera genes con RNG opcional; si no hay rngFn, usa Math.random
  function defaultGenes(species, rngFn){
    const R = typeof rngFn === 'function' ? rngFn : Math.random;
    return {
      // Multiplicadores acotados respecto al valor base de la especie
      speedMul: clamp(0.95 + R()*0.10, 0.75, 1.35),
      metabolismMul: clamp(0.90 + R()*0.20, 0.70, 1.50),
      visionMul: clamp(0.90 + R()*0.20, 0.70, 1.60),
      lifespan: 160 + Math.floor(R()*80) // 160..240 segundos de vida
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
    const base = (species===SPECIES.HERB?HERB:CARN);
    const genes = defaultGenes(species, rng); // Hereda/varía con RNG de spawn
    return {
      sp: species,                     // Especie
      x: x + 0.5, y: y + 0.5,          // Posición en coordenadas de tile (centro)
      dir: rng()*Math.PI*2,            // Dirección inicial en radianes
      speed: base.baseSpeed + rng()*0.35, // Velocidad base con ruido individual
      wobble: rng()*0.6 + 0.2,         // Zig-zag aleatorio
      r: (species===SPECIES.HERB?0.32:0.36) + rng()*0.1, // Radio de dibujo
      energy: (species===SPECIES.HERB?1.0:1.4),
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

  function step(dt){
    // Avanza el reloj global y el clima
    simTime += dt;
    worldTime += dt;
    advanceWeather(dt);

    // Disipación de incendios activos
    if (fire){ fire.t -= dt; if (fire.t <= 0) fire = null; }

    // Sub-steps de crecimiento vegetal para estabilidad (cada 0.5 s)
    accPlant += dt;
    while (accPlant >= 0.5){ accPlant -= 0.5; growPlants(); }

    // Actualiza criaturas en orden inverso (para poder eliminar en caliente)
    for (let i=animals.length-1; i>=0; i--){
      const a = animals[i];
      a.cooldown = Math.max(0, a.cooldown - dt);
      a.age += dt;

      // Muerte por longevidad
      if (a.age > a.genes.lifespan){ animals.splice(i,1); continue; }

      const base = (a.sp===SPECIES.HERB?HERB:CARN);
      const night = isNight();
      // Comportamiento diferencial nocturno (carnívoros mejoran, herbívoros empeoran)
      const speedNightMul = (a.sp===SPECIES.CARN) ? (night?1.1:1.0) : (night?0.9:1.0);
      const visionNightMul = (a.sp===SPECIES.CARN) ? (night?1.1:1.0) : (night?0.9:1.0);

      const effSpeed = (a.speed * a.genes.speedMul) * speedNightMul;
      const hungerRate = (a.sp===SPECIES.HERB?HERB.hungerRate:CARN.hungerRate) * a.genes.metabolismMul;

      if (a.sp === SPECIES.HERB){
        // Herbívoro: huye de depredadores, come plantas para recuperar energía
        a.energy -= hungerRate * dt;
        const threat = nearestPredator(a, (base.vision * a.genes.visionMul) * visionNightMul);
        if (threat){
          const ang = Math.atan2(a.y - threat.y, a.x - threat.x); // ángulo de huida
          a.dir = ang + (Math.random()-0.5)*0.6;                   // añade ruido para evitar bloqueo
        } else {
          a.dir += (Math.random()-0.5) * a.wobble * dt * 2.0;      // deambular
        }
        moveCreature(a, dt, effSpeed);
        clampInside(a);    // rebote en bordes/obstáculos
        eatPlant(a);       // intenta comer si está sobre GRASS
        // Reproducción asexuada simple con coste de energía y cooldown
        if (a.energy > HERB.reproThreshold && a.cooldown<=0){
          reproduce(a, SPECIES.HERB);
          a.energy -= HERB.reproCost;
          a.cooldown = 5;
        }
      } else {
        // Carnívoro: persigue a la presa más cercana en rango de visión
        a.energy -= hungerRate * dt;
        const prey = nearestHerbivore(a, (base.vision * a.genes.visionMul) * visionNightMul);
        if (prey){
          const ang = Math.atan2(prey.y - a.y, prey.x - a.x); // ángulo hacia presa
          a.dir = ang + (Math.random()-0.5)*0.2;              // leve ruido para variación
        } else {
          a.dir += (Math.random()-0.5) * a.wobble * dt * 1.3; // patrulla al azar
        }
        moveCreature(a, dt, effSpeed);
        clampInside(a);
        // Check de colisión simple por radio: si alcanza, come
        if (prey && dist2(a, prey) < (a.r*TILE + prey.r*TILE) * (a.r*TILE + prey.r*TILE)){
          a.energy += CARN.eatRate;
          const idxPrey = animals.indexOf(prey);
          if (idxPrey !== -1) animals.splice(idxPrey,1);
        }
        if (a.energy > CARN.reproThreshold && a.cooldown<=0){
          reproduce(a, SPECIES.CARN);
          a.energy -= CARN.reproCost;
          a.cooldown = 7;
        }
      }

      // Muerte por inanición
      if (a.energy <= 0){ animals.splice(i,1); }
    }
  }

  function growPlants(){
    // Regla local de crecimiento con factores: noche, clima, vecindad y agua cercana
    const night = isNight();
    for(let y=0; y<WORLD_H; y++){
      for(let x=0; x<WORLD_W; x++){
        const id = idx(x,y);
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
    // Herbívoro come planta del tile actual si hay suficiente densidad
    if (a.sp!==SPECIES.HERB) return;
    const x = Math.floor(a.x), y = Math.floor(a.y);
    if (terrain[idx(x,y)]!==BIOME.GRASS) return;
    const id = idx(x,y);
    if (plant[id] > 0.05){
      a.energy = Math.min(a.energy + HERB.eatRate, 2.5);
      plant[id] = Math.max(0, plant[id] - HERB.eatPlantDelta);
    }
  }
  function dist2(a,b){
    // Distancia al cuadrado (evita sqrt) en píxeles del canvas
    const dx = (a.x-b.x)*TILE, dy = (a.y-b.y)*TILE;
    return dx*dx + dy*dy;
  }
  function nearestHerbivore(pred, visionTiles){
    // Busca el herbívoro más cercano dentro del radio de visión
    let best=null, bestD = (visionTiles*TILE)*(visionTiles*TILE);
    for(const b of animals){
      if (b.sp!==SPECIES.HERB) continue;
      const d2 = dist2(pred,b);
      if (d2 < bestD){ bestD = d2; best = b; }
    }
    return best;
  }
  function nearestPredator(h, visionTiles){
    // Devuelve un depredador si entra al radio de visión
    for(const b of animals){
      if (b.sp!==SPECIES.CARN) continue;
      const d2 = dist2(h,b);
      if (d2 < (visionTiles*TILE)*(visionTiles*TILE)) return b;
    }
    return null;
  }
  function mutate(val, sigma, min, max){
    // Mutación uniforme acotada (simple y robusta)
    const delta = (Math.random()*2-1) * sigma;
    return clamp(val + delta, min, max);
  }
  function reproduce(parent, species){
    // Reproducción asexual: hijo = padre +/- mutaciones pequeñas
    const g = parent.genes;
    const child = {
      sp: species,
      x: parent.x + (Math.random()-0.5)*0.6,
      y: parent.y + (Math.random()-0.5)*0.6,
      dir: Math.random()*Math.PI*2,
      speed: Math.max(0.35, parent.speed * (0.95 + Math.random()*0.1)),
      wobble: Math.max(0.1, parent.wobble * (0.95 + Math.random()*0.1)),
      r: Math.max(0.24, parent.r * (0.97 + Math.random()*0.06)),
      energy: species===SPECIES.HERB ? 0.8 : 1.0,
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
  let activeTool = TOOL.INSPECT; // Herramienta actual

  // Toolbar: click delega en data-tool y actualiza estado visual
  const toolbar = document.getElementById('toolbar');
  toolbar.addEventListener('click', (e)=>{
    const b = e.target.closest('button[data-tool]');
    if (!b) return;
    activeTool = b.dataset.tool;
    for (const btn of toolbar.querySelectorAll('button[data-tool]')) btn.classList.toggle('active', btn===b);
  });

  // Botones de eventos especiales
  document.getElementById('evtFire').addEventListener('click', ()=> triggerFireCenter());
  document.getElementById('evtMeteor').addEventListener('click', ()=> strikeMeteor());
  document.getElementById('evtPlagueH').addEventListener('click', ()=> plague(SPECIES.HERB, 0.3));
  document.getElementById('evtPlagueC').addEventListener('click', ()=> plague(SPECIES.CARN, 0.3));

  // Atajos de teclado para herramientas y eventos
  window.addEventListener('keydown', (e)=>{
    if (e.repeat) return; // evita autorepetición
    const k = e.key.toLowerCase();
    if (k==='1') setTool(TOOL.ADD_HERB);
    else if (k==='2') setTool(TOOL.ADD_CARN);
    else if (k==='3') setTool(TOOL.ERASER);
    else if (k==='4') setTool(TOOL.FOOD);
    else if (k==='5') setTool(TOOL.WATER);
    else if (k==='6') setTool(TOOL.BARRIER);
    else if (k==='7') setTool(TOOL.INSPECT);
    else if (k==='f') triggerFireCenter();
    else if (k==='m') strikeMeteor();
    else if (k==='p') plague(SPECIES.HERB, 0.3);
    else if (k==='o') plague(SPECIES.CARN, 0.3);
  });
  function setTool(t){
    activeTool = t;
    for (const btn of toolbar.querySelectorAll('button[data-tool]'))
      btn.classList.toggle('active', btn.dataset.tool===t);
  }

  // Entrada de ratón (y arrastre) sobre el canvas
  let dragging = false;
  cvs.addEventListener('mousedown', (e)=>{ dragging = true; handleAt(e); });
  cvs.addEventListener('mousemove', (e)=>{ if (dragging) handleAt(e); });
  window.addEventListener('mouseup', ()=> dragging=false);
  cvs.addEventListener('click', (e)=>{ if (!dragging) handleAt(e); });

  function getTileFromEvent(e){
    // Convierte coordenadas de pantalla a índice de tile respetando el tamaño CSS actual
    const rect = cvs.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (TILE * (rect.width / (WORLD_W*TILE))));
    const y = Math.floor((e.clientY - rect.top) / (TILE * (rect.height / (WORLD_H*TILE))));
    return {x: clamp(Math.floor(x),0,WORLD_W-1), y: clamp(Math.floor(y),0,WORLD_H-1)};
  }

  function handleAt(e){
    const {x,y} = getTileFromEvent(e);
    applyActionAt(x,y,activeTool);
  }

  function applyActionAt(x,y,action){
    // Aplica la herramienta elegida sobre el tile (x,y)
    const id = idx(x,y);
    switch(action){
      case TOOL.ADD_HERB:
        animals.push({
          sp: SPECIES.HERB, x:x+0.5, y:y+0.5, dir:Math.random()*Math.PI*2,
          speed: HERB.baseSpeed, wobble: 0.4, r:0.32, energy:1.0, cooldown:0, age:0,
          genes: defaultGenes(SPECIES.HERB)
        });
        break;
      case TOOL.ADD_CARN:
        animals.push({
          sp: SPECIES.CARN, x:x+0.5, y:y+0.5, dir:Math.random()*Math.PI*2,
          speed: CARN.baseSpeed, wobble: 0.4, r:0.36, energy:1.2, cooldown:0, age:0,
          genes: defaultGenes(SPECIES.CARN)
        });
        break;
      case TOOL.ERASER: {
        // Elimina animales en un radio de 2 tiles alrededor del punto
        const r=2; const r2=r*r;
        for (let i=animals.length-1;i>=0;i--){
          const a=animals[i];
          const dx=a.x-(x+0.5), dy=a.y-(y+0.5);
          if (dx*dx+dy*dy < r2) animals.splice(i,1);
        }
        break; }
      case TOOL.FOOD:
        if (terrain[id]===BIOME.GRASS){ plant[id] = clamp(plant[id] + 0.35, 0, 1); }
        break;
      case TOOL.WATER:
        terrain[id] = BIOME.WATER; plant[id] = 0; // Convertir a agua limpia el tile
        break;
      case TOOL.BARRIER:
        terrain[id] = BIOME.BARRIER; plant[id] = 0; // Obstáculo sólido
        break;
      case TOOL.INSPECT: {
        const nearest = nearestAnimalTo(x+0.5,y+0.5, 3);
        if (nearest){
          // Muestra estado y genes en consola para depuración
          console.log('Animal', {sp:nearest.sp===SPECIES.HERB?'HERB':'CARN', x:nearest.x, y:nearest.y, energy:nearest.energy, age:nearest.age, genes:nearest.genes});
        }
        break; }
    }
  }

  function nearestAnimalTo(x,y, maxR){
    // Escoge el animal más cercano a (x,y) dentro de un radio Euclídeo
    let best=null, bestD=maxR*maxR;
    for(const a of animals){
      const dx=a.x-x, dy=a.y-y; const d=dx*dx+dy*dy;
      if (d<bestD){ bestD=d; best=a; }
    }
    return best;
  }

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
  function render(){
    // --- Capa de terreno base por tile ---
    for(let y=0; y<WORLD_H; y++){
      for(let x=0; x<WORLD_W; x++){
        const id = idx(x,y);
        const t = terrain[id];
        if (t === BIOME.WATER){ ctx.fillStyle = COLORS.WATER; }
        else if (t === BIOME.DIRT){ ctx.fillStyle = COLORS.DIRT; }
        else if (t === BIOME.BARRIER){ ctx.fillStyle = COLORS.BARRIER; }
        else { const p = plant[id]; ctx.fillStyle = p > 0.66 ? COLORS.GRASS2 : (p > 0.33 ? COLORS.GRASS1 : COLORS.GRASS0); }
        ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
      }
    }

    // Sombreado sutil para orillas (tiles DIRT junto a WATER)
    ctx.globalAlpha = 0.08; ctx.fillStyle = COLORS.SHORE;
    for(let y=0; y<WORLD_H; y++){
      for(let x=0; x<WORLD_W; x++){
        if (terrain[idx(x,y)] !== BIOME.DIRT) continue;
        let nearWater=false;
        for(let dy=-1; dy<=1; dy++){
          for(let dx=-1; dx<=1; dx++){
            const nx=x+dx, ny=y+dy;
            if (nx<0||ny<0||nx>=WORLD_W||ny>=WORLD_H) continue;
            if (terrain[idx(nx,ny)]===BIOME.WATER){ nearWater=true; break; }
          }
          if(nearWater) break;
        }
        if (nearWater) ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
      }
    }
    ctx.globalAlpha = 1;

    // Detalle de brotes (ruido visual basado en densidad de planta)
    ctx.globalAlpha = 0.35; ctx.fillStyle = COLORS.GRASS2;
    for(let y=0; y<WORLD_H; y++){
      for(let x=0; x<WORLD_W; x++){
        if (terrain[idx(x,y)] !== BIOME.GRASS) continue;
        const p = plant[idx(x,y)]; if (p < 0.2) continue;
        const n = (p*3)|0; // más densidad => más trazos
        for(let i=0;i<n;i++){
          const ox = (Math.random()*0.8+0.1)*TILE; const oy = (Math.random()*0.8+0.1)*TILE;
          ctx.fillRect(x*TILE+ox, y*TILE+oy, 1, 2);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Dibujo de animales (círculo + triángulo direccional)
    for(const a of animals){
      ctx.fillStyle = (a.sp===SPECIES.HERB) ? '#fef08a' : '#ef4444';
      const r = a.r * TILE;
      ctx.beginPath(); ctx.arc(a.x*TILE, a.y*TILE, r, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); const ear = r*0.7; // triángulo direccional
      ctx.moveTo(a.x*TILE + Math.cos(a.dir)*r, a.y*TILE + Math.sin(a.dir)*r);
      ctx.lineTo(a.x*TILE + Math.cos(a.dir+0.8)*ear, a.y*TILE + Math.sin(a.dir+0.8)*ear);
      ctx.lineTo(a.x*TILE + Math.cos(a.dir-0.8)*ear, a.y*TILE + Math.sin(a.dir-0.8)*ear);
      ctx.closePath(); ctx.fill();
    }

    // Tinte nocturno proporcional al factor de luz
    const nightAlpha = 1 - daylightFactor();
    if (nightAlpha > 0.02){ ctx.fillStyle = `rgba(6, 8, 14, ${0.55*nightAlpha})`; ctx.fillRect(0,0,WORLD_W*TILE, WORLD_H*TILE); }

    // Efectos de clima (líneas de lluvia / filtro de sequía)
    if (weatherState===WEATHER.RAIN){
      ctx.globalAlpha = 0.4; ctx.strokeStyle = '#93c5fd';
      for(let i=0;i<120;i++){ const x = Math.random()*WORLD_W*TILE; const y = Math.random()*WORLD_H*TILE; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+2,y+8); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else if (weatherState===WEATHER.DROUGHT){
      ctx.globalAlpha = 0.15; ctx.fillStyle = '#f59e0b'; ctx.fillRect(0,0,WORLD_W*TILE, WORLD_H*TILE); ctx.globalAlpha = 1;
    }

    // Overlay del incendio
    if (fire){
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#fb923c';
      ctx.beginPath(); ctx.arc(fire.x*TILE, fire.y*TILE, fire.r*TILE, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Flash de meteorito (pantalla blanca breve)
    if (flashTimer>0){ flashTimer -= 1/60; ctx.globalAlpha = Math.max(0, flashTimer/0.3); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,WORLD_W*TILE, WORLD_H*TILE); ctx.globalAlpha = 1; }
  }

  // ==============================================================
  //                        BUCLE PRINCIPAL
  // ==============================================================
  let frames=0, fps=0, fpsTime=0; // Medición de FPS a 0.5s
  const $fps = document.getElementById('fps');
  const $count = document.getElementById('count');
  const $tick = document.getElementById('tick');
  const $clock = document.getElementById('clock');
  const $weather = document.getElementById('weather');

  function loop(now){
    const dt = Math.min(0.05, (now - last)/1000); // Delta tiempo con tope (50ms) para estabilidad
    last = now;

    step(dt);    // Actualización de estado
    render();    // Dibujo de frame

    // UI cada ~0.5s
    frames++; fpsTime += dt;
    if (fpsTime >= 0.5){
      fps = Math.round(frames / fpsTime);
      frames = 0; fpsTime = 0;
      const h = animals.filter(a=>a.sp===SPECIES.HERB).length;
      const c = animals.filter(a=>a.sp===SPECIES.CARN).length;
      $fps.textContent = `FPS: ${fps}`;
      $count.textContent = `Herbívoros: ${h} · Carnívoros: ${c} · Plantas densas: ${countGreens()}`;
      $tick.textContent = `t: ${simTime.toFixed(1)}s`;
      // Reloj 24h del día simulado
      const dayT = (worldTime % DAY_LENGTH_SEC) / DAY_LENGTH_SEC; // 0..1
      const hours = Math.floor(dayT * 24);
      const mins = Math.floor((dayT * 24 - hours) * 60);
      $clock.textContent = `Hora: ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
      $weather.textContent = `Clima: ${WEATHER_NAMES[weatherState]}`;
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
  generateTerrain();                 // Crea el mapa base
  spawnAnimals();                    // Población inicial
  weatherTimer = 0; advanceWeather(0.01); // Forzar selección de clima inicial
  setTool(TOOL.INSPECT);            // Herramienta por defecto
  requestAnimationFrame((t)=>{ last=t; loop(t); }); // Arranque del bucle

  // ==============================================================
  //                       SELF-TESTS (sanidad)
  // ==============================================================
  function runSelfTests(){
    const tests = [];
    const add = (name, pass, info='') => tests.push({ name, pass, info });

    // Tamaños de buffers del mundo
    add('terrain tamaño', terrain.length === WORLD_W*WORLD_H);
    // Asegura rango [0,1] en plantas
    add('plant [0,1]', (()=>{ for (let i=0;i<plant.length;i++){ const v=plant[i]; if(!(v>=0 && v<=1)) return false; } return true; })());

    // Poblaciones iniciales
    const h0 = animals.filter(a=>a.sp===SPECIES.HERB).length;
    const c0 = animals.filter(a=>a.sp===SPECIES.CARN).length;
    add('HERB_START', h0 === HERB_START, `h0=${h0}`);
    add('CARN_START', c0 === CARN_START, `c0=${c0}`);

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
    applyActionAt(gx,gy,TOOL.FOOD); add('Comida aumenta planta', plant[idG] >= oldPlant);

    // Verifica FIX de RNG: defaultGenes sin rng debe funcionar y estar en rango
    let okGenes = true; let g;
    try { g = defaultGenes(SPECIES.HERB); } catch(e){ okGenes = false; }
    add('defaultGenes() sin rng no falla', okGenes);
    if (okGenes){
      add('speedMul rango', g.speedMul>=0.75 && g.speedMul<=1.35, `v=${g.speedMul.toFixed(3)}`);
      add('metabolismMul rango', g.metabolismMul>=0.7 && g.metabolismMul<=1.5, `v=${g.metabolismMul.toFixed(3)}`);
      add('visionMul rango', g.visionMul>=0.7 && g.visionMul<=1.6, `v=${g.visionMul.toFixed(3)}`);
      add('lifespan rango', g.lifespan>=160 && g.lifespan<=240, `v=${g.lifespan}`);
    }

    // Añadir animal mediante herramienta debe incrementar población
    const before = animals.length;
    applyActionAt(gx,gy,TOOL.ADD_HERB);
    add('ADD_HERB incrementa población', animals.length === before+1, `before=${before} now=${animals.length}`);

    // Cambios de terreno por herramientas
    applyActionAt(gx,gy,TOOL.WATER);   add('Agua cambia a WATER', terrain[idG] === BIOME.WATER);
    applyActionAt(gx,gy,TOOL.BARRIER); add('Barrera cambia a BARRIER', terrain[idG] === BIOME.BARRIER);

    // Reporte visual breve
    const passed = tests.filter(t=>t.pass).length;
    const el = document.createElement('div'); el.className = 'tests'; el.innerHTML = `<b>Self-tests:</b> ${passed}/${tests.length} OK`;
    document.body.appendChild(el);
    console.group('%cSelf-tests Fase 4','color:#60a5fa');
    tests.forEach(t=>console[t.pass? 'log': 'error'](`${t.pass?'✔':'✖'} ${t.name}${t.info? ' — '+t.info:''}`));
    console.groupEnd();
  }
  runSelfTests();

  </script>
</body>
</html>
