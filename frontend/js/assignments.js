/* StudyTrack - Assignments Module */
import { api, createElement, showToast, showLoading, showEmpty, showModal, closeModal, escapeHtml, formatDate, formatDateTime } from './utils.js';

export function initAssignments(container, user) {
  container.innerHTML = '';
  const page = createElement('div', { className: 'animate-fade-in-up' });

  const isMentor = user?.role === 'mentor';

  page.appendChild(createElement('div', { className: 'page-header flex justify-between items-center flex-wrap gap-4' }, [
    createElement('div', {}, [
      createElement('h1', { className: 'page-title', textContent: 'Assignments' }),
      createElement('p', { className: 'page-subtitle', textContent: isMentor ? 'Create and grade assignments for your channels' : 'View and submit your assignments' })
    ]),
    isMentor ? createElement('button', {
      className: 'btn btn-primary',
      textContent: '+ New Assignment',
      onClick: () => showAssignmentForm(user)
    }) : null
  ].filter(Boolean)));

  page.appendChild(createElement('div', { id: 'assignments-list' }));
  container.appendChild(page);

  loadAssignments(user);
}

async function loadAssignments(user) {
  const el = document.getElementById('assignments-list');
  if (!el) return;
  showLoading(el);

  try {
    const result = await api.getAssignments('status=published');
    if (!result?.success) return;

    el.innerHTML = '';
    if (result.data.length === 0) {
      showEmpty(el, '📝', 'No assignments yet', user?.role === 'mentor' ? 'Create your first assignment for your mentor channel.' : 'Join a mentor channel to receive and submit course assignments.');
      return;
    }

    result.data.forEach(a => {
      const isPastDue = new Date(a.dueDate) < new Date();
      const card = createElement('div', { className: 'card card-hover', style: { marginBottom: '0.75rem' } });

      card.innerHTML = `
        <div class="flex justify-between items-start flex-wrap gap-3">
          <div style="flex:1;min-width:0">
            <h4 class="font-semibold">${escapeHtml(a.title)}</h4>
            <p class="text-sm text-muted" style="margin-top:0.25rem">${escapeHtml(a.description || '')}</p>
            <div class="flex gap-3 flex-wrap" style="margin-top:0.5rem">
              <span class="text-xs text-muted">📅 Due: ${formatDateTime(a.dueDate)}</span>
              <span class="text-xs text-muted">🏅 ${a.maxPoints} points</span>
              <span class="text-xs text-muted">📺 ${escapeHtml(a.channelId?.name || '')}</span>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            ${isPastDue ? '<span class="tag tag-danger">Past Due</span>' : '<span class="tag tag-success">Active</span>'}
          </div>
        </div>
      `;

      // Action buttons row
      const actionsRow = createElement('div', { className: 'flex gap-2', style: { marginTop: '0.75rem' } });

      const isOwnerMentor = user?.role === 'mentor' && ((a.mentor?._id || a.mentor)?.toString()) === ((user?._id || user?.id)?.toString());
      if (isOwnerMentor) {
        actionsRow.appendChild(createElement('button', {
          className: 'btn btn-secondary btn-sm', textContent: '📊 View Submissions',
          onClick: () => showSubmissions(a)
        }));
        actionsRow.appendChild(createElement('button', {
          className: 'btn btn-ghost btn-sm', textContent: '🗑️ Delete',
          onClick: async () => {
            if (confirm('Delete this assignment and all submissions?')) {
              await api.deleteAssignment(a._id);
              showToast('Assignment deleted', 'info');
              loadAssignments(user);
            }
          }
        }));
      } else {
        actionsRow.appendChild(createElement('button', {
          className: 'btn btn-primary btn-sm', textContent: '📤 View / Submit',
          onClick: () => showAssignmentDetail(a, user)
        }));
      }

      card.appendChild(actionsRow);
      el.appendChild(card);
    });
  } catch {
    el.innerHTML = '<div class="text-sm text-muted text-center" style="padding:2rem">Failed to load assignments</div>';
  }
}

async function showAssignmentDetail(assignment, user) {
  try {
    const result = await api.getAssignment(assignment._id);
    if (!result?.success) return;

    const { assignment: a, submission } = result.data;

    const modal = createElement('div', { className: 'modal', style: { maxWidth: '640px' } });
    modal.innerHTML = `
      <div class="modal-header">
        <h3>${escapeHtml(a.title)}</h3>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">
        <div class="text-sm">${escapeHtml(a.description || 'No description.')}</div>
        ${a.instructions ? `<div class="card" style="padding:1rem;background:var(--bg-tertiary);margin-top:0.5rem"><h5 class="font-semibold text-sm" style="margin-bottom:0.5rem">Instructions</h5><div class="text-sm">${escapeHtml(a.instructions)}</div></div>` : ''}
        <div class="flex gap-4 text-sm text-muted" style="margin-top:0.5rem">
          <span>📅 Due: ${formatDateTime(a.dueDate)}</span>
          <span>🏅 ${a.maxPoints} points</span>
        </div>

        ${submission && submission.status === 'graded' ? `
          <div class="card" style="padding:1rem;margin-top:1rem;border-color:var(--accent-400)">
            <h5 class="font-semibold text-sm" style="margin-bottom:0.5rem">✅ Graded</h5>
            <div class="stat-value" style="color:var(--primary-500)">${submission.score}/${a.maxPoints}</div>
            ${submission.feedback ? `<div class="text-sm text-muted" style="margin-top:0.5rem">${escapeHtml(submission.feedback)}</div>` : ''}
          </div>
        ` : submission ? `
          <div class="card" style="padding:1rem;margin-top:1rem">
            <h5 class="font-semibold text-sm">📤 Submitted</h5>
            <div class="text-xs text-muted">${formatDateTime(submission.submittedAt)}</div>
            ${submission.isLate ? '<span class="tag tag-warning" style="margin-top:0.25rem">Late Submission</span>' : ''}
          </div>
        ` : ''}

        ${!submission || a.allowResubmission ? `
          <form id="submit-form" style="margin-top:1rem">
            <div class="form-group">
              <label class="form-label">${submission ? 'Resubmit' : 'Your Submission'}</label>
              <textarea class="form-textarea" id="sub-content" placeholder="Write your answer or notes..." rows="4">${escapeHtml(submission?.content || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">URL (optional)</label>
              <input class="form-input" id="sub-url" type="url" placeholder="Link to document or repo..." value="${escapeHtml(submission?.url || '')}">
            </div>
            <button type="submit" class="btn btn-primary">${submission ? 'Resubmit' : 'Submit Assignment'}</button>
          </form>
        ` : ''}
      </div>
    `;

    const overlay = showModal(modal);
    modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);

    const form = modal.querySelector('#submit-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api.request(`/assignments/${a._id}/submit`, {
            method: 'POST',
            body: JSON.stringify({
              content: document.getElementById('sub-content').value,
              url: document.getElementById('sub-url').value
            }),
            headers: { 'Content-Type': 'application/json' }
          });
          showToast('Assignment submitted!', 'success');
          closeModal(overlay);
          loadAssignments(user);
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showSubmissions(assignment) {
  try {
    const result = await api.getSubmissions(assignment._id);
    if (!result?.success) return;

    const modal = createElement('div', { className: 'modal', style: { maxWidth: '700px' } });
    const header = `
      <div class="modal-header">
        <h3>Submissions: ${escapeHtml(assignment.title)}</h3>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
    `;

    const body = createElement('div', { className: 'modal-body' });

    if (result.data.length === 0) {
      body.innerHTML = '<div class="empty-state" style="padding:2rem"><div class="empty-state-icon" style="font-size:2rem">📭</div><div class="text-sm text-muted">No submissions yet</div></div>';
    } else {
      result.data.forEach(sub => {
        const subCard = createElement('div', { className: 'card', style: { padding: '1rem', marginBottom: '0.75rem' } });
        const studentName = sub.studentId?.name || 'Student';

        subCard.innerHTML = `
          <div class="flex justify-between items-start">
            <div>
              <div class="font-semibold text-sm">${escapeHtml(studentName)}</div>
              <div class="text-xs text-muted">${formatDateTime(sub.submittedAt)} ${sub.isLate ? '<span class="tag tag-warning">Late</span>' : ''}</div>
              ${sub.content ? `<div class="text-sm" style="margin-top:0.5rem;max-height:80px;overflow:auto">${escapeHtml(sub.content)}</div>` : ''}
              ${sub.url ? `<a href="${escapeHtml(sub.url)}" target="_blank" class="text-sm" style="margin-top:0.25rem;display:block">🔗 Attached Link</a>` : ''}
            </div>
            <div class="text-right">
              ${sub.status === 'graded' ? `<div class="tag tag-success">${sub.score}/${assignment.maxPoints}</div>` : '<div class="tag tag-gray">Pending</div>'}
            </div>
          </div>
        `;

        // Grade form
        if (sub.status !== 'graded') {
          const gradeForm = createElement('form', { className: 'flex gap-2 items-end', style: { marginTop: '0.75rem' } });
          gradeForm.innerHTML = `
            <div class="form-group" style="flex:1">
              <input class="form-input" type="number" placeholder="Score" min="0" max="${assignment.maxPoints}" required id="grade-score-${sub._id}">
            </div>
            <div class="form-group" style="flex:2">
              <input class="form-input" type="text" placeholder="Feedback (optional)" id="grade-feedback-${sub._id}">
            </div>
            <button type="submit" class="btn btn-success btn-sm">Grade</button>
          `;
          gradeForm.onsubmit = async (e) => {
            e.preventDefault();
            try {
              await api.gradeSubmission(assignment._id, sub._id, {
                score: parseInt(document.getElementById(`grade-score-${sub._id}`).value),
                feedback: document.getElementById(`grade-feedback-${sub._id}`).value
              });
              showToast('Submission graded!', 'success');
              showSubmissions(assignment); // Refresh
            } catch (err) {
              showToast(err.message, 'error');
            }
          };
          subCard.appendChild(gradeForm);
        }

        body.appendChild(subCard);
      });
    }

    modal.innerHTML = header;
    modal.appendChild(body);

    const overlay = showModal(modal);
    modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showAssignmentForm(user) {
  // Load user's channels
  let channels = [];
  try {
    const result = await api.getChannels('myChannels=true');
    if (result?.success) {
      const currentUserId = (user?._id || user?.id)?.toString();
      channels = result.data.filter(ch => (ch.mentor?._id || ch.mentor)?.toString() === currentUserId);
    }
  } catch {}

  if (channels.length === 0) {
    showToast('Create a mentor channel first before creating assignments.', 'warning');
    return;
  }

  const modal = createElement('div', { className: 'modal' });
  const channelOptions = channels.map(ch => `<option value="${ch._id}">${escapeHtml(ch.name)}</option>`).join('');

  modal.innerHTML = `
    <div class="modal-header">
      <h3>New Assignment</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <form class="modal-body" id="assignment-form">
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="asgn-title" required placeholder="e.g., Binary Search Implementation" maxlength="100">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="asgn-desc" placeholder="Brief overview..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Instructions</label>
        <textarea class="form-textarea" id="asgn-instructions" rows="4" placeholder="Detailed instructions for students..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Channel</label>
          <select class="form-select" id="asgn-channel" required>${channelOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Max Points</label>
          <input class="form-input" type="number" id="asgn-points" value="100" min="1" max="1000">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input class="form-input" type="datetime-local" id="asgn-due" required>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:0.5rem;padding-top:1.5rem">
          <input type="checkbox" id="asgn-resubmit">
          <label for="asgn-resubmit" class="text-sm">Allow resubmission</label>
        </div>
      </div>
      <div class="modal-footer" style="padding:0;border:none">
        <button type="button" class="btn btn-secondary" id="asgn-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Create & Publish</button>
      </div>
    </form>
  `;

  const overlay = showModal(modal);
  modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#asgn-cancel-btn').onclick = () => closeModal(overlay);

  modal.querySelector('#assignment-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createAssignment({
        title: document.getElementById('asgn-title').value,
        description: document.getElementById('asgn-desc').value,
        instructions: document.getElementById('asgn-instructions').value,
        channelId: document.getElementById('asgn-channel').value,
        dueDate: new Date(document.getElementById('asgn-due').value).toISOString(),
        maxPoints: parseInt(document.getElementById('asgn-points').value) || 100,
        published: true,
        allowResubmission: document.getElementById('asgn-resubmit').checked
      });
      showToast('Assignment published!', 'success');
      closeModal(overlay);
      loadAssignments(user);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}
