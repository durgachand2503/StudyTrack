const User = require('../models/User');

// GET /api/users/me
exports.getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/me
exports.updateMe = async (req, res, next) => {
  try {
    const allowedFields = [
      'name', 'subjects', 'studyGoals', 'targetExams',
      'preferences', 'theme'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Handle avatar upload
    if (req.file) {
      updates.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId: req.user._id })
    ]);

    const unread = await Notification.countDocuments({
      userId: req.user._id,
      read: false
    });

    res.json({
      success: true,
      data: {
        notifications,
        total,
        unread,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/notifications/:id/read
exports.markNotificationRead = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/notifications/read-all
exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/notifications/:id
exports.deleteNotification = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    const notif = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    const unread = await Notification.countDocuments({
      userId: req.user._id,
      read: false
    });
    res.json({ success: true, message: 'Notification deleted.', data: { unread } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/notifications
exports.clearAllNotifications = async (req, res, next) => {
  try {
    const Notification = require('../models/Notification');
    await Notification.deleteMany({ userId: req.user._id });
    res.json({ success: true, message: 'All notifications cleared.', data: { unread: 0 } });
  } catch (error) {
    next(error);
  }
};
