const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
  type: { 
    type: String, 
    enum: ['video', 'article', 'document', 'link', 'other'],
    default: 'video'
  },
  description: { type: String, trim: true, default: '' },
  addedAt: { type: Date, default: Date.now }
}, { _id: true });

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Channel name is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  mentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  resources: [resourceSchema]
}, {
  timestamps: true
});

channelSchema.index({ mentor: 1 });
channelSchema.index({ members: 1 });
channelSchema.index({ subject: 1 });

module.exports = mongoose.model('Channel', channelSchema);
