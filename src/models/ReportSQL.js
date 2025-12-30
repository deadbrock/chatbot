const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Relatórios
 * Gerencia relatórios personalizados e agendados
 */
const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Informações Básicas
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Nome do relatório'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do relatório'
  },
  
  // Tipo de Relatório
  type: {
    type: DataTypes.ENUM(
      'tickets',           // Relatório de tickets
      'messages',          // Relatório de mensagens
      'agents',            // Desempenho de atendentes
      'contacts',          // Relatório de contatos
      'nps',               // Relatório de NPS
      'campaigns',         // Relatório de campanhas
      'flows',             // Relatório de fluxos
      'custom'             // Relatório customizado
    ),
    allowNull: false,
    defaultValue: 'tickets'
  },
  
  // Filtros (JSON)
  filters: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Filtros aplicados ao relatório (dateFrom, dateTo, userId, queueId, status, etc.)'
  },
  
  // Agendamento (JSON)
  schedule: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null,
    comment: 'Configuração de agendamento (frequency: daily|weekly|monthly, dayOfWeek, dayOfMonth, time, timezone)'
  },
  
  // Formato de Saída
  format: {
    type: DataTypes.ENUM('pdf', 'excel', 'csv', 'json'),
    allowNull: false,
    defaultValue: 'pdf'
  },
  
  // Destinatários (Array de emails para envio automático)
  recipients: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Lista de emails para envio automático do relatório'
  },
  
  // Controle de Agendamento
  lastGenerated: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data da última geração'
  },
  
  nextScheduled: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data da próxima geração agendada'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('active', 'paused', 'error', 'draft'),
    allowNull: false,
    defaultValue: 'draft'
  },
  
  // Estatísticas
  generationCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Número de vezes que foi gerado'
  },
  
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Última mensagem de erro (se houver)'
  },
  
  // Campos Customizados (para relatórios custom)
  customFields: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Campos customizados a incluir no relatório'
  },
  
  // Configurações de Visualização
  chartTypes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Tipos de gráficos a incluir (bar, line, pie, etc.)'
  },
  
  // Controle de Acesso
  isPublic: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Se true, todos os usuários podem visualizar'
  },
  
  allowedUsers: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array de user IDs que podem visualizar (se não for público)'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  // Criador
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário que criou'
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário que atualizou por último'
  }
}, {
  tableName: 'reports',
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['createdBy'] },
    { fields: ['nextScheduled'] }
  ]
});

/**
 * Métodos de Instância
 */

// Calcular próxima execução agendada
Report.prototype.calculateNextScheduled = function() {
  if (!this.schedule || this.status !== 'active') {
    return null;
  }
  
  const now = new Date();
  const { frequency, dayOfWeek, dayOfMonth, time } = this.schedule;
  const [hour, minute] = (time || '09:00').split(':').map(Number);
  
  let next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  
  switch (frequency) {
    case 'daily':
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;
      
    case 'weekly':
      const targetDay = dayOfWeek || 1; // 1 = Monday
      const currentDay = next.getDay() || 7;
      const daysUntil = (targetDay - currentDay + 7) % 7;
      next.setDate(next.getDate() + (daysUntil || 7));
      break;
      
    case 'monthly':
      const targetDate = dayOfMonth || 1;
      next.setDate(targetDate);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
      
    default:
      return null;
  }
  
  return next;
};

// Marcar como gerado
Report.prototype.markAsGenerated = async function() {
  this.lastGenerated = new Date();
  this.generationCount += 1;
  this.nextScheduled = this.calculateNextScheduled();
  await this.save();
};

// Registrar erro
Report.prototype.markAsError = async function(error) {
  this.status = 'error';
  this.lastError = error.message || String(error);
  await this.save();
};

// Limpar erro e reativar
Report.prototype.clearError = async function() {
  if (this.status === 'error') {
    this.status = 'active';
    this.lastError = null;
    await this.save();
  }
};

// Verificar se usuário tem acesso
Report.prototype.hasAccess = function(userId) {
  if (this.isPublic) return true;
  if (this.createdBy === userId) return true;
  if (Array.isArray(this.allowedUsers) && this.allowedUsers.includes(userId)) return true;
  return false;
};

// Obter filtros aplicados em formato legível
Report.prototype.getFiltersDescription = function() {
  const descriptions = [];
  
  if (this.filters.dateFrom) {
    descriptions.push(`De: ${new Date(this.filters.dateFrom).toLocaleDateString('pt-BR')}`);
  }
  
  if (this.filters.dateTo) {
    descriptions.push(`Até: ${new Date(this.filters.dateTo).toLocaleDateString('pt-BR')}`);
  }
  
  if (this.filters.status) {
    descriptions.push(`Status: ${this.filters.status}`);
  }
  
  if (this.filters.queueId) {
    descriptions.push(`Fila específica`);
  }
  
  if (this.filters.userId) {
    descriptions.push(`Atendente específico`);
  }
  
  return descriptions.join(' | ') || 'Sem filtros';
};

// Obter agendamento em formato legível
Report.prototype.getScheduleDescription = function() {
  if (!this.schedule) return 'Não agendado';
  
  const { frequency, dayOfWeek, dayOfMonth, time } = this.schedule;
  
  switch (frequency) {
    case 'daily':
      return `Diariamente às ${time}`;
      
    case 'weekly':
      const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      return `Toda ${days[dayOfWeek || 1]} às ${time}`;
      
    case 'monthly':
      return `Todo dia ${dayOfMonth || 1} às ${time}`;
      
    default:
      return 'Agendamento inválido';
  }
};

/**
 * Métodos Estáticos
 */

// Buscar relatórios agendados para executar
Report.findScheduledReports = async function() {
  const now = new Date();
  
  return await Report.findAll({
    where: {
      status: 'active',
      nextScheduled: {
        [sequelize.Sequelize.Op.lte]: now
      }
    },
    order: [['nextScheduled', 'ASC']]
  });
};

// Buscar relatórios do usuário
Report.findUserReports = async function(userId, includePublic = true) {
  const where = {
    [sequelize.Sequelize.Op.or]: [
      { createdBy: userId },
      { allowedUsers: { [sequelize.Sequelize.Op.contains]: [userId] } }
    ]
  };
  
  if (includePublic) {
    where[sequelize.Sequelize.Op.or].push({ isPublic: true });
  }
  
  return await Report.findAll({
    where,
    order: [['createdAt', 'DESC']]
  });
};

// Estatísticas de relatórios
Report.getStats = async function() {
  const [total, active, scheduled, draft, error] = await Promise.all([
    Report.count(),
    Report.count({ where: { status: 'active' } }),
    Report.count({ where: { status: 'active', schedule: { [sequelize.Sequelize.Op.ne]: null } } }),
    Report.count({ where: { status: 'draft' } }),
    Report.count({ where: { status: 'error' } })
  ]);
  
  return {
    total,
    active,
    scheduled,
    draft,
    error
  };
};

// Limpar relatórios antigos (opcional)
Report.cleanupOldReports = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const deleted = await Report.destroy({
    where: {
      status: 'draft',
      createdAt: {
        [sequelize.Sequelize.Op.lt]: cutoffDate
      }
    }
  });
  
  return deleted;
};

module.exports = Report;

