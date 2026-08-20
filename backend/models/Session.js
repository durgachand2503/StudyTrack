const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // planned duration in minutes
    required: true
  },
  actualDuration: {
    type: Number, // actual duration in minutes
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'abandoned', 'paused'],
    default: 'completed'
  },
  completed: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  // Store the local date string for timezone-safe streak/heatmap
  localDate: {
    type: String, // YYYY-MM-DD
    required: true
  }
}, {
  timestamps: true
});

// Indexes for analytics and heatmap queries
sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ userId: 1, subject: 1 });
sessionSchema.index({ userId: 1, localDate: 1 });
sessionSchema.index({ userId: 1, startTime: -1 });

module.exports = mongoose.model('Session', sessionSchema);
