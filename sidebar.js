export function initSidebar(state){
  const sidebar = document.getElementById('sidebar');
  if(!sidebar) return;
  state.sidebar = sidebar;

  const sections = [
    {
      id: 'info',
      title: 'Información',
      content: `<p>Tiempo sim: <span id="sb-simTime">0</span>s</p>`
    },
    {
      id: 'ayuda',
      title: 'Ayuda',
      content: `<p>Usa la barra de herramientas para interactuar con el mundo.</p>`
    }
  ];

  const detailElements = [];
  sections.forEach(sec => {
    const details = document.createElement('details');
    details.dataset.section = sec.id;
    const summary = document.createElement('summary');
    summary.textContent = sec.title;
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = sec.content;
    details.appendChild(summary);
    details.appendChild(panel);

    if (localStorage.getItem(`sidebar-${sec.id}`) === '1') {
      details.open = true;
    }

    details.addEventListener('toggle', () => {
      if (details.open) {
        detailElements.forEach(d => { if (d !== details) d.open = false; });
      }
      localStorage.setItem(`sidebar-${sec.id}`, details.open ? '1' : '0');
    });

    sidebar.appendChild(details);
    detailElements.push(details);
  });

  state.sidebarPanels = sidebar.querySelectorAll('.panel');
}
