const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false
  },
  avatar: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['student', 'mentor'],
    default: 'student'
  },
  subjects: [{
    type: String,
    trim: true
  }],
  studyGoals: [{
    title: { type: String, trim: true },
    target: { type: String, trim: true },
    deadline: Date
  }],
  targetExams: [{
    name: { type: String, trim: true },
    date: Date,
    category: { type: String, trim: true }
  }],
  preferences: {
    dailyGoal: { type: Number, default: 120 }, // minutes
    weeklyGoal: { type: Number, default: 600 }, // minutes
    pomodoroLength: { type: Number, default: 25 }, // minutes
    breakLength: { type: Number, default: 5 }, // minutes
    notifications: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true }
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'system'],
    default: 'system'
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastActiveDate: {
    type: String, // Store as YYYY-MM-DD to avoid timezone issues
    default: null
  },
  totalStudyTime: {
    type: Number,
    default: 0 // in minutes
  },
  refreshToken: {
    type: String,
    select: false
  }
}, {
  timestamps: true
});

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// toJSON transform - remove sensitive fields
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
