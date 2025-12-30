const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Papéis (Roles)
 * Sistema de controle de acesso baseado em papéis (RBAC)
 */
const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Nome do papel (ex: admin, agent, supervisor)'
  },
  
  displayName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome para exibição'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do papel'
  },
  
  // Permissões
  permissions: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de permissões'
  },
  // Exemplo: ['tickets.read', 'tickets.write', 'contacts.read', 'analytics.view']
  
  // Hierarquia
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Nível hierárquico (maior = mais poder)'
  },
  
  inheritsFrom: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Herda permissões de outro papel'
  },
  
  // Tipo
  type: {
    type: DataTypes.ENUM('system', 'custom'),
    defaultValue: 'custom',
    comment: 'Tipo do papel'
  },
  
  // Configurações
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Papel ativo'
  },
  
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Papel padrão para novos usuários'
  },
  
  // Restrições
  maxUsers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Máximo de usuários (0 = ilimitado)'
  },
  
  currentUsers: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Usuários atuais com este papel'
  },
  
  // Limitações por módulo
  restrictions: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Restrições específicas por módulo'
  },
  // Exemplo: { 
  //   tickets: { maxDaily: 50, maxConcurrent: 5 },
  //   campaigns: { maxPerMonth: 10 }
  // }
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Criado por (user ID)'
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Atualizado por (user ID)'
  }
}, {
  tableName: 'roles',
  timestamps: true,
  indexes: [
    { fields: ['name'], unique: true },
    { fields: ['level'] },
    { fields: ['type'] },
    { fields: ['isActive'] }
  ]
});

/**
 * Verifica se o papel tem uma permissão
 */
Role.prototype.hasPermission = function(permission) {
  if (!this.permissions || this.permissions.length === 0) return false;
  
  // Verificar permissão exata
  if (this.permissions.includes(permission)) return true;
  
  // Verificar wildcard (ex: tickets.* permite tickets.read, tickets.write, etc)
  const [resource, action] = permission.split('.');
  return this.permissions.includes(`${resource}.*`) || this.permissions.includes('*');
};

/**
 * Adiciona permissão
 */
Role.prototype.addPermission = async function(permission) {
  if (this.type === 'system') {
    throw new Error('Não é possível modificar papéis do sistema');
  }
  
  const permissions = this.permissions || [];
  if (!permissions.includes(permission)) {
    permissions.push(permission);
    await this.update({ permissions });
  }
};

/**
 * Remove permissão
 */
Role.prototype.removePermission = async function(permission) {
  if (this.type === 'system') {
    throw new Error('Não é possível modificar papéis do sistema');
  }
  
  const permissions = (this.permissions || []).filter(p => p !== permission);
  await this.update({ permissions });
};

/**
 * Busca permissões completas (incluindo herdadas)
 */
Role.prototype.getAllPermissions = async function() {
  let allPermissions = [...(this.permissions || [])];
  
  // Se herda de outro papel, buscar permissões do pai
  if (this.inheritsFrom) {
    const parentRole = await Role.findByPk(this.inheritsFrom);
    if (parentRole) {
      const parentPermissions = await parentRole.getAllPermissions();
      allPermissions = [...new Set([...allPermissions, ...parentPermissions])];
    }
  }
  
  return allPermissions;
};

/**
 * Inicializa papéis padrão
 */
Role.initializeDefaults = async function() {
  const defaults = [
    {
      name: 'admin',
      displayName: 'Administrador',
      description: 'Acesso total ao sistema',
      permissions: ['*'],
      level: 100,
      type: 'system',
      isActive: true
    },
    {
      name: 'supervisor',
      displayName: 'Supervisor',
      description: 'Supervisão de atendentes e acesso a relatórios',
      permissions: [
        'tickets.*',
        'contacts.*',
        'analytics.*',
        'reports.*',
        'agents.view',
        'queues.view',
        'tags.*',
        'quick-replies.*'
      ],
      level: 50,
      type: 'system',
      isActive: true
    },
    {
      name: 'agent',
      displayName: 'Atendente',
      description: 'Atendimento básico de tickets',
      permissions: [
        'tickets.read',
        'tickets.write',
        'tickets.update',
        'contacts.read',
        'contacts.write',
        'messages.send',
        'messages.read',
        'tags.read',
        'quick-replies.read',
        'quick-replies.use'
      ],
      level: 10,
      type: 'system',
      isActive: true,
      isDefault: true
    },
    {
      name: 'viewer',
      displayName: 'Visualizador',
      description: 'Apenas visualização, sem edição',
      permissions: [
        'tickets.read',
        'contacts.read',
        'analytics.view',
        'reports.view'
      ],
      level: 5,
      type: 'system',
      isActive: true
    }
  ];
  
  for (const def of defaults) {
    await Role.findOrCreate({
      where: { name: def.name },
      defaults: def
    });
  }
  
  console.log('✅ Papéis padrão inicializados');
};

module.exports = Role;


