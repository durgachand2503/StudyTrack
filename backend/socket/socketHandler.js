const Message = require('../models/Message');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const Group = require('../models/Group');
const Channel = require('../models/Channel');
const Notification = require('../models/Notification');

const onlineUsers = new Map(); // userId -> Set of socketIds

module.exports = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId).select('name avatar');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = decoded.userId;
      socket.userName = user.name;
      socket.userAvatar = user.avatar;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${socket.userName} (${userId})`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal notification room
    socket.join(`user:${userId}`);

    // Broadcast online status
    io.emit('user-online', { userId, name: socket.userName });

    // === Group Chat ===
    socket.on('join-group', (groupId) => {
      if (groupId) {
        socket.join(`group:${groupId}`);
      }
    });

    socket.on('leave-group', (groupId) => {
      if (groupId) {
        socket.leave(`group:${groupId}`);
      }
    });

    socket.on('group-message', async ({ groupId, content }) => {
      if (!groupId || !content || !content.trim()) return;

      try {
        const group = await Group.findById(groupId);
        if (!group) return;

        const isMember = (group.members || []).some(m => (m.userId?._id || m.userId).toString() === userId.toString());
        const isCreator = group.creator && group.creator.toString() === userId.toString();
        if (!isMember && !isCreator) {
          socket.emit('error', { message: 'You must join this group to send messages.' });
          return;
        }

        const message = await Message.create({
          sender: userId,
          content: content.trim(),
          groupId,
          timestamp: new Date()
        });

        const populated = await Message.findById(message._id)
          .populate('sender', 'name avatar');

        io.to(`group:${groupId}`).emit('group-message', {
          ...populated.toObject(),
          groupId
        });

        // 1. Identify users actively in the group chat room (viewing the chat window)
        const groupRoomSockets = io.sockets.adapter.rooms.get(`group:${groupId}`) || new Set();
        const viewingUserIds = new Set();
        for (const sId of groupRoomSockets) {
          const s = io.sockets.sockets.get(sId);
          if (s && s.userId) {
            viewingUserIds.add(s.userId.toString());
          }
        }

        // 2. Dispatch real-time notifications ONLY to group members NOT currently viewing this chat
        if (group && group.members) {
          const recipientIds = group.members
            .map(m => (m.userId?._id || m.userId).toString())
            .filter(id => id !== userId.toString() && !viewingUserIds.has(id));

          if (recipientIds.length > 0) {
            const notifs = recipientIds.map(recId => ({
              userId: recId,
              type: 'group_message',
              title: `New message in ${group.name}`,
              message: `${socket.userName}: ${content.trim().slice(0, 80)}`,
              relatedEntity: { type: 'group', id: groupId }
            }));
            await Notification.insertMany(notifs);

            recipientIds.forEach(recId => {
              io.to(`user:${recId}`).emit('notification', {
                type: 'group_message',
                title: `New message in ${group.name}`,
                message: `${socket.userName}: ${content.trim().slice(0, 80)}`,
                relatedEntity: { type: 'group', id: groupId }
              });
            });
          }
        }
      } catch (error) {
        console.error('Error saving group message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // === Channel Chat ===
    socket.on('join-channel', (channelId) => {
      if (channelId) {
        socket.join(`channel:${channelId}`);
      }
    });

    socket.on('leave-channel', (channelId) => {
      if (channelId) {
        socket.leave(`channel:${channelId}`);
      }
    });

    socket.on('channel-message', async ({ channelId, content }) => {
      if (!channelId || !content || !content.trim()) return;

      try {
        const channel = await Channel.findById(channelId);
        if (!channel) return;

        const isMember = (channel.members || []).some(m => (m._id || m).toString() === userId.toString());
        const isMentor = channel.mentor && (channel.mentor._id || channel.mentor).toString() === userId.toString();
        if (!isMember && !isMentor) {
          socket.emit('error', { message: 'You must join this mentor channel to send messages.' });
          return;
        }

        const message = await Message.create({
          sender: userId,
          content: content.trim(),
          channelId,
          timestamp: new Date()
        });

        const populated = await Message.findById(message._id)
          .populate('sender', 'name avatar');

        io.to(`channel:${channelId}`).emit('channel-message', {
          ...populated.toObject(),
          channelId
        });

        // 1. Identify users actively in the channel chat room (viewing the channel chat window)
        const channelRoomSockets = io.sockets.adapter.rooms.get(`channel:${channelId}`) || new Set();
        const viewingUserIds = new Set();
        for (const sId of channelRoomSockets) {
          const s = io.sockets.sockets.get(sId);
          if (s && s.userId) {
            viewingUserIds.add(s.userId.toString());
          }
        }

        // 2. Dispatch real-time notifications ONLY to channel members & mentor NOT currently viewing this chat
        if (channel) {
          const allMemberIds = (channel.members || []).map(m => (m._id || m).toString());
          if (channel.mentor) allMemberIds.push((channel.mentor._id || channel.mentor).toString());
          const recipientIds = [...new Set(allMemberIds)]
            .filter(id => id !== userId.toString() && !viewingUserIds.has(id));

          if (recipientIds.length > 0) {
            const notifs = recipientIds.map(recId => ({
              userId: recId,
              type: 'channel_message',
              title: `New post in ${channel.name}`,
              message: `${socket.userName}: ${content.trim().slice(0, 80)}`,
              relatedEntity: { type: 'channel', id: channelId }
            }));
            await Notification.insertMany(notifs);

            recipientIds.forEach(recId => {
              io.to(`user:${recId}`).emit('notification', {
                type: 'channel_message',
                title: `New post in ${channel.name}`,
                message: `${socket.userName}: ${content.trim().slice(0, 80)}`,
                relatedEntity: { type: 'channel', id: channelId }
              });
            });
          }
        }
      } catch (error) {
        console.error('Error saving channel message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // === Typing indicators ===
    socket.on('typing', ({ roomType, roomId }) => {
      if (!roomId) return;
      const room = `${roomType}:${roomId}`;
      socket.to(room).emit('user-typing', {
        userId,
        name: socket.userName
      });
    });

    socket.on('stop-typing', ({ roomType, roomId }) => {
      if (!roomId) return;
      const room = `${roomType}:${roomId}`;
      socket.to(room).emit('user-stop-typing', { userId });
    });

    // === Get online users ===
    socket.on('get-online-users', () => {
      const users = Array.from(onlineUsers.keys());
      socket.emit('online-users', users);
    });

    // === Disconnect ===
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userName}`);

      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).delete(socket.id);
        if (onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);
          io.emit('user-offline', { userId });
        }
      }
    });
  });
};
