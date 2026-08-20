const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Channel = require('../models/Channel');
const Notification = require('../models/Notification');

// GET /api/assignments
exports.getAssignments = async (req, res, next) => {
  try {
    const { channelId, status } = req.query;
    const query = {};

    if (req.user.role === 'mentor') {
      const mentorChannels = await Channel.find({
        $or: [{ mentor: req.user._id }, { members: req.user._id }]
      }).select('_id');
      const channelIds = mentorChannels.map(c => c._id);

      if (channelId) {
        if (!channelIds.some(id => id.toString() === channelId)) {
          return res.json({ success: true, data: [] });
        }
        query.channelId = channelId;
      } else {
        query.channelId = { $in: channelIds };
      }
      if (status === 'published') query.published = true;
    } else {
      // Students ONLY see published assignments for channels they have joined
      const userChannels = await Channel.find({ members: req.user._id }).select('_id');
      const userChannelIds = userChannels.map(c => c._id);

      if (userChannelIds.length === 0) {
        return res.json({ success: true, data: [] });
      }

      if (channelId) {
        if (!userChannelIds.some(id => id.toString() === channelId)) {
          return res.json({ success: true, data: [] });
        }
        query.channelId = channelId;
      } else {
        query.channelId = { $in: userChannelIds };
      }

      query.published = true;
    }

    const assignments = await Assignment.find(query)
      .populate('mentor', 'name avatar')
      .populate('channelId', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: assignments });
  } catch (error) {
    next(error);
  }
};

// GET /api/assignments/:id
exports.getAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('mentor', 'name avatar')
      .populate('channelId', 'name members mentor');

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    const channel = assignment.channelId;
    if (channel) {
      const isMentor = channel.mentor?.toString() === req.user._id.toString() || assignment.mentor?.toString() === req.user._id.toString();
      const isMember = channel.members?.some(m => m.toString() === req.user._id.toString());
      if (!isMentor && !isMember) {
        return res.status(403).json({ success: false, message: 'You are not a member of this channel.' });
      }
    }

    // Check if user has submitted
    const submission = await Submission.findOne({
      assignmentId: assignment._id,
      studentId: req.user._id
    });

    res.json({
      success: true,
      data: {
        assignment,
        submission: submission || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/assignments
exports.createAssignment = async (req, res, next) => {
  try {
    const { title, description, instructions, channelId, dueDate, maxPoints, published, allowResubmission } = req.body;

    // Verify mentor owns the channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }
    if (channel.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the channel mentor can create assignments.' });
    }

    const assignment = await Assignment.create({
      title,
      description,
      instructions,
      channelId,
      mentor: req.user._id,
      dueDate,
      maxPoints: maxPoints || 100,
      published: published || false,
      allowResubmission: allowResubmission || false
    });

    // Notify channel members if published
    if (assignment.published) {
      const memberIds = channel.members.filter(m => m.toString() !== req.user._id.toString());
      const notifications = memberIds.map(userId => ({
        userId,
        type: 'assignment_published',
        title: 'New Assignment',
        message: `New assignment "${title}" in ${channel.name}`,
        relatedEntity: { type: 'assignment', id: assignment._id }
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        const io = req.app.get('io');
        if (io) {
          memberIds.forEach(userId => {
            io.to(`user:${userId}`).emit('notification', {
              type: 'assignment_published',
              title: 'New Assignment',
              message: `New assignment "${title}" in ${channel.name}`
            });
          });
        }
      }
    }

    await assignment.populate('mentor', 'name avatar');
    await assignment.populate('channelId', 'name');

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
};

// PUT /api/assignments/:id
exports.updateAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    if (assignment.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the mentor can update this assignment.' });
    }

    const { title, description, instructions, dueDate, maxPoints, published, allowResubmission } = req.body;
    if (title) assignment.title = title;
    if (description !== undefined) assignment.description = description;
    if (instructions !== undefined) assignment.instructions = instructions;
    if (dueDate) assignment.dueDate = dueDate;
    if (maxPoints !== undefined) assignment.maxPoints = maxPoints;
    if (published !== undefined) assignment.published = published;
    if (allowResubmission !== undefined) assignment.allowResubmission = allowResubmission;

    await assignment.save();
    await assignment.populate('mentor', 'name avatar');

    res.json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
};

// POST /api/assignments/:id/submit
exports.submitAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    if (!assignment.published) {
      return res.status(400).json({ success: false, message: 'This assignment is not yet published.' });
    }

    // Verify student has joined the channel
    const channel = await Channel.findById(assignment.channelId);
    if (!channel || !channel.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'You must join this mentor channel to submit assignments.' });
    }

    // Check for existing submission
    const existingSubmission = await Submission.findOne({
      assignmentId: assignment._id,
      studentId: req.user._id
    });

    if (existingSubmission && !assignment.allowResubmission) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted this assignment. Resubmission is not allowed.'
      });
    }

    const { content, url } = req.body;
    const isLate = new Date() > new Date(assignment.dueDate);

    if (existingSubmission && assignment.allowResubmission) {
      // Update existing submission
      existingSubmission.content = content || existingSubmission.content;
      existingSubmission.url = url || existingSubmission.url;
      existingSubmission.submittedAt = new Date();
      existingSubmission.isLate = isLate;
      existingSubmission.status = 'submitted';
      existingSubmission.score = null;
      existingSubmission.feedback = '';

      if (req.file) {
        existingSubmission.filePath = `/uploads/assignments/${req.file.filename}`;
        existingSubmission.fileName = req.file.originalname;
      }

      await existingSubmission.save();
      return res.json({ success: true, data: existingSubmission });
    }

    // Create new submission
    const submissionData = {
      assignmentId: assignment._id,
      studentId: req.user._id,
      content: content || '',
      url: url || '',
      isLate
    };

    if (req.file) {
      submissionData.filePath = `/uploads/assignments/${req.file.filename}`;
      submissionData.fileName = req.file.originalname;
    }

    const submission = await Submission.create(submissionData);

    // Check early bird badge
    if (!isLate) {
      const { checkAndAwardBadges } = require('../utils/badgeChecker');
      const Badge = require('../models/Badge');
      try {
        await Badge.create({
          userId: req.user._id,
          badgeType: 'early_bird',
          name: 'Early Bird',
          description: 'Submit an assignment before its deadline',
          icon: '🐦'
        });
      } catch (err) {
        // Ignore duplicate badge
      }
    }

    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    // Handle duplicate key error (concurrent submission)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted this assignment.'
      });
    }
    next(error);
  }
};

// GET /api/assignments/:id/submissions
exports.getSubmissions = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    // Only mentor can see all submissions
    if (assignment.mentor.toString() !== req.user._id.toString()) {
      // Student can see their own submission
      const submission = await Submission.findOne({
        assignmentId: assignment._id,
        studentId: req.user._id
      }).populate('studentId', 'name avatar');

      return res.json({ success: true, data: submission ? [submission] : [] });
    }

    const submissions = await Submission.find({ assignmentId: assignment._id })
      .populate('studentId', 'name avatar email')
      .sort({ submittedAt: -1 });

    res.json({ success: true, data: submissions });
  } catch (error) {
    next(error);
  }
};

// PUT /api/assignments/:assignmentId/submissions/:submissionId/grade
exports.gradeSubmission = async (req, res, next) => {
  try {
    const { score, feedback } = req.body;

    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    if (assignment.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the mentor can grade submissions.' });
    }

    const submission = await Submission.findById(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    submission.score = score;
    submission.feedback = feedback || '';
    submission.status = 'graded';
    submission.gradedAt = new Date();
    submission.gradedBy = req.user._id;
    await submission.save();

    // Notify student
    await Notification.create({
      userId: submission.studentId,
      type: 'assignment_graded',
      title: 'Assignment Graded',
      message: `Your submission for "${assignment.title}" has been graded: ${score}/${assignment.maxPoints}`,
      relatedEntity: { type: 'assignment', id: assignment._id }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${submission.studentId}`).emit('notification', {
        type: 'assignment_graded',
        title: 'Assignment Graded',
        message: `Your submission for "${assignment.title}" has been graded: ${score}/${assignment.maxPoints}`
      });
    }

    await submission.populate('studentId', 'name avatar');
    res.json({ success: true, data: submission });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/assignments/:id
exports.deleteAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    if (assignment.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the mentor can delete this assignment.' });
    }

    await Assignment.findByIdAndDelete(req.params.id);
    await Submission.deleteMany({ assignmentId: req.params.id });

    res.json({ success: true, message: 'Assignment deleted.' });
  } catch (error) {
    next(error);
  }
};
