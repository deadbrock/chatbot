import { getStoredUser } from './auth.js';
import { resolveSectionForRole } from './permissions.js';
import { syncSidebarSubmenu } from './menuController.js';

let onSectionChangeCb = null;
let onAccessDeniedCb = null;

function setActiveNav(section) {
  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    const s = link.getAttribute('data-section');
    link.classList.toggle('active', s === section);
  });
  syncSidebarSubmenu(section);
}

function setActiveSection(section) {
  document.querySelectorAll('.content-section').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`${section}Section`);
  if (target) target.classList.add('active');
}

function resolveNavigationTarget(section) {
  const role = getStoredUser()?.role || 'agent';
  const requested = section || 'dashboard';
  const allowed = resolveSectionForRole(role, requested);

  if (allowed !== requested) {
    onAccessDeniedCb?.(requested, allowed);
  }

  return allowed;
}

export function navigateToSection(section) {
  const safe = resolveNavigationTarget(section);
  window.location.hash = `#${safe}`;
  setActiveNav(safe);
  setActiveSection(safe);
  onSectionChangeCb?.(safe);
}

export function initRouter(onSectionChange, onAccessDenied) {
  onSectionChangeCb = onSectionChange;
  onAccessDeniedCb = onAccessDenied;

  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      navigateToSection(section);
    });
  });

  window.addEventListener('hashchange', () => {
    const requested = (window.location.hash || '#dashboard').replace('#', '');
    const safe = resolveNavigationTarget(requested);

    if (safe !== requested) {
      window.location.hash = `#${safe}`;
      return;
    }

    setActiveNav(safe);
    setActiveSection(safe);
    onSectionChangeCb?.(safe);
  });
}
