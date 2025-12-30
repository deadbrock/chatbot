const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  protocol: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: String,
  userPhone: String,
  
  department: String,
  departmentId: String,
  
  status: {
    type: String,
    enum: ['open', 'waiting_human', 'in_progress', 'resolved', 'closed'],
    default: 'open',
    index: true
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  subject: String,
  description: String,
  
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  messages: [{
    from: String,
    message: String,
    type: {
      type: String,
      enum: ['text', 'audio', 'image', 'document', 'system']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    isBot: Boolean
  }],
  
  attachments: [{
    filename: String,
    mimetype: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  interactions: [{
    type: String,
    data: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  ratedAt: Date,
  feedback: String,
  
  tags: [String],
  
  requestedHumanAt: Date,
  assignedAt: Date,
  resolvedAt: Date,
  closedAt: Date,
  
  metadata: mongoose.Schema.Types.Mixed,
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices compostos
ticketSchema.index({ userId: 1, status: 1 });
ticketSchema.index({ department: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });

// Middleware para atualizar updatedAt
ticketSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Métodos
ticketSchema.methods.addMessage = function(from, message, type = 'text', isBot = false) {
  this.messages.push({
    from,
    message,
    type,
    isBot,
    timestamp: new Date()
  });
  return this.save();
};

ticketSchema.methods.addInteraction = function(type, data) {
  this.interactions.push({
    type,
    data,
    timestamp: new Date()
  });
  return this.save();
};

ticketSchema.methods.close = function(feedback = null) {
  this.status = 'closed';
  this.closedAt = new Date();
  if (feedback) {
    this.feedback = feedback;
  }
  return this.save();
};

// Statics
ticketSchema.statics.generateProtocol = async function() {
  const prefix = 'TKT';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

ticketSchema.statics.getOpenTickets = function() {
  return this.find({ 
    status: { $in: ['open', 'waiting_human', 'in_progress'] } 
  }).sort({ createdAt: -1 });
};

ticketSchema.statics.getTicketsByDepartment = function(departmentId) {
  return this.find({ departmentId }).sort({ createdAt: -1 });
};

ticketSchema.statics.getTicketsByUser = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Ticket', ticketSchema);

