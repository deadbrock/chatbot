/**
 * View de Automações Inteligentes
 * Interface para configurar regras de automação
 */
class AutomationsView {
  constructor() {
    this.rules = [];
    this.templates = [];
    this.executions = [];
    this.editingRule = null;
  }

  /**
   * Renderiza a view
   */
  async render() {
    const content = document.getElementById('content');
    
    content.innerHTML = `
      <div class="automations-container">
        <!-- Header -->
        <div class="page-header">
          <div>
            <h1>Automações Inteligentes</h1>
            <p class="subtitle">Configure regras de automação para otimizar o atendimento</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" id="btnTemplates">
              📋 Templates
            </button>
            <button class="btn btn-primary" id="btnNewRule">
              ➕ Nova Regra
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="stats-grid" id="statsCards">
          <div class="stat-card loading">Carregando...</div>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab-btn active" data-tab="rules">Regras</button>
          <button class="tab-btn" data-tab="executions">Execuções</button>
          <button class="tab-btn" data-tab="test">Testar</button>
        </div>

        <!-- Tab Content: Regras -->
        <div class="tab-content active" id="tabRules">
          <div class="rules-list" id="rulesList">
            <div class="loading">Carregando regras...</div>
          </div>
        </div>

        <!-- Tab Content: Execuções -->
        <div class="tab-content" id="tabExecutions">
          <div class="executions-list" id="executionsList">
            <div class="loading">Carregando execuções...</div>
          </div>
        </div>

        <!-- Tab Content: Testar -->
        <div class="tab-content" id="tabTest">
          <div class="test-container">
            <div class="test-form">
              <h3>🧪 Testar Automação</h3>
              <p>Digite uma mensagem para testar qual automação será acionada:</p>
              
              <textarea 
                id="testMessage" 
                placeholder="Ex: Preciso falar sobre meu salário"
                rows="3"
              ></textarea>
              
              <button class="btn btn-primary" id="btnTestMessage">
                Testar Mensagem
              </button>
            </div>
            
            <div class="test-result" id="testResult"></div>
          </div>
        </div>
      </div>

      <!-- Modal: Nova/Editar Regra -->
      <div id="modalRule" class="modal">
        <div class="modal-content modal-lg">
          <div class="modal-header">
            <h2 id="modalTitle">Nova Regra de Automação</h2>
            <span class="close">&times;</span>
          </div>
          <div class="modal-body">
            <form id="formRule">
              <!-- Informações Básicas -->
              <div class="form-section">
                <h3>📋 Informações Básicas</h3>
                
                <div class="form-group">
                  <label>Nome da Regra *</label>
                  <input type="text" id="ruleName" required />
                </div>

                <div class="form-group">
                  <label>Descrição</label>
                  <textarea id="ruleDescription" rows="2"></textarea>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label>Prioridade *</label>
                    <input type="number" id="rulePriority" value="10" min="1" max="100" />
                    <small>Menor valor = maior prioridade</small>
                  </div>

                  <div class="form-group">
                    <label>Status</label>
                    <label class="switch">
                      <input type="checkbox" id="ruleActive" checked />
                      <span class="slider"></span>
                    </label>
                    <span id="ruleActiveLabel">Ativada</span>
                  </div>
                </div>
              </div>

              <!-- Gatilho -->
              <div class="form-section">
                <h3>🎯 Gatilho (Quando executar)</h3>
                
                <div class="form-row">
                  <div class="form-group">
                    <label>Tipo de Gatilho *</label>
                    <select id="triggerType">
                      <option value="intent">Intenção</option>
                      <option value="keyword">Palavra-chave</option>
                      <option value="sentiment">Sentimento</option>
                      <option value="always">Sempre</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label>Valor do Gatilho *</label>
                    <input type="text" id="triggerValue" placeholder="Ex: salario, ferias, reclamacao" />
                  </div>
                </div>
              </div>

              <!-- Coleta de Dados -->
              <div class="form-section">
                <h3>📝 Coleta de Dados (Slots)</h3>
                <p class="hint">Dados que serão coletados do usuário antes de executar as ações.</p>
                
                <div id="slotsContainer">
                  <div class="slots-list" id="slotsList"></div>
                  <button type="button" class="btn btn-secondary btn-sm" id="btnAddSlot">
                    ➕ Adicionar Dado
                  </button>
                </div>
              </div>

              <!-- Ações -->
              <div class="form-section">
                <h3>⚡ Ações (O que fazer)</h3>
                <p class="hint">Ações que serão executadas após coletar todos os dados.</p>
                
                <div id="actionsContainer">
                  <div class="actions-list" id="actionsList"></div>
                  <button type="button" class="btn btn-secondary btn-sm" id="btnAddAction">
                    ➕ Adicionar Ação
                  </button>
                </div>
              </div>

              <!-- Mensagens -->
              <div class="form-section">
                <h3>💬 Mensagens Personalizadas</h3>
                
                <div class="form-group">
                  <label>Mensagem de Saudação</label>
                  <textarea id="greetingMessage" rows="2" placeholder="Mensagem enviada ao iniciar a automação"></textarea>
                </div>

                <div class="form-group">
                  <label>Mensagem de Conclusão</label>
                  <textarea id="completionMessage" rows="2" placeholder="Mensagem enviada ao finalizar"></textarea>
                </div>

                <div class="form-group">
                  <label>Mensagem de Erro</label>
                  <textarea id="errorMessage" rows="2" placeholder="Mensagem em caso de erro"></textarea>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" id="btnCancelRule">Cancelar</button>
                <button type="submit" class="btn btn-primary">Salvar Regra</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Modal: Templates -->
      <div id="modalTemplates" class="modal">
        <div class="modal-content modal-lg">
          <div class="modal-header">
            <h2>📋 Templates de Automação</h2>
            <span class="close">&times;</span>
          </div>
          <div class="modal-body">
            <div class="templates-grid" id="templatesGrid">
              <div class="loading">Carregando templates...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Carregar dados
    await this.loadStats();
    await this.loadRules();
    await this.loadTemplates();

    // Event listeners
    this.attachEventListeners();
  }

  /**
   * Anexa event listeners
   */
  attachEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Botões principais
    document.getElementById('btnNewRule')?.addEventListener('click', () => this.openRuleModal());
    document.getElementById('btnTemplates')?.addEventListener('click', () => this.openTemplatesModal());

    // Formulário de regra
    document.getElementById('formRule')?.addEventListener('submit', (e) => this.saveRule(e));
    document.getElementById('btnCancelRule')?.addEventListener('click', () => this.closeRuleModal());

    // Slots e Ações
    document.getElementById('btnAddSlot')?.addEventListener('click', () => this.addSlot());
    document.getElementById('btnAddAction')?.addEventListener('click', () => this.addAction());

    // Toggle ativo
    document.getElementById('ruleActive')?.addEventListener('change', (e) => {
      document.getElementById('ruleActiveLabel').textContent = e.target.checked ? 'Ativada' : 'Desativada';
    });

    // Testar mensagem
    document.getElementById('btnTestMessage')?.addEventListener('click', () => this.testMessage());

    // Modals
    this.attachModalListeners();
  }

  /**
   * Anexa listeners dos modais
   */
  attachModalListeners() {
    const modals = ['modalRule', 'modalTemplates'];
    
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (!modal) return;

      const closeBtn = modal.querySelector('.close');
      closeBtn?.addEventListener('click', () => {
        modal.style.display = 'none';
      });

      window.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }

  /**
   * Carrega estatísticas
   */
  async loadStats() {
    try {
      const data = await apiFetch('/automations/stats');
      
      const statsHtml = `
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <div class="stat-value">${data.stats.totalRules}</div>
            <div class="stat-label">Total de Regras</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <div class="stat-value">${data.stats.activeRules}</div>
            <div class="stat-label">Regras Ativas</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-info">
            <div class="stat-value">${data.stats.totalExecutions}</div>
            <div class="stat-label">Execuções</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-info">
            <div class="stat-value">${data.stats.successRate}%</div>
            <div class="stat-label">Taxa de Sucesso</div>
          </div>
        </div>
      `;

      document.getElementById('statsCards').innerHTML = statsHtml;

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      document.getElementById('statsCards').innerHTML = '<div class="stat-card error">Erro ao carregar</div>';
    }
  }

  /**
   * Carrega regras
   */
  async loadRules() {
    try {
      const data = await apiFetch('/automations/rules');
      this.rules = data.rules;

      const container = document.getElementById('rulesList');
      
      if (this.rules.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚙️</div>
            <h3>Nenhuma regra criada</h3>
            <p>Crie sua primeira regra de automação ou use um template pronto.</p>
            <button class="btn btn-primary" onclick="window.automationsView.openTemplatesModal()">
              Ver Templates
            </button>
          </div>
        `;
        return;
      }

      let html = '<div class="rules-grid">';
      
      for (const rule of this.rules) {
        const statusClass = rule.isActive ? 'active' : 'inactive';
        const statusText = rule.isActive ? 'Ativa' : 'Inativa';
        
        html += `
          <div class="rule-card ${statusClass}">
            <div class="rule-header">
              <div>
                <h3>${rule.name}</h3>
                <span class="badge badge-${statusClass}">${statusText}</span>
              </div>
              <div class="rule-actions">
                <button class="btn-icon" onclick="window.automationsView.toggleRule('${rule.id}')" title="Ativar/Desativar">
                  ${rule.isActive ? '⏸️' : '▶️'}
                </button>
                <button class="btn-icon" onclick="window.automationsView.editRule('${rule.id}')" title="Editar">
                  ✏️
                </button>
                <button class="btn-icon" onclick="window.automationsView.deleteRule('${rule.id}')" title="Excluir">
                  🗑️
                </button>
              </div>
            </div>

            <p class="rule-description">${rule.description || 'Sem descrição'}</p>

            <div class="rule-info">
              <div class="info-item">
                <span class="label">Gatilho:</span>
                <span class="value">${rule.triggerType} = ${rule.triggerValue}</span>
              </div>
              <div class="info-item">
                <span class="label">Prioridade:</span>
                <span class="value">${rule.priority}</span>
              </div>
              <div class="info-item">
                <span class="label">Slots:</span>
                <span class="value">${(rule.requiredSlots || []).length} dados</span>
              </div>
              <div class="info-item">
                <span class="label">Ações:</span>
                <span class="value">${(rule.actions || []).length} ações</span>
              </div>
            </div>

            <div class="rule-stats">
              <span>📊 ${rule.executionCount || 0} execuções</span>
              <span>✅ ${rule.successCount || 0} sucessos</span>
            </div>
          </div>
        `;
      }
      
      html += '</div>';
      container.innerHTML = html;

    } catch (error) {
      console.error('Erro ao carregar regras:', error);
      document.getElementById('rulesList').innerHTML = '<div class="error">Erro ao carregar regras</div>';
    }
  }

  /**
   * Carrega templates
   */
  async loadTemplates() {
    try {
      const data = await apiFetch('/automations/templates');
      this.templates = data.templates;
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
  }

  /**
   * Troca de tab
   */
  switchTab(tab) {
    // Atualizar botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');

    // Carregar dados específicos da tab
    if (tab === 'executions') {
      this.loadExecutions();
    }
  }

  /**
   * Carrega execuções
   */
  async loadExecutions() {
    try {
      const data = await apiFetch('/automations/executions?limit=50');
      this.executions = data.executions;

      const container = document.getElementById('executionsList');
      
      if (this.executions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Nenhuma execução registrada</p></div>';
        return;
      }

      let html = '<div class="executions-table"><table><thead><tr><th>Data</th><th>Regra</th><th>Contato</th><th>Status</th><th>Resultado</th></tr></thead><tbody>';
      
      for (const exec of this.executions) {
        const statusEmoji = {
          'started': '🔵',
          'collecting': '📝',
          'executing': '⚡',
          'completed': '✅',
          'failed': '❌'
        }[exec.status] || '❓';

        html += `
          <tr>
            <td>${new Date(exec.createdAt).toLocaleString('pt-BR')}</td>
            <td>${exec.rule?.name || 'N/A'}</td>
            <td>${exec.contact?.name || exec.contact?.phone || 'N/A'}</td>
            <td><span class="badge badge-${exec.status}">${statusEmoji} ${exec.status}</span></td>
            <td>${exec.error || (exec.result ? 'Sucesso' : '-')}</td>
          </tr>
        `;
      }
      
      html += '</tbody></table></div>';
      container.innerHTML = html;

    } catch (error) {
      console.error('Erro ao carregar execuções:', error);
      document.getElementById('executionsList').innerHTML = '<div class="error">Erro ao carregar execuções</div>';
    }
  }

  /**
   * Abre modal de nova regra
   */
  openRuleModal(rule = null) {
    this.editingRule = rule;
    
    const modal = document.getElementById('modalRule');
    const title = document.getElementById('modalTitle');
    
    if (rule) {
      title.textContent = 'Editar Regra';
      this.fillRuleForm(rule);
    } else {
      title.textContent = 'Nova Regra';
      document.getElementById('formRule').reset();
      document.getElementById('slotsList').innerHTML = '';
      document.getElementById('actionsList').innerHTML = '';
    }

    modal.style.display = 'block';
  }

  /**
   * Preenche formulário com dados da regra
   */
  fillRuleForm(rule) {
    document.getElementById('ruleName').value = rule.name;
    document.getElementById('ruleDescription').value = rule.description || '';
    document.getElementById('rulePriority').value = rule.priority;
    document.getElementById('ruleActive').checked = rule.isActive;
    document.getElementById('triggerType').value = rule.triggerType;
    document.getElementById('triggerValue').value = rule.triggerValue;
    document.getElementById('greetingMessage').value = rule.greetingMessage || '';
    document.getElementById('completionMessage').value = rule.completionMessage || '';
    document.getElementById('errorMessage').value = rule.errorMessage || '';

    // Slots
    const slotsList = document.getElementById('slotsList');
    slotsList.innerHTML = '';
    (rule.requiredSlots || []).forEach(slot => {
      this.addSlot(slot, rule.slotPrompts?.[slot] || '');
    });

    // Ações
    const actionsList = document.getElementById('actionsList');
    actionsList.innerHTML = '';
    (rule.actions || []).forEach(action => {
      this.addAction(action);
    });
  }

  /**
   * Fecha modal de regra
   */
  closeRuleModal() {
    document.getElementById('modalRule').style.display = 'none';
    this.editingRule = null;
  }

  /**
   * Adiciona um slot
   */
  addSlot(slotName = '', slotPrompt = '') {
    const slotsList = document.getElementById('slotsList');
    const slotId = `slot_${Date.now()}_${Math.random()}`;
    
    const slotHtml = `
      <div class="slot-item" data-slot-id="${slotId}">
        <input type="text" class="slot-name" placeholder="Nome do dado (ex: nome_completo)" value="${slotName}" />
        <input type="text" class="slot-prompt" placeholder="Mensagem para solicitar" value="${slotPrompt}" />
        <button type="button" class="btn-icon" onclick="this.parentElement.remove()">🗑️</button>
      </div>
    `;
    
    slotsList.insertAdjacentHTML('beforeend', slotHtml);
  }

  /**
   * Adiciona uma ação
   */
  addAction(action = null) {
    const actionsList = document.getElementById('actionsList');
    const actionId = `action_${Date.now()}_${Math.random()}`;
    
    const actionType = action?.type || 'create_ticket';
    const actionParams = action?.params || {};
    
    const actionHtml = `
      <div class="action-item" data-action-id="${actionId}">
        <select class="action-type">
          <option value="create_ticket" ${actionType === 'create_ticket' ? 'selected' : ''}>Criar Ticket</option>
          <option value="transfer_queue" ${actionType === 'transfer_queue' ? 'selected' : ''}>Transferir para Fila</option>
          <option value="add_tag" ${actionType === 'add_tag' ? 'selected' : ''}>Adicionar Tag</option>
          <option value="send_notification" ${actionType === 'send_notification' ? 'selected' : ''}>Enviar Notificação</option>
          <option value="update_contact" ${actionType === 'update_contact' ? 'selected' : ''}>Atualizar Contato</option>
        </select>
        <input type="text" class="action-params" placeholder='Parâmetros (JSON)' value='${JSON.stringify(actionParams)}' />
        <button type="button" class="btn-icon" onclick="this.parentElement.remove()">🗑️</button>
      </div>
    `;
    
    actionsList.insertAdjacentHTML('beforeend', actionHtml);
  }

  /**
   * Salva regra
   */
  async saveRule(e) {
    e.preventDefault();
    
    try {
      // Coletar dados do formulário
      const ruleData = {
        name: document.getElementById('ruleName').value,
        description: document.getElementById('ruleDescription').value,
        priority: parseInt(document.getElementById('rulePriority').value),
        isActive: document.getElementById('ruleActive').checked,
        triggerType: document.getElementById('triggerType').value,
        triggerValue: document.getElementById('triggerValue').value,
        greetingMessage: document.getElementById('greetingMessage').value,
        completionMessage: document.getElementById('completionMessage').value,
        errorMessage: document.getElementById('errorMessage').value,
        requiredSlots: [],
        slotPrompts: {},
        actions: []
      };

      // Coletar slots
      document.querySelectorAll('.slot-item').forEach(item => {
        const name = item.querySelector('.slot-name').value;
        const prompt = item.querySelector('.slot-prompt').value;
        if (name) {
          ruleData.requiredSlots.push(name);
          ruleData.slotPrompts[name] = prompt;
        }
      });

      // Coletar ações
      document.querySelectorAll('.action-item').forEach(item => {
        const type = item.querySelector('.action-type').value;
        const paramsStr = item.querySelector('.action-params').value;
        try {
          const params = JSON.parse(paramsStr || '{}');
          ruleData.actions.push({ type, params });
        } catch (e) {
          console.error('Erro ao parsear parâmetros da ação:', e);
        }
      });

      // Salvar
      let response;
      if (this.editingRule) {
        response = await apiFetch(`/automations/rules/${this.editingRule.id}`, {
          method: 'PUT',
          body: ruleData
        });
      } else {
        response = await apiFetch('/automations/rules', {
          method: 'POST',
          body: ruleData
        });
      }

      if (response.success) {
        showNotification('Regra salva com sucesso!', 'success');
        this.closeRuleModal();
        await this.loadRules();
        await this.loadStats();
      } else {
        throw new Error(response.error || 'Erro ao salvar regra');
      }

    } catch (error) {
      console.error('Erro ao salvar regra:', error);
      showNotification('Erro ao salvar regra: ' + error.message, 'error');
    }
  }

  /**
   * Edita regra
   */
  editRule(ruleId) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      this.openRuleModal(rule);
    }
  }

  /**
   * Ativa/desativa regra
   */
  async toggleRule(ruleId) {
    try {
      const rule = this.rules.find(r => r.id === ruleId);
      if (!rule) return;

      const response = await apiFetch(`/automations/rules/${ruleId}/toggle`, {
        method: 'PATCH',
        body: { isActive: !rule.isActive }
      });

      if (response.success) {
        showNotification(`Regra ${response.rule.isActive ? 'ativada' : 'desativada'}!`, 'success');
        await this.loadRules();
        await this.loadStats();
      }

    } catch (error) {
      console.error('Erro ao alternar regra:', error);
      showNotification('Erro ao alternar regra', 'error');
    }
  }

  /**
   * Deleta regra
   */
  async deleteRule(ruleId) {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;

    try {
      const response = await apiFetch(`/automations/rules/${ruleId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        showNotification('Regra excluída com sucesso!', 'success');
        await this.loadRules();
        await this.loadStats();
      }

    } catch (error) {
      console.error('Erro ao excluir regra:', error);
      showNotification('Erro ao excluir regra', 'error');
    }
  }

  /**
   * Abre modal de templates
   */
  async openTemplatesModal() {
    const modal = document.getElementById('modalTemplates');
    modal.style.display = 'block';

    if (this.templates.length === 0) {
      await this.loadTemplates();
    }

    const grid = document.getElementById('templatesGrid');
    
    let html = '';
    for (const template of this.templates) {
      html += `
        <div class="template-card">
          <h3>${template.name}</h3>
          <p>${template.description}</p>
          <button class="btn btn-primary" onclick="window.automationsView.useTemplate('${template.id}')">
            Usar Template
          </button>
        </div>
      `;
    }
    
    grid.innerHTML = html;
  }

  /**
   * Usa um template
   */
  async useTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    // Fechar modal de templates
    document.getElementById('modalTemplates').style.display = 'none';

    // Abrir modal de regra com dados do template
    this.openRuleModal(template.config);
  }

  /**
   * Testa uma mensagem
   */
  async testMessage() {
    try {
      const message = document.getElementById('testMessage').value;
      
      if (!message) {
        showNotification('Digite uma mensagem para testar', 'warning');
        return;
      }

      const response = await apiFetch('/automations/test', {
        method: 'POST',
        body: { message }
      });

      const resultDiv = document.getElementById('testResult');
      
      if (response.result) {
        const exec = response.result.execution;
        const res = response.result.response;
        
        resultDiv.innerHTML = `
          <div class="test-result-success">
            <h4>✅ Automação Acionada!</h4>
            <p><strong>Mensagem da IA:</strong></p>
            <div class="ai-message">${res.message}</div>
            ${res.needsInput ? `<p><strong>Próximo dado:</strong> ${res.nextSlot}</p>` : ''}
            <p><strong>Status:</strong> ${exec.status}</p>
          </div>
        `;
      } else {
        resultDiv.innerHTML = `
          <div class="test-result-none">
            <h4>ℹ️ Nenhuma Automação Correspondente</h4>
            <p>Nenhuma regra foi acionada para esta mensagem.</p>
          </div>
        `;
      }

    } catch (error) {
      console.error('Erro ao testar mensagem:', error);
      showNotification('Erro ao testar mensagem', 'error');
    }
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.AutomationsView = AutomationsView;
  window.automationsView = new AutomationsView();
}

console.log('✅ Automations View carregado com sucesso!');
