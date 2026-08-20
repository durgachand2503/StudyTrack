const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'assignment_published',
      'assignment_deadline',
      'assignment_graded',
      'new_message',
      'group_message',
      'channel_message',
      'badge_earned',
      'task_due',
      'streak_milestone',
      'group_invite',
      'group_join',
      'group_leave',
      'channel_join',
      'channel_leave',
      'channel_update',
      'system'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  relatedEntity: {
    type: { type: String, trim: true },
    id: { type: mongoose.Schema.Types.ObjectId }
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
