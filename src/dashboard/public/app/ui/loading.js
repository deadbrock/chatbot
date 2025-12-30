/**
 * Sistema de loading states para o dashboard
 */

/**
 * Mostrar spinner de loading global
 */
export function showLoading(message = 'Carregando...') {
  showPageLoading(message);
}

/**
 * Esconder spinner de loading global
 */
export function hideLoading() {
  hidePageLoading();
}

/**
 * Mostrar spinner de loading em um elemento específico
 */
export function showLoadingInElement(elementId, message = 'Carregando...') {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.innerHTML = `
    <div class="loading-container">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="text-muted mt-3 mb-0">${message}</p>
    </div>
  `;
}

/**
 * Mostrar estado vazio
 */
export function showEmpty(elementId, config = {}) {
  const {
    icon = 'bi-inbox',
    title = 'Nenhum item encontrado',
    message = 'Quando houver dados, eles aparecerão aqui.',
    action = null
  } = config;

  const el = document.getElementById(elementId);
  if (!el) return;

  const actionHtml = action ? `
    <button class="btn btn-sm btn-outline-primary mt-3" onclick="${action.onClick}">
      <i class="bi ${action.icon}"></i> ${action.label}
    </button>
  ` : '';

  el.innerHTML = `
    <div class="empty-state">
      <i class="bi ${icon} empty-icon"></i>
      <h5 class="mt-3 mb-2">${title}</h5>
      <p class="text-muted">${message}</p>
      ${actionHtml}
    </div>
  `;
}

/**
 * Mostrar estado de erro
 */
export function showError(elementId, config = {}) {
  const {
    title = 'Erro ao carregar',
    message = 'Não foi possível carregar os dados. Tente novamente.',
    retry = null
  } = config;

  const el = document.getElementById(elementId);
  if (!el) return;

  const retryHtml = retry ? `
    <button class="btn btn-sm btn-primary mt-3" onclick="${retry.onClick}">
      <i class="bi bi-arrow-clockwise"></i> Tentar novamente
    </button>
  ` : '';

  el.innerHTML = `
    <div class="error-state">
      <i class="bi bi-exclamation-triangle-fill text-danger error-icon"></i>
      <h5 class="mt-3 mb-2">${title}</h5>
      <p class="text-muted">${message}</p>
      ${retryHtml}
    </div>
  `;
}

/**
 * Mostrar skeleton loader (placeholder animado)
 */
export function showSkeleton(elementId, type = 'table') {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (type === 'table') {
    el.innerHTML = `
      <div class="skeleton-loader">
        ${Array(5).fill(0).map(() => `
          <div class="skeleton-row">
            <div class="skeleton-cell"></div>
            <div class="skeleton-cell"></div>
            <div class="skeleton-cell"></div>
            <div class="skeleton-cell"></div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (type === 'card') {
    el.innerHTML = `
      <div class="skeleton-card">
        <div class="skeleton-title"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text"></div>
      </div>
    `;
  } else if (type === 'list') {
    el.innerHTML = `
      <div class="skeleton-list">
        ${Array(8).fill(0).map(() => `
          <div class="skeleton-item"></div>
        `).join('')}
      </div>
    `;
  }
}

/**
 * Wrapper para executar ação com loading
 */
export async function withLoading(elementId, asyncFn, loadingMessage = 'Carregando...') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const originalContent = el.innerHTML;
  
  try {
    showLoadingInElement(elementId, loadingMessage);
    const result = await asyncFn();
    return result;
  } catch (error) {
    showError(elementId, {
      title: 'Erro',
      message: error?.message || 'Ocorreu um erro inesperado.',
      retry: {
        onClick: `location.reload()`,
        label: 'Recarregar'
      }
    });
    throw error;
  }
}

/**
 * Mostrar progress bar
 */
export function showProgress(elementId, percent, label = '') {
  const el = document.getElementById(elementId);
  if (!el) return;

  const clampedPercent = Math.max(0, Math.min(100, percent));

  el.innerHTML = `
    <div class="progress-container">
      ${label ? `<div class="progress-label mb-2">${label}</div>` : ''}
      <div class="progress" style="height: 8px;">
        <div 
          class="progress-bar progress-bar-striped progress-bar-animated" 
          role="progressbar" 
          style="width: ${clampedPercent}%"
          aria-valuenow="${clampedPercent}" 
          aria-valuemin="0" 
          aria-valuemax="100"
        ></div>
      </div>
      <div class="progress-percent text-muted mt-1">${clampedPercent}%</div>
    </div>
  `;
}

/**
 * Adicionar overlay de loading na página inteira
 */
export function showPageLoading(message = 'Carregando...') {
  const existing = document.getElementById('page-loading-overlay');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'page-loading-overlay';
  overlay.className = 'page-loading-overlay';
  overlay.innerHTML = `
    <div class="page-loading-content">
      <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status">
        <span class="visually-hidden">Carregando...</span>
      </div>
      <p class="text-light mt-3 mb-0">${message}</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

/**
 * Remover overlay de loading
 */
export function hidePageLoading() {
  const overlay = document.getElementById('page-loading-overlay');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Adicionar classe de loading em botão
 */
export function setButtonLoading(buttonElement, loading = true) {
  if (!buttonElement) return;

  if (loading) {
    buttonElement.disabled = true;
    buttonElement.dataset.originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Carregando...
    `;
  } else {
    buttonElement.disabled = false;
    buttonElement.innerHTML = buttonElement.dataset.originalText || buttonElement.innerHTML;
  }
}

