let onSectionChangeCb = null;

function setActiveNav(section) {
  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    const s = link.getAttribute('data-section');
    link.classList.toggle('active', s === section);
  });
}

function setActiveSection(section) {
  document.querySelectorAll('.content-section').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`${section}Section`);
  if (target) target.classList.add('active');
}

export function navigateToSection(section) {
  const safe = section || 'dashboard';
  window.location.hash = `#${safe}`;
  setActiveNav(safe);
  setActiveSection(safe);
  onSectionChangeCb?.(safe);
}

export function initRouter(onSectionChange) {
  onSectionChangeCb = onSectionChange;

  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      navigateToSection(section);
    });
  });

  window.addEventListener('hashchange', () => {
    const section = (window.location.hash || '#dashboard').replace('#', '');
    setActiveNav(section);
    setActiveSection(section);
    onSectionChangeCb?.(section);
  });
}


