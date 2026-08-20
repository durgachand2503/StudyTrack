/* StudyTrack - Study Groups Module */
import { api, createElement, showToast, showLoading, showEmpty, showModal, closeModal, escapeHtml, timeAgo } from './utils.js';
import { getSocket, joinRoom, leaveRoom, sendMessage } from './socket.js';

let activeGroupId = null;
let currentContainer = null;
let currentUser = null;

export function getActiveGroupId() {
  return activeGroupId;
}

export function leaveActiveGroup() {
  if (activeGroupId) {
    leaveRoom('group', activeGroupId);
    activeGroupId = null;
  }
  const socket = getSocket();
  if (socket) {
    socket.off('group-message');
    socket.off('group-message-deleted');
    socket.off('group-messages-cleared');
  }
}

export function initGroups(container, user, initialGroupId = null) {
  currentContainer = container;
  currentUser = user || window.studyTrack?.getCurrentUser();
  if (activeGroupId && activeGroupId !== initialGroupId) {
    leaveRoom('group', activeGroupId);
    activeGroupId = null;
  }
  if (initialGroupId) {
    openGroupChatView(initialGroupId);
  } else {
    renderGroupsListView();
  }
}

function renderGroupsListView(filterParam = 'myGroups=true') {
  currentContainer.innerHTML = '';
  if (activeGroupId) {
    leaveRoom('group', activeGroupId);
    activeGroupId = null;
  }

  const page = createElement('div', { className: 'animate-fade-in-up' });

  // Page Header
  page.appendChild(createElement('div', { className: 'page-header flex justify-between items-center flex-wrap gap-4' }, [
    createElement('div', {}, [
      createElement('h1', { className: 'page-title', textContent: 'Study Groups' }),
      createElement('p', { className: 'page-subtitle', textContent: 'Collaborate with peers, discuss topics, and study together' })
    ]),
    createElement('button', {
      className: 'btn btn-primary',
      textContent: '+ Create Group',
      onClick: () => showGroupForm(currentUser)
    })
  ]));

  // Filters & Search Bar
  const filtersRow = createElement('div', {
    className: 'flex items-center justify-between flex-wrap gap-3',
    style: { marginBottom: '1.5rem' }
  });

  const filterBtns = createElement('div', { className: 'flex gap-2' });
  const myBtn = createElement('button', {
    className: `btn ${filterParam.includes('myGroups') ? 'btn-secondary' : 'btn-ghost'} btn-sm`,
    textContent: '👥 My Groups',
    onClick: () => renderGroupsListView('myGroups=true')
  });
  const allBtn = createElement('button', {
    className: `btn ${!filterParam || filterParam === '' ? 'btn-secondary' : 'btn-ghost'} btn-sm`,
    textContent: '🌐 All Groups',
    onClick: () => renderGroupsListView('')
  });
  filterBtns.appendChild(myBtn);
  filterBtns.appendChild(allBtn);

  const searchInput = createElement('input', {
    className: 'form-input',
    placeholder: 'Search study groups...',
    style: { maxWidth: '280px', fontSize: '0.875rem', padding: '0.4rem 0.8rem' }
  });
  searchInput.oninput = (e) => loadGroupCards(groupsContainer, `search=${encodeURIComponent(e.target.value)}`);

  filtersRow.appendChild(filterBtns);
  filtersRow.appendChild(searchInput);
  page.appendChild(filtersRow);

  // Groups Grid Container
  const groupsContainer = createElement('div', {
    id: 'groups-cards-container',
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '1rem'
    }
  });
  page.appendChild(groupsContainer);
  currentContainer.appendChild(page);

  loadGroupCards(groupsContainer, filterParam);
}

async function loadGroupCards(container, params = '') {
  showLoading(container);
  try {
    const result = await api.getGroups(params);
    if (!result?.success) return;

    container.innerHTML = '';
    const groups = result.data.groups || [];

    if (groups.length === 0) {
      showEmpty(container, '👥', 'No study groups found', 'Create a new group or join existing ones to collaborate.',
        createElement('button', { className: 'btn btn-primary btn-sm', textContent: '+ Create Study Group', onClick: () => showGroupForm(currentUser) })
      );
      return;
    }

    groups.forEach(group => {
      const curId = (currentUser?._id || currentUser?.id)?.toString();
      const isMember = group.members?.some(m => (m.userId?._id || m.userId)?.toString() === curId);

      const card = createElement('div', {
        className: 'card card-hover flex flex-col justify-between',
        style: { cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' },
        onClick: () => openGroupChatView(group)
      });

      card.innerHTML = `
        <div>
          <div class="flex justify-between items-start gap-2" style="margin-bottom:0.5rem">
            <div class="flex items-center gap-2">
              <div class="user-avatar" style="width:36px;height:36px;font-size:0.9rem;background:linear-gradient(135deg, var(--primary-500), var(--primary-700));color:#fff">
                ${group.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 class="font-semibold" style="font-size:1rem;line-height:1.2">${escapeHtml(group.name)}</h4>
                <span class="text-xs text-muted">Created by ${escapeHtml(group.creator?.name || 'Peer')}</span>
              </div>
            </div>
            <span class="tag tag-primary text-xs">${escapeHtml(group.category || 'General')}</span>
          </div>
          <p class="text-sm text-muted" style="margin:0.5rem 0;min-height:36px;line-height:1.4">
            ${escapeHtml(group.description || 'No description provided.')}
          </p>
        </div>
        <div class="flex justify-between items-center border-t pt-3" style="border-top:1px solid var(--border-color);margin-top:0.75rem">
          <div class="flex items-center gap-2 text-xs text-muted">
            <span>👥 ${group.members?.length || 0} members</span>
            ${isMember ? '<span class="tag tag-success text-xs">Joined</span>' : ''}
          </div>
          <button class="btn ${isMember ? 'btn-primary' : 'btn-secondary'} btn-sm">
            ${isMember ? '💬 Open Chat' : '👉 Join & Chat'}
          </button>
        </div>
      `;

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<div class="text-sm text-muted text-center" style="padding:2rem">Failed to load groups. Please try again.</div>';
  }
}

export async function openGroupChatView(groupOrId) {
  let group = groupOrId;
  if (typeof groupOrId === 'string') {
    if (currentContainer) showLoading(currentContainer);
    try {
      const res = await api.getGroup(groupOrId);
      if (res?.success && res.data && res.data._id) {
        group = res.data;
      } else {
        renderGroupsListView();
        return;
      }
    } catch {
      renderGroupsListView();
      return;
    }
  }

  if (!group || !group._id) {
    renderGroupsListView();
    return;
  }

  // Leave previous room if any
  if (activeGroupId && activeGroupId !== group._id) leaveRoom('group', activeGroupId);
  activeGroupId = group._id;
  joinRoom('group', group._id);

  try {
    history.replaceState(null, '', `#/groups/${group._id}`);
  } catch {}

  currentContainer.innerHTML = '';

  const curUserId = (currentUser?._id || currentUser?.id)?.toString();
  const isCreator = (group.creator?._id || group.creator)?.toString() === curUserId;
  const isMember = group.members?.some(m => (m.userId?._id || m.userId)?.toString() === curUserId);
  const isAdmin = group.members?.some(m => (m.userId?._id || m.userId)?.toString() === curUserId && m.role === 'admin') || isCreator;

  const page = createElement('div', { className: 'chat-page-layout animate-fade-in-up' });

  // ── Fixed Sticky Chat Header ──
  const chatHeader = createElement('div', {
    className: 'chat-sticky-header flex justify-between items-center flex-wrap gap-3'
  });

  const headerLeft = createElement('div', { className: 'flex items-center gap-3' }, [
    createElement('button', {
      className: 'btn btn-secondary btn-sm flex items-center gap-1',
      style: { fontWeight: '600', padding: '0.45rem 0.85rem' },
      textContent: '← Back to Groups',
      title: 'Return to groups list',
      onClick: () => {
        leaveRoom('group', group._id);
        activeGroupId = null;
        try {
          history.replaceState(null, '', '#/groups');
        } catch {}
        renderGroupsListView();
      }
    }),
    createElement('div', {
      className: 'user-avatar',
      style: { width: '38px', height: '38px', fontSize: '1rem', background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))', color: '#fff' },
      textContent: group.name.charAt(0).toUpperCase()
    }),
    createElement('div', {}, [
      createElement('div', { className: 'flex items-center gap-2' }, [
        createElement('h3', { className: 'font-semibold', style: { margin: 0, fontSize: '1.1rem' }, textContent: group.name }),
        createElement('span', { className: 'tag tag-primary text-xs', textContent: group.category || 'General' })
      ]),
      createElement('div', { className: 'text-xs text-muted', textContent: `👥 ${group.members?.length || 0} members · Active study group` })
    ])
  ]);

  const headerRight = createElement('div', { className: 'flex items-center gap-2 relative' });

  // View members button
  headerRight.appendChild(createElement('button', {
    className: 'btn btn-ghost btn-sm',
    textContent: '👥 Members',
    title: 'View member list',
    onClick: () => showGroupMembersModal(group)
  }));

  if (!isMember) {
    headerRight.appendChild(createElement('button', {
      className: 'btn btn-primary btn-sm',
      textContent: '✓ Join Group',
      onClick: async () => {
        try {
          await api.joinGroup(group._id);
          showToast('Joined group successfully!', 'success');
          const updated = await api.getGroup(group._id);
          if (updated?.success) openGroupChatView(updated.data);
        } catch (err) { showToast(err.message, 'error'); }
      }
    }));
  } else {
    // Options Menu Button (Delete by Date, Clear Chat, Leave/Delete Group)
    const optionsBtn = createElement('button', {
      className: 'btn btn-ghost btn-sm',
      style: { fontSize: '1.1rem', padding: '0.35rem 0.65rem' },
      textContent: '⋮',
      title: 'Chat options & message management',
      onClick: (e) => {
        e.stopPropagation();
        const existing = headerRight.querySelector('.chat-options-dropdown');
        if (existing) {
          existing.remove();
          return;
        }

        const dropdown = createElement('div', { className: 'chat-options-dropdown' });

        // Option: Delete by Date
        const deleteDateItem = createElement('button', {
          className: 'chat-options-item',
          innerHTML: '<span>📅</span> <span>Delete Messages by Date</span>',
          onClick: () => {
            dropdown.remove();
            showDeleteMessagesByDateModal(group._id, isAdmin, () => loadGroupMessages(messagesEl, group._id, currentUser, group, isAdmin));
          }
        });
        dropdown.appendChild(deleteDateItem);

        // Option: Clear Entire Chat
        const clearChatItem = createElement('button', {
          className: 'chat-options-item danger',
          innerHTML: '<span>🗑️</span> <span>Clear / Delete Chat</span>',
          onClick: () => {
            dropdown.remove();
            showClearChatModal(group._id, isAdmin, () => loadGroupMessages(messagesEl, group._id, currentUser, group, isAdmin));
          }
        });
        dropdown.appendChild(clearChatItem);

        // Option: Leave or Delete Group
        if (isAdmin && isCreator) {
          const delGroupItem = createElement('button', {
            className: 'chat-options-item danger',
            innerHTML: '<span>💥</span> <span>Delete Group Permanently</span>',
            onClick: async () => {
              dropdown.remove();
              if (confirm('Permanently delete this entire study group? This cannot be undone.')) {
                try {
                  await api.deleteGroup(group._id);
                  showToast('Group deleted', 'info');
                  leaveRoom('group', group._id);
                  activeGroupId = null;
                  renderGroupsListView();
                } catch (err) { showToast(err.message, 'error'); }
              }
            }
          });
          dropdown.appendChild(delGroupItem);
        } else {
          const leaveGroupItem = createElement('button', {
            className: 'chat-options-item danger',
            innerHTML: '<span>🚪</span> <span>Leave Group</span>',
            onClick: async () => {
              dropdown.remove();
              if (confirm('Are you sure you want to leave this study group?')) {
                try {
                  await api.leaveGroup(group._id);
                  showToast('Left group', 'info');
                  leaveRoom('group', group._id);
                  activeGroupId = null;
                  renderGroupsListView();
                } catch (err) { showToast(err.message, 'error'); }
              }
            }
          });
          dropdown.appendChild(leaveGroupItem);
        }

        headerRight.appendChild(dropdown);

        const closeDropdown = () => {
          dropdown.remove();
          document.removeEventListener('click', closeDropdown);
        };
        setTimeout(() => document.addEventListener('click', closeDropdown), 10);
      }
    });

    headerRight.appendChild(optionsBtn);
  }

  chatHeader.appendChild(headerLeft);
  chatHeader.appendChild(headerRight);
  page.appendChild(chatHeader);

  // ── Dedicated Chat Card (Scrollable message viewport + Bottom input) ──
  const chatCard = createElement('div', { className: 'chat-main-card' });

  // Messages Stream Viewport
  const messagesEl = createElement('div', {
    id: 'group-messages-container',
    className: 'chat-messages-viewport'
  });
  chatCard.appendChild(messagesEl);

  // Bottom Input Bar
  if (isMember) {
    const inputBar = createElement('div', {
      className: 'chat-input-bar flex gap-2 items-center',
      style: {
        padding: '0.85rem 1.25rem',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        flexShrink: 0
      }
    });

    const input = createElement('input', {
      className: 'form-input',
      placeholder: `Message #${escapeHtml(group.name)}... (Press Enter to send)`,
      style: { flex: '1', borderRadius: 'var(--radius-full)', padding: '0.6rem 1.2rem' }
    });

    const sendBtn = createElement('button', {
      className: 'btn btn-primary',
      style: { borderRadius: 'var(--radius-full)', padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' },
      textContent: 'Send ➤',
      onClick: () => sendGroupMessage(input)
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendGroupMessage(input);
      }
    });

    inputBar.appendChild(input);
    inputBar.appendChild(sendBtn);
    chatCard.appendChild(inputBar);
  } else {
    chatCard.appendChild(createElement('div', {
      className: 'text-center text-muted flex flex-col items-center justify-center gap-2',
      style: { padding: '1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 },
      innerHTML: `
        <div class="text-sm">You are viewing this group as a visitor. Join to participate and send messages!</div>
        <button class="btn btn-primary btn-sm" id="join-chat-prompt-btn">Join Group Now</button>
      `
    }));

    setTimeout(() => {
      const btn = chatCard.querySelector('#join-chat-prompt-btn');
      if (btn) {
        btn.onclick = async () => {
          try {
            await api.joinGroup(group._id);
            showToast('Joined group!', 'success');
            const updated = await api.getGroup(group._id);
            if (updated?.success) openGroupChatView(updated.data);
          } catch (err) { showToast(err.message, 'error'); }
        };
      }
    }, 10);
  }

  page.appendChild(chatCard);
  currentContainer.appendChild(page);

  if (!isMember) {
    messagesEl.innerHTML = `
      <div class="flex flex-col items-center justify-center text-center p-8 m-auto" style="max-width: 480px;">
        <div style="font-size: 3.5rem; margin-bottom: 1rem;">🔒</div>
        <h3 class="font-bold text-lg mb-2">Group Chat Locked</h3>
        <p class="text-muted text-sm mb-6" style="line-height: 1.6;">
          Join this group to access the chat and participate in the discussion.
        </p>
        <button id="main-join-group-btn" class="btn btn-primary btn-lg" style="padding: 0.75rem 2rem; border-radius: var(--radius-full); font-weight: 600;">
          ➕ Join Group
        </button>
      </div>
    `;

    setTimeout(() => {
      const btn = messagesEl.querySelector('#main-join-group-btn');
      if (btn) {
        btn.onclick = async () => {
          try {
            await api.joinGroup(group._id);
            showToast('Joined group!', 'success');
            const updated = await api.getGroup(group._id);
            if (updated?.success) openGroupChatView(updated.data);
          } catch (err) { showToast(err.message, 'error'); }
        };
      }
    }, 10);
  } else {
    // Setup Real-time listeners
    const socket = getSocket();
    if (socket) {
      joinRoom('group', group._id);
      socket.off('group-message');
      socket.off('group-message-deleted');
      socket.off('group-messages-cleared');

      socket.on('group-message', (msg) => {
        if (msg.groupId === activeGroupId) {
          appendChatMessage(messagesEl, msg, currentUser, group, isAdmin);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      });

      socket.on('group-message-deleted', (data) => {
        if (data.groupId === activeGroupId) {
          const msgEl = messagesEl.querySelector(`[data-message-id="${data.messageId}"]`);
          if (msgEl) {
            const textEl = msgEl.querySelector('.chat-msg-text');
            if (textEl) {
              textEl.innerHTML = '<span class="chat-msg-deleted">🚫 This message was deleted</span>';
            }
            const actionsEl = msgEl.querySelector('.chat-msg-actions');
            if (actionsEl) actionsEl.remove();
          }
        }
      });

      socket.on('group-messages-cleared', (data) => {
        if (data.groupId === activeGroupId) {
          loadGroupMessages(messagesEl, group._id, currentUser, group, isAdmin);
        }
      });
    }

    // Load message history
    loadGroupMessages(messagesEl, group._id, currentUser, group, isAdmin);
  }
}

async function loadGroupMessages(container, groupId, currentUser, group, isAdmin) {
  showLoading(container);
  try {
    const result = await api.getGroupMessages(groupId);
    if (!result?.success) return;

    container.innerHTML = '';
    const messages = result.data.messages || [];

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted flex flex-col items-center justify-center" style="margin:auto;padding:2rem">
          <div style="font-size:2.5rem;margin-bottom:0.5rem">💬</div>
          <h4 class="font-semibold text-sm">No messages yet</h4>
          <p class="text-xs text-muted" style="margin-top:0.25rem">Be the first to say hello and start the study session!</p>
        </div>
      `;
      return;
    }

    messages.forEach(msg => {
      appendChatMessage(container, msg, currentUser, group, isAdmin);
    });

    container.scrollTop = container.scrollHeight;
  } catch (err) {
    container.innerHTML = '<div class="text-sm text-muted text-center" style="padding:2rem">Failed to load message history.</div>';
  }
}

function sendGroupMessage(input) {
  const content = input.value.trim();
  if (!content || !activeGroupId) return;
  sendMessage('group', activeGroupId, content);
  input.value = '';
  input.focus();
}

function appendChatMessage(container, msg, currentUser, group, isAdmin) {
  // Clear placeholder if present
  const placeholder = container.querySelector('.text-muted');
  if (placeholder && placeholder.closest('.text-center')) {
    container.innerHTML = '';
  }

  // System join/leave event messages
  if (msg.isSystem) {
    const timeStr = new Date(msg.timestamp || msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isLeave = msg.content?.includes('left');
    const icon = isLeave ? '🚪' : '✨';
    const sysEl = createElement('div', {
      className: 'chat-system-message animate-fade-in',
      dataset: { messageId: msg._id || '' }
    }, [
      createElement('span', { textContent: icon }),
      createElement('span', { className: 'font-medium', textContent: `${timeStr} — ${msg.content}` })
    ]);
    container.appendChild(sysEl);
    return;
  }

  const senderId = msg.sender?._id || msg.sender;
  const isOwn = senderId === currentUser?._id;
  const canDelete = !msg.isDeleted && (isOwn || isAdmin);
  const senderName = msg.sender?.name || (isOwn ? 'You' : 'Member');
  const avatarLetter = (senderName || 'U').charAt(0).toUpperCase();

  const row = createElement('div', {
    className: `chat-msg-row ${isOwn ? 'own' : ''}`,
    dataset: { messageId: msg._id || '' }
  });

  const avatar = createElement('div', {
    className: 'user-avatar',
    style: {
      width: '32px',
      height: '32px',
      fontSize: '0.75rem',
      flexShrink: 0,
      background: isOwn ? 'var(--primary-600)' : 'var(--bg-tertiary)',
      color: isOwn ? '#fff' : 'var(--text-primary)'
    },
    textContent: avatarLetter
  });

  const bubble = createElement('div', {
    className: 'chat-msg-bubble',
    style: {
      background: isOwn ? 'var(--primary-500)' : 'var(--bg-card)',
      color: isOwn ? '#ffffff' : 'var(--text-primary)',
      border: isOwn ? 'none' : '1px solid var(--border-color)',
      borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
      padding: '0.65rem 1rem',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative'
    }
  }, [
    !isOwn ? createElement('div', {
      className: 'chat-msg-name text-xs font-semibold',
      style: { color: 'var(--primary-400)', marginBottom: '2px' },
      textContent: senderName
    }) : null,
    createElement('div', {
      className: 'chat-msg-text text-sm',
      style: { wordBreak: 'break-word', lineHeight: '1.4' },
      innerHTML: msg.isDeleted
        ? '<span class="chat-msg-deleted">🚫 This message was deleted</span>'
        : escapeHtml(msg.content)
    }),
    createElement('div', {
      className: 'chat-msg-time text-xs',
      style: {
        color: isOwn ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
        textAlign: 'right',
        marginTop: '4px',
        fontSize: '0.65rem'
      },
      textContent: new Date(msg.timestamp || msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })
  ].filter(Boolean));

  row.appendChild(avatar);
  row.appendChild(bubble);

  // Message Actions (Delete button on hover/touch)
  if (canDelete) {
    const actions = createElement('div', { className: 'chat-msg-actions' });
    const delBtn = createElement('button', {
      className: 'chat-action-btn',
      title: 'Delete this message',
      innerHTML: '🗑️',
      onClick: (e) => {
        e.stopPropagation();
        confirmDeleteSingleGroupMessage(group?._id || activeGroupId, msg._id);
      }
    });
    actions.appendChild(delBtn);
    row.appendChild(actions);
  }

  container.appendChild(row);
}

function confirmDeleteSingleGroupMessage(groupId, messageId) {
  const modal = createElement('div', { className: 'modal', style: { maxWidth: '380px' } });
  modal.innerHTML = `
    <div class="modal-header">
      <h3 style="color:var(--danger-500)">🗑️ Delete Message</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <div class="modal-body" style="padding:1rem 1.25rem">
      <p class="text-sm" style="margin-bottom:1rem;color:var(--text-secondary)">
        Are you sure you want to delete this message? The content will be removed.
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-secondary btn-sm" id="del-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-danger btn-sm" id="del-confirm-btn">Delete Message</button>
      </div>
    </div>
  `;

  const overlay = showModal(modal);
  modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#del-cancel-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#del-confirm-btn').onclick = async () => {
    try {
      const res = await api.deleteGroupMessage(groupId, messageId);
      if (res?.success) {
        showToast('Message deleted successfully.', 'success');
        closeModal(overlay);
      } else {
        showToast(res?.message || 'Unable to delete the message. Please try again.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Unable to delete the message. Please try again.', 'error');
    }
  };
}

function showDeleteMessagesByDateModal(groupId, isAdmin, onDeleted) {
  const today = new Date().toISOString().split('T')[0];
  const modal = createElement('div', { className: 'modal', style: { maxWidth: '420px' } });

  modal.innerHTML = `
    <div class="modal-header">
      <h3>📅 Delete Messages by Date</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <form class="modal-body" id="delete-date-form" style="padding:1rem 1.25rem">
      <p class="text-sm text-secondary" style="margin-bottom:1rem">
        ${isAdmin ? 'As an admin, this will delete all messages sent in this group on the selected date.' : 'This will delete all of your messages sent in this group on the selected date.'}
      </p>
      <div class="form-group">
        <label class="form-label">Select Date</label>
        <input type="date" class="form-input" id="del-target-date" value="${today}" max="${today}" required>
      </div>
      <div class="modal-footer" style="padding:0;border:none;margin-top:1.5rem">
        <button type="button" class="btn btn-secondary btn-sm" id="del-date-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-danger btn-sm">Delete Messages</button>
      </div>
    </form>
  `;

  const overlay = showModal(modal);
  modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#del-date-cancel-btn').onclick = () => closeModal(overlay);

  modal.querySelector('#delete-date-form').onsubmit = async (e) => {
    e.preventDefault();
    const dateVal = document.getElementById('del-target-date').value;
    if (!dateVal) {
      showToast('Please select a date.', 'warning');
      return;
    }

    if (confirm(`Delete messages from ${dateVal}? This action cannot be undone.`)) {
      try {
        const res = await api.deleteGroupMessages(groupId, `date=${dateVal}`);
        if (res?.success) {
          showToast(res.message || 'Messages deleted successfully.', 'success');
          closeModal(overlay);
          if (onDeleted) onDeleted();
        } else {
          showToast(res?.message || 'Unable to delete messages.', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Unable to delete messages. Please try again.', 'error');
      }
    }
  };
}

function showClearChatModal(groupId, isAdmin, onCleared) {
  const modal = createElement('div', { className: 'modal', style: { maxWidth: '420px' } });

  modal.innerHTML = `
    <div class="modal-header">
      <h3 style="color:var(--danger-500)">🗑️ Clear Entire Chat</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <div class="modal-body" style="padding:1rem 1.25rem">
      <p class="text-sm font-semibold text-danger" style="margin-bottom:0.5rem">
        ⚠️ Warning: Permanent Action
      </p>
      <p class="text-sm text-secondary" style="margin-bottom:1.25rem">
        ${isAdmin ? 'Are you sure you want to clear this entire chat history for all members? This action cannot be undone.' : 'Are you sure you want to delete all of your messages from this chat? This action cannot be undone.'}
      </p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-secondary btn-sm" id="clear-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-danger btn-sm" id="clear-confirm-btn">Clear Chat Now</button>
      </div>
    </div>
  `;

  const overlay = showModal(modal);
  modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#clear-cancel-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#clear-confirm-btn').onclick = async () => {
    try {
      const res = await api.deleteGroupMessages(groupId);
      if (res?.success) {
        showToast(res.message || 'Chat cleared successfully.', 'success');
        closeModal(overlay);
        if (onCleared) onCleared();
      } else {
        showToast(res?.message || 'Unable to clear chat.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Unable to clear chat. Please try again.', 'error');
    }
  };
}

function showGroupMembersModal(group) {
  const modal = createElement('div', { className: 'modal', style: { maxWidth: '420px' } });

  modal.innerHTML = `
    <div class="modal-header">
      <h3>👥 Group Members (${group.members?.length || 0})</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <div class="modal-body" style="max-height:360px;overflow-y:auto;padding:0.75rem 1.25rem">
      ${(group.members || []).map(m => `
        <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border-color)">
          <div class="flex items-center gap-2">
            <div class="user-avatar" style="width:30px;height:30px;font-size:0.75rem">${(m.userId?.name || 'U').charAt(0).toUpperCase()}</div>
            <div>
              <div class="font-medium text-sm">${escapeHtml(m.userId?.name || 'Unknown')}</div>
              <div class="text-xs text-muted">${escapeHtml(m.userId?.email || '')}</div>
            </div>
          </div>
          <span class="tag ${m.role === 'admin' ? 'tag-primary' : 'tag-gray'} text-xs">${m.role || 'member'}</span>
        </div>
      `).join('')}
    </div>
  `;

  const overlay = showModal(modal);
  modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
}

function showGroupForm(user) {
  const modal = createElement('div', { className: 'modal' });

  modal.innerHTML = `
    <div class="modal-header">
      <h3>Create Study Group</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <form class="modal-body" id="group-form">
      <div class="form-group">
        <label class="form-label">Group Name</label>
        <input class="form-input" id="group-name" required placeholder="e.g., Data Structures & Algorithms Sprint">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="group-desc" placeholder="What is the goal of this study group?"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category</label>
          <input class="form-input" id="group-category" placeholder="e.g., Computer Science, Math, Biology">
        </div>
        <div class="form-group">
          <label class="form-label">Max Members</label>
          <input class="form-input" type="number" id="group-max" value="50" min="2" max="500">
        </div>
      </div>
      <div class="modal-footer" style="padding:0;border:none">
        <button type="button" class="btn btn-secondary" id="group-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Group</button>
      </div>
    </form>
  `;

  const overlay = showModal(modal);
  modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#group-cancel-btn').onclick = () => closeModal(overlay);

  modal.querySelector('#group-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await api.createGroup({
        name: document.getElementById('group-name').value,
        description: document.getElementById('group-desc').value,
        category: document.getElementById('group-category').value || 'general',
        maxMembers: parseInt(document.getElementById('group-max').value) || 50
      });
      if (result?.success) {
        showToast('Study group created!', 'success');
        closeModal(overlay);
        openGroupChatView(result.data);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}
