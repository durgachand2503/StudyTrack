const Group = require('../models/Group');
const { checkAndAwardBadges } = require('../utils/badgeChecker');

// GET /api/groups
exports.getGroups = async (req, res, next) => {
  try {
    const { search, category, myGroups, page, limit: lim } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    if (myGroups === 'true') {
      query['members.userId'] = req.user._id;
    }

    const page_ = parseInt(page) || 1;
    const limit_ = Math.min(parseInt(lim) || 20, 50);
    const skip = (page_ - 1) * limit_;

    const [groups, total] = await Promise.all([
      Group.find(query)
        .populate('creator', 'name avatar')
        .populate('members.userId', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit_),
      Group.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: { groups, total, page: page_, pages: Math.ceil(total / limit_) }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/groups/:id
exports.getGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator', 'name avatar')
      .populate('members.userId', 'name avatar');

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    res.json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

// POST /api/groups
exports.createGroup = async (req, res, next) => {
  try {
    const { name, description, category, privacy, maxMembers } = req.body;

    const group = await Group.create({
      name,
      description,
      category,
      privacy,
      maxMembers,
      creator: req.user._id,
      members: [{
        userId: req.user._id,
        role: 'admin',
        joinedAt: new Date()
      }]
    });

    // Check badge for group creation
    const io = req.app.get('io');
    await checkAndAwardBadges(req.user._id, io);

    await group.populate('creator', 'name avatar');
    await group.populate('members.userId', 'name avatar');

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

// PUT /api/groups/:id
exports.updateGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Only admin can update
    const member = group.members.find(m => m.userId.toString() === req.user._id.toString());
    if (!member || member.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can update the group.' });
    }

    const { name, description, category, privacy, maxMembers } = req.body;
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (category) group.category = category;
    if (privacy) group.privacy = privacy;
    if (maxMembers) group.maxMembers = maxMembers;

    await group.save();
    await group.populate('creator', 'name avatar');
    await group.populate('members.userId', 'name avatar');

    res.json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

// POST /api/groups/:id/join
exports.joinGroup = async (req, res, next) => {
  try {
    const Message = require('../models/Message');
    const Notification = require('../models/Notification');
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Check if already a member
    const isMember = group.members.some(m => m.userId.toString() === req.user._id.toString());
    if (isMember) {
      return res.status(409).json({ success: false, message: 'You are already a member of this group.' });
    }

    // Check max members
    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({ success: false, message: 'Group is full.' });
    }

    group.members.push({
      userId: req.user._id,
      role: 'member',
      joinedAt: new Date()
    });

    await group.save();
    await group.populate('members.userId', 'name avatar');

    // 1. Create a system join message in the chat
    const sysMsg = await Message.create({
      sender: req.user._id,
      groupId: group._id,
      content: `${req.user.name} joined the group.`,
      isSystem: true,
      timestamp: new Date()
    });

    const populatedMsg = await Message.findById(sysMsg._id).populate('sender', 'name avatar');

    const io = req.app.get('io');
    if (io) {
      // Real-time broadcast of the system message into the chat room
      io.to(`group:${group._id}`).emit('group-message', {
        ...populatedMsg.toObject(),
        groupId: group._id
      });

      // 2. Notify Group Admin(s) and Creator (excluding the user who joined)
      const adminIds = (group.members || [])
        .filter(m => m.role === 'admin')
        .map(m => (m.userId?._id || m.userId).toString());

      if (group.creator) {
        adminIds.push((group.creator._id || group.creator).toString());
      }

      const uniqueAdminIds = [...new Set(adminIds)].filter(id => id !== req.user._id.toString());

      if (uniqueAdminIds.length > 0) {
        const notifs = uniqueAdminIds.map(adminId => ({
          userId: adminId,
          type: 'group_join',
          title: 'New Member Joined',
          message: `${req.user.name} joined your ${group.name}.`,
          relatedEntity: { type: 'group', id: group._id }
        }));

        await Notification.insertMany(notifs);

        uniqueAdminIds.forEach(adminId => {
          io.to(`user:${adminId}`).emit('notification', {
            type: 'group_join',
            title: 'New Member Joined',
            message: `${req.user.name} joined your ${group.name}.`,
            relatedEntity: { type: 'group', id: group._id }
          });
        });
      }
    }

    res.json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

// POST /api/groups/:id/leave
exports.leaveGroup = async (req, res, next) => {
  try {
    const Message = require('../models/Message');
    const Notification = require('../models/Notification');
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const memberIndex = group.members.findIndex(m => m.userId.toString() === req.user._id.toString());
    if (memberIndex === -1) {
      return res.status(400).json({ success: false, message: 'You are not a member of this group.' });
    }

    // Creator cannot leave; they must transfer ownership or delete
    if (group.creator.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Group creator cannot leave. Transfer ownership or delete the group.' });
    }

    group.members.splice(memberIndex, 1);
    await group.save();

    // 1. Create a system leave message in the chat
    const sysMsg = await Message.create({
      sender: req.user._id,
      groupId: group._id,
      content: `${req.user.name} left the group.`,
      isSystem: true,
      timestamp: new Date()
    });

    const populatedMsg = await Message.findById(sysMsg._id).populate('sender', 'name avatar');

    const io = req.app.get('io');
    if (io) {
      // Real-time broadcast of system message
      io.to(`group:${group._id}`).emit('group-message', {
        ...populatedMsg.toObject(),
        groupId: group._id
      });

      // 2. Notify Group Admin(s) and Creator (excluding user who left)
      const adminIds = (group.members || [])
        .filter(m => m.role === 'admin')
        .map(m => (m.userId?._id || m.userId).toString());

      if (group.creator) {
        adminIds.push((group.creator._id || group.creator).toString());
      }

      const uniqueAdminIds = [...new Set(adminIds)].filter(id => id !== req.user._id.toString());

      if (uniqueAdminIds.length > 0) {
        const notifs = uniqueAdminIds.map(adminId => ({
          userId: adminId,
          type: 'group_leave',
          title: 'Member Left Group',
          message: `${req.user.name} left your ${group.name}.`,
          relatedEntity: { type: 'group', id: group._id }
        }));

        await Notification.insertMany(notifs);

        uniqueAdminIds.forEach(adminId => {
          io.to(`user:${adminId}`).emit('notification', {
            type: 'group_leave',
            title: 'Member Left Group',
            message: `${req.user.name} left your ${group.name}.`,
            relatedEntity: { type: 'group', id: group._id }
          });
        });
      }
    }

    res.json({ success: true, message: 'Left the group.' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/groups/:id/members/:userId
exports.removeMember = async (req, res, next) => {
  try {
    const Message = require('../models/Message');
    const User = require('../models/User');
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Only admin/moderator can remove
    const requester = group.members.find(m => m.userId.toString() === req.user._id.toString());
    if (!requester || !['admin', 'moderator'].includes(requester.role)) {
      return res.status(403).json({ success: false, message: 'Only admins and moderators can remove members.' });
    }

    // Cannot remove the creator
    if (req.params.userId === group.creator.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot remove the group creator.' });
    }

    const memberIndex = group.members.findIndex(m => m.userId.toString() === req.params.userId);
    if (memberIndex === -1) {
      return res.status(404).json({ success: false, message: 'Member not found in group.' });
    }

    const removedUser = await User.findById(req.params.userId);
    const removedUserName = removedUser?.name || 'A member';

    group.members.splice(memberIndex, 1);
    await group.save();

    // Create system message
    const sysMsg = await Message.create({
      sender: req.user._id,
      groupId: group._id,
      content: `${removedUserName} left the group.`,
      isSystem: true,
      timestamp: new Date()
    });

    const populatedMsg = await Message.findById(sysMsg._id).populate('sender', 'name avatar');
    const io = req.app.get('io');
    if (io) {
      io.to(`group:${group._id}`).emit('group-message', {
        ...populatedMsg.toObject(),
        groupId: group._id
      });
    }

    res.json({ success: true, message: 'Member removed.' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/groups/:id
exports.deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the creator can delete the group.' });
    }

    await Group.findByIdAndDelete(req.params.id);

    // Clean up messages
    const Message = require('../models/Message');
    await Message.deleteMany({ groupId: req.params.id });

    res.json({ success: true, message: 'Group deleted.' });
  } catch (error) {
    next(error);
  }
};

// GET /api/groups/:id/messages
exports.getGroupMessages = async (req, res, next) => {
  try {
    const Message = require('../models/Message');
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    // Access Control: Non-members cannot view messages
    const isMember = (group.members || []).some(m => (m.userId?._id || m.userId).toString() === req.user._id.toString());
    const isCreator = group.creator && group.creator.toString() === req.user._id.toString();
    if (!isMember && !isCreator && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You must join this group to view messages.' });
    }

    const { page, limit: lim } = req.query;
    const page_ = parseInt(page) || 1;
    const limit_ = Math.min(parseInt(lim) || 50, 100);
    const skip = (page_ - 1) * limit_;

    const [messages, total] = await Promise.all([
      Message.find({ groupId: req.params.id })
        .populate('sender', 'name avatar')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit_),
      Message.countDocuments({ groupId: req.params.id })
    ]);

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Chronological order
        total,
        page: page_,
        pages: Math.ceil(total / limit_)
      }
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/groups/:id/messages/:messageId
exports.deleteGroupMessage = async (req, res, next) => {
  try {
    const Message = require('../models/Message');
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const message = await Message.findOne({ _id: req.params.messageId, groupId: req.params.id });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const isAuthor = message.sender.toString() === req.user._id.toString();
    const isCreator = group.creator.toString() === req.user._id.toString();
    const isAdmin = group.members.some(m => (m.userId?._id || m.userId).toString() === req.user._id.toString() && m.role === 'admin');

    if (!isAuthor && !isCreator && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this message.' });
    }

    // Soft delete to maintain thread integrity
    message.isDeleted = true;
    message.content = 'This message was deleted';
    message.deletedAt = new Date();
    message.deletedBy = req.user._id;
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`group:${group._id}`).emit('group-message-deleted', {
        messageId: message._id,
        groupId: group._id,
        isDeleted: true,
        content: 'This message was deleted'
      });
    }

    res.json({ success: true, message: 'Message deleted successfully.', data: message });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/groups/:id/messages
// Supports: ?date=YYYY-MM-DD or ?from=...&to=... or clear all
exports.deleteGroupMessages = async (req, res, next) => {
  try {
    const Message = require('../models/Message');
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    const isCreator = group.creator.toString() === req.user._id.toString();
    const isAdmin = group.members.some(m => (m.userId?._id || m.userId).toString() === req.user._id.toString() && m.role === 'admin');

    const { date, from, to } = req.query;
    const filter = { groupId: req.params.id };

    // Date range filtering
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.timestamp = { $gte: start, $lte: end };
    } else if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    // Regular users can only delete their own messages
    if (!isCreator && !isAdmin) {
      filter.sender = req.user._id;
    }

    const result = await Message.updateMany(filter, {
      $set: {
        isDeleted: true,
        content: 'This message was deleted',
        deletedAt: new Date(),
        deletedBy: req.user._id
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`group:${group._id}`).emit('group-messages-cleared', {
        groupId: group._id,
        deletedBy: req.user._id,
        isBulkAll: isCreator || isAdmin,
        date: date || null
      });
    }

    res.json({
      success: true,
      message: `Deleted ${result.modifiedCount} message(s).`,
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    next(error);
  }
};

