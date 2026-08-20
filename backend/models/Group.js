const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'moderator', 'member'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [memberSchema],
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  privacy: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  maxMembers: {
    type: Number,
    default: 50,
    min: 2,
    max: 500
  }
}, {
  timestamps: true
});

// Indexes
groupSchema.index({ name: 'text', description: 'text' });
groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ creator: 1 });
groupSchema.index({ category: 1 });

module.exports = mongoose.model('Group', groupSchema);
