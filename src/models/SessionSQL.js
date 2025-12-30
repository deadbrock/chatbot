const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  userName: {
    type: DataTypes.STRING
  },
  userPhone: {
    type: DataTypes.STRING
  },
  welcomed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  currentDepartment: {
    type: DataTypes.STRING
  },
  currentFlow: {
    type: DataTypes.STRING
  },
  awaitingInput: {
    type: DataTypes.STRING
  },
  lastInteraction: {
    type: DataTypes.DATE
  },
  interactionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
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
Session.prototype.updateInteraction = async function() {
  this.lastInteraction = new Date();
  this.interactionCount += 1;
  return await this.save();
};

Session.prototype.setFlow = async function(flow) {
  this.currentFlow = flow;
  return await this.save();
};

Session.prototype.clearFlow = async function() {
  this.currentFlow = null;
  this.awaitingInput = null;
  return await this.save();
};

// Métodos estáticos
Session.getActiveSession = async function(userId) {
  return await this.findOne({
    where: {
      userId,
      active: true
    }
  });
};

Session.getActiveSessions = async function() {
  return await this.findAll({
    where: {
      active: true
    },
    order: [['updatedAt', 'DESC']]
  });
};

module.exports = Session;

