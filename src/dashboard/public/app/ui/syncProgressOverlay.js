import { apiFetch } from '../api.js';
import { connectSocket } from '../socket.js';

let overlayEl = null;
let pollTimer = null;
let hideTimer = null;
let initialized = false;
let lastProgressKey = '';

function unwrapStatus(response) {
  return response?.data ?? response ?? {};
}

function ensureOverlay() {
  if (overlayEl) return overlayEl;

  overlayEl = document.createElement('div');
  overlayEl.id = 'whatsappSyncOverlay';
  overlayEl.className = 'whatsapp-sync-overlay';
  overlayEl.setAttribute('role', 'status');
  overlayEl.setAttribute('aria-live', 'polite');
  overlayEl.innerHTML = `
    <div class="whatsapp-sync-overlay__header">
      <div class="whatsapp-sync-overlay__icon">
        <i class="bi bi-whatsapp"></i>
      </div>
      <div>
        <h6 class="whatsapp-sync-overlay__title">Sincronizando WhatsApp</h6>
        <p class="whatsapp-sync-overlay__subtitle" id="syncOverlayPhase">Preparando...</p>
      </div>
    </div>
    <div class="whatsapp-sync-overlay__body">
      <div class="whatsapp-sync-overlay__percent-row">
        <span class="whatsapp-sync-overlay__percent" id="syncOverlayPercent">0%</span>
        <span class="whatsapp-sync-overlay__phase" id="syncOverlayCounter">0 / 0 conversas</span>
      </div>
      <div class="whatsapp-sync-overlay__bar" aria-hidden="true">
        <div class="whatsapp-sync-overlay__bar-fill" id="syncOverlayBar"></div>
      </div>
      <div class="whatsapp-sync-overlay__stats">
        <div class="whatsapp-sync-overlay__stat">
          <span class="whatsapp-sync-overlay__stat-label">Conversas</span>
          <span class="whatsapp-sync-overlay__stat-value" id="syncOverlayChats">0 / 0</span>
        </div>
        <div class="whatsapp-sync-overlay__stat">
          <span class="whatsapp-sync-overlay__stat-label">Mensagens</span>
          <span class="whatsapp-sync-overlay__stat-value" id="syncOverlayMessages">0</span>
        </div>
      </div>
      <p class="whatsapp-sync-overlay__message" id="syncOverlayMessage">Aguardando início...</p>
    </div>
  `;

  document.body.appendChild(overlayEl);
  return overlayEl;
}

function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR');
}

function phaseLabel(progress) {
  switch (progress?.phase) {
    case 'counting_chats':
      return 'Contando conversas';
    case 'syncing_chats':
      return 'Importando conversas';
    case 'done':
      return 'Concluído';
    case 'error':
      return 'Erro';
    default:
      return 'Preparando';
  }
}

function progressKey(progress) {
  if (!progress) return '';
  return [
    progress.status,
    progress.percent,
    progress.chatsProcessed,
    progress.chatsToSync,
    progress.messagesSynced,
    progress.message
  ].join('|');
}

function updateOverlay(progress) {
  if (!progress) return;

  const key = progressKey(progress);
  if (key === lastProgressKey) return;
  lastProgressKey = key;

  ensureOverlay();

  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  const chatsProcessed = Number(progress.chatsProcessed) || 0;
  const chatsToSync = Number(progress.chatsToSync) || 0;
  const messagesImported = Number(progress.messagesImported) || 0;
  const messagesSynced = Number(progress.messagesSynced) || (messagesImported + (Number(progress.messagesUpdated) || 0));

  overlayEl.classList.toggle('is-success', progress.status === 'completed');
  overlayEl.classList.toggle('is-error', progress.status === 'error');

  document.getElementById('syncOverlayPercent').textContent = `${percent}%`;
  document.getElementById('syncOverlayPhase').textContent = phaseLabel(progress);
  document.getElementById('syncOverlayCounter').textContent = chatsToSync
    ? `${formatNumber(chatsProcessed)} / ${formatNumber(chatsToSync)} conversas`
    : `${formatNumber(progress.chatsFound || 0)} encontradas`;
  document.getElementById('syncOverlayBar').style.width = `${percent}%`;
  document.getElementById('syncOverlayChats').textContent = chatsToSync
    ? `${formatNumber(chatsProcessed)} / ${formatNumber(chatsToSync)}`
    : formatNumber(progress.chatsFound || 0);
  document.getElementById('syncOverlayMessages').textContent = formatNumber(messagesSynced);
  document.getElementById('syncOverlayMessage').textContent = progress.message || 'Sincronizando...';

  if (['started', 'counting', 'running'].includes(progress.status)) {
    showOverlay();
    startPolling();
  } else if (progress.status === 'completed') {
    showOverlay();
    scheduleHide(4500);
    stopPolling();
  } else if (progress.status === 'error') {
    showOverlay();
    scheduleHide(6000);
    stopPolling();
  }
}

function showOverlay() {
  ensureOverlay();
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  overlayEl.classList.add('is-visible');
}

function scheduleHide(delayMs = 4000) {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    overlayEl?.classList.remove('is-visible', 'is-success', 'is-error');
    lastProgressKey = '';
  }, delayMs);
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const status = unwrapStatus(await apiFetch('/whatsapp/sync/status'));
      if (status.syncInProgress && status.progress) {
        updateOverlay(status.progress);
        return;
      }
      if (!status.syncInProgress && status.progress?.status === 'completed') {
        updateOverlay(status.progress);
        stopPolling();
      }
    } catch {
      // Ignorar falhas temporárias de rede durante polling
    }
  }, 1500);
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

function handleProgress(data) {
  updateOverlay(data);
}

function handleComplete(data) {
  if (data?.progress) {
    updateOverlay(data.progress);
    return;
  }
  if (data?.success && data?.stats) {
    updateOverlay({
      status: 'completed',
      phase: 'done',
      percent: 100,
      chatsProcessed: data.stats.chatsProcessed,
      chatsToSync: data.stats.chatsToSync,
      chatsFound: data.stats.chatsFound,
      messagesImported: data.stats.messagesImported,
      message: `Sincronização concluída: ${data.stats.conversationsEnsured || data.stats.ticketsEnsured || data.stats.chatsProcessed} conversas, ${(data.stats.messagesImported || 0) + (data.stats.messagesUpdated || 0)} mensagens`
    });
  } else if (!data?.success) {
    updateOverlay({
      status: 'error',
      phase: 'error',
      message: data?.error || 'Erro na sincronização'
    });
  }
}

async function checkInitialSyncStatus() {
  try {
    const status = unwrapStatus(await apiFetch('/whatsapp/sync/status'));
    if (status.syncInProgress && status.progress) {
      updateOverlay(status.progress);
      startPolling();
    }
  } catch {
    // Sem autenticação ou API indisponível
  }
}

/**
 * Dispara sincronização automática ao entrar no painel (ex.: após fim de semana).
 */
export async function triggerLoginSync() {
  try {
    const whatsappStatus = unwrapStatus(await apiFetch('/whatsapp/status'));
    if (!whatsappStatus.connected) return;

    const syncStatus = unwrapStatus(await apiFetch('/whatsapp/sync/status'));
    if (syncStatus.syncInProgress) {
      if (syncStatus.progress) {
        updateOverlay(syncStatus.progress);
        startPolling();
      }
      return;
    }

    await apiFetch('/whatsapp/sync-on-login', {
      method: 'POST',
      body: { force: true }
    });
  } catch {
    // WhatsApp offline ou API indisponível — painel segue normalmente
  }
}

export function initWhatsappSyncProgress() {
  if (initialized) return;
  initialized = true;

  ensureOverlay();

  const socket = connectSocket();
  socket.on('whatsapp_sync_progress', handleProgress);
  socket.on('whatsapp_sync_complete', handleComplete);

  checkInitialSyncStatus();
}
