require('dotenv').config();
const http = require('http');

const API_BASE = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const fetchOptions = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  };

  const res = await fetch(url, fetchOptions);
  const json = await res.json();
  return { status: res.status, ok: res.ok, data: json };
}

async function runTests() {
  console.log('🧪 Starting End-to-End API Verification for StudyTrack...\n');
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/studytrack');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    console.log('1. Checking Health Check endpoint...');
    const health = await request('/health');
    assert(health.status === 200 && health.data.success && health.data.database === 'connected', 'API Health Check & MongoDB connected');

    // 2. Auth Login
    console.log('\n2. Testing Authentication...');
    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: 'demo@studytrack.com', password: 'Password123!' }
    });
    assert(login.status === 200 && login.data.success && login.data.data.accessToken, 'Student Login successful with Access Token');
    const token = login.data.data.accessToken;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 3. User Me & Notifications
    console.log('\n3. Testing User Endpoints...');
    const me = await request('/users/me', { headers: authHeaders });
    assert(me.status === 200 && me.data.data.email === 'demo@studytrack.com', 'GET /api/users/me returns authenticated user');

    const notifs = await request('/users/notifications', { headers: authHeaders });
    assert(notifs.status === 200 && Array.isArray(notifs.data.data.notifications), 'GET /api/users/notifications returns notifications');

    // 4. Analytics Endpoints
    console.log('\n4. Testing Analytics & Heatmap Endpoints...');
    const today = new Date().toISOString().split('T')[0];
    const stats = await request(`/analytics/study-stats?localDate=${today}`, { headers: authHeaders });
    assert(stats.status === 200 && stats.data.data.streak.current >= 1, 'GET /api/analytics/study-stats returns streak and goals');

    const weekly = await request(`/analytics/weekly-activity?localDate=${today}`, { headers: authHeaders });
    assert(weekly.status === 200 && weekly.data.data.length === 7 && weekly.data.data[0].dayName, 'GET /api/analytics/weekly-activity returns 7-day data with day names');

    const subjectDist = await request('/analytics/subject-breakdown', { headers: authHeaders });
    assert(subjectDist.status === 200 && Array.isArray(subjectDist.data.data), 'GET /api/analytics/subject-breakdown returns subjects array');

    const monthly = await request(`/analytics/monthly-productivity?localDate=${today}`, { headers: authHeaders });
    assert(monthly.status === 200 && monthly.data.data.length === 30 && monthly.data.data[0].date, 'GET /api/analytics/monthly-productivity returns 30 days of data');

    const heatmap = await request(`/analytics/heatmap?localDate=${today}`, { headers: authHeaders });
    assert(heatmap.status === 200 && Array.isArray(heatmap.data.data) && heatmap.data.data.length > 0 && heatmap.data.data[0].date, 'GET /api/analytics/heatmap returns date-keyed heatmap entries');

    const taskStats = await request('/analytics/task-stats', { headers: authHeaders });
    assert(taskStats.status === 200 && typeof taskStats.data.data.completionRate === 'number', 'GET /api/analytics/task-stats returns completionRate and byStatus');

    // 5. Tasks CRUD
    console.log('\n5. Testing Tasks CRUD...');
    const createTask = await request('/tasks', {
      method: 'POST',
      headers: authHeaders,
      body: {
        title: 'E2E Test Task ' + Date.now(),
        subject: 'Algorithms',
        priority: 'high',
        category: 'coding'
      }
    });
    assert(createTask.status === 201 && createTask.data.data._id, 'POST /api/tasks creates a task');
    const taskId = createTask.data.data._id;

    const completeTask = await request(`/tasks/${taskId}/complete`, {
      method: 'PUT',
      headers: authHeaders
    });
    assert(completeTask.status === 200 && completeTask.data.data.status === 'completed', 'PUT /api/tasks/:id/complete updates task status');

    const deleteTask = await request(`/tasks/${taskId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(deleteTask.status === 200 && deleteTask.data.success, 'DELETE /api/tasks/:id removes the task');

    // 6. Study Sessions
    console.log('\n6. Testing Study Sessions...');
    const now = new Date();
    const session = await request('/sessions', {
      method: 'POST',
      headers: authHeaders,
      body: {
        subject: 'Algorithms',
        startTime: new Date(now.getTime() - 25 * 60000).toISOString(),
        endTime: now.toISOString(),
        duration: 25,
        actualDuration: 25,
        status: 'completed',
        completed: true,
        localDate: today
      }
    });
    assert(session.status === 201 && session.data.data._id, 'POST /api/sessions records a completed Pomodoro session');

    const sessions = await request('/sessions?from=2026-01-01&to=2026-12-31&limit=50', { headers: authHeaders });
    assert(sessions.status === 200 && Array.isArray(sessions.data.data.sessions), 'GET /api/sessions parses from/to and returns sessions array');

    // 7. Groups & Group Messages
    console.log('\n7. Testing Study Groups & Messages...');
    const groups = await request('/groups', { headers: authHeaders });
    assert(groups.status === 200 && groups.data.data.groups.length > 0, 'GET /api/groups returns study groups');
    const groupId = groups.data.data.groups[0]._id;

    const groupMessages = await request(`/groups/${groupId}/messages`, { headers: authHeaders });
    assert(groupMessages.status === 200 && Array.isArray(groupMessages.data.data.messages), 'GET /api/groups/:id/messages returns message history');

    // 8. Channels & Assignments
    console.log('\n8. Testing Mentor Channels & Assignments...');
    const channels = await request('/channels', { headers: authHeaders });
    assert(channels.status === 200 && channels.data.data.length > 0, 'GET /api/channels returns mentor channels');
    const channelId = channels.data.data[0]._id;

    const channelMessages = await request(`/channels/${channelId}/messages`, { headers: authHeaders });
    assert(channelMessages.status === 200 && Array.isArray(channelMessages.data.data.messages), 'GET /api/channels/:id/messages returns channel message history');

    // Test assignment isolation: demo student (joined channel) sees published assignments
    const assignments = await request('/assignments?status=published', { headers: authHeaders });
    assert(assignments.status === 200 && Array.isArray(assignments.data.data) && assignments.data.data.length > 0, 'GET /api/assignments returns published assignments for joined member');

    // Test unjoined student: register new student, they should see 0 assignments initially
    const freshUserRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Unjoined Student',
        email: `unjoined_${Date.now()}@studytrack.com`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'student'
      }
    });
    assert(freshUserRes.status === 201, 'POST /api/auth/register registers a fresh student');
    const freshToken = freshUserRes.data?.data?.accessToken;
    const unjoinedAssignments = await request('/assignments?status=published', {
      headers: { Authorization: `Bearer ${freshToken}` }
    });
    assert(unjoinedAssignments.status === 200 && unjoinedAssignments.data.data.length === 0, 'No default assignments visible to unjoined student');

    // 9. Badges
    console.log('\n9. Testing Badges...');
    const badges = await request('/badges', { headers: authHeaders });
    assert(badges.status === 200 && badges.data.data.badges.length === 14 && badges.data.data.totalEarned > 0, 'GET /api/badges returns all 14 badges with earned status');

    // 10. Notification Management
    console.log('\n10. Testing Notification Management (Delete & Clear)...');
    const userNotifs = await request('/users/notifications', { headers: authHeaders });
    if (userNotifs.data.data.notifications.length > 0) {
      const firstNotifId = userNotifs.data.data.notifications[0]._id;
      const delNotif = await request(`/users/notifications/${firstNotifId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      assert(delNotif.status === 200 && delNotif.data.success, 'DELETE /api/users/notifications/:id deletes a single notification');
    }

    const clearNotifs = await request('/users/notifications', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${freshToken}` }
    });
    assert(clearNotifs.status === 200 && clearNotifs.data.success, 'DELETE /api/users/notifications clears all user notifications');

    // 11. Message Deletion & Authorization
    console.log('\n11. Testing Message Deletion (Single, By Date, Clear Chat, Permissions)...');
    const Message = require('./models/Message');
    const authorId = me.data.data._id;

    // Create a message in the group
    const groupMsg = await Message.create({
      sender: authorId,
      groupId: groupId,
      content: 'Test group message for deletion',
      timestamp: new Date()
    });

    // Delete single message by author
    const delMsgRes = await request(`/groups/${groupId}/messages/${groupMsg._id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(delMsgRes.status === 200 && delMsgRes.data.success, 'DELETE /api/groups/:id/messages/:messageId soft-deletes message');

    // Verify it is marked deleted
    const checkDeleted = await Message.findById(groupMsg._id);
    assert(checkDeleted.isDeleted === true && checkDeleted.content === 'This message was deleted', 'Message content is replaced with deleted text');

    // Unauthorized deletion attempt by fresh user on author's message
    const msg2 = await Message.create({
      sender: authorId,
      groupId: groupId,
      content: 'Protected message',
      timestamp: new Date()
    });
    const unauthDelRes = await request(`/groups/${groupId}/messages/${msg2._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${freshToken}` }
    });
    assert(unauthDelRes.status === 403, 'Unauthorized user cannot delete another user’s message (403 Forbidden)');

    // Delete by date
    const todayDate = new Date().toISOString().split('T')[0];
    const delByDateRes = await request(`/groups/${groupId}/messages?date=${todayDate}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(delByDateRes.status === 200 && delByDateRes.data.success, 'DELETE /api/groups/:id/messages?date=YYYY-MM-DD deletes messages by date');

    // Clear entire chat
    const clearChatRes = await request(`/groups/${groupId}/messages`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(clearChatRes.status === 200 && clearChatRes.data.success, 'DELETE /api/groups/:id/messages clears chat messages');

    // 12. Testing Group & Channel Join & Leave Notifications and System Messages
    console.log('\n12. Testing Group & Channel Join & Leave Notifications and System Messages...');
    const NotificationModel = require('./models/Notification');
    const ChannelModel = require('./models/Channel');
    const GroupModel = require('./models/Group');

    // Register a dynamic test student
    const dynamicName = `Student_${Math.floor(Math.random() * 10000)}`;
    const joiningUserRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: dynamicName,
        email: `student_${Date.now()}@studytrack.com`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'student'
      }
    });
    assert(joiningUserRes.status === 201, `POST /api/auth/register registers student ${dynamicName}`);
    const joiningToken = joiningUserRes.data?.data?.accessToken;
    const joiningHeaders = { Authorization: `Bearer ${joiningToken}` };

    // --- Study Group Join ---
    const joinGroupRes = await request(`/groups/${groupId}/join`, {
      method: 'POST',
      headers: joiningHeaders
    });
    assert(joinGroupRes.status === 200 && joinGroupRes.data.success, 'POST /api/groups/:id/join successfully joins group');

    // Verify system join message exists in group chat
    const groupJoinSysMsg = await Message.findOne({
      groupId: groupId,
      isSystem: true,
      content: new RegExp(`${dynamicName} joined the group`)
    });
    assert(groupJoinSysMsg !== null, `System join message created dynamically for ${dynamicName}`);

    // Verify group admin / creator received join notification
    const groupObj = await GroupModel.findById(groupId);
    const expectedAdminId = (groupObj.creator?._id || groupObj.creator).toString();
    const adminJoinNotif = await NotificationModel.findOne({
      userId: expectedAdminId,
      type: 'group_join',
      message: new RegExp(`${dynamicName} joined your`)
    });
    assert(adminJoinNotif !== null, `Admin received dynamic "New Member Joined" notification for ${dynamicName}`);

    // --- Study Group Leave ---
    const leaveGroupRes = await request(`/groups/${groupId}/leave`, {
      method: 'POST',
      headers: joiningHeaders
    });
    assert(leaveGroupRes.status === 200 && leaveGroupRes.data.success, 'POST /api/groups/:id/leave successfully leaves group');

    // Verify system leave message exists in group chat
    const groupLeaveSysMsg = await Message.findOne({
      groupId: groupId,
      isSystem: true,
      content: new RegExp(`${dynamicName} left the group`)
    });
    assert(groupLeaveSysMsg !== null, `System leave message created dynamically for ${dynamicName}`);

    // Verify group admin / creator received leave notification
    const adminLeaveNotif = await NotificationModel.findOne({
      userId: expectedAdminId,
      type: 'group_leave',
      message: new RegExp(`${dynamicName} left your`)
    });
    assert(adminLeaveNotif !== null, `Admin received dynamic "Member Left Group" notification for ${dynamicName}`);

    // --- Mentor Channel Join ---
    const joinChannelRes = await request(`/channels/${channelId}/join`, {
      method: 'POST',
      headers: joiningHeaders
    });
    assert(joinChannelRes.status === 200 && joinChannelRes.data.success, 'POST /api/channels/:id/join successfully joins channel');

    // Verify system join message exists in channel chat
    const channelJoinSysMsg = await Message.findOne({
      channelId: channelId,
      isSystem: true,
      content: new RegExp(`${dynamicName} joined the mentor channel`)
    });
    assert(channelJoinSysMsg !== null, `System join message created dynamically for ${dynamicName} in channel`);

    // Verify channel mentor received join notification
    const channelObj = await ChannelModel.findById(channelId);
    const mentorId = (channelObj.mentor?._id || channelObj.mentor).toString();
    const mentorJoinNotif = await NotificationModel.findOne({
      userId: mentorId,
      type: 'channel_join',
      message: new RegExp(`${dynamicName} joined your`)
    });
    assert(mentorJoinNotif !== null, `Mentor received dynamic "New Student Joined" notification for ${dynamicName}`);

    // --- Mentor Channel Leave ---
    const leaveChannelRes = await request(`/channels/${channelId}/leave`, {
      method: 'POST',
      headers: joiningHeaders
    });
    assert(leaveChannelRes.status === 200 && leaveChannelRes.data.success, 'POST /api/channels/:id/leave successfully leaves channel');

    // Verify system leave message exists in channel chat
    const channelLeaveSysMsg = await Message.findOne({
      channelId: channelId,
      isSystem: true,
      content: new RegExp(`${dynamicName} left the mentor channel`)
    });
    assert(channelLeaveSysMsg !== null, `System leave message created dynamically for ${dynamicName} in channel`);

    // Verify channel mentor received leave notification
    const mentorLeaveNotif = await NotificationModel.findOne({
      userId: mentorId,
      type: 'channel_leave',
      message: new RegExp(`${dynamicName} left your`)
    });
    assert(mentorLeaveNotif !== null, `Mentor received dynamic "Student Left Channel" notification for ${dynamicName}`);

    // 13. Testing Chat Access Control (Non-members blocked with 403 Forbidden)
    console.log('\n13. Testing Group & Mentor Channel Chat Access Control...');
    // Create an unjoined student
    const unjoinedStudentRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Unjoined Student',
        email: `unjoined_${Date.now()}@studytrack.com`,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'student'
      }
    });
    assert(unjoinedStudentRes.status === 201, 'POST /api/auth/register registers unjoined student');
    const unjoinedToken = unjoinedStudentRes.data?.data?.accessToken;
    const unjoinedHeaders = { Authorization: `Bearer ${unjoinedToken}` };

    // Attempt to read group messages before joining -> 403 Forbidden
    const unauthGroupMsgRes = await request(`/groups/${groupId}/messages`, {
      headers: unjoinedHeaders
    });
    assert(unauthGroupMsgRes.status === 403 && !unauthGroupMsgRes.data.success, 'Non-member cannot read group messages (403 Forbidden)');

    // Attempt to read channel messages before joining -> 403 Forbidden
    const unauthChannelMsgRes = await request(`/channels/${channelId}/messages`, {
      headers: unjoinedHeaders
    });
    assert(unauthChannelMsgRes.status === 403 && !unauthChannelMsgRes.data.success, 'Non-member cannot read mentor channel messages (403 Forbidden)');

    // Join group & verify access granted
    await request(`/groups/${groupId}/join`, {
      method: 'POST',
      headers: unjoinedHeaders
    });
    const authGroupMsgRes = await request(`/groups/${groupId}/messages`, {
      headers: unjoinedHeaders
    });
    assert(authGroupMsgRes.status === 200 && authGroupMsgRes.data.success, 'Joined member can read group messages (200 OK)');

    // Join channel & verify access granted
    await request(`/channels/${channelId}/join`, {
      method: 'POST',
      headers: unjoinedHeaders
    });
    const authChannelMsgRes = await request(`/channels/${channelId}/messages`, {
      headers: unjoinedHeaders
    });
    assert(authChannelMsgRes.status === 200 && authChannelMsgRes.data.success, 'Joined member can read mentor channel messages (200 OK)');

    // 14. Testing Chat Notification Suppression (No notification when actively viewing chat)
    console.log('\n14. Testing Chat Notification Suppression for Active Chat Viewers...');
    const ioClient = require('../frontend/node_modules/socket.io-client');
    const authorSocket = ioClient('http://localhost:5000', {
      auth: { token }
    });
    const unjoinedMemberSocket = ioClient('http://localhost:5000', {
      auth: { token: unjoinedToken }
    });

    await new Promise(resolve => {
      let count = 0;
      const check = () => { count++; if (count === 2) resolve(); };
      authorSocket.on('connect', check);
      unjoinedMemberSocket.on('connect', check);
    });

    // Author socket enters the group room (actively viewing chat)
    authorSocket.emit('join-group', groupId);
    // unjoinedMemberSocket is a group member but NOT in the group room (viewing dashboard)

    await new Promise(r => setTimeout(r, 200));

    // Clear notifications first
    await NotificationModel.deleteMany({ userId: authorId });

    // Send a message from unjoinedMemberSocket into the group
    unjoinedMemberSocket.emit('group-message', {
      groupId,
      content: 'Testing active viewer notification suppression!'
    });

    await new Promise(r => setTimeout(r, 500));

    // Author was actively viewing the chat room -> should NOT receive notification
    const authorNotif = await NotificationModel.findOne({
      userId: authorId,
      type: 'group_message',
      message: /Testing active viewer notification suppression/
    });
    assert(authorNotif === null, 'Active chat viewer did NOT receive group_message notification');

    // Author leaves the room (navigates away to another page)
    authorSocket.emit('leave-group', groupId);
    await new Promise(r => setTimeout(r, 200));

    // Send another message
    unjoinedMemberSocket.emit('group-message', {
      groupId,
      content: 'Message after author left chat room!'
    });

    await new Promise(r => setTimeout(r, 500));

    // Now author is NOT in the room -> SHOULD receive notification
    const authorNotifAfterLeave = await NotificationModel.findOne({
      userId: authorId,
      type: 'group_message',
      message: /Message after author left chat room/
    });
    assert(authorNotifAfterLeave !== null, 'Member outside chat received group_message notification');

    authorSocket.disconnect();
    unjoinedMemberSocket.disconnect();

    console.log(`\n====================================================`);
    console.log(`🏁 Total Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`====================================================\n`);

    await mongoose.disconnect();
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
