/**
 * AI Playground View - Tela de Desenvolvimento e Treinamento da IA
 */

class AIPlaygroundView {
  constructor() {
    this.container = null;
    this.currentContext = null;
    this.conversationHistory = [];
  }

  /**
   * Obter URL base da API (detecta Railway em produção)
   */
  getApiBaseUrl() {
    // Tentar ler de meta tag
    const apiUrlMeta = document.querySelector('meta[name="api-url"]');
    if (apiUrlMeta) {
      const url = apiUrlMeta.getAttribute('content');
      if (url && url.trim()) {
        return url.endsWith('/api') ? url : `${url}/api`;
      }
    }
    
    // Detectar automaticamente
    const hostname = window.location.hostname;
    const isProduction = hostname !== 'localhost' && 
                         hostname !== '127.0.0.1' && 
                         !hostname.includes('192.168');
    
    if (isProduction) {
      console.warn('⚠️ API_URL não configurada na meta tag!');
    }
    
    // Fallback para URL relativa
    return '/api';
  }

  /**
   * Renderizar a view
   */
  async render() {
    const container = document.getElementById('main-content');
    
    container.innerHTML = `
      <div class="ai-playground-container">
        <!-- Header -->
        <div class="playground-header">
          <h1>🤖 AI Playground</h1>
          <p>Teste e treine sua IA em tempo real</p>
        </div>

        <!-- Main Content -->
        <div class="playground-content">
          <!-- Chat Area -->
          <div class="playground-chat-section">
            <div class="chat-card">
              <div class="chat-header">
                <h2>💬 Conversa</h2>
                <button id="clearChat" class="btn-secondary">
                  <i class="fas fa-trash"></i> Limpar
                </button>
              </div>
              
              <div id="aiPlaygroundChatMessages" class="chat-messages"></div>
              
              <div class="chat-input-area">
                <textarea 
                  id="messageInput" 
                  placeholder="Digite sua mensagem aqui..."
                  rows="3"
                ></textarea>
                <button id="sendMessage" class="btn-primary">
                  <i class="fas fa-paper-plane"></i> Enviar
                </button>
              </div>
            </div>
          </div>

          <!-- Context & Settings -->
          <div class="playground-settings-section">
            <!-- Context Editor -->
            <div class="settings-card">
              <h3>📝 Contexto da IA</h3>
              <textarea 
                id="contextInput" 
                placeholder="Defina o contexto e personalidade da IA..."
                rows="10"
              >Você é um assistente virtual de RH. 
Ajude o usuário com suas dúvidas sobre:
- Férias
- Folha de pagamento
- Benefícios
- Políticas da empresa
- Atendimento humano

Se não souber responder ou o usuário pedir para falar com humano, classifique como "atendimento_humano".</textarea>
              <button id="updateContext" class="btn-secondary mt-2">
                <i class="fas fa-sync"></i> Atualizar Contexto
              </button>
            </div>

            <!-- Last Response Details -->
            <div class="settings-card" id="responseDetails">
              <h3>📊 Última Resposta</h3>
              <div class="response-info">
                <p><strong>Intenção:</strong> <span id="detectedIntent">-</span></p>
                <p><strong>Confiança:</strong> <span id="confidence">-</span></p>
                <p><strong>Tempo:</strong> <span id="responseTime">-</span></p>
              </div>
            </div>

            <!-- Training Examples -->
            <div class="settings-card">
              <div class="card-header-actions">
                <h3>📚 Exemplos de Treinamento</h3>
                <button id="showExamples" class="btn-secondary btn-sm">
                  <i class="fas fa-list"></i> Ver Todos
                </button>
              </div>
              <div id="examplesCount" class="examples-count">
                Carregando...
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="settings-card">
              <h3>⚡ Ações Rápidas</h3>
              <button id="saveExample" class="btn-success btn-block mb-2">
                <i class="fas fa-save"></i> Salvar como Exemplo
              </button>
              <button id="viewStats" class="btn-info btn-block">
                <i class="fas fa-chart-bar"></i> Ver Estatísticas
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal: Salvar Exemplo -->
      <div id="saveExampleModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>💾 Salvar Exemplo de Treinamento</h2>
            <span class="close">&times;</span>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Mensagem:</label>
              <input type="text" id="exampleMessage" class="form-control" readonly>
            </div>
            <div class="form-group">
              <label>Intenção Esperada:</label>
              <input type="text" id="exampleIntent" class="form-control" placeholder="Ex: consulta_ferias">
            </div>
            <div class="form-group">
              <label>Resposta Esperada (opcional):</label>
              <textarea id="exampleResponse" class="form-control" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>Notas (opcional):</label>
              <textarea id="exampleNotes" class="form-control" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button id="confirmSaveExample" class="btn-primary">Salvar</button>
            <button class="btn-secondary close">Cancelar</button>
          </div>
        </div>
      </div>

      <!-- Modal: Visualizar Exemplos -->
      <div id="examplesModal" class="modal">
        <div class="modal-content modal-lg">
          <div class="modal-header">
            <h2>📚 Exemplos de Treinamento</h2>
            <span class="close">&times;</span>
          </div>
          <div class="modal-body">
            <div id="examplesList"></div>
          </div>
        </div>
      </div>

      <!-- Modal: Estatísticas -->
      <div id="statsModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>📊 Estatísticas de Intenções</h2>
            <span class="close">&times;</span>
          </div>
          <div class="modal-body">
            <div id="statsContent"></div>
          </div>
        </div>
      </div>
    `;

    this.container = container;
    this.attachEventListeners();
    this.loadExamplesCount();
    this.loadContext();
  }

  /**
   * Anexar event listeners
   */
  attachEventListeners() {
    // Enviar mensagem
    document.getElementById('sendMessage').addEventListener('click', () => this.sendMessage());
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Limpar chat
    document.getElementById('clearChat').addEventListener('click', () => this.clearChat());

    // Atualizar contexto
    document.getElementById('updateContext').addEventListener('click', () => this.updateContext());

    // Salvar exemplo
    document.getElementById('saveExample').addEventListener('click', () => this.openSaveExampleModal());
    document.getElementById('confirmSaveExample').addEventListener('click', () => this.saveTrainingExample());

    // Ver exemplos
    document.getElementById('showExamples').addEventListener('click', () => this.showExamples());

    // Ver estatísticas
    document.getElementById('viewStats').addEventListener('click', () => this.showStats());

    // Modais
    this.setupModals();
  }

  /**
   * Configurar modais
   */
  setupModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.modal .close');

    closeButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
      });
    });

    window.addEventListener('click', (e) => {
      modals.forEach(modal => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }

  /**
   * Enviar mensagem para a IA
   */
  async sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) return;

    // Adicionar mensagem do usuário ao chat
    this.addMessageToChat('user', message);

    // Limpar input
    input.value = '';

    // Mostrar loading
    this.showLoading();

    try {
      const context = document.getElementById('contextInput').value;
      
      // ✅ apiFetch já adiciona o baseUrl automaticamente!
      const response = await window.apiFetch('/ai-playground/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message,
          context,
          userId: 'playground'
        })
      });

      // Verificar se a resposta tem conteúdo
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();
      
      console.log('📊 AI Playground - Resposta recebida:', {
        status: response.status,
        contentType,
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200)
      });

      // Tentar fazer parse do JSON
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse do JSON:', parseError);
        throw new Error(`Resposta inválida do servidor (${response.status}): ${responseText.substring(0, 100)}`);
      }

      // Verificar se a requisição foi bem-sucedida
      if (!response.ok) {
        throw new Error(data.message || `Erro ${response.status}: ${response.statusText}`);
      }

      if (data.success) {
        // Adicionar resposta da IA ao chat
        this.addMessageToChat('ai', data.response, {
          intent: data.intent,
          confidence: data.confidence,
          sentiment: data.sentiment
        });
        
        // Atualizar detalhes da resposta
        this.updateResponseDetails({
          intent: data.intent,
          confidence: data.confidence,
          sentiment: data.sentiment
        }, {
          responseTime: data.responseTime
        });
        
        // Salvar no histórico
        this.conversationHistory.push({
          message,
          response: data.response,
          intent: data.intent,
          timestamp: new Date()
        });
      } else {
        this.showError('Erro ao processar mensagem: ' + (data.error || 'Erro desconhecido'));
      }

    } catch (error) {
      console.error('❌ Erro no AI Playground:', error);
      this.showError('Erro de conexão com a API: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Adicionar mensagem ao chat
   */
  addMessageToChat(sender, message, details = null) {
    console.log('🔷 addMessageToChat chamado:', { sender, message: message?.substring(0, 50), details });
    
    const chatMessages = document.getElementById('aiPlaygroundChatMessages');
    
    if (!chatMessages) {
      console.error('❌ Elemento chatMessages não encontrado!');
      return;
    }
    
    console.log('✅ Elemento chatMessages encontrado:', chatMessages);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let html = `
      <div class="message-bubble">
        <div class="message-text">${this.formatMessage(message)}</div>
        <div class="message-time">${time}</div>
    `;

    if (details) {
      html += `
        <div class="message-details">
          <span class="badge badge-intent">${details.intent || 'N/A'}</span>
          <span class="badge badge-confidence">${details.confidence ? (details.confidence * 100).toFixed(0) : '0'}%</span>
        </div>
      `;
    }

    html += `</div>`;
    messageDiv.innerHTML = html;

    console.log('📝 HTML da mensagem:', html);
    console.log('📦 Adicionando ao chatMessages...', messageDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    console.log('✅ Mensagem adicionada! Total de mensagens:', chatMessages.children.length);
  }

  /**
   * Formatar mensagem (quebras de linha, etc)
   */
  formatMessage(message) {
    return message.replace(/\n/g, '<br>');
  }

  /**
   * Atualizar detalhes da resposta
   */
  updateResponseDetails(output, performance) {
    document.getElementById('detectedIntent').textContent = output.intent;
    document.getElementById('confidence').textContent = `${(output.confidence * 100).toFixed(1)}%`;
    document.getElementById('responseTime').textContent = performance.responseTime;
  }

  /**
   * Limpar chat
   */
  clearChat() {
    if (confirm('Deseja limpar o histórico de conversa?')) {
      document.getElementById('aiPlaygroundChatMessages').innerHTML = '';
      this.conversationHistory = [];
      document.getElementById('detectedIntent').textContent = '-';
      document.getElementById('confidence').textContent = '-';
      document.getElementById('responseTime').textContent = '-';
    }
  }

  /**
   * Atualizar contexto
   */
  async updateContext() {
    try {
      const context = document.getElementById('contextInput').value;
      
      if (!context || context.trim() === '') {
        this.showError('Por favor, insira um contexto válido');
        return;
      }
      
      // Salvar no banco de dados
      // ✅ apiFetch já adiciona o baseUrl automaticamente!
      const response = await window.apiFetch('/ai-playground/config', {
        method: 'POST',
        body: {
          systemPrompt: context
        }
      });
      
      if (response.success) {
        this.currentContext = context;
        this.showSuccess('✅ Contexto salvo no banco de dados! Será mantido após recarregar a página.');
      } else {
        throw new Error(response.error || 'Erro ao salvar contexto');
      }
      
    } catch (error) {
      console.error('❌ Erro ao salvar contexto:', error);
      this.showError('Erro ao salvar contexto: ' + error.message);
    }
  }

  /**
   * Carregar contexto salvo
   */
  loadContext() {
    // Aqui você pode carregar um contexto salvo anteriormente
    const savedContext = localStorage.getItem('aiPlaygroundContext');
    if (savedContext) {
      document.getElementById('contextInput').value = savedContext;
    }
  }

  /**
   * Abrir modal de salvar exemplo
   */
  openSaveExampleModal() {
    if (this.conversationHistory.length === 0) {
      alert('Nenhuma conversa para salvar. Envie uma mensagem primeiro.');
      return;
    }

    const lastInteraction = this.conversationHistory[this.conversationHistory.length - 1];
    document.getElementById('exampleMessage').value = lastInteraction.message;
    document.getElementById('exampleIntent').value = lastInteraction.intent || '';
    document.getElementById('exampleResponse').value = lastInteraction.response || '';
    
    document.getElementById('saveExampleModal').style.display = 'block';
  }

  /**
   * Salvar exemplo de treinamento
   */
  async saveTrainingExample() {
    const message = document.getElementById('exampleMessage').value;
    const expectedIntent = document.getElementById('exampleIntent').value;
    const expectedResponse = document.getElementById('exampleResponse').value;
    const notes = document.getElementById('exampleNotes').value;

    if (!expectedIntent) {
      alert('Informe a intenção esperada');
      return;
    }

    try {
      // ✅ apiFetch já adiciona o baseUrl automaticamente!
      const response = await window.apiFetch('/ai-playground/examples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message,
          expectedIntent,
          expectedResponse,
          notes
        })
      });

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      if (!response.ok) {
        throw new Error(data.message || `Erro ${response.status}`);
      }

      if (data.success) {
        this.showSuccess('Exemplo salvo com sucesso!');
        document.getElementById('saveExampleModal').style.display = 'none';
        this.loadExamplesCount();
        
        // Limpar campos
        document.getElementById('exampleIntent').value = '';
        document.getElementById('exampleResponse').value = '';
        document.getElementById('exampleNotes').value = '';
      } else {
        alert('Erro ao salvar exemplo: ' + data.error);
      }

    } catch (error) {
      console.error('Erro:', error);
      alert('Erro de conexão com a API');
    }
  }

  /**
   * Carregar contagem de exemplos
   */
  async loadExamplesCount() {
    try {
      // ✅ apiFetch já adiciona o baseUrl e token automaticamente!
      const response = await window.apiFetch('/ai-playground/examples', {
        method: 'GET'
      });

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      if (response.ok && data.success) {
        document.getElementById('examplesCount').innerHTML = `
          <p><strong>${data.examples.length}</strong> exemplos salvos</p>
        `;
      }

    } catch (error) {
      console.error('Erro ao carregar exemplos:', error);
    }
  }

  /**
   * Mostrar exemplos
   */
  async showExamples() {
    try {
      // ✅ apiFetch já adiciona o baseUrl e token automaticamente!
      const response = await window.apiFetch('/ai-playground/examples', {
        method: 'GET'
      });

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      if (response.ok && data.success) {
        const examplesList = document.getElementById('examplesList');
        
        if (data.examples.length === 0) {
          examplesList.innerHTML = '<p class="text-center">Nenhum exemplo salvo ainda.</p>';
        } else {
          examplesList.innerHTML = data.examples.map(ex => `
            <div class="example-item">
              <div class="example-header">
                <span class="badge badge-intent">${ex.expectedIntent}</span>
                <button class="btn-danger btn-sm" onclick="aiPlaygroundView.deleteExample('${ex.id}')">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
              <div class="example-body">
                <p><strong>Mensagem:</strong> ${ex.message}</p>
                ${ex.expectedResponse ? `<p><strong>Resposta:</strong> ${ex.expectedResponse}</p>` : ''}
                ${ex.notes ? `<p><strong>Notas:</strong> ${ex.notes}</p>` : ''}
                <small>${new Date(ex.createdAt).toLocaleString('pt-BR')}</small>
              </div>
            </div>
          `).join('');
        }

        document.getElementById('examplesModal').style.display = 'block';
      }

    } catch (error) {
      console.error('Erro ao carregar exemplos:', error);
      alert('Erro ao carregar exemplos');
    }
  }

  /**
   * Deletar exemplo
   */
  async deleteExample(id) {
    if (!confirm('Deseja realmente deletar este exemplo?')) return;

    try {
      // ✅ apiFetch já adiciona o baseUrl e token automaticamente!
      const response = await window.apiFetch(`/ai-playground/examples/${id}`, {
        method: 'DELETE'
      });

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      if (response.ok && data.success) {
        this.showSuccess('Exemplo removido!');
        this.showExamples(); // Recarregar lista
        this.loadExamplesCount();
      }

    } catch (error) {
      console.error('Erro ao deletar exemplo:', error);
      alert('Erro ao deletar exemplo');
    }
  }

  /**
   * Mostrar estatísticas
   */
  async showStats() {
    try {
      // ✅ apiFetch já adiciona o baseUrl e token automaticamente!
      const response = await window.apiFetch('/ai-playground/stats', {
        method: 'GET'
      });

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      if (response.ok && data.success) {
        const statsContent = document.getElementById('statsContent');
        
        if (data.stats.length === 0) {
          statsContent.innerHTML = '<p class="text-center">Nenhum dado disponível ainda.</p>';
        } else {
          statsContent.innerHTML = `
            <p><strong>Total de Exemplos:</strong> ${data.totalExamples}</p>
            <h3>Distribuição por Intenção:</h3>
            <div class="stats-list">
              ${data.stats.map(stat => `
                <div class="stat-item">
                  <span>${stat.intent}</span>
                  <span class="badge">${stat.count}</span>
                </div>
              `).join('')}
            </div>
          `;
        }

        document.getElementById('statsModal').style.display = 'block';
      }

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      alert('Erro ao carregar estatísticas');
    }
  }

  /**
   * Helpers de UI
   */
  showLoading() {
    const chatMessages = document.getElementById('aiPlaygroundChatMessages');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingMessage';
    loadingDiv.className = 'chat-message ai';
    loadingDiv.innerHTML = `
      <div class="message-bubble">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  hideLoading() {
    const loading = document.getElementById('loadingMessage');
    if (loading) loading.remove();
  }

  showSuccess(message) {
    // Implementar notificação de sucesso
    alert(message);
  }

  showError(message) {
    // Implementar notificação de erro
    alert(message);
  }
}

// Criar instância global
window.aiPlaygroundView = new AIPlaygroundView();

// Log para confirmar carregamento
console.log('✅ AI Playground View carregado com sucesso!');

