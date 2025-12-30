import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';

/**
 * View de Transmissões (Broadcasts)
 * Interface simplificada para envio rápido de mensagens
 */

let currentBroadcasts = [];
let currentLists = [];

export async function initBroadcastsView() {
  console.log('Inicializando view de Transmissões...');
  
  // Carregar transmissões e listas
  await Promise.all([
    loadBroadcasts(),
    loadBroadcastLists()
  ]);
  
  // Configurar event listeners
  setupEventListeners();
}

async function loadBroadcasts() {
  try {
    const response = await apiFetch('/broadcasts');
    
    if (response.success) {
      currentBroadcasts = response.data;
      renderBroadcastsTable(response.data);
    }
  } catch (error) {
    console.error('Erro ao carregar transmissões:', error);
    showToast('Erro ao carregar transmissões', 'error');
  }
}

async function loadBroadcastLists() {
  try {
    const response = await apiFetch('/broadcasts/lists/all');
    
    if (response.success) {
      currentLists = response.data;
      renderListsCards(response.data);
      updateListsSelect(response.data);
    }
  } catch (error) {
    console.error('Erro ao carregar listas:', error);
    showToast('Erro ao carregar listas', 'error');
  }
}

function renderBroadcastsTable(broadcasts) {
  const tbody = document.getElementById('broadcastsTableBody');
  
  if (!tbody) {
    console.error('Elemento broadcastsTableBody não encontrado');
    return;
  }

  if (broadcasts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4">
          <i class="bi bi-broadcast fs-1 text-muted d-block mb-2"></i>
          <p class="text-muted">Nenhuma transmissão encontrada</p>
          <button class="btn btn-primary btn-sm" onclick="window.openQuickSendModal()">
            <i class="bi bi-send"></i> Enviar Primeira Transmissão
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = broadcasts.map(broadcast => {
    const statusBadge = getStatusBadge(broadcast.status);
    const progress = broadcast.totalRecipients > 0 
      ? Math.round((broadcast.sentCount / broadcast.totalRecipients) * 100) 
      : 0;
    
    return `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <i class="bi bi-broadcast text-success me-2"></i>
            <div>
              <div class="fw-bold">${broadcast.name}</div>
              <small class="text-muted">${formatDate(broadcast.createdAt)}</small>
            </div>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div class="text-center">
            <div class="fw-bold">${broadcast.totalRecipients}</div>
            <small class="text-muted">destinatários</small>
          </div>
        </td>
        <td>
          <div class="progress" style="height: 20px;">
            <div class="progress-bar bg-success" 
                 role="progressbar" 
                 style="width: ${progress}%"
                 aria-valuenow="${progress}" 
                 aria-valuemin="0" 
                 aria-valuemax="100">
              ${progress}%
            </div>
          </div>
        </td>
        <td>
          <div class="small">
            <div><i class="bi bi-check-circle text-success"></i> ${broadcast.deliveredCount}</div>
            <div><i class="bi bi-eye text-info"></i> ${broadcast.readCount}</div>
          </div>
        </td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" 
                    onclick="window.viewBroadcastDetails('${broadcast.id}')"
                    title="Ver Detalhes">
              <i class="bi bi-eye"></i>
            </button>
            ${broadcast.status === 'draft' ? `
              <button class="btn btn-outline-success" 
                      onclick="window.sendBroadcast('${broadcast.id}')"
                      title="Enviar">
                <i class="bi bi-send"></i>
              </button>
            ` : ''}
            <button class="btn btn-outline-danger" 
                    onclick="window.deleteBroadcast('${broadcast.id}')"
                    title="Excluir">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderListsCards(lists) {
  const container = document.getElementById('broadcastListsContainer');
  
  if (!container) {
    console.error('Elemento broadcastListsContainer não encontrado');
    return;
  }

  if (lists.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-4">
        <i class="bi bi-list-ul fs-1 text-muted d-block mb-2"></i>
        <p class="text-muted">Nenhuma lista criada</p>
        <button class="btn btn-primary btn-sm" onclick="window.openListModal()">
          <i class="bi bi-plus-circle"></i> Criar Primeira Lista
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = lists.map(list => `
    <div class="col-md-4">
      <div class="card h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h6 class="card-title mb-0">
              <i class="bi bi-list-ul text-primary"></i>
              ${list.name}
            </h6>
            <span class="badge ${list.isActive ? 'bg-success' : 'bg-secondary'}">
              ${list.isActive ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          
          ${list.description ? `<p class="card-text text-muted small">${list.description}</p>` : ''}
          
          <div class="d-flex justify-content-between align-items-center mt-3">
            <div>
              <i class="bi bi-people"></i>
              <strong>${list.totalContacts}</strong> contatos
            </div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" 
                      onclick="window.viewListDetails('${list.id}')"
                      title="Ver Detalhes">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-success" 
                      onclick="window.sendToList('${list.id}')"
                      title="Enviar">
                <i class="bi bi-send"></i>
              </button>
              <button class="btn btn-outline-secondary" 
                      onclick="window.editList('${list.id}')"
                      title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger" 
                      onclick="window.deleteList('${list.id}')"
                      title="Excluir">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function updateListsSelect(lists) {
  const select = document.getElementById('quickSendList');
  if (!select) return;
  
  select.innerHTML = `
    <option value="">Selecione uma lista...</option>
    ${lists.map(list => `
      <option value="${list.id}">${list.name} (${list.totalContacts} contatos)</option>
    `).join('')}
  `;
}

function setupEventListeners() {
  // Botão de envio rápido
  const quickSendBtn = document.getElementById('quickSendBtn');
  if (quickSendBtn) {
    quickSendBtn.addEventListener('click', () => openQuickSendModal());
  }
  
  // Botão de nova lista
  const newListBtn = document.getElementById('newListBtn');
  if (newListBtn) {
    newListBtn.addEventListener('click', () => openListModal());
  }
  
  // Formulário de envio rápido
  const quickSendForm = document.getElementById('quickSendForm');
  if (quickSendForm) {
    quickSendForm.addEventListener('submit', handleQuickSend);
  }
  
  // Formulário de lista
  const listForm = document.getElementById('broadcastListForm');
  if (listForm) {
    listForm.addEventListener('submit', handleListSubmit);
  }
}

function openQuickSendModal() {
  const modal = new bootstrap.Modal(document.getElementById('quickSendModal'));
  document.getElementById('quickSendForm').reset();
  modal.show();
}

function openListModal(listId = null) {
  const modal = new bootstrap.Modal(document.getElementById('broadcastListModal'));
  
  if (listId) {
    loadListData(listId);
  } else {
    document.getElementById('broadcastListForm').reset();
    document.getElementById('broadcastListModalLabel').textContent = 'Nova Lista de Transmissão';
  }
  
  modal.show();
}

async function loadListData(listId) {
  try {
    const response = await apiFetch(`/api/broadcasts/lists/${listId}`);
    
    if (response.success) {
      const list = response.data;
      
      document.getElementById('listId').value = list.id;
      document.getElementById('listName').value = list.name;
      document.getElementById('listDescription').value = list.description || '';
      document.getElementById('listCategory').value = list.category || '';
      document.getElementById('listIsActive').checked = list.isActive;
      
      document.getElementById('broadcastListModalLabel').textContent = 'Editar Lista';
    }
  } catch (error) {
    console.error('Erro ao carregar lista:', error);
    showToast('Erro ao carregar dados da lista', 'error');
  }
}

async function handleQuickSend(e) {
  e.preventDefault();
  
  const formData = {
    name: `Transmissão ${new Date().toLocaleString('pt-BR')}`,
    message: document.getElementById('quickSendMessage').value,
    listId: document.getElementById('quickSendList').value,
    recipientType: 'list',
    sendImmediately: true
  };
  
  try {
    const response = await apiFetch('/broadcasts', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    if (response.success) {
      showToast('Transmissão enviada com sucesso!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('quickSendModal')).hide();
      loadBroadcasts();
    }
  } catch (error) {
    console.error('Erro ao enviar transmissão:', error);
    showToast('Erro ao enviar transmissão', 'error');
  }
}

async function handleListSubmit(e) {
  e.preventDefault();
  
  const formData = {
    name: document.getElementById('listName').value,
    description: document.getElementById('listDescription').value,
    category: document.getElementById('listCategory').value,
    isActive: document.getElementById('listIsActive').checked,
    contacts: [] // Será preenchido depois
  };
  
  const listId = document.getElementById('listId').value;
  
  try {
    let response;
    if (listId) {
      response = await apiFetch(`/api/broadcasts/lists/${listId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
    } else {
      response = await apiFetch('/broadcasts/lists', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
    }
    
    if (response.success) {
      showToast(response.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('broadcastListModal')).hide();
      loadBroadcastLists();
    }
  } catch (error) {
    console.error('Erro ao salvar lista:', error);
    showToast('Erro ao salvar lista', 'error');
  }
}

function getStatusBadge(status) {
  const badges = {
    draft: '<span class="badge bg-secondary">Rascunho</span>',
    sending: '<span class="badge bg-warning">Enviando</span>',
    completed: '<span class="badge bg-success">Concluída</span>',
    failed: '<span class="badge bg-danger">Falhou</span>'
  };
  return badges[status] || '<span class="badge bg-secondary">Desconhecido</span>';
}

// Funções globais
window.openQuickSendModal = openQuickSendModal;
window.openListModal = openListModal;

window.viewBroadcastDetails = async (broadcastId) => {
  try {
    const response = await apiFetch(`/api/broadcasts/${broadcastId}`);
    const statsResponse = await apiFetch(`/api/broadcasts/${broadcastId}/stats`);
    
    if (response.success && statsResponse.success) {
      showBroadcastDetailsModal(response.data, statsResponse.data);
    }
  } catch (error) {
    console.error('Erro ao carregar detalhes:', error);
    showToast('Erro ao carregar detalhes', 'error');
  }
};

window.sendBroadcast = async (broadcastId) => {
  if (!confirm('Deseja enviar esta transmissão agora?')) return;
  
  try {
    const response = await apiFetch(`/api/broadcasts/${broadcastId}/send`, {
      method: 'POST'
    });
    
    if (response.success) {
      showToast('Transmissão enviada com sucesso!', 'success');
      loadBroadcasts();
    }
  } catch (error) {
    console.error('Erro ao enviar transmissão:', error);
    showToast('Erro ao enviar transmissão', 'error');
  }
};

window.deleteBroadcast = async (broadcastId) => {
  if (!confirm('Deseja realmente excluir esta transmissão?')) return;
  
  try {
    const response = await apiFetch(`/api/broadcasts/${broadcastId}`, {
      method: 'DELETE'
    });
    
    if (response.success) {
      showToast('Transmissão excluída com sucesso!', 'success');
      loadBroadcasts();
    }
  } catch (error) {
    console.error('Erro ao excluir transmissão:', error);
    showToast('Erro ao excluir transmissão', 'error');
  }
};

window.viewListDetails = async (listId) => {
  try {
    const response = await apiFetch(`/api/broadcasts/lists/${listId}`);
    
    if (response.success) {
      showListDetailsModal(response.data);
    }
  } catch (error) {
    console.error('Erro ao carregar detalhes da lista:', error);
    showToast('Erro ao carregar detalhes', 'error');
  }
};

window.sendToList = (listId) => {
  openQuickSendModal();
  setTimeout(() => {
    document.getElementById('quickSendList').value = listId;
  }, 100);
};

window.editList = (listId) => {
  openListModal(listId);
};

window.deleteList = async (listId) => {
  if (!confirm('Deseja realmente excluir esta lista?')) return;
  
  try {
    const response = await apiFetch(`/api/broadcasts/lists/${listId}`, {
      method: 'DELETE'
    });
    
    if (response.success) {
      showToast('Lista excluída com sucesso!', 'success');
      loadBroadcastLists();
    }
  } catch (error) {
    console.error('Erro ao excluir lista:', error);
    showToast('Erro ao excluir lista', 'error');
  }
};

function showBroadcastDetailsModal(broadcast, stats) {
  const modalHtml = `
    <div class="modal fade" id="broadcastDetailsModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-broadcast text-success"></i>
              ${broadcast.name}
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
                    <h3 class="text-danger">${stats.failed}</h3>
                    <small class="text-muted">Falhas</small>
                  </div>
                </div>
              </div>
            </div>
            
            <h6>Mensagem:</h6>
            <div class="alert alert-light">${broadcast.message}</div>
            
            <div class="row">
              <div class="col-md-6">
                <p><strong>Status:</strong> ${getStatusBadge(broadcast.status)}</p>
                <p><strong>Total de Destinatários:</strong> ${broadcast.totalRecipients}</p>
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
  
  const oldModal = document.getElementById('broadcastDetailsModal');
  if (oldModal) oldModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  const modal = new bootstrap.Modal(document.getElementById('broadcastDetailsModal'));
  modal.show();
}

function showListDetailsModal(list) {
  const modalHtml = `
    <div class="modal fade" id="listDetailsModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-list-ul text-primary"></i>
              ${list.name}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            ${list.description ? `<p class="text-muted">${list.description}</p>` : ''}
            
            <div class="row mb-3">
              <div class="col-md-6">
                <p><strong>Total de Contatos:</strong> ${list.totalContacts}</p>
                <p><strong>Categoria:</strong> ${list.category || 'Não definida'}</p>
              </div>
              <div class="col-md-6">
                <p><strong>Status:</strong> ${list.isActive ? '<span class="badge bg-success">Ativa</span>' : '<span class="badge bg-secondary">Inativa</span>'}</p>
                <p><strong>Uso:</strong> ${list.usageCount} vezes</p>
              </div>
            </div>
            
            <h6>Contatos:</h6>
            <div class="list-group" style="max-height: 300px; overflow-y: auto;">
              ${list.contactDetails && list.contactDetails.length > 0 
                ? list.contactDetails.map(contact => `
                  <div class="list-group-item">
                    <div class="d-flex justify-content-between">
                      <div>
                        <strong>${contact.name}</strong>
                        <br>
                        <small class="text-muted">${contact.phone}</small>
                      </div>
                    </div>
                  </div>
                `).join('')
                : '<p class="text-muted">Nenhum contato na lista</p>'
              }
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
            <button type="button" class="btn btn-success" onclick="window.sendToList('${list.id}'); bootstrap.Modal.getInstance(document.getElementById('listDetailsModal')).hide();">
              <i class="bi bi-send"></i> Enviar para esta Lista
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const oldModal = document.getElementById('listDetailsModal');
  if (oldModal) oldModal.remove();
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  const modal = new bootstrap.Modal(document.getElementById('listDetailsModal'));
  modal.show();
}

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

