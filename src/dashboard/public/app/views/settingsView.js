import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';
import { getStoredUser, setStoredUser } from '../auth.js';
import { getRoleLabel } from '../permissions.js';

function getInitials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
}

function notifyUserUpdated(user) {
  setStoredUser(user);
  window.dispatchEvent(new CustomEvent('user:updated', { detail: user }));
}

export async function loadSettingsView() {
  const container = document.getElementById('settingsContent');
  if (!container) return;

  aiTabLoaded = false;

  container.innerHTML = `
    <div class="settings-container">
      <ul class="nav nav-tabs settings-tabs mb-4" id="settingsTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="profile-tab" data-bs-toggle="tab" data-bs-target="#profile-panel" type="button" role="tab">
            <i class="bi bi-person-circle me-1"></i> Meu Perfil
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="ai-tab" data-bs-toggle="tab" data-bs-target="#ai-panel" type="button" role="tab">
            <i class="bi bi-robot me-1"></i> Configurações da IA
          </button>
        </li>
      </ul>
      <div class="tab-content">
        <div class="tab-pane fade show active" id="profile-panel" role="tabpanel">
          <div id="profile-content"></div>
        </div>
        <div class="tab-pane fade" id="ai-panel" role="tabpanel">
          <div id="ai-content"></div>
        </div>
      </div>
    </div>
  `;

  await loadProfileTab();
  bindSettingsTabHandlers();
}

let aiTabLoaded = false;

function bindSettingsTabHandlers() {
  const aiTab = document.getElementById('ai-tab');
  if (!aiTab || aiTab.dataset.bound === '1') return;

  aiTab.dataset.bound = '1';
  aiTab.addEventListener('shown.bs.tab', () => {
    if (!aiTabLoaded) {
      loadAITab();
    }
  });

  if (aiTab.classList.contains('active')) {
    loadAITab();
  }
}

function bindAiTabEvents(container) {
  container.querySelector('#aiConfigForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveAIConfig();
  });
  container.querySelector('#testAIBtn')?.addEventListener('click', testAI);
  container.querySelector('#addTrainingExampleForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await addTrainingExample();
  });
  container.querySelector('#viewTrainingExamplesBtn')?.addEventListener('click', viewTrainingExamples);
  container.querySelector('#toggleAiApiKeyBtn')?.addEventListener('click', () => {
    const input = container.querySelector('#aiApiKey');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  });
}

async function loadProfileTab() {
  const container = document.getElementById('profile-content');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <div class="text-muted mt-2">Carregando perfil...</div>
    </div>
  `;

  try {
    const profile = await apiFetch('/users/me');
    const liveContainer = document.getElementById('profile-content');
    if (!liveContainer || !liveContainer.isConnected) return;

    const stored = getStoredUser() || {};
    const user = { ...stored, ...profile };
    const initials = getInitials(user.name);
    const roleLabel = getRoleLabel(user.role);
    const avatarUrl = user.avatar || null;

    liveContainer.innerHTML = `
      <div class="row g-4">
        <div class="col-lg-4">
          <div class="card profile-card h-100">
            <div class="card-body text-center">
              <div class="profile-avatar-wrap mx-auto mb-3">
                ${avatarUrl
                  ? `<img src="${escapeHtml(avatarUrl)}" alt="Foto de perfil" class="profile-avatar-img" id="profileAvatarPreview">`
                  : `<span class="profile-avatar-fallback" id="profileAvatarFallback">${escapeHtml(initials)}</span>`}
              </div>
              <h5 class="mb-1">${escapeHtml(user.name || 'Usuário')}</h5>
              <p class="text-muted small mb-3">${escapeHtml(user.email || '')}</p>
              <span class="badge bg-primary-subtle text-primary-emphasis mb-3">${escapeHtml(roleLabel)}</span>
              <div class="d-grid gap-2">
                <label class="btn btn-outline-primary btn-sm mb-0" for="profileAvatarInput">
                  <i class="bi bi-camera me-1"></i> Alterar foto
                </label>
                <input type="file" id="profileAvatarInput" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
                <button type="button" class="btn btn-outline-danger btn-sm" id="removeAvatarBtn" ${avatarUrl ? '' : 'disabled'}>
                  <i class="bi bi-trash me-1"></i> Remover foto
                </button>
              </div>
              <div class="form-text mt-2">JPG, PNG, WEBP ou GIF. Máx. 2 MB.</div>
            </div>
          </div>
        </div>

        <div class="col-lg-8">
          <div class="card profile-card">
            <div class="card-header">
              <strong><i class="bi bi-pencil-square me-1"></i> Dados do perfil</strong>
            </div>
            <div class="card-body">
              <form id="profileForm">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label" for="profileName">Nome completo</label>
                    <input type="text" class="form-control" id="profileName" value="${escapeHtml(user.name || '')}" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="profileEmail">E-mail</label>
                    <input type="email" class="form-control" id="profileEmail" value="${escapeHtml(user.email || '')}" required>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="profilePhone">Telefone</label>
                    <input type="tel" class="form-control" id="profilePhone" value="${escapeHtml(user.phone || '')}" placeholder="(00) 00000-0000">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Departamento</label>
                    <input type="text" class="form-control" value="${escapeHtml(user.department || '—')}" disabled>
                  </div>
                </div>

                <hr class="my-4">

                <h6 class="mb-3"><i class="bi bi-shield-lock me-1"></i> Alterar senha</h6>
                <div class="row g-3">
                  <div class="col-md-4">
                    <label class="form-label" for="profileCurrentPassword">Senha atual</label>
                    <input type="password" class="form-control" id="profileCurrentPassword" autocomplete="current-password">
                  </div>
                  <div class="col-md-4">
                    <label class="form-label" for="profileNewPassword">Nova senha</label>
                    <input type="password" class="form-control" id="profileNewPassword" autocomplete="new-password">
                  </div>
                  <div class="col-md-4">
                    <label class="form-label" for="profileConfirmPassword">Confirmar nova senha</label>
                    <input type="password" class="form-control" id="profileConfirmPassword" autocomplete="new-password">
                  </div>
                </div>
                <div class="form-text">Deixe em branco se não quiser alterar a senha.</div>

                <div class="mt-4">
                  <button type="submit" class="btn btn-primary" id="saveProfileBtn">
                    <i class="bi bi-save me-1"></i> Salvar alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    liveContainer.querySelector('#profileForm')?.addEventListener('submit', saveProfile);
    liveContainer.querySelector('#profileAvatarInput')?.addEventListener('change', uploadAvatar);
    liveContainer.querySelector('#removeAvatarBtn')?.addEventListener('click', removeAvatar);
  } catch (error) {
    console.error('Erro ao carregar perfil:', error);
    const liveContainer = document.getElementById('profile-content');
    if (liveContainer?.isConnected) {
      liveContainer.innerHTML = `
        <div class="alert alert-danger">
          ${escapeHtml(error?.message || 'Erro ao carregar perfil.')}
        </div>
      `;
    }
  }
}

async function saveProfile(event) {
  event.preventDefault();

  const name = document.getElementById('profileName')?.value?.trim();
  const email = document.getElementById('profileEmail')?.value?.trim();
  const phone = document.getElementById('profilePhone')?.value?.trim();
  const currentPassword = document.getElementById('profileCurrentPassword')?.value || '';
  const newPassword = document.getElementById('profileNewPassword')?.value || '';
  const confirmPassword = document.getElementById('profileConfirmPassword')?.value || '';

  if (!name || !email) {
    showToast('Nome e e-mail são obrigatórios.', 'warning');
    return;
  }

  if (newPassword || confirmPassword || currentPassword) {
    if (!currentPassword) {
      showToast('Informe a senha atual para alterá-la.', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      showToast('A nova senha deve ter pelo menos 6 caracteres.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('A confirmação da nova senha não confere.', 'warning');
      return;
    }
  }

  const payload = { name, email, phone };
  if (newPassword) {
    payload.currentPassword = currentPassword;
    payload.newPassword = newPassword;
  }

  try {
    const user = await apiFetch('/users/me', {
      method: 'PUT',
      body: payload
    });

    notifyUserUpdated(user);
    showToast('Perfil atualizado com sucesso!', 'success');
    document.getElementById('profileCurrentPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileConfirmPassword').value = '';
    await loadProfileTab();
  } catch (error) {
    showToast(error?.message || 'Erro ao salvar perfil.', 'error');
  }
}

async function uploadAvatar(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('A imagem deve ter no máximo 2 MB.', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const user = await apiFetch('/users/me/avatar', {
      method: 'POST',
      body: formData
    });

    notifyUserUpdated(user);
    showToast('Foto de perfil atualizada!', 'success');
    await loadProfileTab();
  } catch (error) {
    showToast(error?.message || 'Erro ao enviar foto.', 'error');
  }
}

async function removeAvatar() {
  if (!confirm('Remover sua foto de perfil?')) return;

  try {
    const user = await apiFetch('/users/me/avatar', { method: 'DELETE' });
    notifyUserUpdated(user);
    showToast('Foto de perfil removida.', 'success');
    await loadProfileTab();
  } catch (error) {
    showToast(error?.message || 'Erro ao remover foto.', 'error');
  }
}

async function loadAITab() {
  const container = document.getElementById('ai-content');
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <div class="text-muted mt-2">Carregando configurações da IA...</div>
    </div>
  `;

  try {
    const [config, analytics, intents] = await Promise.all([
      apiFetch('/ai/config'),
      apiFetch('/ai/analytics?days=7'),
      apiFetch('/ai/intents')
    ]);

    const liveContainer = document.getElementById('ai-content');
    if (!liveContainer || !liveContainer.isConnected) return;

    const cfg = config || {};
    const stats = analytics || {};
    const intentList = intents || [];

    liveContainer.innerHTML = `
      <div class="mb-4">
        <h4 class="mb-2"><i class="bi bi-robot text-primary"></i> Assistente IA de Atendimento</h4>
        <p class="text-muted">Configure provider, modelo e treine a IA para classificar assuntos e direcionar ao departamento correto.</p>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-md-4">
          <div class="card ${cfg.enabled ? 'border-success' : 'border-secondary'}">
            <div class="card-body text-center">
              <i class="bi ${cfg.enabled ? 'bi-check-circle-fill text-success' : 'bi-x-circle text-secondary'} fs-1"></i>
              <h5 class="mt-2">${cfg.enabled ? 'IA Ativada' : 'IA Desativada'}</h5>
              <p class="text-muted small">${cfg.enabled ? 'Classificação inteligente ativa' : 'Somente palavras-chave locais'}</p>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card border-primary">
            <div class="card-body text-center">
              <i class="bi bi-cloud fs-1 text-primary"></i>
              <h5 class="mt-2">${escapeHtml(cfg.provider || 'N/A')}</h5>
              <p class="text-muted small">Provider de IA</p>
              <small class="badge bg-secondary">${escapeHtml(cfg.model || 'N/A')}</small>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card border-info">
            <div class="card-body text-center">
              <i class="bi bi-graph-up fs-1 text-info"></i>
              <h5 class="mt-2">${stats.summary?.totalClassifications || 0}</h5>
              <p class="text-muted small">Classificações (7 dias)</p>
              <small class="text-muted">Taxa de uso: ${stats.summary?.usageRate || 0}%</small>
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header bg-primary text-white">
          <i class="bi bi-sliders"></i> <strong>Configurações da IA</strong>
        </div>
        <div class="card-body">
          <form id="aiConfigForm">
            <div class="row g-3">
              <div class="col-md-12">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="aiEnabled" ${cfg.enabled ? 'checked' : ''}>
                  <label class="form-check-label fw-bold" for="aiEnabled">Ativar classificação por IA</label>
                  <div class="form-text">A IA interpreta a mensagem do colaborador antes de pedir menus numerados.</div>
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Provider de IA</label>
                <select class="form-select" id="aiProvider">
                  <option value="gemini" ${cfg.provider === 'gemini' ? 'selected' : ''}>Google Gemini (grátis)</option>
                  <option value="groq" ${cfg.provider === 'groq' ? 'selected' : ''}>Groq (grátis + rápido)</option>
                  <option value="openai" ${cfg.provider === 'openai' ? 'selected' : ''}>OpenAI (pago)</option>
                  <option value="claude" ${cfg.provider === 'claude' ? 'selected' : ''}>Anthropic Claude (pago)</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label">Modelo</label>
                <select class="form-select" id="aiModel">
                  <option value="gemini-2.5-flash" ${cfg.model === 'gemini-2.5-flash' || cfg.model === 'gemini-pro' ? 'selected' : ''}>Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro" ${cfg.model === 'gemini-2.5-pro' ? 'selected' : ''}>Gemini 2.5 Pro</option>
                  <option value="llama-3.1-8b-instant" ${cfg.model === 'llama-3.1-8b-instant' ? 'selected' : ''}>Llama 3.1 8B (Groq)</option>
                  <option value="meta-llama/llama-4-maverick-17b-128e-instruct" ${cfg.model === 'meta-llama/llama-4-maverick-17b-128e-instruct' ? 'selected' : ''}>Llama 4 Maverick (Groq)</option>
                  <option value="gpt-3.5-turbo" ${cfg.model === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
                  <option value="gpt-4" ${cfg.model === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
                </select>
              </div>
              <div class="col-md-12">
                <label class="form-label">API Key</label>
                <div class="input-group">
                  <input type="password" class="form-control" id="aiApiKey" placeholder="Digite sua API Key">
                  <button class="btn btn-outline-secondary" type="button" id="toggleAiApiKeyBtn">
                    <i class="bi bi-eye"></i>
                  </button>
                </div>
                <div class="form-text mt-2">
                  ${cfg.apiKey ? `<span class="text-success"><i class="bi bi-check-circle"></i> API Key configurada (${escapeHtml(cfg.apiKey)})</span>` : '<span class="text-warning"><i class="bi bi-exclamation-triangle"></i> Nenhuma API Key configurada</span>'}
                </div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Confiança mínima (${Math.round((cfg.confidenceThreshold || 0.7) * 100)}%)</label>
                <input type="range" class="form-range" id="aiConfidenceThreshold" min="0" max="1" step="0.05" value="${cfg.confidenceThreshold || 0.7}">
              </div>
              <div class="col-md-6">
                <label class="form-label">Temperature (${cfg.temperature || 0.3})</label>
                <input type="range" class="form-range" id="aiTemperature" min="0" max="1" step="0.1" value="${cfg.temperature || 0.3}">
              </div>
              <div class="col-12">
                <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> Salvar Configurações</button>
                <button type="button" class="btn btn-outline-secondary" id="testAIBtn"><i class="bi bi-lightning"></i> Testar IA</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header bg-success text-white">
          <i class="bi bi-lightbulb"></i> <strong>Treinar IA com Exemplos</strong>
        </div>
        <div class="card-body">
          <p class="text-muted small mb-3">Adicione frases reais dos colaboradores e o setor correto. Quanto mais exemplos, melhor a classificação.</p>
          <form id="addTrainingExampleForm">
            <div class="row g-2">
              <div class="col-md-5">
                <input type="text" class="form-control form-control-sm" id="trainingMessage" placeholder='Ex: "quero afastar um colaborador"' required>
              </div>
              <div class="col-md-3">
                <select class="form-select form-select-sm" id="trainingIntent" required>
                  <option value="">Setor</option>
                  <option value="dp">DP (Departamento Pessoal)</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="rh">RH</option>
                  <option value="compras">Compras</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="logistica">Logística</option>
                  <option value="seguranca">Segurança do Trabalho</option>
                  <option value="faturamento">Faturamento</option>
                  <option value="comercial">Comercial</option>
                  <option value="operacional">Operacional</option>
                  <option value="novo_cliente">Novo Cliente</option>
                  <option value="trabalhe_conosco">Trabalhe Conosco</option>
                  <option value="atendimento_humano">Atendimento Humano</option>
                </select>
              </div>
              <div class="col-md-3">
                <input type="text" class="form-control form-control-sm" id="trainingReasoning" placeholder="Motivo da classificação" required>
              </div>
              <div class="col-md-1">
                <button type="submit" class="btn btn-sm btn-success w-100"><i class="bi bi-plus"></i></button>
              </div>
            </div>
          </form>
          <div class="mt-3">
            <button class="btn btn-sm btn-outline-primary" id="viewTrainingExamplesBtn">
              <i class="bi bi-list"></i> Ver exemplos (${Array.isArray(intentList) ? intentList.length : 0} intenções)
            </button>
          </div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header bg-info text-white">
          <i class="bi bi-bar-chart"></i> <strong>Analytics (7 dias)</strong>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <h6>Por intenção</h6>
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead><tr><th>Intenção</th><th>Vezes</th><th>Confiança</th></tr></thead>
                  <tbody>
                    ${(stats.byIntent || []).map((s) => `
                      <tr>
                        <td>${escapeHtml(s.intent)}</td>
                        <td><span class="badge bg-primary">${s.count}</span></td>
                        <td>${(parseFloat(s.avgConfidence) * 100).toFixed(1)}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="col-md-6">
              <h6>Por método</h6>
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead><tr><th>Método</th><th>Vezes</th><th>Tempo</th></tr></thead>
                  <tbody>
                    ${(stats.byMethod || []).map((s) => `
                      <tr>
                        <td><span class="badge ${s.method === 'keywords' ? 'bg-success' : 'bg-warning'}">${escapeHtml(s.method)}</span></td>
                        <td>${s.count}</td>
                        <td>${s.avgProcessingTime ? `${Math.round(s.avgProcessingTime)}ms` : 'N/A'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><i class="bi bi-list-check"></i> <strong>Intenções e palavras-chave</strong></div>
        <div class="card-body">
          <div class="row g-2">
            ${Array.isArray(intentList) && intentList.length > 0 ? intentList.map((intent) => `
              <div class="col-md-6">
                <div class="border rounded p-2">
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <strong>${escapeHtml(intent.id)}</strong>
                      <div class="small text-muted">→ ${escapeHtml(intent.flow)}</div>
                    </div>
                    <span class="badge bg-secondary">${intent.keywordCount || 0} palavras</span>
                  </div>
                  <div class="small text-muted mt-1">
                    ${(intent.keywords || []).slice(0, 5).join(', ')}${(intent.keywords || []).length > 5 ? '...' : ''}
                  </div>
                </div>
              </div>
            `).join('') : '<div class="col-12 text-center text-muted">Nenhuma intenção configurada</div>'}
          </div>
        </div>
      </div>
    `;

    bindAiTabEvents(liveContainer);
    aiTabLoaded = true;
  } catch (error) {
    console.error('Erro ao carregar configurações da IA:', error);
    const liveContainer = document.getElementById('ai-content');
    if (liveContainer?.isConnected) {
      liveContainer.innerHTML = `
        <div class="alert alert-danger mb-0">
          ${escapeHtml(error?.message || 'Erro ao carregar configurações da IA')}
        </div>
      `;
    }
    showToast(error?.message || 'Erro ao carregar configurações da IA', 'error');
  }
}

async function addTrainingExample() {
  const message = document.getElementById('trainingMessage').value.trim();
  const intent = document.getElementById('trainingIntent').value;
  const reasoning = document.getElementById('trainingReasoning').value.trim();

  if (!message || !intent || !reasoning) {
    showToast('Preencha todos os campos!', 'warning');
    return;
  }

  const response = await apiFetch('/ai/training-examples');
  const examples = response.examples || [];
  examples.push({ message, intent, reasoning });

  await apiFetch('/ai/training-examples', {
    method: 'POST',
    body: { examples }
  });

  showToast('Exemplo adicionado com sucesso.', 'success');
  await loadAITab();
}

async function viewTrainingExamples() {
  const response = await apiFetch('/ai/training-examples');
  const examples = response.examples || [];

  if (!examples.length) {
    showToast('Nenhum exemplo cadastrado ainda.', 'info');
    return;
  }

  const html = examples.map((ex, i) => `
    <div class="border-bottom pb-2 mb-2">
      <strong>#${i + 1}:</strong> "${escapeHtml(ex.message)}"<br>
      <small class="text-muted">→ ${escapeHtml(ex.intent)} (${escapeHtml(ex.reasoning)})</small>
      <button class="btn btn-sm btn-outline-danger float-end" data-remove-example="${i}">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `).join('');

  document.getElementById('trainingExamplesModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal fade" id="trainingExamplesModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Exemplos de treinamento (${examples.length})</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" style="max-height: 500px; overflow-y: auto;">${html}</div>
        </div>
      </div>
    </div>
  `);

  document.querySelectorAll('[data-remove-example]').forEach((button) => {
    button.addEventListener('click', async () => {
      await removeTrainingExample(Number(button.dataset.removeExample));
    });
  });

  bootstrap.Modal.getOrCreateInstance(document.getElementById('trainingExamplesModal')).show();
}

async function removeTrainingExample(index) {
  if (!confirm('Remover este exemplo?')) return;

  const response = await apiFetch('/ai/training-examples');
  const examples = response.examples || [];
  examples.splice(index, 1);

  await apiFetch('/ai/training-examples', {
    method: 'POST',
    body: { examples }
  });

  showToast('Exemplo removido.', 'success');
  bootstrap.Modal.getInstance(document.getElementById('trainingExamplesModal'))?.hide();
  await viewTrainingExamples();
  await loadAITab();
}

async function saveAIConfig() {
  const config = {
    enabled: document.getElementById('aiEnabled').checked,
    provider: document.getElementById('aiProvider').value,
    model: document.getElementById('aiModel').value,
    apiKey: document.getElementById('aiApiKey').value || undefined,
    confidenceThreshold: parseFloat(document.getElementById('aiConfidenceThreshold').value),
    temperature: parseFloat(document.getElementById('aiTemperature').value)
  };

  await apiFetch('/ai/config', {
    method: 'PUT',
    body: config
  });

  showToast('Configurações salvas com sucesso!', 'success');
  await loadAITab();
}

async function testAI() {
  const message = prompt('Digite uma mensagem para testar a IA:\n\nExemplo: "preciso afastar um colaborador"');
  if (!message) return;

  const result = await apiFetch('/ai/test', {
    method: 'POST',
    body: { message, userContext: {} }
  });

  alert(
    `Resultado do teste:\n\n` +
    `Intent: ${result.intent || 'N/A'}\n` +
    `Fluxo: ${result.flow || 'N/A'}\n` +
    `Confiança: ${((result.confidence || 0) * 100).toFixed(1)}%\n` +
    `Método: ${result.method || 'N/A'}\n` +
    `Tempo: ${result.processingTimeMs || 0}ms\n\n` +
    `${result.reasoning || ''}`
  );
}