const Session = require('../models/Session');
const Task = require('../models/Task');
const User = require('../models/User');

// GET /api/analytics/study-stats
exports.getStudyStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { localDate } = req.query;
    const today = localDate || new Date().toISOString().split('T')[0];

    // Calculate date ranges
    const todayDate = new Date(today + 'T00:00:00');
    const weekAgo = new Date(todayDate);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(todayDate);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const monthAgoStr = monthAgo.toISOString().split('T')[0];

    // Aggregation for different time ranges
    const [todayStats, weekStats, monthStats, allTimeStats] = await Promise.all([
      Session.aggregate([
        { $match: { userId, localDate: today, completed: true } },
        { $group: { _id: null, total: { $sum: '$actualDuration' }, count: { $sum: 1 } } }
      ]),
      Session.aggregate([
        { $match: { userId, localDate: { $gte: weekAgoStr, $lte: today }, completed: true } },
        { $group: { _id: null, total: { $sum: '$actualDuration' }, count: { $sum: 1 } } }
      ]),
      Session.aggregate([
        { $match: { userId, localDate: { $gte: monthAgoStr, $lte: today }, completed: true } },
        { $group: { _id: null, total: { $sum: '$actualDuration' }, count: { $sum: 1 } } }
      ]),
      Session.aggregate([
        { $match: { userId, completed: true } },
        { $group: { _id: null, total: { $sum: '$actualDuration' }, count: { $sum: 1 }, avg: { $avg: '$actualDuration' } } }
      ])
    ]);

    const user = await User.findById(userId);

    res.json({
      success: true,
      data: {
        today: { minutes: todayStats[0]?.total || 0, sessions: todayStats[0]?.count || 0 },
        week: { minutes: weekStats[0]?.total || 0, sessions: weekStats[0]?.count || 0 },
        month: { minutes: monthStats[0]?.total || 0, sessions: monthStats[0]?.count || 0 },
        allTime: {
          minutes: allTimeStats[0]?.total || 0,
          sessions: allTimeStats[0]?.count || 0,
          avgDuration: Math.round(allTimeStats[0]?.avg || 0)
        },
        streak: {
          current: user?.currentStreak || 0,
          longest: user?.longestStreak || 0,
          lastActive: user?.lastActiveDate || null
        },
        weeklyGoal: user?.preferences?.weeklyGoal || 600,
        dailyGoal: user?.preferences?.dailyGoal || 120
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/subject-breakdown
exports.getSubjectBreakdown = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const breakdown = await Session.aggregate([
      { $match: { userId, completed: true } },
      {
        $group: {
          _id: '$subject',
          totalMinutes: { $sum: '$actualDuration' },
          sessionCount: { $sum: 1 }
        }
      },
      { $sort: { totalMinutes: -1 } }
    ]);

    res.json({
      success: true,
      data: breakdown.map(b => ({
        subject: b._id,
        totalMinutes: b.totalMinutes,
        sessionCount: b.sessionCount
      }))
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/weekly-activity
exports.getWeeklyActivity = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { localDate } = req.query;
    const today = localDate || new Date().toISOString().split('T')[0];

    // Build array of last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today + 'T00:00:00');
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }

    const activity = await Session.aggregate([
      {
        $match: {
          userId,
          localDate: { $in: days },
          completed: true
        }
      },
      {
        $group: {
          _id: '$localDate',
          totalMinutes: { $sum: '$actualDuration' },
          sessionCount: { $sum: 1 }
        }
      }
    ]);

    const activityMap = {};
    activity.forEach(a => { activityMap[a._id] = a; });

    const result = days.map(day => ({
      date: day,
      dayName: new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
      totalMinutes: activityMap[day]?.totalMinutes || 0,
      sessionCount: activityMap[day]?.sessionCount || 0
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/heatmap
exports.getHeatmapData = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { localDate } = req.query;
    const today = localDate || new Date().toISOString().split('T')[0];

    const yearAgo = new Date(today + 'T00:00:00');
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoStr = yearAgo.toISOString().split('T')[0];

    const heatmap = await Session.aggregate([
      {
        $match: {
          userId,
          localDate: { $gte: yearAgoStr, $lte: today },
          completed: true
        }
      },
      {
        $group: {
          _id: '$localDate',
          totalMinutes: { $sum: '$actualDuration' },
          sessionCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: heatmap.map(h => ({
        date: h._id,
        totalMinutes: h.totalMinutes,
        sessionCount: h.sessionCount
      }))
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/task-stats
exports.getTaskStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [statusCounts, priorityCounts, total] = await Promise.all([
      Task.aggregate([
        { $match: { userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Task.aggregate([
        { $match: { userId } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Task.countDocuments({ userId })
    ]);

    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s._id] = s.count; });

    const priorityMap = {};
    priorityCounts.forEach(p => { priorityMap[p._id] = p.count; });

    res.json({
      success: true,
      data: {
        total,
        byStatus: statusMap,
        byPriority: priorityMap,
        completionRate: total > 0 ? Math.round(((statusMap.completed || 0) / total) * 100) : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/analytics/monthly-productivity
exports.getMonthlyProductivity = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { localDate } = req.query;
    const today = localDate || new Date().toISOString().split('T')[0];

    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today + 'T00:00:00');
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }

    const activity = await Session.aggregate([
      { $match: { userId, localDate: { $in: days }, completed: true } },
      {
        $group: {
          _id: '$localDate',
          totalMinutes: { $sum: '$actualDuration' },
          sessionCount: { $sum: 1 }
        }
      }
    ]);

    const activityMap = {};
    activity.forEach(a => { activityMap[a._id] = a; });

    const result = days.map(day => ({
      date: day,
      totalMinutes: activityMap[day]?.totalMinutes || 0,
      sessionCount: activityMap[day]?.sessionCount || 0
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
