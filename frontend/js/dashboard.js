/* StudyTrack - Dashboard Module */
import { api, createElement, showToast, showLoading, showEmpty, showError, getLocalDateStr, formatDuration, escapeHtml, formatDate } from './utils.js';

export async function initDashboard(container, user) {
  container.innerHTML = '';
  const page = createElement('div', { className: 'animate-fade-in-up' });

  // 1. Page Header with Greeting, Date & Quick Actions
  const greeting = getGreeting();
  const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  const headerDiv = createElement('div', { className: 'page-header flex justify-between items-center flex-wrap gap-4' }, [
    createElement('div', {}, [
      createElement('h1', { className: 'page-title', textContent: `${greeting}, ${user?.name?.split(' ')[0] || 'Student'}! 👋` }),
      createElement('p', { className: 'page-subtitle', textContent: `Today is ${todayFormatted} • Ready to make progress?` })
    ]),
    createElement('div', { className: 'flex gap-2 flex-wrap' }, [
      createElement('button', {
        className: 'btn btn-primary btn-sm flex items-center gap-1',
        textContent: '⏱️ Start Focus',
        onClick: () => window.studyTrack?.navigateTo('timer')
      }),
      createElement('button', {
        className: 'btn btn-secondary btn-sm flex items-center gap-1',
        textContent: '➕ New Task',
        onClick: () => window.studyTrack?.navigateTo('tasks')
      }),
      createElement('button', {
        className: 'btn btn-secondary btn-sm flex items-center gap-1',
        textContent: '📅 Calendar',
        onClick: () => window.studyTrack?.navigateTo('calendar')
      })
    ])
  ]);
  page.appendChild(headerDiv);

  // 2. Stats Grid
  const statsGrid = createElement('div', { className: 'stats-grid', id: 'dash-stats' });
  // Initial skeletons for stats
  for (let i = 0; i < 4; i++) {
    statsGrid.appendChild(createElement('div', { className: 'stat-card' }, [
      createElement('div', { className: 'stat-icon primary', style: { opacity: 0.5 } }),
      createElement('div', { style: { flex: 1 } }, [
        createElement('div', { style: { height: '24px', width: '60%', background: 'var(--bg-tertiary)', borderRadius: '4px', marginBottom: '4px' } }),
        createElement('div', { style: { height: '14px', width: '40%', background: 'var(--bg-tertiary)', borderRadius: '4px' } })
      ])
    ]));
  }
  page.appendChild(statsGrid);

  // 3. Main Dashboard Grid
  const grid = createElement('div', { className: 'dashboard-grid', style: { marginTop: '1.5rem' } });

  // Quick Focus Card
  const timerCard = createElement('div', { className: 'card card-gradient card-hover flex flex-col justify-between', style: { cursor: 'pointer', minHeight: '220px' } });
  timerCard.onclick = () => window.studyTrack?.navigateTo('timer');
  timerCard.innerHTML = `
    <div>
      <div class="card-header" style="margin-bottom:0.5rem">
        <h3 style="color:#fff;font-size:1.15rem">⏱️ Focus Session</h3>
        <span class="tag" style="background:rgba(255,255,255,0.25);color:#fff">Pomodoro</span>
      </div>
      <p style="color:rgba(255,255,255,0.85);font-size:0.875rem;line-height:1.4">Eliminate distractions and enter deep study flow.</p>
    </div>
    <div class="flex items-center justify-between" style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.2)">
      <span style="font-size:0.8125rem;color:rgba(255,255,255,0.9);font-weight:600">25m Standard</span>
      <button class="btn btn-sm" style="background:#ffffff;color:var(--primary-700);font-weight:700">Start Timer →</button>
    </div>
  `;
  grid.appendChild(timerCard);

  // Today's tasks card
  const tasksCard = createElement('div', { className: 'card card-hover flex flex-col' });
  tasksCard.innerHTML = `
    <div class="card-header">
      <h3 style="font-size:1.1rem">✅ Pending Tasks</h3>
      <a href="#/tasks" class="text-xs font-semibold" style="color:var(--primary-500)">View All →</a>
    </div>
  `;
  const tasksList = createElement('div', { id: 'dash-tasks', style: { flex: 1 } });
  tasksCard.appendChild(tasksList);
  grid.appendChild(tasksCard);

  // Weekly study time chart
  const chartCard = createElement('div', { className: 'card card-hover flex flex-col' });
  chartCard.innerHTML = `<div class="card-header"><h3 style="font-size:1.1rem">📈 Weekly Activity</h3></div>`;
  const chartWrapper = createElement('div', { style: { position: 'relative', height: '180px', flex: 1 } });
  chartWrapper.appendChild(createElement('canvas', { id: 'dash-weekly-chart' }));
  chartCard.appendChild(chartWrapper);
  grid.appendChild(chartCard);

  // Study Streak & Consistency Card
  const streakCard = createElement('div', { className: 'card card-hover flex flex-col justify-between', id: 'dash-streak' });
  grid.appendChild(streakCard);

  // Subject Distribution Chart
  const subjectCard = createElement('div', { className: 'card card-hover flex flex-col' });
  subjectCard.innerHTML = `<div class="card-header"><h3 style="font-size:1.1rem">📚 Subject Breakdown</h3></div>`;
  const subjectWrapper = createElement('div', { style: { position: 'relative', height: '180px', flex: 1 } });
  subjectWrapper.appendChild(createElement('canvas', { id: 'dash-subject-chart' }));
  subjectCard.appendChild(subjectWrapper);
  grid.appendChild(subjectCard);

  // Recent Badges & Achievements
  const badgeCard = createElement('div', { className: 'card card-hover flex flex-col', id: 'dash-badges' });
  badgeCard.innerHTML = `
    <div class="card-header">
      <h3 style="font-size:1.1rem">🏆 Achievements</h3>
      <a href="#/badges" class="text-xs font-semibold" style="color:var(--primary-500)">All Badges →</a>
    </div>
  `;
  grid.appendChild(badgeCard);

  page.appendChild(grid);
  container.appendChild(page);

  // Load live data
  await loadDashboardData(user);
}

async function loadDashboardData(user) {
  const today = getLocalDateStr();

  try {
    const [statsRes, weeklyRes, subjectRes, tasksRes, badgesRes] = await Promise.all([
      api.getStudyStats(today),
      api.getWeeklyActivity(today),
      api.getSubjectBreakdown(),
      api.getTasks('status=pending&sortBy=dueDate&order=asc&limit=4'),
      api.getBadges()
    ]);

    // 1. Render Stats
    const statsGrid = document.getElementById('dash-stats');
    if (statsGrid && statsRes?.success) {
      const s = statsRes.data;
      statsGrid.innerHTML = '';
      const goalPct = Math.min(100, Math.round((s.week.minutes / (s.weeklyGoal || 600)) * 100));
      const stats = [
        { icon: '⏱️', cls: 'primary', value: formatDuration(s.today.minutes), label: 'Today Study Time' },
        { icon: '📅', cls: 'info', value: formatDuration(s.week.minutes), label: 'This Week Total' },
        { icon: '🔥', cls: 'warning', value: `${s.streak.current} ${s.streak.current === 1 ? 'day' : 'days'}`, label: 'Active Streak' },
        { icon: '🎯', cls: 'success', value: `${goalPct}%`, label: 'Weekly Goal Progress' }
      ];
      stats.forEach(st => {
        statsGrid.appendChild(createElement('div', { className: 'stat-card' }, [
          createElement('div', { className: `stat-icon ${st.cls}`, textContent: st.icon }),
          createElement('div', {}, [
            createElement('div', { className: 'stat-value', textContent: st.value }),
            createElement('div', { className: 'stat-label', textContent: st.label })
          ])
        ]));
      });
    }

    // 2. Render Streak
    const streakEl = document.getElementById('dash-streak');
    if (streakEl && statsRes?.success) {
      const s = statsRes.data.streak;
      streakEl.innerHTML = `
        <div class="card-header">
          <h3 style="font-size:1.1rem">🔥 Study Streak</h3>
          <span class="tag tag-warning">Best: ${s.longest}d</span>
        </div>
        <div style="text-align:center;padding:1rem 0">
          <div style="font-family:var(--font-heading);font-size:3rem;font-weight:800;color:var(--warning);line-height:1">${s.current}</div>
          <div class="text-sm font-semibold text-muted" style="margin-top:0.25rem">Consecutive Study Days</div>
          <div class="text-xs text-tertiary" style="margin-top:0.5rem">${s.current >= 3 ? '🎉 Amazing consistency! Keep it up!' : 'Study today to maintain your streak!'}</div>
        </div>
      `;
    }

    // 3. Render Tasks
    const tasksList = document.getElementById('dash-tasks');
    if (tasksList && tasksRes?.success) {
      tasksList.innerHTML = '';
      if (tasksRes.data.tasks.length === 0) {
        tasksList.innerHTML = `
          <div class="empty-state" style="padding:1.5rem 0">
            <div class="empty-state-icon" style="font-size:1.75rem">🎉</div>
            <div class="text-sm font-semibold text-primary">All caught up!</div>
            <div class="text-xs text-muted" style="margin-top:2px">No pending tasks for today.</div>
          </div>
        `;
      } else {
        tasksRes.data.tasks.forEach(t => {
          const taskRow = createElement('div', {
            className: 'task-item',
            style: { marginBottom: '0.45rem', padding: '0.5rem 0.75rem' }
          });

          const checkbox = createElement('div', {
            className: 'task-checkbox',
            title: 'Complete task',
            onClick: async () => {
              try {
                await api.completeTask(t._id);
                showToast('Task completed! 🎉', 'success');
                taskRow.remove();
                if (tasksList.children.length === 0) {
                  tasksList.innerHTML = `
                    <div class="empty-state" style="padding:1.5rem 0">
                      <div class="empty-state-icon" style="font-size:1.75rem">🎉</div>
                      <div class="text-sm font-semibold text-primary">All caught up!</div>
                    </div>
                  `;
                }
              } catch (err) {
                showToast(err.message, 'error');
              }
            }
          });

          const content = createElement('div', { style: { flex: 1, minWidth: 0, margin: '0 0.5rem' } }, [
            createElement('div', { className: 'text-sm font-medium truncate', textContent: t.title }),
            createElement('div', { className: 'text-xs text-muted truncate', textContent: `${t.subject || 'General'}${t.dueDate ? ' • ' + formatDate(t.dueDate) : ''}` })
          ]);

          const priorityBadge = createElement('span', {
            className: `tag tag-${t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : t.priority === 'medium' ? 'primary' : 'secondary'} text-xs`,
            textContent: t.priority
          });

          taskRow.appendChild(checkbox);
          taskRow.appendChild(content);
          taskRow.appendChild(priorityBadge);
          tasksList.appendChild(taskRow);
        });
      }
    }

    // 4. Render Weekly Bar Chart
    const weeklyCanvas = document.getElementById('dash-weekly-chart');
    if (weeklyCanvas && weeklyRes?.success) {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      new Chart(weeklyCanvas, {
        type: 'bar',
        data: {
          labels: weeklyRes.data.map(d => d.dayName),
          datasets: [{
            label: 'Minutes',
            data: weeklyRes.data.map(d => d.totalMinutes),
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            hoverBackgroundColor: 'rgba(99, 102, 241, 1)',
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw} minutes study time`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(150, 150, 150, 0.1)' },
              ticks: { font: { size: 10 } }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11, weight: '600' } }
            }
          }
        }
      });
    }

    // 5. Render Subject Doughnut Chart
    const subjectCanvas = document.getElementById('dash-subject-chart');
    if (subjectCanvas && subjectRes?.success) {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      const items = subjectRes.data || [];
      if (items.length === 0) {
        subjectCanvas.parentElement.innerHTML = `
          <div class="empty-state" style="padding:1.5rem 0">
            <div class="empty-state-icon" style="font-size:1.75rem">📚</div>
            <div class="text-xs text-muted">Complete sessions to see subject distribution</div>
          </div>
        `;
      } else {
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
        new Chart(subjectCanvas, {
          type: 'doughnut',
          data: {
            labels: items.map(s => s.subject),
            datasets: [{
              data: items.map(s => s.totalMinutes),
              backgroundColor: items.map((_, i) => colors[i % colors.length]),
              borderWidth: 0,
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8, boxWidth: 10 } },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.label}: ${ctx.raw}m`
                }
              }
            },
            cutout: '68%'
          }
        });
      }
    }

    // 6. Render Badges
    const badgeEl = document.getElementById('dash-badges');
    if (badgeEl && badgesRes?.success) {
      const earned = (badgesRes.data.badges || []).filter(b => b.earned).slice(0, 4);
      if (earned.length === 0) {
        badgeEl.innerHTML += `
          <div class="empty-state" style="padding:1.5rem 0">
            <div class="empty-state-icon" style="font-size:1.75rem">🏆</div>
            <div class="text-xs text-muted">Complete study goals to unlock your first badge!</div>
          </div>
        `;
      } else {
        const badgeRow = createElement('div', { className: 'flex gap-3 justify-center flex-wrap', style: { padding: '0.5rem 0' } });
        earned.forEach(b => {
          badgeRow.appendChild(createElement('div', {
            className: 'text-center card card-hover',
            style: { padding: '0.75rem', minWidth: '70px', borderRadius: 'var(--radius-lg)' }
          }, [
            createElement('div', { textContent: b.icon, style: { fontSize: '1.75rem', marginBottom: '2px' } }),
            createElement('div', { className: 'text-xs font-semibold truncate', textContent: b.name, style: { maxWidth: '80px' } })
          ]));
        });
        badgeEl.appendChild(badgeRow);
      }
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
