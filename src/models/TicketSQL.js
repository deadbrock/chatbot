const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  protocol: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  userName: {
    type: DataTypes.STRING
  },
  userPhone: {
    type: DataTypes.STRING
  },
  department: {
    type: DataTypes.STRING
  },
  departmentId: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('open', 'waiting_human', 'in_progress', 'resolved', 'closed'),
    defaultValue: 'open'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  subject: {
    type: DataTypes.STRING
  },
  description: {
    type: DataTypes.TEXT
  },
  messages: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('messages');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('messages', JSON.stringify(value));
    }
  },
  attachments: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('attachments');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('attachments', JSON.stringify(value));
    }
  },
  rating: {
    type: DataTypes.INTEGER,
    validate: {
      min: 1,
      max: 5
    }
  },
  ratedAt: {
    type: DataTypes.DATE
  },
  feedback: {
    type: DataTypes.TEXT
  },
  assignedTo: {
    type: DataTypes.INTEGER
  },
  assignedAt: {
    type: DataTypes.DATE
  },
  resolvedAt: {
    type: DataTypes.DATE
  },
  closedAt: {
    type: DataTypes.DATE
  },
  metadata: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('metadata');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('metadata', JSON.stringify(value));
    }
  }
});

// Métodos
Ticket.prototype.addMessage = async function(from, message, type = 'text', isBot = false) {
  const messages = this.messages || [];
  messages.push({
    from,
    message,
    type,
    isBot,
    timestamp: new Date()
  });
  this.messages = messages;
  return await this.save();
};

Ticket.prototype.closeTicket = async function(feedback = null) {
  this.status = 'closed';
  this.closedAt = new Date();
  if (feedback) {
    this.feedback = feedback;
  }
  return await this.save();
};

// Métodos estáticos
Ticket.generateProtocol = async function() {
  const prefix = 'TKT';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

Ticket.getOpenTickets = async function() {
  return await this.findAll({
    where: {
      status: ['open', 'waiting_human', 'in_progress']
    },
    order: [['createdAt', 'DESC']]
  });
};

module.exports = Ticket;

