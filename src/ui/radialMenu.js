export function initRadialMenu(container, options, holdMs = 500) {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  if (!root) return;

  const center = document.createElement('button');
  center.className = 'radial-btn';
  center.textContent = '\u2630';
  root.appendChild(center);

  const menu = document.createElement('div');
  menu.className = 'radial-options';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      opt.onSelect();
      hide();
    });
    menu.appendChild(btn);
  });
  root.appendChild(menu);

  let timer;
  function show() { menu.classList.add('open'); }
  function hide() { menu.classList.remove('open'); }
  function cancel() { clearTimeout(timer); hide(); }

  const start = () => { timer = setTimeout(show, holdMs); };

  center.addEventListener('mousedown', start);
  center.addEventListener('touchstart', start);
  center.addEventListener('mouseup', cancel);
  center.addEventListener('mouseleave', cancel);
  center.addEventListener('touchend', cancel);
}
