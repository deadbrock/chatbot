import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';

/**
 * View de Campanhas de Mensagens em Massa
 * Interface completa para criar e gerenciar campanhas
 */

let currentCampaigns = [];
let currentPage = 1;
let totalPages = 1;

export async function initCampaignsView() {
  console.log('Inicializando view de Campanhas...');
  
  // Carregar campanhas
  await loadCampaigns();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Carregar estatísticas gerais
  await loadCampaignsStats();
}

async function loadCampaigns(page = 1, filters = {}) {
  try {
    const queryParams = new URLSearchParams({
      page,
      limit: 20,
      ...filters
    });

    const response = await apiFetch(`/api/campaigns?${queryParams}`);
    
    if (response.success) {
      currentCampaigns = response.data;
      currentPage = response.pagination.page;
      totalPages = response.pagination.pages;
      
      renderCampaignsTable(response.data);
      renderPagination(response.pagination);
    }
  } catch (error) {
    console.error('Erro ao carregar campanhas:', error);
    showToast('Erro ao carregar campanhas', 'error');
  }
}

function renderCampaignsTable(campaigns) {
  const tbody = document.getElementById('campaignsTableBody');
  
  if (!tbody) {
    console.error('Elemento campaignsTableBody não encontrado');
    return;
  }

  if (campaigns.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4">
          <i class="bi bi-inbox fs-1 text-muted d-block mb-2"></i>
          <p class="text-muted">Nenhuma campanha encontrada</p>
          <button class="btn btn-primary btn-sm" onclick="window.openCampaignModal()">
            <i class="bi bi-plus-circle"></i> Criar Primeira Campanha
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = campaigns.map(campaign => {
    const statusBadge = getStatusBadge(campaign.status);
    const progress = campaign.totalContacts > 0 
      ? Math.round((campaign.sentCount / campaign.totalContacts) * 100) 
      : 0;
    
    return `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <i class="bi bi-megaphone-fill text-primary me-2"></i>
            <div>
              <div class="fw-bold">${campaign.name}</div>
              ${campaign.description ? `<small class="text-muted">${campaign.description}</small>` : ''}
            </div>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>
          <span class="badge bg-light text-dark">${campaign.targetType}</span>
        </td>
        <td>
          <div class="text-center">
            <div class="fw-bold">${campaign.totalContacts}</div>
            <small class="text-muted">contatos</small>
          </div>
        </td>
        <td>
          <div class="progress" style="height: 20px;">
            <div class="progress-bar ${getProgressColor(progress)}" 
                 role="progressbar" 
                 style="width: ${progress}%"
                 aria-valuenow="${progress}" 
                 aria-valuemin="0" 
                 aria-valuemax="100">
              ${progress}%
            </div>
          </div>
          <small class="text-muted">${campaign.sentCount}/${campaign.totalContacts} enviados</small>
        </td>
        <td>
          <div class="small">
            <div><i class="bi bi-check-circle text-success"></i> ${campaign.deliveredCount}</div>
            <div><i class="bi bi-eye text-info"></i> ${campaign.readCount}</div>
            <div><i class="bi bi-chat-dots text-primary"></i> ${campaign.repliesCount}</div>
          </div>
        </td>
        <td>
          <small class="text-muted">${formatDate(campaign.createdAt)}</small>
        </td>
        <td>
          <div class="btn-group btn-group-sm">
            ${getActionButtons(campaign)}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getStatusBadge(status) {
  const badges = {
    draft: '<span class="badge bg-secondary">Rascunho</span>',
    scheduled: '<span class="badge bg-info">Agendada</span>',
    sending: '<span class="badge bg-warning">Enviando</span>',
    completed: '<span class="badge bg-success">Concluída</span>',
    paused: '<span class="badge bg-warning">Pausada</span>',
    cancelled: '<span class="badge bg-danger">Cancelada</span>',
    failed: '<span class="badge bg-danger">Falhou</span>'
  };
  return badges[status] || '<span class="badge bg-secondary">Desconhecido</span>';
}

function getProgressColor(progress) {
  if (progress < 25) return 'bg-danger';
  if (progress < 50) return 'bg-warning';
  if (progress < 75) return 'bg-info';
  return 'bg-success';
}

function getActionButtons(campaign) {
  const buttons = [];
  
  // Botão de visualizar
  buttons.push(`
    <button class="btn btn-outline-primary" 
            onclick="window.viewCampaignDetails('${campaign.id}')"
            title="Ver Detalhes">
      <i class="bi bi-eye"></i>
    </button>
  `);
  
  // Botões baseados no status
  if (campaign.status === 'draft' || campaign.status === 'scheduled') {
    buttons.push(`
      <button class="btn btn-outline-success" 
              onclick="window.startCampaign('${campaign.id}')"
              title="Iniciar">
        <i class="bi bi-play-fill"></i>
      </button>
    `);
    buttons.push(`
      <button class="btn btn-outline-primary" 
              onclick="window.editCampaign('${campaign.id}')"
              title="Editar">
        <i class="bi bi-pencil"></i>
      </button>
    `);
  }
  
  if (campaign.status === 'sending') {
    buttons.push(`
      <button class="btn btn-outline-warning" 
              onclick="window.pauseCampaign('${campaign.id}')"
              title="Pausar">
        <i class="bi bi-pause-fill"></i>
      </button>
    `);
  }
  
  if (campaign.status === 'paused') {
    buttons.push(`
      <button class="btn btn-outline-success" 
              onclick="window.startCampaign('${campaign.id}')"
              title="Retomar">
        <i class="bi bi-play-fill"></i>
      </button>
    `);
  }
  
  // Botão de duplicar
  buttons.push(`
    <button class="btn btn-outline-secondary" 
            onclick="window.duplicateCampaign('${campaign.id}')"
            title="Duplicar">
      <i class="bi bi-files"></i>
    </button>
  `);
  
  // Botão de deletar (apenas para rascunhos e canceladas)
  if (['draft', 'cancelled', 'failed'].includes(campaign.status)) {
    buttons.push(`
      <button class="btn btn-outline-danger" 
              onclick="window.deleteCampaign('${campaign.id}')"
              title="Excluir">
        <i class="bi bi-trash"></i>
      </button>
    `);
  }
  
  return buttons.join('');
}

async function loadCampaignsStats() {
  try {
    // Estatísticas gerais baseadas nas campanhas carregadas
    const stats = {
      total: currentCampaigns.length,
      active: currentCampaigns.filter(c => c.status === 'sending').length,
      completed: currentCampaigns.filter(c => c.status === 'completed').length,
      scheduled: currentCampaigns.filter(c => c.status === 'scheduled').length
    };
    
    // Atualizar cards de estatísticas
    updateStatsCards(stats);
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
}

function updateStatsCards(stats) {
  const cards = [
    { id: 'totalCampaigns', value: stats.total, icon: 'megaphone' },
    { id: 'activeCampaigns', value: stats.active, icon: 'play-circle' },
    { id: 'completedCampaigns', value: stats.completed, icon: 'check-circle' },
    { id: 'scheduledCampaigns', value: stats.scheduled, icon: 'clock' }
  ];
  
  cards.forEach(card => {
    const element = document.getElementById(card.id);
    if (element) {
      element.textContent = card.value;
    }
  });
}

function setupEventListeners() {
  // Botão de nova campanha
  const newCampaignBtn = document.getElementById('newCampaignBtn');
  if (newCampaignBtn) {
    newCampaignBtn.addEventListener('click', () => openCampaignModal());
  }
  
  // Filtros
  const statusFilter = document.getElementById('campaignStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => applyFilters());
  }
  
  const categoryFilter = document.getElementById('campaignCategoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => applyFilters());
  }
  
  // Busca
  const searchInput = document.getElementById('campaignSearch');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyFilters();
      }, 500);
    });
  }
  
  // Formulário de campanha
  const campaignForm = document.getElementById('campaignForm');
  if (campaignForm) {
    campaignForm.addEventListener('submit', handleCampaignSubmit);
  }
  
  // Tipo de segmentação
  const targetTypeSelect = document.getElementById('campaignTargetType');
  if (targetTypeSelect) {
    targetTypeSelect.addEventListener('change', handleTargetTypeChange);
  }
  
  // Preview de mensagem
  const messageInput = document.getElementById('campaignMessage');
  if (messageInput) {
    messageInput.addEventListener('input', updateMessagePreview);
  }
}

function applyFilters() {
  const status = document.getElementById('campaignStatusFilter')?.value || '';
  const category = document.getElementById('campaignCategoryFilter')?.value || '';
  const search = document.getElementById('campaignSearch')?.value || '';
  
  const filters = {};
  if (status) filters.status = status;
  if (category) filters.category = category;
  if (search) filters.search = search;
  
  loadCampaigns(1, filters);
}

function openCampaignModal(campaignId = null) {
  const modal = new bootstrap.Modal(document.getElementById('campaignModal'));
  
  if (campaignId) {
    // Modo edição
    loadCampaignData(campaignId);
  } else {
    // Modo criação
    document.getElementById('campaignForm').reset();
    document.getElementById('campaignModalLabel').textContent = 'Nova Campanha';
  }
  
  modal.show();
}

async function loadCampaignData(campaignId) {
  try {
    const response = await apiFetch(`/api/campaigns/${campaignId}`);
    
    if (response.success) {
      const campaign = response.data;
      
      // Preencher formulário
      document.getElementById('campaignId').value = campaign.id;
      document.getElementById('campaignName').value = campaign.name;
      document.getElementById('campaignDescription').value = campaign.description || '';
      document.getElementById('campaignMessage').value = campaign.message;
      document.getElementById('campaignTargetType').value = campaign.targetType;
      document.getElementById('campaignCategory').value = campaign.category || '';
      
      // Atualizar título do modal
      document.getElementById('campaignModalLabel').textContent = 'Editar Campanha';
      
      // Atualizar preview
      updateMessagePreview();
    }
  } catch (error) {
    console.error('Erro ao carregar campanha:', error);
    showToast('Erro ao carregar dados da campanha', 'error');
  }
}

async function handleCampaignSubmit(e) {
  e.preventDefault();
  
  const formData = {
    name: document.getElementById('campaignName').value,
    description: document.getElementById('campaignDescription').value,
    message: document.getElementById('campaignMessage').value,
    targetType: document.getElementById('campaignTargetType').value,
    category: document.getElementById('campaignCategory').value,
    sendImmediately: document.getElementById('campaignSendImmediately')?.checked || false
  };
  
  const campaignId = document.getElementById('campaignId').value;
  
  try {
    let response;
    if (campaignId) {
      // Atualizar
      response = await apiFetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
    } else {
      // Criar
      response = await apiFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
    }
    
    if (response.success) {
      showToast(response.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('campaignModal')).hide();
      loadCampaigns(currentPage);
    }
  } catch (error) {
    console.error('Erro ao salvar campanha:', error);
    showToast('Erro ao salvar campanha', 'error');
  }
}

function handleTargetTypeChange(e) {
  const targetType = e.target.value;
  const filtersContainer = document.getElementById('campaignTargetFilters');
  
  if (!filtersContainer) return;
  
  // Mostrar/ocultar opções de filtro baseado no tipo
  switch (targetType) {
    case 'all':
      filtersContainer.innerHTML = '<p class="text-muted">Todos os contatos serão incluídos</p>';
      break;
    case 'tags':
      filtersContainer.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Tags</label>
          <select class="form-select" id="campaignTargetTags" multiple>
            <option value="cliente">Cliente</option>
            <option value="lead">Lead</option>
            <option value="vip">VIP</option>
          </select>
        </div>
      `;
      break;
    case 'segment':
      filtersContainer.innerHTML = `
        <div class="mb-3">
          <label class="form-label">Categoria</label>
          <select class="form-select" id="campaignTargetCategory">
            <option value="">Todas</option>
            <option value="cliente">Cliente</option>
            <option value="lead">Lead</option>
            <option value="fornecedor">Fornecedor</option>
          </select>
        </div>
      `;
      break;
  }
}

function updateMessagePreview() {
  const message = document.getElementById('campaignMessage')?.value || '';
  const preview = document.getElementById('campaignMessagePreview');
  
  if (!preview) return;
  
  // Substituir variáveis por exemplos
  let previewText = message
    .replace(/\{\{nome\}\}/g, '<strong>João Silva</strong>')
    .replace(/\{\{email\}\}/g, '<strong>joao@example.com</strong>')
    .replace(/\{\{telefone\}\}/g, '<strong>(11) 98765-4321</strong>')
    .replace(/\{\{empresa\}\}/g, '<strong>Empresa XYZ</strong>');
  
  preview.innerHTML = previewText || '<em class="text-muted">Preview da mensagem aparecerá aqui...</em>';
}

// Funções globais para os botões
window.openCampaignModal = openCampaignModal;

window.viewCampaignDetails = async (campaignId) => {
  try {
    const response = await apiFetch(`/api/campaigns/${campaignId}`);
    const statsResponse = await apiFetch(`/api/campaigns/${campaignId}/stats`);
    
    if (response.success && statsResponse.success) {
      showCampaignDetailsModal(response.data, statsResponse.data);
    }
  } catch (error) {
    console.error('Erro ao carregar detalhes:', error);
    showToast('Erro ao carregar detalhes da campanha', 'error');
  }
};

window.startCampaign = async (campaignId) => {
  if (!confirm('Deseja iniciar o envio desta campanha?')) return;
  
  try {
    const response = await apiFetch(`/api/campaigns/${campaignId}/start`, {
      method: 'POST'
    });
    
    if (response.success) {
      showToast('Campanha iniciada com sucesso!', 'success');
      loadCampaigns(currentPage);
    }
  } catch (error) {
    console.error('Erro ao iniciar campanha:', error);
    showToast('Erro ao iniciar campanha', 'error');
  }
};

window.pauseCampaign = async (campaignId) => {
  if (!confirm('Deseja pausar esta campanha?')) return;
  
  try {
    const response = await apiFetch(`/api/campaigns/${campaignId}/pause`, {
      method: 'POST'
    });
    
    if (response.success) {
      showToast('Campanha pausada com sucesso!', 'success');
      loadCampaigns(currentPage);
    }
  } catch (error) {
    console.error('Erro ao pausar campanha:', error);
    showToast('Erro ao pausar campanha', 'error');
  }
};

window.duplicateCampaign = async (campaignId) => {
  if (!confirm('Deseja duplicar esta campanha?')) return;
  
  try {
    const response = await apiFetch(`/api/campaigns/${campaignId}/duplicate`, {
      method: 'POST'
    });
    
    if (response.success) {
      showToast('Campanha duplicada com sucesso!', 'success');
      loadCampaigns(currentPage);
    }
  } catch (error) {
    console.error('Erro ao duplicar campanha:', error);
    showToast('Erro ao duplicar campanha', 'error');
  }
};

window.deleteCampaign = async (campaignId) => {
  if (!confirm('Deseja realmente excluir esta campanha? Esta ação não pode ser desfeita.')) return;
  
  try {
    const response = await apiFetch(`/api/campaigns/${campaignId}`, {
      method: 'DELETE'
    });
    
    if (response.success) {
      showToast('Campanha excluída com sucesso!', 'success');
      loadCampaigns(currentPage);
    }
  } catch (error) {
    console.error('Erro ao excluir campanha:', error);
    showToast('Erro ao excluir campanha', 'error');
  }
};

window.editCampaign = (campaignId) => {
  openCampaignModal(campaignId);
};

function showCampaignDetailsModal(campaign, stats) {
  // Criar modal de detalhes dinamicamente
  const modalHtml = `
    <div class="modal fade" id="campaignDetailsModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-megaphone-fill text-primary"></i>
              ${campaign.name}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3 mb-4">
              <div class="col-md-3">
                <div class="card text-center">
                  <div class="card-body">
                    <h3 class="text-primary">${stats.sent}</h3>
                    <small class="text-muted">Enviados</small>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="card text-center">
                  <div class="card-body">
                    <h3 class="text-success">${stats.delivered}</h3>
                    <small class="text-muted">Entregues</small>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="card text-center">
                  <div class="card-body">
                    <h3 class="text-info">${stats.read}</h3>
                    <small class="text-muted">Lidos</small>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <div class="card text-center">
                  <div class="card-body">
                    <h3 class="text-warning">${stats.replies}</h3>
                    <small class="text-muted">Respostas</small>
                  </div>
                </div>
              </div>
            </div>
            
            <h6>Mensagem:</h6>
            <div class="alert alert-light">${campaign.message}</div>
            
            <div class="row">
              <div class="col-md-6">
                <p><strong>Status:</strong> ${getStatusBadge(campaign.status)}</p>
                <p><strong>Tipo:</strong> ${campaign.targetType}</p>
              </div>
              <div class="col-md-6">
                <p><strong>Taxa de Entrega:</strong> ${stats.deliveryRate}%</p>
                <p><strong>Taxa de Leitura:</strong> ${stats.readRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remover modal anterior se existir
  const oldModal = document.getElementById('campaignDetailsModal');
  if (oldModal) oldModal.remove();
  
  // Adicionar novo modal
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('campaignDetailsModal'));
  modal.show();
}

function renderPagination(pagination) {
  const container = document.getElementById('campaignsPagination');
  if (!container) return;
  
  if (pagination.pages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '<nav><ul class="pagination justify-content-center">';
  
  // Botão anterior
  html += `
    <li class="page-item ${pagination.page === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="window.loadCampaignsPage(${pagination.page - 1}); return false;">
        Anterior
      </a>
    </li>
  `;
  
  // Páginas
  for (let i = 1; i <= pagination.pages; i++) {
    if (i === 1 || i === pagination.pages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
      html += `
        <li class="page-item ${i === pagination.page ? 'active' : ''}">
          <a class="page-link" href="#" onclick="window.loadCampaignsPage(${i}); return false;">
            ${i}
          </a>
        </li>
      `;
    } else if (i === pagination.page - 3 || i === pagination.page + 3) {
      html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }
  }
  
  // Botão próximo
  html += `
    <li class="page-item ${pagination.page === pagination.pages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="window.loadCampaignsPage(${pagination.page + 1}); return false;">
        Próximo
      </a>
    </li>
  `;
  
  html += '</ul></nav>';
  container.innerHTML = html;
}

window.loadCampaignsPage = (page) => {
  loadCampaigns(page);
};

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

