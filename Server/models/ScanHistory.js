const mongoose = require('mongoose');

const scanHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['file', 'url'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  displayName: {
    type: String,
    required: true
  },
  verdict: String,
  dataId: String,
  sha1: String,
  sandboxId: String,
  address: String,
  sources: [{
    provider: String,
    assessment: String,
    category: String,
    status: String,
    update_time: String
  }]
});

module.exports = mongoose.model('ScanHistory', scanHistorySchema); 