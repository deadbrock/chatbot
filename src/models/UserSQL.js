const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'agent', 'viewer'),
    defaultValue: 'agent'
  },
  department: {
    type: DataTypes.STRING
  },
  departmentId: {
    type: DataTypes.STRING
  },
  phone: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'busy', 'away'),
    defaultValue: 'offline'
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE
  },
  stats: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('stats');
      return rawValue ? JSON.parse(rawValue) : {
        ticketsHandled: 0,
        averageRating: 0
      };
    },
    set(value) {
      this.setDataValue('stats', JSON.stringify(value));
    }
  }
});

// Hook para hash de senha antes de salvar
User.beforeCreate(async (user) => {
  if (user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

// Métodos
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.prototype.updateStatus = async function(status) {
  this.status = status;
  return await this.save();
};

// Métodos estáticos
User.getByEmail = async function(email) {
  return await this.findOne({
    where: {
      email,
      active: true
    }
  });
};

User.getAvailableAgents = async function(departmentId = null) {
  const where = {
    active: true,
    status: ['online', 'away'],
    role: ['agent', 'manager']
  };
  
  if (departmentId) {
    where.departmentId = departmentId;
  }
  
  return await this.findAll({ where });
};

module.exports = User;

