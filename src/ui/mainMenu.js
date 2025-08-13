export function initMainMenu(state){
  const root = document.getElementById('mainMenu');
  if(!root) return;
  const logo = document.createElement('img');
  logo.id = 'mainMenuLogo';
  logo.src = 'public/images/logo.png';
  root.appendChild(logo);
 
  const buttons = [
    { label: 'Jugar', action: 'play' },
    { label: 'Opciones', action: 'options' },
    { label: 'Tutorial', action: 'tutorial' },
    { label: 'Cr\u00E9ditos', action: 'credits' }
  ];

  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    btn.dataset.action = b.action;
    root.appendChild(btn);
  });

  requestAnimationFrame(() => root.classList.add('show'));

  const playBtn = root.querySelector('button[data-action="play"]');
  if(playBtn){
    playBtn.addEventListener('click', () => {
      root.classList.add('hide');
      state.paused = false;
      setTimeout(() => root.remove(), 500);
    });
  }

  state.paused = true;
}
