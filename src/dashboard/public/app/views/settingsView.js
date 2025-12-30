import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';

let currentTab = 'flows';

export async function loadSettingsView() {
  console.log('Carregando Configurações...');
  
  // Renderizar tabs
  renderSettingsTabs();
  
  // Carregar aba inicial
  await loadFlowsTab();
}

function renderSettingsTabs() {
  const container = document.getElementById('settingsContent');
  if (!container) return;

  container.innerHTML = `
    <div class="settings-container">
      <!-- Tabs Navigation -->
      <ul class="nav nav-tabs mb-4" id="settingsTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="flows-tab" data-tab="flows">
            <i class="bi bi-diagram-3"></i> Fluxos de Conversa
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="templates-tab" data-tab="templates">
            <i class="bi bi-chat-left-text"></i> Templates de Mensagens
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="general-tab" data-tab="general">
            <i class="bi bi-gear"></i> Configurações Gerais
          </button>
        </li>
      </ul>

      <!-- Tab Content -->
      <div class="tab-content" id="settingsTabContent">
        <div class="tab-pane fade show active" id="flows-content"></div>
        <div class="tab-pane fade" id="templates-content"></div>
        <div class="tab-pane fade" id="general-content"></div>
      </div>
    </div>
  `;

  // Event listeners para tabs
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', async (e) => {
      const tabName = e.currentTarget.dataset.tab;
      switchTab(tabName);
    });
  });
}

async function switchTab(tabName) {
  currentTab = tabName;

  // Atualizar tabs visuais
  document.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`${tabName}-tab`).classList.add('active');

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('show', 'active');
  });
  document.getElementById(`${tabName}-content`).classList.add('show', 'active');

  // Carregar conteúdo
  switch (tabName) {
    case 'flows':
      await loadFlowsTab();
      break;
    case 'templates':
      await loadTemplatesTab();
      break;
    case 'general':
      await loadGeneralTab();
      break;
  }
}

/**
 * TAB: Fluxos
 */
async function loadFlowsTab() {
  const container = document.getElementById('flows-content');
  if (!container) return;

  try {
    const flows = await apiFetch('/flows');

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 class="mb-1">Fluxos de Conversa</h4>
          <p class="text-muted mb-0">Crie fluxos personalizados para automatizar conversas</p>
        </div>
        <button class="btn btn-primary" id="newFlowBtn">
          <i class="bi bi-plus-circle"></i> Novo Fluxo
        </button>
      </div>

      <div class="row g-3" id="flowsList">
        ${flows.length === 0 ? `
          <div class="col-12">
            <div class="empty-state">
              <i class="bi bi-diagram-3 empty-icon"></i>
              <h5 class="mt-3">Nenhum fluxo criado</h5>
              <p class="text-muted">Comece criando seu primeiro fluxo de conversa!</p>
              <button class="btn btn-primary mt-2" onclick="document.getElementById('newFlowBtn').click()">
                <i class="bi bi-plus-circle"></i> Criar Primeiro Fluxo
              </button>
            </div>
          </div>
        ` : flows.map(flow => renderFlowCard(flow)).join('')}
      </div>
    `;

    // Event listener para novo fluxo
    document.getElementById('newFlowBtn')?.addEventListener('click', () => openFlowModal());

  } catch (error) {
    console.error('Erro ao carregar fluxos:', error);
    showToast({ title: 'Erro', message: 'Falha ao carregar fluxos.', variant: 'danger' });
  }
}

function renderFlowCard(flow) {
  const statusColors = {
    active: 'success',
    draft: 'warning',
    archived: 'secondary'
  };
  
  const statusLabels = {
    active: 'Ativo',
    draft: 'Rascunho',
    archived: 'Arquivado'
  };

  return `
    <div class="col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h5 class="card-title mb-0">${escapeHtml(flow.name)}</h5>
            <span class="badge bg-${statusColors[flow.status]}">${statusLabels[flow.status]}</span>
          </div>
          <p class="card-text text-muted small mb-3">${escapeHtml(flow.description || 'Sem descrição')}</p>
          
          <div class="small text-muted mb-3">
            <div><i class="bi bi-lightning"></i> Gatilho: <strong>${escapeHtml(flow.trigger)}</strong></div>
            <div><i class="bi bi-list-ol"></i> ${flow.steps?.length || 0} steps</div>
            ${flow.department ? `<div><i class="bi bi-building"></i> ${escapeHtml(flow.department)}</div>` : ''}
          </div>

          <div class="btn-group w-100" role="group">
            <button class="btn btn-sm btn-outline-primary" data-action="edit-flow" data-id="${flow.id}">
              <i class="bi bi-pencil"></i> Editar
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-action="duplicate-flow" data-id="${flow.id}">
              <i class="bi bi-files"></i> Duplicar
            </button>
            ${flow.status === 'draft' ? `
              <button class="btn btn-sm btn-success" data-action="activate-flow" data-id="${flow.id}">
                <i class="bi bi-play"></i>
              </button>
            ` : ''}
            ${flow.status === 'active' ? `
              <button class="btn btn-sm btn-warning" data-action="archive-flow" data-id="${flow.id}">
                <i class="bi bi-archive"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * TAB: Templates
 */
async function loadTemplatesTab() {
  const container = document.getElementById('templates-content');
  if (!container) return;

  try {
    const templates = await apiFetch('/templates');

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 class="mb-1">Templates de Mensagens</h4>
          <p class="text-muted mb-0">Crie mensagens reutilizáveis com variáveis</p>
        </div>
        <button class="btn btn-primary" id="newTemplateBtn">
          <i class="bi bi-plus-circle"></i> Novo Template
        </button>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Prévia</th>
                  <th>Variáveis</th>
                  <th>Departamento</th>
                  <th class="text-end">Ações</th>
                </tr>
              </thead>
              <tbody id="templatesTableBody">
                ${templates.length === 0 ? `
                  <tr><td colspan="6" class="text-center text-muted">Nenhum template criado</td></tr>
                ` : templates.map(t => `
                  <tr>
                    <td class="fw-semibold">${escapeHtml(t.name)}</td>
                    <td><span class="badge bg-info">${escapeHtml(t.category)}</span></td>
                    <td class="text-truncate" style="max-width: 300px;">${escapeHtml(t.content)}</td>
                    <td>${t.variables?.length || 0}</td>
                    <td>${escapeHtml(t.department || '—')}</td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-primary" data-action="edit-template" data-id="${t.id}">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-sm btn-outline-secondary" data-action="duplicate-template" data-id="${t.id}">
                        <i class="bi bi-files"></i>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('newTemplateBtn')?.addEventListener('click', () => openTemplateModal());

  } catch (error) {
    console.error('Erro ao carregar templates:', error);
    showToast({ title: 'Erro', message: 'Falha ao carregar templates.', variant: 'danger' });
  }
}

/**
 * TAB: Configurações Gerais
 */
async function loadGeneralTab() {
  const container = document.getElementById('general-content');
  if (!container) return;

  container.innerHTML = `
    <div class="row g-4">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0"><i class="bi bi-robot"></i> Bot</h5>
          </div>
          <div class="card-body">
            <form>
              <div class="mb-3">
                <label class="form-label">Nome do Bot</label>
                <input type="text" class="form-control" value="Assistente Virtual" />
              </div>
              <div class="mb-3">
                <label class="form-label">Tempo de Inatividade (minutos)</label>
                <input type="number" class="form-control" value="30" />
              </div>
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="autoCloseTickets" checked />
                <label class="form-check-label" for="autoCloseTickets">
                  Fechar tickets inativos automaticamente
                </label>
              </div>
              <button type="submit" class="btn btn-primary">
                <i class="bi bi-save"></i> Salvar
              </button>
            </form>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0"><i class="bi bi-bell"></i> Notificações</h5>
          </div>
          <div class="card-body">
            <form>
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="notifyNewTicket" checked />
                <label class="form-check-label" for="notifyNewTicket">
                  Novo ticket criado
                </label>
              </div>
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="notifyWaitingHuman" checked />
                <label class="form-check-label" for="notifyWaitingHuman">
                  Cliente solicitou atendente
                </label>
              </div>
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="notifyNewMessage" />
                <label class="form-check-label" for="notifyNewMessage">
                  Nova mensagem em ticket
                </label>
              </div>
              <button type="submit" class="btn btn-primary">
                <i class="bi bi-save"></i> Salvar
              </button>
            </form>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0"><i class="bi bi-shield-check"></i> Avançado</h5>
          </div>
          <div class="card-body">
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle"></i>
              <strong>Atenção:</strong> Configurações avançadas podem afetar o funcionamento do sistema.
            </div>
            <button class="btn btn-danger" id="clearCacheBtn">
              <i class="bi bi-trash"></i> Limpar Cache
            </button>
            <button class="btn btn-warning ms-2" id="resetSessionsBtn">
              <i class="bi bi-arrow-clockwise"></i> Resetar Todas as Sessões
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openFlowModal(flowId = null) {
  showToast({ title: 'Em desenvolvimento', message: 'Editor de fluxos será implementado na próxima fase!', variant: 'info' });
  // TODO: Implementar modal de edição de fluxo
}

function openTemplateModal(templateId = null) {
  showToast({ title: 'Em desenvolvimento', message: 'Editor de templates será implementado na próxima fase!', variant: 'info' });
  // TODO: Implementar modal de edição de template
}

