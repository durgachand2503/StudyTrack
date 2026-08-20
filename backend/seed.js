require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');

const User = require('./models/User');
const Task = require('./models/Task');
const Session = require('./models/Session');
const Group = require('./models/Group');
const Channel = require('./models/Channel');
const Message = require('./models/Message');
const Assignment = require('./models/Assignment');
const Submission = require('./models/Submission');
const Badge = require('./models/Badge');
const Notification = require('./models/Notification');

async function seedData() {
  try {
    await connectDB();
    console.log('Clearing existing demo data...');

    // Clean up existing collections
    await Promise.all([
      User.deleteMany({}),
      Task.deleteMany({}),
      Session.deleteMany({}),
      Group.deleteMany({}),
      Channel.deleteMany({}),
      Message.deleteMany({}),
      Assignment.deleteMany({}),
      Submission.deleteMany({}),
      Badge.deleteMany({}),
      Notification.deleteMany({})
    ]);

    console.log('Creating users...');

    // 1. Create Demo Student
    const student = await User.create({
      name: 'Alex Johnson',
      email: 'demo@studytrack.com',
      password: 'Password123!',
      role: 'student',
      subjects: ['Data Structures', 'Algorithms', 'Physics', 'Mathematics', 'Computer Networks'],
      currentStreak: 5,
      longestStreak: 12,
      lastActiveDate: new Date().toISOString().split('T')[0],
      totalStudyTime: 1840, // ~30.6 hours
      preferences: {
        dailyGoal: 120,
        weeklyGoal: 600,
        pomodoroLength: 25,
        breakLength: 5,
        notifications: true,
        soundEnabled: true
      }
    });

    // 2. Create Mentor User
    const mentor = await User.create({
      name: 'Dr. Sarah Vance',
      email: 'mentor@studytrack.com',
      password: 'Password123!',
      role: 'mentor',
      subjects: ['Data Structures', 'Algorithms', 'Software Engineering'],
      preferences: {
        dailyGoal: 180,
        weeklyGoal: 900
      }
    });

    // 3. Create Peer Students for Groups
    const peer1 = await User.create({
      name: 'Elena Rostova',
      email: 'elena@studytrack.com',
      password: 'Password123!',
      role: 'student',
      subjects: ['Mathematics', 'Physics']
    });

    const peer2 = await User.create({
      name: 'Marcus Chen',
      email: 'marcus@studytrack.com',
      password: 'Password123!',
      role: 'student',
      subjects: ['Data Structures', 'Algorithms']
    });

    console.log('Creating study sessions (past 30 days)...');
    // Generate realistic sessions for heatmap and analytics
    const sessionsToCreate = [];
    const today = new Date();

    const subjectPool = ['Data Structures', 'Algorithms', 'Physics', 'Mathematics', 'Computer Networks'];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const localDate = d.toISOString().split('T')[0];

      // Skip a few days to make streak realistic (active last 5 days)
      if (i > 5 && i % 4 === 0) continue;

      const numSessions = (i % 3) + 1;
      for (let s = 0; s < numSessions; s++) {
        const subject = subjectPool[(i + s) % subjectPool.length];
        const duration = [25, 45, 50, 60][(i + s) % 4];
        const actualDuration = duration;

        const startTime = new Date(d);
        startTime.setHours(9 + s * 3, 15, 0, 0);
        const endTime = new Date(startTime.getTime() + actualDuration * 60000);

        sessionsToCreate.push({
          userId: student._id,
          subject,
          startTime,
          endTime,
          duration,
          actualDuration,
          status: 'completed',
          completed: true,
          notes: `Studied ${subject} chapter ${(s % 5) + 1} and solved practice problems.`,
          localDate
        });
      }
    }

    await Session.insertMany(sessionsToCreate);

    console.log('Creating tasks...');
    const taskData = [
      {
        userId: student._id,
        title: 'Implement Dijkstra & A* Algorithm',
        description: 'Complete graph pathfinding implementations and benchmark execution times.',
        subject: 'Algorithms',
        category: 'coding',
        priority: 'urgent',
        status: 'pending',
        dueDate: new Date(Date.now() + 2 * 86400000),
        estimatedDuration: 90
      },
      {
        userId: student._id,
        title: 'Review Electromagnetism Notes (Ch. 4-6)',
        description: 'Maxwell equations and wave propagation problem sets.',
        subject: 'Physics',
        category: 'exam',
        priority: 'high',
        status: 'in-progress',
        dueDate: new Date(Date.now() + 4 * 86400000),
        estimatedDuration: 60
      },
      {
        userId: student._id,
        title: 'Linear Algebra Eigenvalues Problem Set',
        description: 'Exercises 5.1 through 5.4 in textbook.',
        subject: 'Mathematics',
        category: 'assignment',
        priority: 'medium',
        status: 'completed',
        dueDate: new Date(Date.now() - 1 * 86400000),
        completedDate: new Date(),
        estimatedDuration: 45
      },
      {
        userId: student._id,
        title: 'TCP/IP Handshake & Socket Programming',
        description: 'Implement client-server echo server in Python and analyze Wireshark capture.',
        subject: 'Computer Networks',
        category: 'project',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(Date.now() + 7 * 86400000),
        estimatedDuration: 120
      },
      {
        userId: student._id,
        title: 'Red-Black Tree Insertion Walkthrough',
        description: 'Practice rotations and recoloring cases.',
        subject: 'Data Structures',
        category: 'reading',
        priority: 'low',
        status: 'completed',
        dueDate: new Date(Date.now() - 3 * 86400000),
        completedDate: new Date(Date.now() - 2 * 86400000),
        estimatedDuration: 30
      }
    ];

    await Task.insertMany(taskData);

    console.log('Creating study groups & messages...');
    const group1 = await Group.create({
      name: 'Algorithms & LeetCode Sprint',
      description: 'Daily competitive programming discussions, code reviews, and mock interviews.',
      creator: student._id,
      category: 'coding',
      privacy: 'public',
      maxMembers: 30,
      members: [
        { userId: student._id, role: 'admin', joinedAt: new Date(Date.now() - 15 * 86400000) },
        { userId: peer1._id, role: 'member', joinedAt: new Date(Date.now() - 10 * 86400000) },
        { userId: peer2._id, role: 'moderator', joinedAt: new Date(Date.now() - 12 * 86400000) }
      ]
    });

    const group2 = await Group.create({
      name: 'Physics & Applied Math Squad',
      description: 'Collaborative problem solving for advanced physics and applied mathematics courses.',
      creator: peer1._id,
      category: 'exam-prep',
      privacy: 'public',
      maxMembers: 20,
      members: [
        { userId: peer1._id, role: 'admin', joinedAt: new Date(Date.now() - 20 * 86400000) },
        { userId: student._id, role: 'member', joinedAt: new Date(Date.now() - 14 * 86400000) }
      ]
    });

    // Group messages
    await Message.insertMany([
      {
        sender: peer2._id,
        groupId: group1._id,
        content: 'Hey team! Anyone started working on today\'s Dynamic Programming challenge?',
        timestamp: new Date(Date.now() - 2 * 3600000)
      },
      {
        sender: student._id,
        groupId: group1._id,
        content: 'Yes! The memoization approach brings it down to O(N*W). I can share my Python solution.',
        timestamp: new Date(Date.now() - 1 * 3600000)
      },
      {
        sender: peer1._id,
        groupId: group1._id,
        content: 'Great! Let\'s do a 25m Pomodoro study session together at 4 PM.',
        timestamp: new Date(Date.now() - 30 * 60000)
      }
    ]);

    console.log('Creating mentor channel & assignments...');
    const channel = await Channel.create({
      name: 'Data Structures & System Design Masterclass',
      description: 'Weekly deep-dives into advanced data structures, concurrency, and scalable architecture.',
      subject: 'Data Structures',
      mentor: mentor._id,
      members: [mentor._id, student._id, peer1._id, peer2._id],
      resources: [
        {
          title: 'Graph Traversal Visualizer',
          url: 'https://visualgo.net/en/dfsbfs',
          type: 'link',
          description: 'Interactive animations for DFS and BFS algorithms'
        },
        {
          title: 'B-Trees and LSM-Trees Overview',
          url: 'https://en.wikipedia.org/wiki/B-tree',
          type: 'article',
          description: 'Deep dive into database storage engines'
        }
      ]
    });

    // Channel message
    await Message.create({
      sender: mentor._id,
      channelId: channel._id,
      content: 'Welcome everyone! Assignment 1 on Binary Search Tree balancing is now posted. Please check the due date.',
      timestamp: new Date(Date.now() - 24 * 3600000)
    });

    // Assignment
    const assignment1 = await Assignment.create({
      title: 'AVL Tree Self-Balancing Implementation',
      description: 'Implement rotation logic (LL, RR, LR, RL) for self-balancing AVL Trees.',
      instructions: '1. Implement insert, delete, and find.\n2. Maintain height invariant.\n3. Include unit tests covering edge cases.',
      channelId: channel._id,
      mentor: mentor._id,
      dueDate: new Date(Date.now() + 5 * 86400000),
      maxPoints: 100,
      published: true,
      allowResubmission: true
    });

    const assignment2 = await Assignment.create({
      title: 'Graph Cycle Detection Algorithms',
      description: 'Implement Kahn\'s algorithm and DFS color cycle detection for directed graphs.',
      instructions: 'Submit code file or GitHub repository link with complexity analysis.',
      channelId: channel._id,
      mentor: mentor._id,
      dueDate: new Date(Date.now() - 2 * 86400000),
      maxPoints: 50,
      published: true,
      allowResubmission: false
    });

    // Submission & Grade
    await Submission.create({
      assignmentId: assignment2._id,
      studentId: student._id,
      content: 'Completed Kahn topological sort and 3-color DFS graph cycle detection in C++.',
      url: 'https://github.com/studytrack/graph-cycle-demo',
      status: 'graded',
      score: 48,
      feedback: 'Excellent clean implementation and thorough edge-case testing! Well done.',
      gradedAt: new Date(Date.now() - 1 * 86400000),
      gradedBy: mentor._id
    });

    console.log('Creating badges & notifications...');
    const badges = [
      {
        userId: student._id,
        badgeType: 'first_session',
        name: 'First Session',
        description: 'Complete your first study session',
        icon: '🎯',
        earnedAt: new Date(Date.now() - 28 * 86400000)
      },
      {
        userId: student._id,
        badgeType: 'streak_3',
        name: 'Streak Starter',
        description: 'Maintain a 3-day study streak',
        icon: '🔥',
        earnedAt: new Date(Date.now() - 25 * 86400000)
      },
      {
        userId: student._id,
        badgeType: 'streak_7',
        name: 'Week Warrior',
        description: 'Maintain a 7-day study streak',
        icon: '⚡',
        earnedAt: new Date(Date.now() - 20 * 86400000)
      },
      {
        userId: student._id,
        badgeType: 'hours_10',
        name: '10 Hours',
        description: 'Study for a total of 10 hours',
        icon: '📚',
        earnedAt: new Date(Date.now() - 18 * 86400000)
      },
      {
        userId: student._id,
        badgeType: 'subject_master',
        name: 'Subject Master',
        description: 'Study 5 different subjects',
        icon: '🎓',
        earnedAt: new Date(Date.now() - 10 * 86400000)
      },
      {
        userId: student._id,
        badgeType: 'group_creator',
        name: 'Community Builder',
        description: 'Create your first study group',
        icon: '👥',
        earnedAt: new Date(Date.now() - 15 * 86400000)
      }
    ];

    await Badge.insertMany(badges);

    // Notifications
    const notifications = [
      {
        userId: student._id,
        type: 'assignment_graded',
        title: 'Assignment Graded',
        message: 'Your submission for "Graph Cycle Detection Algorithms" scored 48/50.',
        read: false,
        createdAt: new Date(Date.now() - 1 * 3600000)
      },
      {
        userId: student._id,
        type: 'badge_earned',
        title: 'Badge Earned!',
        message: 'You earned the "Subject Master" badge! 🎓',
        read: true,
        createdAt: new Date(Date.now() - 10 * 86400000)
      },
      {
        userId: student._id,
        type: 'assignment_published',
        title: 'New Assignment',
        message: 'Dr. Sarah Vance posted "AVL Tree Self-Balancing Implementation".',
        read: false,
        createdAt: new Date(Date.now() - 4 * 3600000)
      }
    ];

    await Notification.insertMany(notifications);

    console.log('\n✅ StudyTrack database seeded successfully!');
    console.log('----------------------------------------------------');
    console.log('Demo Student:');
    console.log('  Email:    demo@studytrack.com');
    console.log('  Password: Password123!');
    console.log('\nDemo Mentor:');
    console.log('  Email:    mentor@studytrack.com');
    console.log('  Password: Password123!');
    console.log('----------------------------------------------------\n');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

seedData();
