import { escapeHtml } from './dom.js';

export function createToast({ title, message, variant = 'primary', delay = 3200 }) {
  const container = document.getElementById('toastContainer');
  if (!container || !window.bootstrap) return;

  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${variant} border-0`;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <strong class="me-1">${escapeHtml(title)}</strong>
        <span>${escapeHtml(message)}</span>
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
    </div>
  `;

  container.appendChild(el);
  const toast = new window.bootstrap.Toast(el, { delay });
  toast.show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

/**
 * Função helper simplificada para mostrar toasts
 * @param {string} message - Mensagem do toast
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 */
export function showToast(message, type = 'info') {
  const variantMap = {
    'success': 'success',
    'error': 'danger',
    'warning': 'warning',
    'info': 'info'
  };
  
  const titleMap = {
    'success': 'Sucesso',
    'error': 'Erro',
    'warning': 'Atenção',
    'info': 'Informação'
  };
  
  createToast({
    title: titleMap[type] || 'Notificação',
    message: message,
    variant: variantMap[type] || 'primary'
  });
}


