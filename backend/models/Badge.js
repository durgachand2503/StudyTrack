const mongoose = require('mongoose');

const BADGE_TYPES = [
  'first_session',
  'streak_3',
  'streak_7',
  'streak_30',
  'hours_10',
  'hours_50',
  'hours_100',
  'tasks_50',
  'early_bird',
  'night_owl',
  'subject_master',
  'group_creator',
  'mentor_star',
  'perfect_week'
];

const BADGE_DEFINITIONS = {
  first_session: {
    name: 'First Session',
    description: 'Complete your first study session',
    icon: '🎯'
  },
  streak_3: {
    name: 'Streak Starter',
    description: 'Maintain a 3-day study streak',
    icon: '🔥'
  },
  streak_7: {
    name: 'Week Warrior',
    description: 'Maintain a 7-day study streak',
    icon: '⚡'
  },
  streak_30: {
    name: 'Month Master',
    description: 'Maintain a 30-day study streak',
    icon: '👑'
  },
  hours_10: {
    name: '10 Hours',
    description: 'Study for a total of 10 hours',
    icon: '📚'
  },
  hours_50: {
    name: '50 Hours',
    description: 'Study for a total of 50 hours',
    icon: '🏆'
  },
  hours_100: {
    name: '100 Hours',
    description: 'Study for a total of 100 hours',
    icon: '💎'
  },
  tasks_50: {
    name: 'Task Master',
    description: 'Complete 50 tasks',
    icon: '✅'
  },
  early_bird: {
    name: 'Early Bird',
    description: 'Submit an assignment before its deadline',
    icon: '🐦'
  },
  night_owl: {
    name: 'Night Owl',
    description: 'Complete a study session after 10 PM',
    icon: '🦉'
  },
  subject_master: {
    name: 'Subject Master',
    description: 'Study 5 different subjects',
    icon: '🎓'
  },
  group_creator: {
    name: 'Community Builder',
    description: 'Create your first study group',
    icon: '👥'
  },
  mentor_star: {
    name: 'Mentor Star',
    description: 'Create your first mentor channel',
    icon: '⭐'
  },
  perfect_week: {
    name: 'Perfect Week',
    description: 'Meet your daily study goal every day for a week',
    icon: '🌟'
  }
};

const badgeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  badgeType: {
    type: String,
    enum: BADGE_TYPES,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  earnedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Prevent duplicate badges per user
badgeSchema.index({ userId: 1, badgeType: 1 }, { unique: true });

module.exports = mongoose.model('Badge', badgeSchema);
module.exports.BADGE_TYPES = BADGE_TYPES;
module.exports.BADGE_DEFINITIONS = BADGE_DEFINITIONS;
