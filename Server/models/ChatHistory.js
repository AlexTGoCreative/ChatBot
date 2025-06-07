const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messages: [{
    type: {
      type: String,
      enum: ['user', 'bot'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  scanData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  sandboxData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  urlData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

chatHistorySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

module.exports = ChatHistory; 