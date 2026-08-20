const User = require('../models/User');
const Badge = require('../models/Badge');
const { BADGE_DEFINITIONS } = require('../models/Badge');
const Session = require('../models/Session');
const Task = require('../models/Task');
const Notification = require('../models/Notification');

/**
 * Checks all badge criteria for a user and awards any newly earned badges.
 * Called after: session completion, task completion, streak update, assignment submission.
 * Returns array of newly earned badges.
 */
const checkAndAwardBadges = async (userId, io) => {
  const newBadges = [];

  try {
    const user = await User.findById(userId);
    if (!user) return newBadges;

    // Get existing badge types for this user
    const existingBadges = await Badge.find({ userId }).select('badgeType');
    const earnedTypes = new Set(existingBadges.map(b => b.badgeType));

    // Helper to award a badge if not already earned
    const awardBadge = async (badgeType) => {
      if (earnedTypes.has(badgeType)) return;
      const def = BADGE_DEFINITIONS[badgeType];
      if (!def) return;

      try {
        const badge = await Badge.create({
          userId,
          badgeType,
          name: def.name,
          description: def.description,
          icon: def.icon
        });
        newBadges.push(badge);

        // Create notification
        await Notification.create({
          userId,
          type: 'badge_earned',
          title: 'Badge Earned!',
          message: `You earned the "${def.name}" badge: ${def.description}`,
          relatedEntity: { type: 'badge', id: badge._id }
        });

        // Emit real-time notification if socket available
        if (io) {
          io.to(`user:${userId}`).emit('notification', {
            type: 'badge_earned',
            title: 'Badge Earned!',
            message: `You earned the "${def.name}" badge! ${def.icon}`,
            badge: { name: def.name, icon: def.icon, description: def.description }
          });
        }
      } catch (err) {
        // Ignore duplicate key errors (race condition protection)
        if (err.code !== 11000) {
          console.error(`Error awarding badge ${badgeType}:`, err);
        }
      }
    };

    // Get stats for badge evaluation
    const totalSessions = await Session.countDocuments({ userId, completed: true });
    const totalStudyMinutes = user.totalStudyTime || 0;
    const totalStudyHours = totalStudyMinutes / 60;
    const completedTasks = await Task.countDocuments({ userId, status: 'completed' });
    const uniqueSubjects = await Session.distinct('subject', { userId, completed: true });

    // === Check each badge ===

    // First Session
    if (totalSessions >= 1) {
      await awardBadge('first_session');
    }

    // Streak badges
    if (user.currentStreak >= 3) await awardBadge('streak_3');
    if (user.currentStreak >= 7) await awardBadge('streak_7');
    if (user.currentStreak >= 30) await awardBadge('streak_30');

    // Study hours badges
    if (totalStudyHours >= 10) await awardBadge('hours_10');
    if (totalStudyHours >= 50) await awardBadge('hours_50');
    if (totalStudyHours >= 100) await awardBadge('hours_100');

    // Task Master
    if (completedTasks >= 50) await awardBadge('tasks_50');

    // Subject Master (5 different subjects)
    if (uniqueSubjects.length >= 5) await awardBadge('subject_master');

    // Night Owl (checked when a session ends after 10 PM)
    const latestSession = await Session.findOne({ userId, completed: true })
      .sort({ endTime: -1 })
      .limit(1);
    if (latestSession) {
      const endHour = new Date(latestSession.endTime).getHours();
      if (endHour >= 22 || endHour < 5) {
        await awardBadge('night_owl');
      }
    }

  } catch (error) {
    console.error('Error in badge checking:', error);
  }

  return newBadges;
};

module.exports = { checkAndAwardBadges };
