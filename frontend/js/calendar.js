/* StudyTrack - Calendar Module */
import { api, createElement, showToast, showModal, closeModal, formatDate, formatDateTime, escapeHtml, priorityTag, statusTag } from './utils.js';
import { showTaskForm } from './tasks.js';

let calendar = null;

export async function initCalendar(container, user) {
  container.innerHTML = '';
  const page = createElement('div', { className: 'animate-fade-in-up' });

  // 1. Page Header with "+ Schedule Task" button
  page.appendChild(createElement('div', { className: 'page-header flex justify-between items-center flex-wrap gap-4' }, [
    createElement('div', {}, [
      createElement('h1', { className: 'page-title', textContent: 'Calendar & Schedule' }),
      createElement('p', { className: 'page-subtitle', textContent: 'Visualize deadlines, scheduled tasks, and study sessions across time' })
    ]),
    createElement('div', { className: 'flex gap-2' }, [
      createElement('button', {
        className: 'btn btn-primary flex items-center gap-1',
        textContent: '➕ Schedule Task',
        onClick: () => {
          showTaskForm(user, null, null, () => {
            if (calendar) calendar.refetchEvents();
          });
        }
      })
    ])
  ]));

  // 2. Calendar Card Container
  const calCard = createElement('div', { className: 'card', style: { padding: '1.25rem' } });
  calCard.appendChild(createElement('div', { id: 'calendar-container' }));
  page.appendChild(calCard);
  container.appendChild(page);

  // 3. Dynamically import FullCalendar
  try {
    const { Calendar } = await import('@fullcalendar/core');
    const dayGridPlugin = (await import('@fullcalendar/daygrid')).default;
    const timeGridPlugin = (await import('@fullcalendar/timegrid')).default;
    const interactionPlugin = (await import('@fullcalendar/interaction')).default;

    const calendarEl = document.getElementById('calendar-container');
    if (!calendarEl) return;

    calendar = new Calendar(calendarEl, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: window.innerWidth < 768 ? 'dayGridMonth' : 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      eventTimeFormat: {
        hour: 'numeric',
        minute: '2-digit',
        meridiem: 'short'
      },
      events: async (fetchInfo, successCallback) => {
        try {
          const [tasksRes, sessionsRes] = await Promise.all([
            api.getTasks('limit=200'),
            api.getSessions(`from=${encodeURIComponent(fetchInfo.startStr)}&to=${encodeURIComponent(fetchInfo.endStr)}&limit=100`)
          ]);

          const events = [];

          // Tasks as events
          if (tasksRes?.success) {
            tasksRes.data.tasks.forEach(t => {
              if (t.dueDate) {
                const priorityColors = {
                  urgent: '#ef4444',
                  high: '#f59e0b',
                  medium: '#6366f1',
                  low: '#64748b'
                };
                const color = t.status === 'completed' ? '#10b981' : (priorityColors[t.priority] || '#6366f1');

                events.push({
                  id: `task-${t._id}`,
                  title: `${t.status === 'completed' ? '✓' : '📋'} [${t.subject || 'General'}] ${t.title}`,
                  start: t.dueDate,
                  allDay: false,
                  backgroundColor: color,
                  borderColor: color,
                  textColor: '#ffffff',
                  extendedProps: { type: 'task', data: t }
                });
              }
            });
          }

          // Sessions as events
          if (sessionsRes?.success) {
            const sessionsList = sessionsRes.data?.sessions || (Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
            sessionsList.forEach(s => {
              events.push({
                id: `session-${s._id}`,
                title: `⏱️ [${s.subject}] ${s.actualDuration}m Session`,
                start: s.startTime,
                end: s.endTime,
                backgroundColor: '#3b82f6',
                borderColor: '#3b82f6',
                textColor: '#ffffff',
                extendedProps: { type: 'session', data: s }
              });
            });
          }

          successCallback(events);
        } catch {
          successCallback([]);
        }
      },
      dateClick: (info) => {
        // Quick schedule task on clicked date/time
        showTaskForm(user, null, info.dateStr, () => {
          if (calendar) calendar.refetchEvents();
        });
      },
      eventClick: (info) => {
        const { type, data } = info.event.extendedProps;
        showCalendarEventModal(type, data, user);
      },
      height: 'auto',
      dayMaxEvents: 4,
      editable: false
    });

    calendar.render();
  } catch (err) {
    console.error('Calendar init error:', err);
    document.getElementById('calendar-container').innerHTML =
      '<div class="text-center text-muted" style="padding:3rem">Failed to load calendar. Please check your network connection.</div>';
  }
}

function showCalendarEventModal(type, data, user) {
  const modal = createElement('div', { className: 'modal', style: { maxWidth: '520px' } });

  if (type === 'task') {
    const isCompleted = data.status === 'completed';
    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">📋 Task Details</h3>
        <button class="modal-close" id="cal-modal-close" aria-label="Close modal">✕</button>
      </div>
      <div class="modal-body">
        <h4 class="font-semibold text-lg ${isCompleted ? 'text-muted' : ''}" style="${isCompleted ? 'text-decoration:line-through' : ''};margin-bottom:0.5rem">
          ${escapeHtml(data.title)}
        </h4>
        <div class="flex gap-2 items-center flex-wrap" style="margin-bottom:0.75rem">
          <span class="tag tag-primary">${escapeHtml(data.subject)}</span>
          ${priorityTag(data.priority)}
          <span class="tag ${isCompleted ? 'tag-success' : 'tag-secondary'}">${isCompleted ? '✓ Completed' : 'Pending'}</span>
          <span class="tag tag-secondary text-xs">${escapeHtml(data.category || 'General')}</span>
        </div>
        ${data.description ? `
          <div class="card" style="padding:0.875rem;margin-bottom:0.875rem;background:var(--bg-tertiary)">
            <div class="text-xs text-muted font-medium" style="margin-bottom:2px">Description / Notes:</div>
            <p class="text-sm" style="margin:0;line-height:1.4">${escapeHtml(data.description)}</p>
          </div>
        ` : ''}
        <div class="text-sm text-muted" style="margin-bottom:1.25rem">
          <div>📅 <strong>Scheduled Due:</strong> ${formatDateTime(data.dueDate)}</div>
        </div>
        <div class="modal-footer" style="padding:0;background:transparent;border:none;justify-content:space-between">
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" id="cal-edit-btn">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm text-danger" id="cal-delete-btn">🗑️ Delete</button>
          </div>
          <div class="flex gap-2">
            <button class="btn ${isCompleted ? 'btn-secondary' : 'btn-success'} btn-sm" id="cal-toggle-btn">
              ${isCompleted ? 'Reopen Task' : '✓ Mark Complete'}
            </button>
          </div>
        </div>
      </div>
    `;

    const overlay = showModal(modal);
    modal.querySelector('#cal-modal-close').onclick = () => closeModal(overlay);

    // Toggle Complete / Reopen
    modal.querySelector('#cal-toggle-btn').onclick = async () => {
      try {
        if (isCompleted) {
          await api.reopenTask(data._id);
          showToast('Task reopened', 'info');
        } else {
          await api.completeTask(data._id);
          showToast('Task completed! 🎉', 'success');
        }
        closeModal(overlay);
        if (calendar) calendar.refetchEvents();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    // Edit Task
    modal.querySelector('#cal-edit-btn').onclick = () => {
      closeModal(overlay);
      showTaskForm(user, data, null, () => {
        if (calendar) calendar.refetchEvents();
      });
    };

    // Delete Task
    modal.querySelector('#cal-delete-btn').onclick = async () => {
      if (confirm(`Delete task "${data.title}"?`)) {
        try {
          await api.deleteTask(data._id);
          showToast('Task deleted', 'info');
          closeModal(overlay);
          if (calendar) calendar.refetchEvents();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    };
  } else {
    // Session modal
    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">⏱️ Study Session Summary</h3>
        <button class="modal-close" id="cal-modal-close" aria-label="Close modal">✕</button>
      </div>
      <div class="modal-body">
        <h4 class="font-semibold text-lg" style="margin-bottom:0.25rem">${escapeHtml(data.subject)}</h4>
        <div class="stat-value" style="color:var(--primary-500);margin:0.5rem 0">${data.actualDuration} minutes</div>
        <div class="text-sm text-muted" style="line-height:1.6">
          <div><strong>Start Time:</strong> ${formatDateTime(data.startTime)}</div>
          <div><strong>End Time:</strong> ${formatDateTime(data.endTime)}</div>
        </div>
        ${data.notes ? `<div class="card" style="padding:0.75rem;margin-top:0.75rem;background:var(--bg-tertiary)"><div class="text-xs text-muted font-medium">Session Notes:</div><div class="text-sm">${escapeHtml(data.notes)}</div></div>` : ''}
      </div>
    `;

    const overlay = showModal(modal);
    modal.querySelector('#cal-modal-close').onclick = () => closeModal(overlay);
  }
}
