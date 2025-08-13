/**
 * Inicializa un menú radial dentro del `container` dado.
 *
 * Retorna una función `destroy` que elimina los listeners registrados, útil
 * cuando el menú se monta y se desmonta dinámicamente.
 *
 * @param {HTMLElement|string} container
 * @param {{label:string,onSelect:Function}[]} options
 * @param {number} [holdMs=500]
 * @returns {Function} destroy
 *
 * @example
 * const destroy = initRadialMenu('#menu', opts);
 * // ... al desmontar
 * destroy();
 */
export function initRadialMenu(container, options, holdMs = 500) {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  if (!root) return () => {};

  const center = document.createElement('button');
  center.className = 'radial-btn';
  center.textContent = '\u2630';
  root.appendChild(center);

  const menu = document.createElement('div');
  menu.className = 'radial-options';
  const optionHandlers = [];
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.textContent = opt.label;
    const handler = () => {
      opt.onSelect();
      hide();
    };
    btn.addEventListener('click', handler);
    optionHandlers.push({ btn, handler });
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

  return function destroy() {
    center.removeEventListener('mousedown', start);
    center.removeEventListener('touchstart', start);
    center.removeEventListener('mouseup', cancel);
    center.removeEventListener('mouseleave', cancel);
    center.removeEventListener('touchend', cancel);
    optionHandlers.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
  };
}
