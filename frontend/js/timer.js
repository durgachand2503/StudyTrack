/* StudyTrack - Enhanced Pomodoro Study Timer */
import { api, createElement, showToast, getLocalDateStr } from './utils.js';

let timerInterval = null;
let timerState = 'idle'; // idle, running, paused
let startTimestamp = null;
let pausedElapsed = 0; // accumulated ms before current pause
let selectedDuration = 25; // minutes
let selectedSubject = '';
let selectedTaskId = null;

const RADIUS = 125;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function initTimer(container, user) {
  clearInterval(timerInterval);
  timerState = 'idle';
  container.innerHTML = '';

  const page = createElement('div', { className: 'animate-fade-in-up' });

  // Page Header
  page.appendChild(createElement('div', { className: 'page-header flex justify-between items-center flex-wrap gap-4' }, [
    createElement('div', {}, [
      createElement('h1', { className: 'page-title', textContent: 'Study Timer' }),
      createElement('p', { className: 'page-subtitle', textContent: 'Master deep focus with the scientifically proven Pomodoro technique' })
    ])
  ]));

  // Main Timer Card
  const timerCard = createElement('div', { className: 'timer-card-wrapper' });

  // Preset Durations
  const presetList = [
    { label: '⚡ 15m Sprint', value: 15 },
    { label: '🎯 25m Standard', value: 25 },
    { label: '📚 30m Focus', value: 30 },
    { label: '🚀 45m Deep', value: 45 },
    { label: '🔥 60m Flow', value: 60 }
  ];

  const presetsContainer = createElement('div', { className: 'timer-presets' });
  presetList.forEach(p => {
    const btn = createElement('button', {
      className: `timer-preset-btn ${p.value === selectedDuration ? 'active' : ''}`,
      textContent: p.label,
      onClick: () => {
        if (timerState !== 'idle') return;
        selectedDuration = p.value;
        presetsContainer.querySelectorAll('.timer-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateTimerDisplay();
      }
    });
    presetsContainer.appendChild(btn);
  });
  timerCard.appendChild(presetsContainer);

  // Subject Selector
  const subjects = user?.subjects?.length ? user.subjects : ['Mathematics', 'Physics', 'Computer Science', 'DSA', 'Machine Learning', 'English'];
  const subjectSelect = createElement('select', {
    className: 'form-select',
    id: 'timer-subject',
    style: { textAlign: 'center', fontWeight: '600', minHeight: '44px', borderRadius: 'var(--radius-lg)' }
  });
  subjectSelect.appendChild(createElement('option', { value: '', textContent: '🎯 Select Study Subject...' }));
  subjects.forEach(s => {
    subjectSelect.appendChild(createElement('option', { value: s, textContent: `📖 ${s}` }));
  });
  if (subjects.length > 0 && !selectedSubject) {
    selectedSubject = subjects[0];
    subjectSelect.value = subjects[0];
  }
  subjectSelect.onchange = (e) => {
    selectedSubject = e.target.value;
  };

  const subjectGroup = createElement('div', { className: 'form-group', style: { maxWidth: '320px', margin: '0 auto 1.5rem' } });
  subjectGroup.appendChild(subjectSelect);
  timerCard.appendChild(subjectGroup);

  // SVG Progress Display
  const timerDisplay = createElement('div', { className: 'timer-display', id: 'timer-display' });
  timerDisplay.innerHTML = `
    <div class="timer-circle">
      <svg class="timer-svg" viewBox="0 0 280 280">
        <defs>
          <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="var(--primary-400)" />
            <stop offset="100%" stop-color="var(--accent-400)" />
          </linearGradient>
        </defs>
        <circle class="timer-track" cx="140" cy="140" r="${RADIUS}" />
        <circle class="timer-progress" id="timer-progress-circle" cx="140" cy="140" r="${RADIUS}"
          stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="0" />
      </svg>
      <div class="timer-time" id="timer-time">${String(selectedDuration).padStart(2,'0')}:00</div>
      <div class="timer-status-badge" id="timer-badge">
        <span class="timer-status-dot"></span>
        <span id="timer-label">Ready to Focus</span>
      </div>
    </div>
  `;
  timerCard.appendChild(timerDisplay);

  // Controls
  const controls = createElement('div', { className: 'timer-controls', id: 'timer-controls' });
  timerCard.appendChild(controls);
  page.appendChild(timerCard);

  // Today's Study Sessions History
  const sessionsCard = createElement('div', { className: 'card', style: { maxWidth: '520px', margin: '1.75rem auto 0' } });
  sessionsCard.innerHTML = `
    <div class="card-header flex justify-between items-center">
      <h3 style="font-size:1.05rem">📊 Today's Focus Sessions</h3>
      <span class="text-xs text-muted" id="timer-sessions-date">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
    </div>
  `;
  const sessionsList = createElement('div', { id: 'timer-sessions', style: { marginTop: '0.5rem' } });
  sessionsCard.appendChild(sessionsList);
  page.appendChild(sessionsCard);

  container.appendChild(page);

  updateControls();
  loadTodaySessions();
}

function updateTimerDisplay() {
  const timeEl = document.getElementById('timer-time');
  if (timeEl && timerState === 'idle') {
    timeEl.textContent = `${String(selectedDuration).padStart(2, '0')}:00`;
  }
}

function updateStatusBadge(state, labelText) {
  const badge = document.getElementById('timer-badge');
  const label = document.getElementById('timer-label');
  if (badge && label) {
    badge.className = `timer-status-badge ${state}`;
    label.textContent = labelText;
  }
}

function startTimer() {
  const subjectEl = document.getElementById('timer-subject');
  selectedSubject = subjectEl?.value;
  if (!selectedSubject) {
    showToast('Please select a subject first', 'warning');
    subjectEl?.focus();
    return;
  }

  if (timerState === 'idle' || timerState === 'paused') {
    timerState = 'running';
    startTimestamp = Date.now();
    runTimer();
    updateControls();
    updateStatusBadge('running', 'In Deep Flow...');
  }
}

function pauseTimer() {
  if (timerState === 'running') {
    timerState = 'paused';
    pausedElapsed += Date.now() - startTimestamp;
    clearInterval(timerInterval);
    updateControls();
    updateStatusBadge('paused', 'Session Paused');
  }
}

function resetTimer() {
  timerState = 'idle';
  clearInterval(timerInterval);
  pausedElapsed = 0;
  startTimestamp = null;
  updateTimerDisplay();
  updateControls();
  updateStatusBadge('', 'Ready to Focus');

  const circle = document.getElementById('timer-progress-circle');
  if (circle) {
    circle.setAttribute('stroke-dashoffset', '0');
  }
}

function runTimer() {
  clearInterval(timerInterval);
  const totalMs = selectedDuration * 60 * 1000;

  timerInterval = setInterval(() => {
    if (timerState !== 'running') return;

    const currentElapsed = pausedElapsed + (Date.now() - startTimestamp);
    const remainingMs = Math.max(totalMs - currentElapsed, 0);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    const timeEl = document.getElementById('timer-time');
    if (timeEl) {
      timeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // Update circular SVG progress
    const progress = currentElapsed / totalMs;
    const circle = document.getElementById('timer-progress-circle');
    if (circle) {
      circle.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - Math.min(progress, 1))));
    }

    if (remainingMs <= 0) {
      completeTimer();
    }
  }, 200);
}

async function completeTimer() {
  clearInterval(timerInterval);
  timerState = 'idle';

  const actualMs = pausedElapsed + (Date.now() - startTimestamp);
  const actualMinutes = Math.round(actualMs / 60000) || selectedDuration;

  document.getElementById('timer-time').textContent = '00:00';
  updateStatusBadge('completed', '🎉 Focus Complete!');

  // Play celebratory audio chime with Web Audio API
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.45);
    });
  } catch {}

  // Save session to backend
  try {
    const now = new Date();
    const startTime = new Date(now.getTime() - actualMs);

    await api.createSession({
      subject: selectedSubject,
      taskId: selectedTaskId,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      duration: selectedDuration,
      actualDuration: actualMinutes || 1,
      status: 'completed',
      completed: true,
      localDate: getLocalDateStr()
    });

    showToast(`Great work! Logged ${actualMinutes}m of ${selectedSubject}`, 'success');
    loadTodaySessions();
  } catch (err) {
    showToast('Failed to save session: ' + err.message, 'error');
  }

  pausedElapsed = 0;
  startTimestamp = null;
  updateControls();
}

function updateControls() {
  const controls = document.getElementById('timer-controls');
  if (!controls) return;
  controls.innerHTML = '';

  if (timerState === 'idle') {
    controls.appendChild(createElement('button', {
      className: 'timer-btn timer-btn-primary-action',
      id: 'timer-start-btn',
      title: 'Start Focus Session',
      innerHTML: '▶',
      onClick: startTimer
    }));
  } else if (timerState === 'running') {
    controls.appendChild(createElement('button', {
      className: 'timer-btn timer-btn-pause-action',
      title: 'Pause Timer',
      innerHTML: '⏸',
      onClick: pauseTimer
    }));
    controls.appendChild(createElement('button', {
      className: 'timer-btn timer-btn-secondary-action',
      title: 'Reset Timer',
      innerHTML: '⏹',
      onClick: resetTimer
    }));
  } else if (timerState === 'paused') {
    controls.appendChild(createElement('button', {
      className: 'timer-btn timer-btn-primary-action',
      title: 'Resume Focus Session',
      innerHTML: '▶',
      onClick: startTimer
    }));
    controls.appendChild(createElement('button', {
      className: 'timer-btn timer-btn-secondary-action',
      title: 'Reset Timer',
      innerHTML: '⏹',
      onClick: resetTimer
    }));
  }
}

async function loadTodaySessions() {
  const el = document.getElementById('timer-sessions');
  if (!el) return;

  try {
    const result = await api.getTodaySessions(getLocalDateStr());
    if (!result?.success) return;

    el.innerHTML = '';
    const sessions = result.data.sessions || [];

    if (sessions.length === 0) {
      el.innerHTML = `
        <div class="text-sm text-muted text-center" style="padding: 1.75rem 1rem">
          <div style="font-size:1.75rem;margin-bottom:0.4rem">🌱</div>
          No sessions recorded today yet. Hit <strong>▶ Play</strong> to start your first session!
        </div>
      `;
      return;
    }

    sessions.forEach(s => {
      el.appendChild(createElement('div', {
        className: 'flex items-center justify-between gap-3',
        style: { padding: '0.65rem 0', borderBottom: '1px solid var(--border-secondary)' }
      }, [
        createElement('div', { className: 'flex items-center gap-3' }, [
          createElement('div', {
            className: 'stat-icon primary',
            style: { width: '34px', height: '34px', fontSize: '0.85rem' },
            textContent: '📖'
          }),
          createElement('div', {}, [
            createElement('div', { className: 'text-sm font-semibold', textContent: s.subject }),
            createElement('div', { className: 'text-xs text-muted', textContent: new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
          ])
        ]),
        createElement('span', { className: 'tag tag-primary text-xs font-semibold', textContent: `${s.actualDuration}m` })
      ]));
    });

    // Summary Row
    el.appendChild(createElement('div', {
      className: 'flex justify-between items-center border-t pt-3',
      style: { borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }
    }, [
      createElement('span', { className: 'text-secondary', textContent: 'Total Focus Today' }),
      createElement('span', { className: 'text-primary font-bold', textContent: `${result.data.totalMinutes || 0}m (${result.data.sessionCount || 0} sessions)` })
    ]));
  } catch {
    el.innerHTML = '<div class="text-xs text-muted text-center" style="padding:1rem">Could not load session history</div>';
  }
}

