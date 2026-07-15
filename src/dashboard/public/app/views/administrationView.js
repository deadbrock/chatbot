import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';

/**
 * View de Administração
 * 4 abas: API Keys, Conexões WhatsApp, Configurações, Roles & Permissões
 */

let currentTab = 'api-keys';

function unwrapApi(response) {
  return response?.data ?? response ?? {};
}

export function initAdministrationView() {
  console.log('Inicializando view de Administração');
  
  // Event listeners para tabs
  setupTabListeners();
  
  // Carregar primeira tab
  loadTab('api-keys');
}

function setupTabListeners() {
  const tabButtons = document.querySelectorAll('[data-admin-tab]');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const tab = e.currentTarget.dataset.adminTab;
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  // Atualizar botões
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-admin-tab="${tab}"]`)?.classList.add('active');
  
  // Atualizar conteúdo
  document.querySelectorAll('[data-admin-content]').forEach(content => {
    content.classList.remove('active');
  });
  document.querySelector(`[data-admin-content="${tab}"]`)?.classList.add('active');
  
  currentTab = tab;
  loadTab(tab);
}

async function loadTab(tab) {
  switch (tab) {
    case 'api-keys':
      await loadApiKeys();
      break;
    case 'connections':
      await loadConnections();
      break;
    case 'settings':
      await loadSettings();
      break;
    case 'roles':
      await loadRoles();
      break;
  }
}

// ==================== API KEYS ====================

async function loadApiKeys() {
  try {
    showLoading('Carregando API Keys...');
    
    const response = await apiFetch('/api-keys');
    const { apiKeys } = unwrapApi(response);
    
    renderApiKeys(apiKeys);
    hideLoading();
  } catch (error) {
    console.error('Erro ao carregar API Keys:', error);
    showToast('Erro ao carregar API Keys', 'error');
    hideLoading();
  }
}

function renderApiKeys(apiKeys) {
  const tbody = document.getElementById('apiKeysTableBody');
  
  if (!apiKeys || apiKeys.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma API Key encontrada</td></tr>';
    return;
  }
  
  tbody.innerHTML = apiKeys.map(key => `
    <tr>
      <td><strong>${key.name}</strong></td>
      <td><code>${key.prefix}***</code></td>
      <td><span class="badge bg-${getTypeColor(key.type)}">${key.type}</span></td>
      <td><span class="badge bg-${getStatusColor(key.status)}">${key.status}</span></td>
      <td>${key.totalRequests}</td>
      <td>${key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Nunca'}</td>
      <td>
        <button class="btn btn-sm btn-info" onclick="window.viewApiKey('${key.id}')">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-warning" onclick="window.revokeApiKey('${key.id}')">
          <i class="bi bi-x-circle"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="window.deleteApiKey('${key.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

window.viewApiKey = async function(id) {
  // TODO: Implementar modal de visualização
  showToast('Ver API Key: ' + id, 'info');
};

window.revokeApiKey = async function(id) {
  if (!confirm('Tem certeza que deseja revogar esta API Key?')) return;
  
  try {
    await apiFetch(`/api-keys/${id}/revoke`, { method: 'POST', body: { reason: 'Revogada pelo usuário' } });
    showToast('API Key revogada com sucesso', 'success');
    loadApiKeys();
  } catch (error) {
    showToast('Erro ao revogar API Key', 'error');
  }
};

window.deleteApiKey = async function(id) {
  if (!confirm('Tem certeza que deseja deletar esta API Key?')) return;
  
  try {
    await apiFetch(`/api-keys/${id}`, { method: 'DELETE' });
    showToast('API Key deletada com sucesso', 'success');
    loadApiKeys();
  } catch (error) {
    showToast('Erro ao deletar API Key', 'error');
  }
};

// ==================== CONNECTIONS ====================

async function loadConnections() {
  try {
    showLoading('Carregando Conexões...');
    
    const response = await apiFetch('/connections');
    const { connections } = unwrapApi(response);
    
    renderConnections(connections);
    hideLoading();
  } catch (error) {
    console.error('Erro ao carregar conexões:', error);
    showToast('Erro ao carregar conexões', 'error');
    hideLoading();
  }
}

function renderConnections(connections) {
  const tbody = document.getElementById('connectionsTableBody');
  
  if (!connections || connections.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma conexão encontrada</td></tr>';
    return;
  }
  
  tbody.innerHTML = connections.map(conn => `
    <tr>
      <td>
        <strong>${conn.name}</strong>
        ${conn.isDefault ? '<span class="badge bg-primary ms-2">Padrão</span>' : ''}
      </td>
      <td>${conn.phoneNumber || '-'}</td>
      <td><span class="badge bg-${getConnectionStatusColor(conn.status)}">${conn.status}</span></td>
      <td>${conn.stats?.totalMessages || 0}</td>
      <td>${conn.lastConnectedAt ? new Date(conn.lastConnectedAt).toLocaleString() : 'Nunca'}</td>
      <td>
        <button class="btn btn-sm btn-success" onclick="window.connectInstance('${conn.id}')">
          <i class="bi bi-plug"></i>
        </button>
        <button class="btn btn-sm btn-warning" onclick="window.disconnectInstance('${conn.id}')">
          <i class="bi bi-plug-fill"></i>
        </button>
        <button class="btn btn-sm btn-info" onclick="window.viewQRCode('${conn.id}')">
          <i class="bi bi-qr-code"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="window.deleteConnection('${conn.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

window.connectInstance = async function(id) {
  try {
    hideLoading();
    const connectData = unwrapApi(await apiFetch('/whatsapp/connect', { method: 'POST' }));
    if (connectData.connected) {
      showToast('WhatsApp já está conectado!', 'success');
      loadConnections();
      return;
    }
    if (connectData.qrcode) {
      showQRCodeModal({ qrcode: connectData.qrcode, expiresIn: connectData.expiresIn || 90 });
      startQRCodePolling();
      return;
    }
    await waitForQRCode(60, 2000);
    setTimeout(loadConnections, 2000);
  } catch (error) {
    hideLoading();
    showToast('Erro ao conectar instância', 'error');
  }
};

window.disconnectInstance = async function(id) {
  if (!confirm('Tem certeza que deseja desconectar o WhatsApp?')) return;
  
  try {
    await apiFetch('/whatsapp/disconnect', { method: 'POST' });
    showToast('WhatsApp desconectado', 'success');
    loadConnections();
  } catch (error) {
    showToast('Erro ao desconectar instância', 'error');
  }
};

window.viewQRCode = async function() {
  try {
    hideLoading();
    const status = unwrapApi(await apiFetch('/whatsapp/status'));
    if (status.connected) {
      showToast('WhatsApp já está conectado!', 'success');
      return;
    }

    showQRCodeModal({ loadingMessage: 'Gerando QR Code...' });

    if (!status.qrCode) {
      await apiFetch('/whatsapp/connect', { method: 'POST' });
    }

    await waitForQRCode(60, 2000);
  } catch (error) {
    hideLoading();
    console.error('Erro ao obter QR Code:', error);
    showToast('Erro ao obter QR Code', 'error');
  }
};

window.deleteConnection = async function(id) {
  if (!confirm('Tem certeza que deseja deletar esta conexão?')) return;
  
  try {
    await apiFetch(`/connections/${id}`, { method: 'DELETE' });
    showToast('Conexão deletada com sucesso', 'success');
    loadConnections();
  } catch (error) {
    showToast('Erro ao deletar conexão', 'error');
  }
};

function showClearSessionConfirmModal() {
  return new Promise((resolve) => {
    const existingModal = document.getElementById('clearSessionModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
      <div class="modal fade" id="clearSessionModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-warning">
              <h5 class="modal-title">
                <i class="bi bi-exclamation-triangle-fill"></i> Limpar sessão do WhatsApp
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">Esta ação é <strong>irreversível</strong> e executará o seguinte:</p>
              <ul class="mb-3">
                <li>Desconectar o WhatsApp deste painel</li>
                <li><strong>Apagar todas as conversas</strong> exibidas no chat</li>
                <li><strong>Apagar todas as mensagens</strong> importadas</li>
                <li>Remover contatos criados automaticamente pela sincronização</li>
                <li>Limpar os dados da sessão local (será necessário escanear o QR Code novamente)</li>
              </ul>
              <div class="alert alert-info mb-0">
                <i class="bi bi-info-circle"></i>
                Após reconectar, use <strong>Sincronizar</strong> para importar novamente as conversas e o histórico de mensagens do WhatsApp.
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="clearSessionCancelBtn">Cancelar</button>
              <button type="button" class="btn btn-warning" id="clearSessionConfirmBtn">
                <i class="bi bi-trash"></i> Limpar tudo e reconectar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalElement = document.getElementById('clearSessionModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    let settled = false;

    const finish = (confirmed) => {
      if (settled) return;
      settled = true;
      modal.hide();
      resolve(confirmed);
    };

    document.getElementById('clearSessionConfirmBtn')?.addEventListener('click', () => finish(true));
    document.getElementById('clearSessionCancelBtn')?.addEventListener('click', () => finish(false));
    modalElement.addEventListener('hidden.bs.modal', () => {
      if (!settled) resolve(false);
      modalElement.remove();
    }, { once: true });

    modal.show();
  });
}

// Função para exibir modal com QR Code (ou estado de carregamento)
function showQRCodeModal({ qrcode = null, expiresIn = 90, loadingMessage = 'Gerando QR Code...' } = {}) {
  const existingModal = document.getElementById('qrcodeModal');
  if (existingModal) {
    existingModal.remove();
  }

  const qrImageBlock = qrcode
    ? `<img id="qrCodeImage" src="${qrcode}" alt="QR Code" style="max-width: 100%; height: auto; border: 3px solid #25D366; border-radius: 10px;">`
    : `<div class="py-4" id="qrLoadingBlock">
        <div class="spinner-border text-success" style="width: 3rem; height: 3rem;" role="status"></div>
        <p class="mt-3 mb-0 text-muted" id="qrLoadingMessage">${loadingMessage}</p>
      </div>`;

  const expiryBlock = qrcode
    ? `<div class="alert alert-info mb-0" id="qrExpiryAlert">
        <i class="bi bi-clock"></i>
        <strong>Expira em <span id="qrCountdown">${expiresIn}</span> segundos</strong>
      </div>`
    : `<div class="alert alert-light mb-0" id="qrExpiryAlert">
        <i class="bi bi-info-circle"></i>
        <span id="qrLoadingHint">O QR Code aparecerá aqui automaticamente</span>
      </div>`;

  const modalHtml = `
    <div class="modal fade" id="qrcodeModal" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title">
              <i class="bi bi-whatsapp"></i> Conectar WhatsApp
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <p class="mb-3">Escaneie o QR Code com seu WhatsApp:</p>
            <div class="qrcode-container mb-3" id="qrCodeContainer" style="background: #f8f9fa; padding: 20px; border-radius: 10px; min-height: 280px; display: flex; align-items: center; justify-content: center;">
              ${qrImageBlock}
            </div>
            ${expiryBlock}
            <hr>
            <ol class="text-start small mb-0">
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque em <strong>Menu</strong> ou <strong>Configurações</strong></li>
              <li>Selecione <strong>Aparelhos conectados</strong></li>
              <li>Toque em <strong>Conectar um aparelho</strong></li>
              <li>Escaneie o QR Code acima</li>
            </ol>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
            <button type="button" class="btn btn-success" id="refreshQRBtn">
              <i class="bi bi-arrow-clockwise"></i> Atualizar QR Code
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalElement = document.getElementById('qrcodeModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
  modal.show();

  document.getElementById('refreshQRBtn')?.addEventListener('click', () => window.viewQRCode());

  if (qrcode) {
    startQRCountdown(expiresIn);
  }

  modalElement.addEventListener('hidden.bs.modal', () => {
    if (qrCountdownInterval) {
      clearInterval(qrCountdownInterval);
      qrCountdownInterval = null;
    }
    if (qrPollingInterval) {
      clearInterval(qrPollingInterval);
      qrPollingInterval = null;
    }
    modalElement.remove();
  });
}

let qrCountdownInterval = null;

function startQRCountdown(expiresIn) {
  if (qrCountdownInterval) clearInterval(qrCountdownInterval);

  let countdown = expiresIn;
  qrCountdownInterval = setInterval(() => {
    countdown -= 1;
    const countdownElement = document.getElementById('qrCountdown');
    if (!countdownElement) {
      clearInterval(qrCountdownInterval);
      return;
    }
    countdownElement.textContent = Math.max(0, countdown);
    if (countdown <= 0) {
      clearInterval(qrCountdownInterval);
      countdownElement.textContent = 'Expirado';
      const alertEl = document.getElementById('qrExpiryAlert');
      if (alertEl) {
        alertEl.classList.remove('alert-info');
        alertEl.classList.add('alert-warning');
      }
    }
  }, 1000);
}

function updateQRModalWithCode(qrcode, expiresIn = 90) {
  const container = document.getElementById('qrCodeContainer');
  if (!container) {
    showQRCodeModal({ qrcode, expiresIn });
    return;
  }

  container.innerHTML = `<img id="qrCodeImage" src="${qrcode}" alt="QR Code" style="max-width: 100%; height: auto; border: 3px solid #25D366; border-radius: 10px;">`;

  const alertEl = document.getElementById('qrExpiryAlert');
  if (alertEl) {
    alertEl.className = 'alert alert-info mb-0';
    alertEl.innerHTML = `<i class="bi bi-clock"></i> <strong>Expira em <span id="qrCountdown">${expiresIn}</span> segundos</strong>`;
  }

  startQRCountdown(expiresIn);
}

function updateQRModalMessage(message) {
  const msgEl = document.getElementById('qrLoadingMessage');
  if (msgEl) msgEl.textContent = message;
}

function showQRModalError(message) {
  const container = document.getElementById('qrCodeContainer');
  if (container) {
    container.innerHTML = `<div class="text-danger py-3"><i class="bi bi-exclamation-triangle"></i><p class="mt-2 mb-0">${message}</p></div>`;
  }
}

// Função para aguardar QR Code estar disponível
async function waitForQRCode(maxAttempts = 60, delayMs = 2000) {
  if (!document.getElementById('qrcodeModal')) {
    showQRCodeModal({ loadingMessage: 'Gerando QR Code...' });
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const status = unwrapApi(await apiFetch('/whatsapp/status'));
      const payload = unwrapApi(await apiFetch('/whatsapp/qrcode'));

      if (status.loadingMessage) {
        updateQRModalMessage(status.loadingMessage);
      } else if (payload.message) {
        updateQRModalMessage(payload.message);
      }

      if (payload.qrcode) {
        updateQRModalWithCode(payload.qrcode, payload.expiresIn || 90);
        startQRCodePolling();
        return true;
      }

      if (payload.connected || status.connected) {
        bootstrap.Modal.getInstance(document.getElementById('qrcodeModal'))?.hide();
        showToast('WhatsApp conectado com sucesso!', 'success');
        loadConnections();
        return true;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Erro na tentativa ${attempt} de QR:`, error);
      if (attempt === maxAttempts) {
        showQRModalError('Não foi possível gerar o QR Code. Tente "Limpar Sessão" e conectar novamente.');
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  showQRModalError('QR Code não disponível. Tente "Limpar Sessão" e conectar novamente.');
  return false;
}

let qrPollingInterval = null;

function startQRCodePolling() {
  if (qrPollingInterval) clearInterval(qrPollingInterval);

  qrPollingInterval = setInterval(async () => {
    try {
      const payload = unwrapApi(await apiFetch('/whatsapp/qrcode'));

      if (payload.connected) {
        clearInterval(qrPollingInterval);
        qrPollingInterval = null;
        bootstrap.Modal.getInstance(document.getElementById('qrcodeModal'))?.hide();
        showToast('WhatsApp conectado com sucesso!', 'success');
        loadConnections();
        return;
      }

      if (payload.qrcode) {
        const img = document.querySelector('#qrCodeImage');
        if (img) {
          img.src = payload.qrcode;
        } else {
          updateQRModalWithCode(payload.qrcode, payload.expiresIn || 90);
        }
        const countdownEl = document.getElementById('qrCountdown');
        if (countdownEl) countdownEl.textContent = payload.expiresIn || 90;
      }
    } catch (error) {
      console.error('Erro no polling do QR:', error);
    }
  }, 5000);
}

// Event listener para botão "Nova Conexão"
window.addEventListener('DOMContentLoaded', () => {
  const newConnectionBtn = document.getElementById('newConnectionBtn');
  if (newConnectionBtn) {
    newConnectionBtn.addEventListener('click', async () => {
      hideLoading();
      showQRCodeModal({ loadingMessage: 'Iniciando conexão WhatsApp...' });

      try {
        const connectData = unwrapApi(await apiFetch('/whatsapp/connect', { method: 'POST' }));

        if (connectData.connected) {
          showToast('WhatsApp já está conectado!', 'success');
          loadConnections();
          return;
        }

        if (connectData.qrcode) {
          updateQRModalWithCode(connectData.qrcode, connectData.expiresIn || 90);
          startQRCodePolling();
          return;
        }

        await waitForQRCode(60, 2000);
      } catch (error) {
        hideLoading();
        console.error('Erro ao iniciar conexão:', error);
        showToast('Erro ao iniciar conexão: ' + (error.message || 'Erro desconhecido'), 'error');
      }
    });
  }

  const syncWhatsappBtn = document.getElementById('syncWhatsappBtn');
  if (syncWhatsappBtn) {
    syncWhatsappBtn.addEventListener('click', async () => {
      try {
        hideLoading();
        const status = unwrapApi(await apiFetch('/whatsapp/status'));
        if (!status.connected) {
          showToast('Conecte o WhatsApp antes de sincronizar', 'warning');
          return;
        }

        showToast('Sincronização iniciada. Acompanhe o progresso no canto inferior direito.', 'info');
        await apiFetch('/whatsapp/sync', { method: 'POST', body: { force: true } });
      } catch (error) {
        hideLoading();
        showToast('Erro ao sincronizar: ' + (error.message || 'Erro desconhecido'), 'error');
      }
    });
  }

  const clearSessionBtn = document.getElementById('clearWhatsappSessionBtn');
  if (clearSessionBtn) {
    clearSessionBtn.addEventListener('click', async () => {
      const confirmed = await showClearSessionConfirmModal();
      if (!confirmed) return;

      try {
        hideLoading();
        const response = await apiFetch('/whatsapp/clear-session', {
          method: 'POST',
          body: { purgeConversations: true }
        });
        const purgeStats = response?.purgeStats || response?.data?.purgeStats;
        const tickets = purgeStats?.ticketsDeleted ?? 0;
        const messages = purgeStats?.messagesDeleted ?? 0;
        showToast(
          `Sessão limpa. ${tickets} conversas e ${messages} mensagens removidas. Gerando novo QR Code...`,
          'info'
        );
        showQRCodeModal({ loadingMessage: 'Gerando novo QR Code...' });
        await apiFetch('/whatsapp/connect', { method: 'POST' });
        await waitForQRCode(60, 2000);
        loadConnections();
      } catch (error) {
        hideLoading();
        console.error('Erro ao limpar sessão:', error);
        showToast('Erro ao limpar sessão: ' + (error.message || 'Erro desconhecido'), 'error');
      }
    });
  }
});

// ==================== SETTINGS ====================

async function loadSettings() {
  try {
    showLoading('Carregando Configurações...');
    
    const response = await apiFetch('/settings');
    const { settings } = unwrapApi(response);
    
    renderSettings(settings);
    hideLoading();
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    showToast('Erro ao carregar configurações', 'error');
    hideLoading();
  }
}

function renderSettings(settings) {
  const container = document.getElementById('settingsContainer');
  
  if (!settings || Object.keys(settings).length === 0) {
    container.innerHTML = '<p class="text-center text-muted">Nenhuma configuração encontrada</p>';
    return;
  }
  
  let html = '';
  
  for (const [category, categorySettings] of Object.entries(settings)) {
    html += `
      <div class="card mb-3">
        <div class="card-header">
          <h5 class="mb-0">${getCategoryLabel(category)}</h5>
        </div>
        <div class="card-body">
          ${categorySettings.map(setting => `
            <div class="mb-3">
              <label class="form-label">
                ${setting.label}
                ${setting.requiresRestart ? '<span class="badge bg-warning">Requer Reiniciar</span>' : ''}
              </label>
              ${renderSettingInput(setting)}
              ${setting.description ? `<small class="form-text text-muted d-block">${setting.description}</small>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

function renderSettingInput(setting) {
  if (setting.type === 'boolean') {
    return `
      <div class="form-check form-switch">
        <input type="checkbox" class="form-check-input" 
               id="setting_${setting.key}" 
               ${setting.value ? 'checked' : ''}
               ${setting.isReadOnly ? 'disabled' : ''}
               onchange="window.updateSetting('${setting.key}', this.checked)">
      </div>
    `;
  }
  
  if (setting.options) {
    return `
      <select class="form-select" id="setting_${setting.key}"
              ${setting.isReadOnly ? 'disabled' : ''}
              onchange="window.updateSetting('${setting.key}', this.value)">
        ${setting.options.map(opt => `
          <option value="${opt.value}" ${setting.value === opt.value ? 'selected' : ''}>
            ${opt.label}
          </option>
        `).join('')}
      </select>
    `;
  }
  
  return `
    <input type="${setting.type === 'number' ? 'number' : 'text'}" 
           class="form-control" 
           id="setting_${setting.key}"
           value="${setting.value || ''}"
           ${setting.isReadOnly ? 'readonly' : ''}
           onblur="window.updateSetting('${setting.key}', this.value)">
  `;
}

window.updateSetting = async function(key, value) {
  try {
    await apiFetch(`/settings/${key}`, { method: 'PUT', body: { value } });
    showToast('Configuração atualizada', 'success');
  } catch (error) {
    showToast('Erro ao atualizar configuração', 'error');
    loadSettings(); // Recarregar para reverter
  }
};

// ==================== ROLES ====================

async function loadRoles() {
  try {
    showLoading('Carregando Papéis...');
    
    const response = await apiFetch('/roles');
    const { roles } = unwrapApi(response);
    
    renderRoles(roles);
    hideLoading();
  } catch (error) {
    console.error('Erro ao carregar papéis:', error);
    showToast('Erro ao carregar papéis', 'error');
    hideLoading();
  }
}

function renderRoles(roles) {
  const container = document.getElementById('rolesContainer');
  
  if (!roles || roles.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">Nenhum papel encontrado</p>';
    return;
  }
  
  container.innerHTML = roles.map(role => `
    <div class="col-md-6 mb-3">
      <div class="card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h5 class="card-title">${role.displayName}</h5>
              <p class="text-muted small mb-0">Nível: ${role.level}</p>
            </div>
            <span class="badge bg-${role.type === 'system' ? 'primary' : 'secondary'}">${role.type}</span>
          </div>
          
          <p class="card-text text-muted">${role.description || 'Sem descrição'}</p>
          
          <div class="mb-3">
            <strong>Permissões (${role.permissions.length}):</strong>
            <div class="mt-2">
              ${role.permissions.slice(0, 5).map(perm => `
                <span class="badge bg-info me-1">${perm}</span>
              `).join('')}
              ${role.permissions.length > 5 ? `<span class="text-muted">+${role.permissions.length - 5} mais</span>` : ''}
            </div>
          </div>
          
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-primary" onclick="window.viewRole('${role.id}')">
              <i class="bi bi-eye"></i> Ver Detalhes
            </button>
            ${role.type !== 'system' ? `
              <button class="btn btn-sm btn-danger" onclick="window.deleteRole('${role.id}')">
                <i class="bi bi-trash"></i> Deletar
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

window.viewRole = async function(id) {
  // TODO: Implementar modal de visualização
  showToast('Ver Papel: ' + id, 'info');
};

window.deleteRole = async function(id) {
  if (!confirm('Tem certeza que deseja deletar este papel?')) return;
  
  try {
    await apiFetch(`/roles/${id}`, { method: 'DELETE' });
    showToast('Papel deletado com sucesso', 'success');
    loadRoles();
  } catch (error) {
    showToast('Erro ao deletar papel', 'error');
  }
};

// ==================== HELPERS ====================

function getTypeColor(type) {
  const colors = {
    production: 'success',
    sandbox: 'warning',
    webhook: 'info',
    integration: 'primary'
  };
  return colors[type] || 'secondary';
}

function getStatusColor(status) {
  const colors = {
    active: 'success',
    inactive: 'secondary',
    revoked: 'danger',
    expired: 'warning'
  };
  return colors[status] || 'secondary';
}

function getConnectionStatusColor(status) {
  const colors = {
    connected: 'success',
    connecting: 'warning',
    disconnected: 'secondary',
    authenticated: 'info',
    qr_ready: 'primary',
    error: 'danger',
    paused: 'warning'
  };
  return colors[status] || 'secondary';
}

function getCategoryLabel(category) {
  const labels = {
    general: 'Geral',
    whatsapp: 'WhatsApp',
    notifications: 'Notificações',
    email: 'Email',
    tickets: 'Tickets',
    chat: 'Chat',
    integrations: 'Integrações',
    security: 'Segurança',
    appearance: 'Aparência',
    birthday: 'Aniversários',
    automation: 'Automação',
    api: 'API',
    advanced: 'Avançado'
  };
  return labels[category] || category;
}

