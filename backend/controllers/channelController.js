const Channel = require('../models/Channel');
const Message = require('../models/Message');

// GET /api/channels
exports.getChannels = async (req, res, next) => {
  try {
    const { search, subject, myChannels } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (subject) query.subject = subject;
    if (myChannels === 'true') {
      query.$or = [
        { mentor: req.user._id },
        { members: req.user._id }
      ];
    }

    const channels = await Channel.find(query)
      .populate('mentor', 'name avatar')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: channels });
  } catch (error) {
    next(error);
  }
};

// GET /api/channels/:id
exports.getChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id)
      .populate('mentor', 'name avatar')
      .populate('members', 'name avatar');

    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    res.json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
};

// POST /api/channels
exports.createChannel = async (req, res, next) => {
  try {
    const { name, description, subject } = req.body;

    const channel = await Channel.create({
      name,
      description,
      subject,
      mentor: req.user._id,
      members: [req.user._id]
    });

    await channel.populate('mentor', 'name avatar');

    // Update user role to mentor if not already
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, { role: 'mentor' });

    res.status(201).json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
};

// PUT /api/channels/:id
exports.updateChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    if (channel.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the mentor can update this channel.' });
    }

    const { name, description, subject } = req.body;
    if (name) channel.name = name;
    if (description !== undefined) channel.description = description;
    if (subject) channel.subject = subject;

    await channel.save();
    await channel.populate('mentor', 'name avatar');
    await channel.populate('members', 'name avatar');

    // Notify channel members of update
    const Notification = require('../models/Notification');
    const memberIds = channel.members
      .map(m => (m._id || m).toString())
      .filter(m => m !== req.user._id.toString());

    if (memberIds.length > 0) {
      const notifs = memberIds.map(userId => ({
        userId,
        type: 'channel_update',
        title: `Channel Updated: ${channel.name}`,
        message: `Channel details were updated by the mentor`,
        relatedEntity: { type: 'channel', id: channel._id }
      }));
      await Notification.insertMany(notifs);

      const io = req.app.get('io');
      if (io) {
        memberIds.forEach(userId => {
          io.to(`user:${userId}`).emit('notification', {
            type: 'channel_update',
            title: `Channel Updated: ${channel.name}`,
            message: `Channel details were updated by the mentor`,
            relatedEntity: { type: 'channel', id: channel._id }
          });
        });
      }
    }

    res.json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
};

// POST /api/channels/:id/join
exports.joinChannel = async (req, res, next) => {
  try {
    const Message = require('../models/Message');
    const Notification = require('../models/Notification');
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    if (channel.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(409).json({ success: false, message: 'Already a member.' });
    }

    channel.members.push(req.user._id);
    await channel.save();

    // 1. Create a system join message in the chat
    const sysMsg = await Message.create({
      sender: req.user._id,
      channelId: channel._id,
      content: `${req.user.name} joined the mentor channel.`,
      isSystem: true,
      timestamp: new Date()
    });

    const populatedMsg = await Message.findById(sysMsg._id).populate('sender', 'name avatar');

    const io = req.app.get('io');
    if (io) {
      // Real-time broadcast of the system message into the channel chat room
      io.to(`channel:${channel._id}`).emit('channel-message', {
        ...populatedMsg.toObject(),
        channelId: channel._id
      });

      // 2. Notify the Mentor (if mentor != joining user)
      const mentorId = (channel.mentor?._id || channel.mentor).toString();
      if (mentorId && mentorId !== req.user._id.toString()) {
        await Notification.create({
          userId: mentorId,
          type: 'channel_join',
          title: 'New Student Joined',
          message: `${req.user.name} joined your ${channel.name}.`,
          relatedEntity: { type: 'channel', id: channel._id }
        });

        io.to(`user:${mentorId}`).emit('notification', {
          type: 'channel_join',
          title: 'New Student Joined',
          message: `${req.user.name} joined your ${channel.name}.`,
          relatedEntity: { type: 'channel', id: channel._id }
        });
      }
    }

    res.json({ success: true, message: 'Joined channel.', data: channel });
  } catch (error) {
    next(error);
  }
};

// POST /api/channels/:id/leave
exports.leaveChannel = async (req, res, next) => {
  try {
    const Message = require('../models/Message');
    const Notification = require('../models/Notification');
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    if (channel.mentor.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Mentor cannot leave their own channel.' });
    }

    const isMember = channel.members.some(m => (m._id || m).toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(400).json({ success: false, message: 'You are not a member of this channel.' });
    }

    channel.members = channel.members.filter(m => (m._id || m).toString() !== req.user._id.toString());
    await channel.save();

    // 1. Create a system leave message in the chat
    const sysMsg = await Message.create({
      sender: req.user._id,
      channelId: channel._id,
      content: `${req.user.name} left the mentor channel.`,
      isSystem: true,
      timestamp: new Date()
    });

    const populatedMsg = await Message.findById(sysMsg._id).populate('sender', 'name avatar');

    const io = req.app.get('io');
    if (io) {
      // Broadcast system leave message to channel chat
      io.to(`channel:${channel._id}`).emit('channel-message', {
        ...populatedMsg.toObject(),
        channelId: channel._id
      });

      // 2. Notify the Mentor (if mentor != user who left)
      const mentorId = (channel.mentor?._id || channel.mentor).toString();
      if (mentorId && mentorId !== req.user._id.toString()) {
        await Notification.create({
          userId: mentorId,
          type: 'channel_leave',
          title: 'Student Left Channel',
          message: `${req.user.name} left your ${channel.name}.`,
          relatedEntity: { type: 'channel', id: channel._id }
        });

        io.to(`user:${mentorId}`).emit('notification', {
          type: 'channel_leave',
          title: 'Student Left Channel',
          message: `${req.user.name} left your ${channel.name}.`,
          relatedEntity: { type: 'channel', id: channel._id }
        });
      }
    }

    res.json({ success: true, message: 'Left channel.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/channels/:id/resources
exports.addResource = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    if (channel.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the mentor can add resources.' });
    }

    const { title, url, type, description } = req.body;
    channel.resources.push({ title, url, type: type || 'video', description });
    await channel.save();

    // Notify channel members
    const Notification = require('../models/Notification');
    const memberIds = channel.members
      .map(m => (m._id || m).toString())
      .filter(m => m !== req.user._id.toString());

    if (memberIds.length > 0) {
      const notifs = memberIds.map(userId => ({
        userId,
        type: 'channel_update',
        title: `New Resource in ${channel.name}`,
        message: `Mentor added resource "${title}"`,
        relatedEntity: { type: 'channel', id: channel._id }
      }));
      await Notification.insertMany(notifs);

      const io = req.app.get('io');
      if (io) {
        memberIds.forEach(userId => {
          io.to(`user:${userId}`).emit('notification', {
            type: 'channel_update',
            title: `New Resource in ${channel.name}`,
            message: `Mentor added resource "${title}"`,
            relatedEntity: { type: 'channel', id: channel._id }
          });
        });
      }
    }

    res.status(201).json({ success: true, data: channel.resources });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:id/resources/:resourceId
exports.removeResource = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    if (channel.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the mentor can remove resources.' });
    }

    channel.resources = channel.resources.filter(
      r => r._id.toString() !== req.params.resourceId
    );
    await channel.save();

    res.json({ success: true, data: channel.resources });
  } catch (error) {
    next(error);
  }
};

// GET /api/channels/:id/messages
exports.getChannelMessages = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    // Access Control: Non-members cannot view messages
    const isMember = (channel.members || []).some(m => (m._id || m).toString() === req.user._id.toString());
    const isMentor = channel.mentor && (channel.mentor._id || channel.mentor).toString() === req.user._id.toString();
    if (!isMember && !isMentor && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You must join this mentor channel to view messages.' });
    }

    const { page, limit: lim } = req.query;
    const page_ = parseInt(page) || 1;
    const limit_ = Math.min(parseInt(lim) || 50, 100);
    const skip = (page_ - 1) * limit_;

    const [messages, total] = await Promise.all([
      Message.find({ channelId: req.params.id })
        .populate('sender', 'name avatar')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit_),
      Message.countDocuments({ channelId: req.params.id })
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

// DELETE /api/channels/:id
exports.deleteChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    if (channel.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the mentor can delete this channel.' });
    }

    await Channel.findByIdAndDelete(req.params.id);
    await Message.deleteMany({ channelId: req.params.id });

    res.json({ success: true, message: 'Channel deleted.' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:id/messages/:messageId
exports.deleteChannelMessage = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    const message = await Message.findOne({ _id: req.params.messageId, channelId: req.params.id });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const isAuthor = message.sender.toString() === req.user._id.toString();
    const isMentor = channel.mentor.toString() === req.user._id.toString();

    if (!isAuthor && !isMentor) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this message.' });
    }

    message.isDeleted = true;
    message.content = 'This message was deleted';
    message.deletedAt = new Date();
    message.deletedBy = req.user._id;
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channel._id}`).emit('channel-message-deleted', {
        messageId: message._id,
        channelId: channel._id,
        isDeleted: true,
        content: 'This message was deleted'
      });
    }

    res.json({ success: true, message: 'Message deleted successfully.', data: message });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/channels/:id/messages
// Supports: ?date=YYYY-MM-DD or ?from=...&to=... or clear all
exports.deleteChannelMessages = async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Channel not found.' });
    }

    const isMentor = channel.mentor.toString() === req.user._id.toString();
    const { date, from, to } = req.query;
    const filter = { channelId: req.params.id };

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

    // Students only delete their own messages; Mentor can delete all
    if (!isMentor) {
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
      io.to(`channel:${channel._id}`).emit('channel-messages-cleared', {
        channelId: channel._id,
        deletedBy: req.user._id,
        isBulkAll: isMentor,
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
