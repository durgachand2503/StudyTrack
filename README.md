# StudyTrack — Smart Study Management Platform

StudyTrack is a full-stack, real-time study management platform designed to help students plan, track, and master their academic journey with smart focus timers, visual analytics, interactive heatmaps, collaborative study groups, mentor channels, assignments, and achievement badges.

---

## 🌟 Key Features

- **⏱️ Smart Focus Timer (Pomodoro)**: Timestamp-based, background-tab safe study timer with customizable durations (15m, 25m, 30m, 45m, 60m), animated SVG progress ring, audio alerts, and automatic session recording.
- **📊 Interactive Dashboard**: Real-time study statistics (daily/weekly goals, active streaks, subject distribution, task queues, and recent achievements).
- **✅ Task Management**: Full CRUD task management with priority levels (urgent, high, medium, low), categorization, due dates, and completion status toggling.
- **📅 FullCalendar Integration**: Month and week calendar views rendering scheduled tasks, deadlines, and completed study sessions.
- **📈 Advanced Analytics & Heatmap**:
  - Weekly study minutes & session activity line charts.
  - Polar area charts for subject distribution.
  - Monthly productivity bar charts.
  - 365-day GitHub-style interactive study activity heatmap with hover tooltips.
- **👥 Study Groups & Real-Time Chat**: Collaborative student study groups with member directory, roles (admin/moderator/member), and Socket.io real-time chat with message history.
- **📺 Mentor Channels & Resources**: Curated learning channels with mentor broadcasts, multi-type resources (videos, articles, docs, links), and channel discussions.
- **📝 Assignments & Submissions**: Mentor assignment publishing, deadline tracking, student file/link submissions, and grading with feedback.
- **🏆 Gamified Badges**: 14 unlockable milestone badges based on study time, streaks, multi-subject mastery, task completion, and community participation.
- **🔍 Global Search**: Fast, debounced search across tasks, study groups, and mentor channels.
- **🌓 Multi-Theme Support**: Instant switching between Light, Dark, and System preference themes with FOUC prevention.

---

## 🏗️ Architecture & Tech Stack

### Backend
- **Runtime**: Node.js & Express
- **Database**: MongoDB with Mongoose ODM
- **Real-Time**: Socket.io (rooms, messaging, live notifications)
- **Auth & Security**: JWT (Access + Refresh tokens), bcrypt password hashing, Helmet, CORS, and Express Rate Limiting.
- **File Uploads**: Multer with MIME and extension filtering for avatars and assignment attachments.

### Frontend
- **Bundler & Dev Server**: Vite
- **UI & Design**: Vanilla JavaScript (ES modules) & Vanilla CSS Design System with dark mode tokens, micro-animations, and responsive layout.
- **Libraries**: Chart.js for data visualization, FullCalendar for scheduling, Socket.io Client for live events.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) running locally on `localhost:27017`

### 2. Backend Setup
```bash
cd backend
npm install
npm run seed     # Seeds demo students, mentors, sessions, tasks, groups, channels, and badges
npm run dev      # Starts API server on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev      # Starts frontend on http://localhost:5173
```

---

## 🔑 Demo Credentials

| Role | Email | Password | Description |
|---|---|---|---|
| **Student** | `demo@studytrack.com` | `Password123!` | Active student account with streaks, sessions, groups, and badges |
| **Mentor** | `mentor@studytrack.com` | `Password123!` | Instructor account managing channels, resources, and grading assignments |

---

## 🧪 Testing & Verification

Run the end-to-end integration test suite against the backend API:
```bash
cd backend
npm test
```
All 21 API test suites verify authentication, analytics, task CRUD, session recording, group chats, mentor channels, and badges.
