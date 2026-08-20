const Task = require('../models/Task');

// GET /api/tasks
exports.getTasks = async (req, res, next) => {
  try {
    const { status, priority, subject, search, sortBy, order, page, limit: lim } = req.query;
    const query = { userId: req.user._id };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (subject) query.subject = subject;
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const page_ = parseInt(page) || 1;
    const limit_ = Math.min(parseInt(lim) || 20, 100);
    const skip = (page_ - 1) * limit_;

    const sortField = sortBy || 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit_),
      Task.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        tasks,
        total,
        page: page_,
        pages: Math.ceil(total / limit_)
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tasks/:id
exports.getTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

// POST /api/tasks
exports.createTask = async (req, res, next) => {
  try {
    const { title, description, subject, category, priority, dueDate, estimatedDuration } = req.body;

    const task = await Task.create({
      userId: req.user._id,
      title,
      description,
      subject,
      category,
      priority,
      dueDate: dueDate || null,
      estimatedDuration: estimatedDuration || null
    });

    // Add subject to user's subjects if not present
    if (subject && !req.user.subjects.includes(subject)) {
      await require('../models/User').findByIdAndUpdate(
        req.user._id,
        { $addToSet: { subjects: subject } }
      );
    }

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

// PUT /api/tasks/:id
exports.updateTask = async (req, res, next) => {
  try {
    const allowedFields = [
      'title', 'description', 'subject', 'category', 'priority',
      'status', 'dueDate', 'estimatedDuration', 'actualStudyTime'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Handle status transitions
    if (updates.status === 'completed' && !updates.completedDate) {
      updates.completedDate = new Date();
    }
    if (updates.status && updates.status !== 'completed') {
      updates.completedDate = null;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    // Check badges after task completion
    if (updates.status === 'completed') {
      const { checkAndAwardBadges } = require('../utils/badgeChecker');
      const io = req.app.get('io');
      await checkAndAwardBadges(req.user._id, io);
    }

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/tasks/:id
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    res.json({ success: true, message: 'Task deleted.' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/tasks/:id/complete
exports.completeTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status: 'completed', completedDate: new Date() } },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const { checkAndAwardBadges } = require('../utils/badgeChecker');
    const io = req.app.get('io');
    await checkAndAwardBadges(req.user._id, io);

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

// PUT /api/tasks/:id/reopen
exports.reopenTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status: 'pending', completedDate: null } },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};
