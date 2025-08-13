import { gsap } from 'gsap';

export function initHUD(state) {
  const hud = document.getElementById('hud');
  if (!hud) return;

  const playBtn = document.createElement('button');
  playBtn.id = 'playPause';
  playBtn.textContent = '⏸️';
  hud.appendChild(playBtn);

  const clock = document.createElement('span');
  clock.id = 'hudClock';
  clock.title = 'Hora';
  hud.appendChild(clock);

  const weather = document.createElement('span');
  weather.id = 'hudWeather';
  weather.title = 'Clima';
  hud.appendChild(weather);

  const herb = document.createElement('span');
  herb.className = 'stat';
  herb.title = 'Herbívoros';
  herb.appendChild(document.createTextNode('🐇 '));
  const herbCount = document.createElement('span');
  herbCount.id = 'herbCount';
  herbCount.textContent = '0';
  herb.appendChild(herbCount);
  hud.appendChild(herb);

  const carn = document.createElement('span');
  carn.className = 'stat';
  carn.title = 'Carnívoros';
  carn.appendChild(document.createTextNode('🦊 '));
  const carnCount = document.createElement('span');
  carnCount.id = 'carnCount';
  carnCount.textContent = '0';
  carn.appendChild(carnCount);
  hud.appendChild(carn);

  const plant = document.createElement('span');
  plant.className = 'stat';
  plant.title = 'Plantas densas';
  plant.appendChild(document.createTextNode('🌿 '));
  const plantCount = document.createElement('span');
  plantCount.id = 'plantCount';
  plantCount.textContent = '0';
  plant.appendChild(plantCount);
  hud.appendChild(plant);

  playBtn.addEventListener('click', () => {
    state.paused = !state.paused;
    playBtn.textContent = state.paused ? '▶️' : '⏸️';
  });

  state.hud = { playBtn, clock, weather, herbCount, carnCount, plantCount };
  state.hudPrevWeather = -1;
}

export function updateHUD(state) {
  const hud = state.hud;
  if (!hud) return;

  const herb = state.animals.filter(a => a.sp === 'HERB').length;
  const carn = state.animals.filter(a => a.sp === 'CARN').length;
  let plants = 0;
  for (let i = 0; i < state.terrain.length; i++) {
    if (state.terrain[i] === state.BIOME.GRASS && state.plant[i] > 0.33) plants++;
  }
  hud.herbCount.textContent = herb;
  hud.carnCount.textContent = carn;
  hud.plantCount.textContent = plants;

  const dayT = (state.worldTime % state.DAY_LENGTH_SEC) / state.DAY_LENGTH_SEC;
  const hours = Math.floor(dayT * 24);
  const mins = Math.floor((dayT * 24 - hours) * 60);
  hud.clock.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

  const icons = [
    `<svg id="sunIcon" class="weather-icon" viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="gold"/><g id="rays" stroke="gold" stroke-width="4"><line x1="32" y1="4" x2="32" y2="16"/><line x1="32" y1="48" x2="32" y2="60"/><line x1="4" y1="32" x2="16" y2="32"/><line x1="48" y1="32" x2="60" y2="32"/><line x1="11" y1="11" x2="20" y2="20"/><line x1="44" y1="44" x2="53" y2="53"/><line x1="44" y1="20" x2="53" y2="11"/><line x1="11" y1="53" x2="20" y2="44"/></g></svg>`,
    `<svg id="rainIcon" class="weather-icon" viewBox="0 0 64 64"><g fill="none" stroke="deepskyblue" stroke-width="4"><path d="M20 30c0-8 6-14 12-14s12 6 12 14"/><line class="drop" x1="24" y1="38" x2="24" y2="50"/><line class="drop" x1="32" y1="38" x2="32" y2="50"/><line class="drop" x1="40" y1="38" x2="40" y2="50"/></g></svg>`,
    `<svg id="fireIcon" class="weather-icon" viewBox="0 0 64 64"><path d="M32 6c8 10 8 14 8 18 0 6-4 10-8 10s-8-4-8-10c0-4 0-8 8-18zm0 28c4 4 8 8 8 14 0 6-4 10-8 10s-8-4-8-10c0-6 4-10 8-14z" fill="orange" stroke="orangered" stroke-width="2"/></svg>`
  ];

  if (state.weatherState !== state.hudPrevWeather) {
    hud.weather.innerHTML = icons[state.weatherState] || '';
    gsap.killTweensOf('#sunIcon, #rainIcon .drop, #fireIcon');
    switch (state.weatherState) {
      case 0:
        gsap.to('#sunIcon', { rotation:360, repeat:-1, duration:20, ease:'linear', transformOrigin:'50% 50%' });
        break;
      case 1:
        gsap.to('#rainIcon .drop', { y:6, repeat:-1, yoyo:true, stagger:0.1, duration:0.6 });
        break;
      case 2:
        gsap.to('#fireIcon', { scale:1.1, repeat:-1, yoyo:true, transformOrigin:'50% 100%', duration:0.4 });
        break;
    }
    state.hudPrevWeather = state.weatherState;
  }
  }
