const Session = require('../models/Session');
const User = require('../models/User');
const Task = require('../models/Task');
const { checkAndAwardBadges } = require('../utils/badgeChecker');

// POST /api/sessions
exports.createSession = async (req, res, next) => {
  try {
    const { subject, taskId, startTime, endTime, duration, actualDuration, status, completed, notes, localDate } = req.body;

    const session = await Session.create({
      userId: req.user._id,
      subject,
      taskId: taskId || null,
      startTime,
      endTime,
      duration,
      actualDuration,
      status: status || 'completed',
      completed: completed !== false,
      notes: notes || '',
      localDate: localDate || new Date().toISOString().split('T')[0]
    });

    // Only update stats for completed sessions
    if (session.completed) {
      // Update user's total study time
      const user = await User.findById(req.user._id);

      user.totalStudyTime = (user.totalStudyTime || 0) + actualDuration;

      // Update streak using localDate (timezone-safe)
      const sessionDate = session.localDate;
      const lastActive = user.lastActiveDate;

      if (lastActive !== sessionDate) {
        if (lastActive) {
          // Check if the session date is exactly one day after lastActiveDate
          const last = new Date(lastActive + 'T00:00:00');
          const current = new Date(sessionDate + 'T00:00:00');
          const diffDays = Math.round((current - last) / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            user.currentStreak += 1;
          } else if (diffDays > 1) {
            user.currentStreak = 1; // Reset streak
          }
          // diffDays === 0 means same day, no streak change
          // diffDays < 0 means past date session, no change
        } else {
          user.currentStreak = 1; // First ever session
        }

        user.lastActiveDate = sessionDate;
        if (user.currentStreak > user.longestStreak) {
          user.longestStreak = user.currentStreak;
        }
      }

      await user.save();

      // Update task's actual study time if linked
      if (taskId) {
        await Task.findByIdAndUpdate(taskId, {
          $inc: { actualStudyTime: actualDuration }
        });
      }

      // Add subject to user's subjects
      if (subject) {
        await User.findByIdAndUpdate(req.user._id, {
          $addToSet: { subjects: subject }
        });
      }

      // Check badges
      const io = req.app.get('io');
      await checkAndAwardBadges(req.user._id, io);
    }

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

// GET /api/sessions
exports.getSessions = async (req, res, next) => {
  try {
    const { subject, from, to, startDate, endDate, page, limit: lim } = req.query;
    const query = { userId: req.user._id, completed: true };

    const parseDate = (val) => {
      if (!val) return null;
      // Handle space replacement for '+' in timezone offset strings like +05:30
      const clean = typeof val === 'string' && val.includes(' ') ? val.replace(' ', '+') : val;
      const d = new Date(clean);
      return isNaN(d.getTime()) ? null : d;
    };

    const fromParsed = parseDate(from || startDate);
    const toParsed = parseDate(to || endDate);

    if (subject) query.subject = subject;
    if (fromParsed || toParsed) {
      query.startTime = {};
      if (fromParsed) query.startTime.$gte = fromParsed;
      if (toParsed) query.startTime.$lte = toParsed;
    }

    const page_ = parseInt(page) || 1;
    const limit_ = Math.min(parseInt(lim) || 20, 100);
    const skip = (page_ - 1) * limit_;

    const [sessions, total] = await Promise.all([
      Session.find(query)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit_)
        .populate('taskId', 'title'),
      Session.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        total,
        page: page_,
        pages: Math.ceil(total / limit_)
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/sessions/today
exports.getTodaySessions = async (req, res, next) => {
  try {
    const { localDate } = req.query;
    const today = localDate || new Date().toISOString().split('T')[0];

    const sessions = await Session.find({
      userId: req.user._id,
      localDate: today,
      completed: true
    }).populate('taskId', 'title');

    const totalMinutes = sessions.reduce((sum, s) => sum + s.actualDuration, 0);

    res.json({
      success: true,
      data: {
        sessions,
        totalMinutes,
        sessionCount: sessions.length
      }
    });
  } catch (error) {
    next(error);
  }
};
