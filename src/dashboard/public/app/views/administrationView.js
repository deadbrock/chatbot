import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';

/**
 * View de Administração
 * 4 abas: API Keys, Conexões WhatsApp, Configurações, Roles & Permissões
 */

let currentTab = 'api-keys';

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
    const { apiKeys } = response;
    
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
    const { connections } = response;
    
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
    await apiFetch(`/connections/${id}/connect`, { method: 'POST' });
    showToast('Conectando instância...', 'info');
    setTimeout(loadConnections, 2000);
  } catch (error) {
    showToast('Erro ao conectar instância', 'error');
  }
};

window.disconnectInstance = async function(id) {
  if (!confirm('Tem certeza que deseja desconectar esta instância?')) return;
  
  try {
    await apiFetch(`/connections/${id}/disconnect`, { method: 'POST' });
    showToast('Instância desconectada', 'success');
    loadConnections();
  } catch (error) {
    showToast('Erro ao desconectar instância', 'error');
  }
};

window.viewQRCode = async function(id) {
  try {
    showLoading('Carregando QR Code...');
    
    // Se não passar ID, conectar a instância principal
    const endpoint = id ? `/connections/${id}/qrcode` : '/whatsapp/qrcode';
    const response = await apiFetch(endpoint);
    
    hideLoading();
    
    if (response.qrcode || (response.data && response.data.qrcode)) {
      const qrcode = response.qrcode || response.data.qrcode;
      const expiresIn = response.expiresIn || (response.data && response.data.expiresIn) || 60;
      
      showQRCodeModal(qrcode, expiresIn);
    } else if (response.connected || (response.data && response.data.connected)) {
      showToast('WhatsApp já está conectado!', 'success');
    } else {
      showToast('QR Code não disponível. Aguarde alguns segundos e tente novamente.', 'warning');
    }
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

// Função para exibir modal com QR Code
function showQRCodeModal(qrcode, expiresIn) {
  // Remover modal existente se houver
  const existingModal = document.getElementById('qrcodeModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Criar modal
  const modalHtml = `
    <div class="modal fade" id="qrcodeModal" tabindex="-1">
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
            <div class="qrcode-container mb-3" style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
              <img src="${qrcode}" alt="QR Code" style="max-width: 100%; height: auto; border: 3px solid #25D366; border-radius: 10px;">
            </div>
            <div class="alert alert-info mb-0">
              <i class="bi bi-clock"></i> 
              <strong>Expira em <span id="qrCountdown">${expiresIn}</span> segundos</strong>
            </div>
            <hr>
            <ol class="text-start small">
              <li>Abra o WhatsApp no seu celular</li>
              <li>Toque em <strong>Menu</strong> ou <strong>Configurações</strong></li>
              <li>Selecione <strong>Aparelhos conectados</strong></li>
              <li>Toque em <strong>Conectar um aparelho</strong></li>
              <li>Escaneie o QR Code acima</li>
            </ol>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
            <button type="button" class="btn btn-success" onclick="window.viewQRCode()">
              <i class="bi bi-arrow-clockwise"></i> Atualizar QR Code
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Adicionar modal ao body
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Exibir modal
  const modalElement = document.getElementById('qrcodeModal');
  const modal = new bootstrap.Modal(modalElement);
  modal.show();
  
  // Countdown
  let countdown = expiresIn;
  const countdownInterval = setInterval(() => {
    countdown--;
    const countdownElement = document.getElementById('qrCountdown');
    if (countdownElement) {
      countdownElement.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        countdownElement.textContent = 'Expirado';
        countdownElement.parentElement.classList.remove('alert-info');
        countdownElement.parentElement.classList.add('alert-danger');
      }
    }
  }, 1000);
  
  // Limpar ao fechar modal
  modalElement.addEventListener('hidden.bs.modal', () => {
    clearInterval(countdownInterval);
    modalElement.remove();
  });
}

// Função para aguardar QR Code estar disponível
async function waitForQRCode(maxAttempts = 10, delayMs = 2000) {
  showLoading('Aguardando QR Code...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔍 Tentativa ${attempt}/${maxAttempts} - Buscando QR Code...`);
      
      const response = await apiFetch('/whatsapp/qrcode');
      
      // Verificar se QR Code está disponível
      if (response.qrcode || (response.data && response.data.qrcode)) {
        const qrcode = response.qrcode || response.data.qrcode;
        const expiresIn = response.expiresIn || (response.data && response.data.expiresIn) || 60;
        
        hideLoading();
        console.log('✅ QR Code encontrado!');
        showQRCodeModal(qrcode, expiresIn);
        return true;
      }
      
      // Verificar se já está conectado
      if (response.connected || (response.data && response.data.connected)) {
        hideLoading();
        showToast('WhatsApp já está conectado!', 'success');
        return true;
      }
      
      // Aguardar antes da próxima tentativa
      if (attempt < maxAttempts) {
        console.log(`⏳ QR Code ainda não disponível. Aguardando ${delayMs/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`❌ Erro na tentativa ${attempt}:`, error);
      if (attempt === maxAttempts) {
        hideLoading();
        showToast('Timeout: QR Code não foi gerado. Tente novamente.', 'error');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  hideLoading();
  showToast('QR Code não disponível após várias tentativas. Tente novamente.', 'warning');
  return false;
}

// Event listener para botão "Nova Conexão"
window.addEventListener('DOMContentLoaded', () => {
  const newConnectionBtn = document.getElementById('newConnectionBtn');
  if (newConnectionBtn) {
    newConnectionBtn.addEventListener('click', async () => {
      try {
        showLoading('Iniciando conexão WhatsApp...');
        
        // Iniciar conexão
        const connectResponse = await apiFetch('/whatsapp/connect', { method: 'POST' });
        console.log('📱 Resposta do connect:', connectResponse);
        
        // Aguardar e buscar QR Code com polling
        await waitForQRCode(10, 2000); // 10 tentativas, 2s cada = 20s total
        
      } catch (error) {
        hideLoading();
        console.error('Erro ao iniciar conexão:', error);
        showToast('Erro ao iniciar conexão: ' + (error.message || 'Erro desconhecido'), 'error');
      }
    });
  }
});

// ==================== SETTINGS ====================

async function loadSettings() {
  try {
    showLoading('Carregando Configurações...');
    
    const response = await apiFetch('/settings');
    const { settings } = response;
    
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
    const { roles } = response;
    
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

