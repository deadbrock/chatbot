const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  
  password: {
    type: String,
    required: true,
    select: false
  },
  
  role: {
    type: String,
    enum: ['admin', 'manager', 'agent', 'viewer'],
    default: 'agent'
  },
  
  department: String,
  departmentId: String,
  
  phone: String,
  
  avatar: String,
  
  status: {
    type: String,
    enum: ['online', 'offline', 'busy', 'away'],
    default: 'offline'
  },
  
  permissions: [{
    type: String
  }],
  
  stats: {
    ticketsHandled: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    }
  },
  
  settings: {
    notifications: {
      type: Boolean,
      default: true
    },
    autoAssign: {
      type: Boolean,
      default: true
    },
    maxConcurrentChats: {
      type: Number,
      default: 5
    }
  },
  
  lastLogin: Date,
  
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices
userSchema.index({ email: 1, active: 1 });
userSchema.index({ role: 1, active: 1 });
userSchema.index({ department: 1, status: 1 });

// Middleware - Hash password antes de salvar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Métodos
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

userSchema.methods.updateStatus = function(status) {
  this.status = status;
  return this.save();
};

userSchema.methods.incrementTicketsHandled = function() {
  this.stats.ticketsHandled += 1;
  return this.save();
};

userSchema.methods.updateAverageRating = function(newRating) {
  const currentTotal = this.stats.averageRating * this.stats.ticketsHandled;
  const newTotal = currentTotal + newRating;
  this.stats.averageRating = newTotal / (this.stats.ticketsHandled + 1);
  return this.save();
};

// Statics
userSchema.statics.getAvailableAgents = function(departmentId = null) {
  const query = {
    active: true,
    status: { $in: ['online', 'away'] },
    role: { $in: ['agent', 'manager'] }
  };
  
  if (departmentId) {
    query.departmentId = departmentId;
  }
  
  return this.find(query).sort({ 'stats.ticketsHandled': 1 });
};

userSchema.statics.getOnlineAgents = function() {
  return this.find({
    active: true,
    status: 'online',
    role: { $in: ['agent', 'manager'] }
  });
};

userSchema.statics.getByEmail = function(email) {
  return this.findOne({ email, active: true }).select('+password');
};

module.exports = mongoose.model('User', userSchema);

