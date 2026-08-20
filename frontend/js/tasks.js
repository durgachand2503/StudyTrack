/* StudyTrack - Tasks Module */
import { api, createElement, showToast, showLoading, showEmpty, showModal, closeModal, formatDate, formatDateTime, escapeHtml, priorityTag, statusTag } from './utils.js';

function formatDatetimeLocal(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let currentFilter = { status: '', priority: '', search: '' };

export function initTasks(container, user) {
  container.innerHTML = '';
  const page = createElement('div', { className: 'animate-fade-in-up' });

  // 1. Page Header
  page.appendChild(createElement('div', { className: 'page-header flex justify-between items-center flex-wrap gap-4' }, [
    createElement('div', {}, [
      createElement('h1', { className: 'page-title', textContent: 'Tasks & To-Dos' }),
      createElement('p', { className: 'page-subtitle', textContent: 'Organize your assignments, readings, and study goals' })
    ]),
    createElement('button', {
      className: 'btn btn-primary flex items-center gap-1',
      textContent: '➕ New Task',
      onClick: () => showTaskForm(user)
    })
  ]));

  // 2. Filter & Search Controls Bar
  const filtersCard = createElement('div', {
    className: 'card',
    style: { padding: '1rem', marginBottom: '1.5rem' }
  });

  const filterFlex = createElement('div', { className: 'flex justify-between items-center flex-wrap gap-3' });

  // Status Filter Tabs
  const statusTabs = createElement('div', { className: 'flex gap-2 flex-wrap' });
  const statuses = [
    { label: 'All Tasks', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in-progress' },
    { label: 'Completed', value: 'completed' }
  ];

  statuses.forEach(s => {
    const tabBtn = createElement('button', {
      className: `btn btn-sm ${currentFilter.status === s.value ? 'btn-primary' : 'btn-secondary'}`,
      textContent: s.label,
      onClick: () => {
        currentFilter.status = s.value;
        statusTabs.querySelectorAll('button').forEach(b => {
          b.className = 'btn btn-sm btn-secondary';
        });
        tabBtn.className = 'btn btn-sm btn-primary';
        loadTasks();
      }
    });
    statusTabs.appendChild(tabBtn);
  });

  // Priority Dropdown & Search Input
  const rightControls = createElement('div', { className: 'flex gap-2 items-center flex-wrap' });

  const prioritySelect = createElement('select', {
    className: 'form-select',
    style: { width: 'auto', minHeight: '34px', padding: '0.25rem 0.75rem', fontSize: '0.8125rem' }
  });
  [
    { label: 'All Priorities', value: '' },
    { label: '🔴 Urgent', value: 'urgent' },
    { label: '🟠 High', value: 'high' },
    { label: '🔵 Medium', value: 'medium' },
    { label: '⚪ Low', value: 'low' }
  ].forEach(p => {
    prioritySelect.appendChild(createElement('option', { value: p.value, textContent: p.label }));
  });
  prioritySelect.onchange = () => {
    currentFilter.priority = prioritySelect.value;
    loadTasks();
  };

  rightControls.appendChild(prioritySelect);
  filterFlex.appendChild(statusTabs);
  filterFlex.appendChild(rightControls);
  filtersCard.appendChild(filterFlex);
  page.appendChild(filtersCard);

  // 3. Tasks List Container
  page.appendChild(createElement('div', { id: 'tasks-list', className: 'flex flex-col gap-2' }));
  container.appendChild(page);

  loadTasks();
}

async function loadTasks() {
  const el = document.getElementById('tasks-list');
  if (!el) return;

  showLoading(el);

  try {
    const params = new URLSearchParams();
    if (currentFilter.status) params.set('status', currentFilter.status);
    if (currentFilter.priority) params.set('priority', currentFilter.priority);
    params.set('sortBy', 'dueDate');
    params.set('order', 'asc');

    const result = await api.getTasks(params.toString());
    if (!result?.success) return;

    el.innerHTML = '';
    if (result.data.tasks.length === 0) {
      el.innerHTML = `
        <div class="empty-state card" style="padding: 3rem 1.5rem">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No tasks found</div>
          <div class="empty-state-desc">You're all caught up! Create a new task or adjust your filters.</div>
          <button class="btn btn-primary btn-sm" id="empty-create-task-btn">➕ Create Task</button>
        </div>
      `;
      el.querySelector('#empty-create-task-btn')?.addEventListener('click', () => showTaskForm());
      return;
    }

    result.data.tasks.forEach(task => {
      el.appendChild(renderTaskItem(task));
    });
  } catch (err) {
    el.innerHTML = `
      <div class="card empty-state text-center" style="padding: 2rem">
        <div class="text-danger font-semibold">Failed to load tasks</div>
        <div class="text-xs text-muted" style="margin-top:4px">${escapeHtml(err.message)}</div>
      </div>
    `;
  }
}

function renderTaskItem(task) {
  const isCompleted = task.status === 'completed';

  const item = createElement('div', {
    className: `task-item card ${isCompleted ? 'task-completed-card' : ''}`,
    style: { padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }
  });

  const leftPart = createElement('div', { className: 'flex items-center gap-3', style: { flex: 1, minWidth: 0 } });

  const checkbox = createElement('div', {
    className: `task-checkbox ${isCompleted ? 'checked' : ''}`,
    title: isCompleted ? 'Mark as pending' : 'Mark as completed',
    textContent: isCompleted ? '✓' : '',
    onClick: async () => {
      try {
        if (isCompleted) {
          await api.reopenTask(task._id);
          showToast('Task reopened', 'info');
        } else {
          await api.completeTask(task._id);
          showToast('Task completed! 🎉', 'success');
        }
        loadTasks();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  const content = createElement('div', { style: { flex: 1, minWidth: 0 } }, [
    createElement('div', {
      className: `text-sm font-semibold truncate ${isCompleted ? 'task-title-completed' : ''}`,
      textContent: task.title
    }),
    createElement('div', { className: 'flex gap-2 items-center flex-wrap', style: { marginTop: '4px' } }, [
      task.subject ? createElement('span', { className: 'tag tag-primary text-xs', textContent: task.subject }) : null,
      priorityTag(task.priority),
      task.dueDate ? createElement('span', { className: 'text-xs text-muted font-medium', textContent: `📅 ${formatDateTime(task.dueDate)}` }) : null
    ].filter(Boolean))
  ]);

  leftPart.appendChild(checkbox);
  leftPart.appendChild(content);

  const actions = createElement('div', { className: 'flex items-center gap-1 flex-shrink-0' }, [
    createElement('button', {
      className: 'btn btn-ghost btn-icon btn-sm text-muted',
      textContent: '✏️',
      title: 'Edit task',
      onClick: () => showTaskForm(null, task)
    }),
    createElement('button', {
      className: 'btn btn-ghost btn-icon btn-sm text-danger',
      textContent: '🗑️',
      title: 'Delete task',
      onClick: async () => {
        if (confirm('Delete this task?')) {
          try {
            await api.deleteTask(task._id);
            showToast('Task deleted', 'info');
            loadTasks();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      }
    })
  ]);

  item.appendChild(leftPart);
  item.appendChild(actions);
  return item;
}

export function showTaskForm(user = null, existingTask = null, defaultDueDate = null, onSaved = null) {
  const isEdit = !!existingTask;
  const modal = createElement('div', { className: 'modal' });

  const initialDueDate = existingTask?.dueDate || defaultDueDate;

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${isEdit ? '✏️ Edit Task' : '➕ Create New Task'}</h3>
      <button class="modal-close" id="modal-close-btn" aria-label="Close modal">✕</button>
    </div>
    <form class="modal-body" id="task-form">
      <div class="form-group">
        <label class="form-label" for="task-title">Task Title</label>
        <input class="form-input" id="task-title" value="${escapeHtml(existingTask?.title || '')}" required placeholder="e.g., Complete Chapter 5 Calculus Exercises">
      </div>
      <div class="form-group">
        <label class="form-label" for="task-desc">Description (Optional)</label>
        <textarea class="form-textarea" id="task-desc" placeholder="Add study notes, links, or specific requirements...">${escapeHtml(existingTask?.description || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="task-subject">Subject / Course</label>
          <input class="form-input" id="task-subject" value="${escapeHtml(existingTask?.subject || '')}" placeholder="e.g., Mathematics" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="task-priority">Priority</label>
          <select class="form-select" id="task-priority">
            <option value="low" ${existingTask?.priority === 'low' ? 'selected' : ''}>⚪ Low Priority</option>
            <option value="medium" ${(!existingTask || existingTask?.priority === 'medium') ? 'selected' : ''}>🔵 Medium Priority</option>
            <option value="high" ${existingTask?.priority === 'high' ? 'selected' : ''}>🟠 High Priority</option>
            <option value="urgent" ${existingTask?.priority === 'urgent' ? 'selected' : ''}>🔴 Urgent</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="task-due">Due Date & Time</label>
          <input class="form-input" type="datetime-local" id="task-due" value="${formatDatetimeLocal(initialDueDate)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="task-category">Category</label>
          <select class="form-select" id="task-category">
            <option value="general" ${existingTask?.category === 'general' ? 'selected' : ''}>General Task</option>
            <option value="assignment" ${existingTask?.category === 'assignment' ? 'selected' : ''}>Assignment</option>
            <option value="exam" ${existingTask?.category === 'exam' ? 'selected' : ''}>Exam Prep</option>
            <option value="project" ${existingTask?.category === 'project' ? 'selected' : ''}>Project</option>
            <option value="reading" ${existingTask?.category === 'reading' ? 'selected' : ''}>Reading</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="margin-top:1.5rem;padding:0;background:transparent;border:none">
        <button type="button" class="btn btn-secondary" id="task-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary" id="task-submit-btn">${isEdit ? 'Save Changes' : 'Create Task'}</button>
      </div>
    </form>
  `;

  const overlay = showModal(modal);

  modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#task-cancel-btn').onclick = () => closeModal(overlay);

  modal.querySelector('#task-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = modal.querySelector('#task-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const dueVal = document.getElementById('task-due').value;
    const data = {
      title: document.getElementById('task-title').value.trim(),
      description: document.getElementById('task-desc').value.trim(),
      subject: document.getElementById('task-subject').value.trim(),
      priority: document.getElementById('task-priority').value,
      category: document.getElementById('task-category').value,
      dueDate: dueVal ? new Date(dueVal).toISOString() : null
    };

    try {
      if (isEdit) {
        await api.updateTask(existingTask._id, data);
        showToast('Task updated!', 'success');
      } else {
        await api.createTask(data);
        showToast('Task created!', 'success');
      }
      closeModal(overlay);
      if (onSaved) {
        onSaved();
      } else {
        loadTasks();
      }
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? 'Save Changes' : 'Create Task';
    }
  };
}
