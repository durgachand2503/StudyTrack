/* StudyTrack - Analytics Module */
import { api, createElement, showLoading, getLocalDateStr, formatDuration } from './utils.js';
import { initHeatmap } from './heatmap.js';

export async function initAnalytics(container, user) {
  container.innerHTML = '';
  const page = createElement('div', { className: 'animate-fade-in-up' });

  page.appendChild(createElement('div', { className: 'page-header' }, [
    createElement('h1', { className: 'page-title', textContent: 'Analytics' }),
    createElement('p', { className: 'page-subtitle', textContent: 'Track your study patterns and progress' })
  ]));

  // Stats row
  page.appendChild(createElement('div', { className: 'stats-grid', id: 'analytics-stats' }));

  // Charts grid
  const grid = createElement('div', { className: 'dashboard-grid', style: { marginTop: '1.5rem' } });

  // Weekly activity chart
  const weeklyCard = createElement('div', { className: 'card' });
  weeklyCard.innerHTML = `<div class="card-header"><h3>📈 Weekly Activity</h3></div>`;
  weeklyCard.appendChild(createElement('div', { style: { height: '250px' } }, [
    createElement('canvas', { id: 'analytics-weekly' })
  ]));
  grid.appendChild(weeklyCard);

  // Subject breakdown
  const subjectCard = createElement('div', { className: 'card' });
  subjectCard.innerHTML = `<div class="card-header"><h3>📚 Subject Distribution</h3></div>`;
  subjectCard.appendChild(createElement('div', { style: { height: '250px' } }, [
    createElement('canvas', { id: 'analytics-subjects' })
  ]));
  grid.appendChild(subjectCard);

  // Monthly productivity
  const monthlyCard = createElement('div', { className: 'card' });
  monthlyCard.innerHTML = `<div class="card-header"><h3>📅 Monthly Productivity</h3></div>`;
  monthlyCard.appendChild(createElement('div', { style: { height: '250px' } }, [
    createElement('canvas', { id: 'analytics-monthly' })
  ]));
  grid.appendChild(monthlyCard);

  // Task stats
  const taskCard = createElement('div', { className: 'card' });
  taskCard.innerHTML = `<div class="card-header"><h3>✅ Task Progress</h3></div>`;
  taskCard.appendChild(createElement('div', { id: 'analytics-tasks' }));
  grid.appendChild(taskCard);

  page.appendChild(grid);

  // Heatmap
  const heatmapCard = createElement('div', { className: 'card', style: { marginTop: '1.5rem' } });
  heatmapCard.innerHTML = `<div class="card-header"><h3>🟩 Study Heatmap</h3></div>`;
  heatmapCard.appendChild(createElement('div', { id: 'analytics-heatmap' }));
  page.appendChild(heatmapCard);

  container.appendChild(page);
  await loadAnalytics(user);
}

async function loadAnalytics(user) {
  const today = getLocalDateStr();

  try {
    const [statsRes, weeklyRes, subjectRes, monthlyRes, taskRes, heatmapRes] = await Promise.all([
      api.getStudyStats(today),
      api.getWeeklyActivity(today),
      api.getSubjectBreakdown(),
      api.getMonthlyProductivity(today),
      api.getTaskStats(),
      api.getHeatmapData(today)
    ]);

    // Stats cards
    const statsEl = document.getElementById('analytics-stats');
    if (statsEl && statsRes?.success) {
      statsEl.innerHTML = '';
      const s = statsRes.data;
      const items = [
        { icon: '⏱️', cls: 'primary', value: formatDuration(s.allTime.minutes), label: 'Total Study Time' },
        { icon: '📊', cls: 'info', value: `${s.allTime.sessions}`, label: 'Total Sessions' },
        { icon: '🔥', cls: 'warning', value: `${s.streak.current} days`, label: 'Current Streak' },
        { icon: '🏅', cls: 'success', value: `${s.streak.longest} days`, label: 'Longest Streak' }
      ];
      items.forEach(st => {
        statsEl.appendChild(createElement('div', { className: 'stat-card' }, [
          createElement('div', { className: `stat-icon ${st.cls}`, textContent: st.icon }),
          createElement('div', {}, [
            createElement('div', { className: 'stat-value', textContent: st.value }),
            createElement('div', { className: 'stat-label', textContent: st.label })
          ])
        ]));
      });
    }

    // Weekly chart
    const weeklyCanvas = document.getElementById('analytics-weekly');
    if (weeklyCanvas && weeklyRes?.success) {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      new Chart(weeklyCanvas, {
        type: 'line',
        data: {
          labels: weeklyRes.data.map(d => d.dayName),
          datasets: [{
            label: 'Study Minutes',
            data: weeklyRes.data.map(d => d.totalMinutes),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#6366f1',
            pointRadius: 5
          }, {
            label: 'Sessions',
            data: weeklyRes.data.map(d => (d.sessionCount || 0) * 10), // Scale for visibility
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: false,
            tension: 0.4,
            pointBackgroundColor: '#10b981',
            pointRadius: 4,
            borderDash: [5, 5]
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { font: { size: 11 } } } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // Subject chart
    const subjectCanvas = document.getElementById('analytics-subjects');
    if (subjectCanvas && subjectRes?.success && subjectRes.data.length) {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
      new Chart(subjectCanvas, {
        type: 'polarArea',
        data: {
          labels: subjectRes.data.map(s => s.subject),
          datasets: [{
            data: subjectRes.data.map(s => s.totalMinutes),
            backgroundColor: subjectRes.data.map((_, i) => colors[i % colors.length] + '90'),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 10 } } }
        }
      });
    }

    // Monthly chart
    const monthlyCanvas = document.getElementById('analytics-monthly');
    if (monthlyCanvas && monthlyRes?.success && monthlyRes.data.length) {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      new Chart(monthlyCanvas, {
        type: 'bar',
        data: {
          labels: monthlyRes.data.map(d => {
            const dt = new Date(d.date + 'T12:00:00');
            return dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
          }),
          datasets: [{
            label: 'Hours',
            data: monthlyRes.data.map(d => +(d.totalMinutes / 60).toFixed(1)),
            backgroundColor: 'rgba(99, 102, 241, 0.6)',
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, title: { display: true, text: 'Hours' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // Task stats
    const tasksEl = document.getElementById('analytics-tasks');
    if (tasksEl && taskRes?.success) {
      const t = taskRes.data;
      const completed = t.byStatus?.completed || 0;
      const pending = t.byStatus?.pending || 0;
      const inProgress = t.byStatus?.['in-progress'] || 0;
      const overdue = t.byStatus?.overdue || 0;
      const completionRate = t.completionRate !== undefined ? t.completionRate : (t.total > 0 ? Math.round((completed / t.total) * 100) : 0);

      tasksEl.innerHTML = `
        <div style="text-align:center;padding:1rem 0">
          <div style="font-size:2.5rem;font-weight:800;color:var(--primary-500)">${completionRate}%</div>
          <div class="text-muted" style="margin-bottom:1rem">Completion Rate</div>
          <div class="progress-bar" style="margin-bottom:1rem">
            <div class="progress-fill ${completionRate >= 75 ? 'success' : completionRate >= 50 ? '' : 'warning'}" style="width:${completionRate}%"></div>
          </div>
          <div class="flex justify-center gap-6 text-sm flex-wrap">
            <div><span class="font-bold">${completed}</span> completed</div>
            <div><span class="font-bold">${pending}</span> pending</div>
            ${inProgress > 0 ? `<div><span class="font-bold">${inProgress}</span> in progress</div>` : ''}
            <div><span class="font-bold">${overdue}</span> overdue</div>
          </div>
        </div>
      `;
    }

    // Heatmap
    const heatmapEl = document.getElementById('analytics-heatmap');
    if (heatmapEl && heatmapRes?.success) {
      initHeatmap(heatmapEl, heatmapRes.data);
    }
  } catch (err) {
    console.error('Analytics error:', err);
  }
}
