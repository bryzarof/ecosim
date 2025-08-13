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

  const icons = ['☀️', '🌧️', '🔥'];
  hud.weather.textContent = icons[state.weatherState] || '';
}
