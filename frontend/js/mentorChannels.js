/* StudyTrack - Mentor Channels Module */
import { api, createElement, showToast, showLoading, showEmpty, showModal, closeModal, escapeHtml, timeAgo } from './utils.js';
import { getSocket, joinRoom, leaveRoom, sendMessage } from './socket.js';

let activeChannelId = null;
let currentContainer = null;
let currentUser = null;
let activeTab = 'chat'; // 'chat' or 'resources'

export function getActiveChannelId() {
  return activeChannelId;
}

export function leaveActiveChannel() {
  if (activeChannelId) {
    leaveRoom('channel', activeChannelId);
    activeChannelId = null;
  }
  const socket = getSocket();
  if (socket) {
    socket.off('channel-message');
    socket.off('channel-message-deleted');
    socket.off('channel-messages-cleared');
  }
}

export function initChannels(container, user, initialChannelId = null) {
  currentContainer = container;
  currentUser = user || window.studyTrack?.getCurrentUser();
  if (activeChannelId && activeChannelId !== initialChannelId) {
    leaveRoom('channel', activeChannelId);
    activeChannelId = null;
  }
  if (initialChannelId) {
    openChannelDedicatedView(initialChannelId);
  } else {
    renderChannelsListView();
  }
}

function renderChannelsListView(filterParam = 'myChannels=true') {
  currentContainer.innerHTML = '';
  if (activeChannelId) {
    leaveRoom('channel', activeChannelId);
    activeChannelId = null;
  }

  const page = createElement('div', { className: 'animate-fade-in-up' });

  // Page Header
  page.appendChild(createElement('div', { className: 'page-header flex justify-between items-center flex-wrap gap-4' }, [
    createElement('div', {}, [
      createElement('h1', { className: 'page-title', textContent: 'Mentor Channels' }),
      createElement('p', { className: 'page-subtitle', textContent: 'Learn from expert mentors, access curated materials, and ask questions' })
    ]),
    createElement('button', {
      className: 'btn btn-primary',
      textContent: '+ Create Channel',
      onClick: () => showChannelForm()
    })
  ]));

  // Filters & Search Bar
  const filtersRow = createElement('div', {
    className: 'flex items-center justify-between flex-wrap gap-3',
    style: { marginBottom: '1.5rem' }
  });

  const filterBtns = createElement('div', { className: 'flex gap-2' });
  const myBtn = createElement('button', {
    className: `btn ${filterParam.includes('myChannels') ? 'btn-secondary' : 'btn-ghost'} btn-sm`,
    textContent: '📺 My Channels',
    onClick: () => renderChannelsListView('myChannels=true')
  });
  const allBtn = createElement('button', {
    className: `btn ${!filterParam || filterParam === '' ? 'btn-secondary' : 'btn-ghost'} btn-sm`,
    textContent: '🌐 All Channels',
    onClick: () => renderChannelsListView('')
  });
  filterBtns.appendChild(myBtn);
  filterBtns.appendChild(allBtn);

  const searchInput = createElement('input', {
    className: 'form-input',
    placeholder: 'Search mentor channels...',
    style: { maxWidth: '280px', fontSize: '0.875rem', padding: '0.4rem 0.8rem' }
  });
  searchInput.oninput = (e) => loadChannelCards(channelsContainer, `search=${encodeURIComponent(e.target.value)}`);

  filtersRow.appendChild(filterBtns);
  filtersRow.appendChild(searchInput);
  page.appendChild(filtersRow);

  // Channels Grid Container
  const channelsContainer = createElement('div', {
    id: 'channels-cards-container',
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '1rem'
    }
  });
  page.appendChild(channelsContainer);
  currentContainer.appendChild(page);

  loadChannelCards(channelsContainer, filterParam);
}

async function loadChannelCards(container, params = '') {
  showLoading(container);
  try {
    const result = await api.getChannels(params);
    if (!result?.success) return;

    container.innerHTML = '';
    const channels = result.data || [];

    if (channels.length === 0) {
      showEmpty(container, '📺', 'No mentor channels found', 'Create a channel or explore available learning communities.',
        createElement('button', { className: 'btn btn-primary btn-sm', textContent: '+ Create Channel', onClick: () => showChannelForm() })
      );
      return;
    }

    channels.forEach(ch => {
      const curUserId = (currentUser?._id || currentUser?.id)?.toString();
      const isMentor = (ch.mentor?._id || ch.mentor)?.toString() === curUserId;
      const isMember = ch.members?.some(m => (m._id || m)?.toString() === curUserId) || isMentor;

      const card = createElement('div', {
        className: 'card card-hover flex flex-col justify-between',
        style: { cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' },
        onClick: () => openChannelDedicatedView(ch)
      });

      card.innerHTML = `
        <div>
          <div class="flex justify-between items-start gap-2" style="margin-bottom:0.5rem">
            <div class="flex items-center gap-2">
              <div class="user-avatar" style="width:36px;height:36px;font-size:0.9rem;background:linear-gradient(135deg, #8b5cf6, #6366f1);color:#fff">
                ${ch.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 class="font-semibold" style="font-size:1rem;line-height:1.2">${escapeHtml(ch.name)}</h4>
                <span class="text-xs text-muted">Mentor: ${escapeHtml(ch.mentor?.name || 'Instructor')}</span>
              </div>
            </div>
            ${ch.subject ? `<span class="tag tag-primary text-xs">${escapeHtml(ch.subject)}</span>` : ''}
          </div>
          <p class="text-sm text-muted" style="margin:0.5rem 0;min-height:36px;line-height:1.4">
            ${escapeHtml(ch.description || 'No description provided.')}
          </p>
        </div>
        <div class="flex justify-between items-center border-t pt-3" style="border-top:1px solid var(--border-color);margin-top:0.75rem">
          <div class="flex items-center gap-2 text-xs text-muted">
            <span>👥 ${ch.members?.length || 0} students</span>
            <span>📎 ${ch.resources?.length || 0} resources</span>
            ${isMember ? '<span class="tag tag-success text-xs">Joined</span>' : ''}
          </div>
          <button class="btn ${isMember ? 'btn-primary' : 'btn-secondary'} btn-sm">
            ${isMember ? '💬 Open Channel' : '👉 Join & Learn'}
          </button>
        </div>
      `;

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<div class="text-sm text-muted text-center" style="padding:2rem">Failed to load mentor channels.</div>';
  }
}

export async function openChannelDedicatedView(channelOrId) {
  let channel = channelOrId;
  const channelId = typeof channelOrId === 'string' ? channelOrId : channelOrId._id;

  // Fetch fresh full details
  if (typeof channelOrId === 'string') {
    if (currentContainer) showLoading(currentContainer);
    try {
      const res = await api.getChannel(channelId);
      if (res?.success && res.data && res.data._id) {
        channel = res.data;
      } else {
        renderChannelsListView();
        return;
      }
    } catch {
      renderChannelsListView();
      return;
    }
  }

  if (!channel || !channel._id) {
    renderChannelsListView();
    return;
  }

  if (activeChannelId && activeChannelId !== channel._id) leaveRoom('channel', activeChannelId);
  activeChannelId = channel._id;
  joinRoom('channel', channel._id);

  try {
    history.replaceState(null, '', `#/channels/${channel._id}`);
  } catch {}

  currentContainer.innerHTML = '';

  const curUserId = (currentUser?._id || currentUser?.id)?.toString();
  const isMentor = (channel.mentor?._id || channel.mentor)?.toString() === curUserId;
  const isMember = channel.members?.some(m => (m._id || m)?.toString() === curUserId) || isMentor;

  const page = createElement('div', { className: 'chat-page-layout animate-fade-in-up' });

  // ── Fixed Sticky Chat Header ──
  const channelHeader = createElement('div', {
    className: 'chat-sticky-header flex justify-between items-center flex-wrap gap-3'
  });

  const headerLeft = createElement('div', { className: 'flex items-center gap-3' }, [
    createElement('button', {
      className: 'btn btn-secondary btn-sm flex items-center gap-1',
      style: { fontWeight: '600', padding: '0.45rem 0.85rem' },
      textContent: '← Back to Channels',
      title: 'Return to channels list',
      onClick: () => {
        leaveRoom('channel', channel._id);
        activeChannelId = null;
        try {
          history.replaceState(null, '', '#/channels');
        } catch {}
        renderChannelsListView();
      }
    }),
    createElement('div', {
      className: 'user-avatar',
      style: { width: '38px', height: '38px', fontSize: '1rem', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff' },
      textContent: channel.name.charAt(0).toUpperCase()
    }),
    createElement('div', {}, [
      createElement('div', { className: 'flex items-center gap-2' }, [
        createElement('h3', { className: 'font-semibold', style: { margin: 0, fontSize: '1.1rem' }, textContent: channel.name }),
        channel.subject ? createElement('span', { className: 'tag tag-primary text-xs', textContent: channel.subject }) : null
      ].filter(Boolean)),
      createElement('div', { className: 'text-xs text-muted', textContent: `Mentor: ${channel.mentor?.name || 'Unknown'} · 👥 ${channel.members?.length || 0} students` })
    ])
  ]);

  const headerRight = createElement('div', { className: 'flex items-center gap-2 relative' });

  if (isMentor) {
    headerRight.appendChild(createElement('button', {
      className: 'btn btn-secondary btn-sm',
      textContent: '+ Add Resource',
      onClick: () => showAddResourceForm(channel._id, () => openChannelDedicatedView(channel))
    }));
  } else if (!isMember) {
    headerRight.appendChild(createElement('button', {
      className: 'btn btn-primary btn-sm',
      textContent: '✓ Join Channel',
      onClick: async () => {
        try {
          await api.joinChannel(channel._id);
          showToast('Joined mentor channel!', 'success');
          openChannelDedicatedView(channel);
        } catch (err) { showToast(err.message, 'error'); }
      }
    }));
  }

  // Options Menu Button (Delete by Date, Clear Chat, Leave/Delete Channel)
  if (isMember) {
    const optionsBtn = createElement('button', {
      className: 'btn btn-ghost btn-sm',
      style: { fontSize: '1.1rem', padding: '0.35rem 0.65rem' },
      textContent: '⋮',
      title: 'Channel options & message management',
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
            showDeleteChannelMessagesByDateModal(channel._id, isMentor, () => {
              const msgContainer = document.getElementById('channel-messages-container');
              if (msgContainer) loadChannelMessages(msgContainer, channel._id, currentUser, isMentor);
            });
          }
        });
        dropdown.appendChild(deleteDateItem);

        // Option: Clear Entire Chat
        const clearChatItem = createElement('button', {
          className: 'chat-options-item danger',
          innerHTML: '<span>🗑️</span> <span>Clear / Delete Chat</span>',
          onClick: () => {
            dropdown.remove();
            showClearChannelChatModal(channel._id, isMentor, () => {
              const msgContainer = document.getElementById('channel-messages-container');
              if (msgContainer) loadChannelMessages(msgContainer, channel._id, currentUser, isMentor);
            });
          }
        });
        dropdown.appendChild(clearChatItem);

        if (isMentor) {
          const delChannelItem = createElement('button', {
            className: 'chat-options-item danger',
            innerHTML: '<span>💥</span> <span>Delete Channel Permanently</span>',
            onClick: async () => {
              dropdown.remove();
              if (confirm('Permanently delete this mentor channel? All discussion and resources will be removed.')) {
                try {
                  await api.deleteChannel(channel._id);
                  showToast('Channel deleted', 'info');
                  leaveRoom('channel', channel._id);
                  activeChannelId = null;
                  renderChannelsListView();
                } catch (err) { showToast(err.message, 'error'); }
              }
            }
          });
          dropdown.appendChild(delChannelItem);
        } else {
          const leaveChannelItem = createElement('button', {
            className: 'chat-options-item danger',
            innerHTML: '<span>🚪</span> <span>Leave Channel</span>',
            onClick: async () => {
              dropdown.remove();
              if (confirm('Are you sure you want to leave this channel?')) {
                try {
                  await api.leaveChannel(channel._id);
                  showToast('Left channel', 'info');
                  leaveRoom('channel', channel._id);
                  activeChannelId = null;
                  renderChannelsListView();
                } catch (err) { showToast(err.message, 'error'); }
              }
            }
          });
          dropdown.appendChild(leaveChannelItem);
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

  channelHeader.appendChild(headerLeft);
  channelHeader.appendChild(headerRight);
  page.appendChild(channelHeader);

  // Sub Navigation Tabs: Chat & Resources
  const tabsRow = createElement('div', { className: 'flex gap-2', style: { marginBottom: '0.6rem', flexShrink: 0 } });
  const chatTabBtn = createElement('button', {
    className: `btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-ghost'} btn-sm`,
    textContent: '💬 Channel Discussion',
    onClick: () => {
      activeTab = 'chat';
      openChannelDedicatedView(channel);
    }
  });
  const resourcesTabBtn = createElement('button', {
    className: `btn ${activeTab === 'resources' ? 'btn-primary' : 'btn-ghost'} btn-sm`,
    textContent: `📎 Curated Resources (${channel.resources?.length || 0})`,
    onClick: () => {
      activeTab = 'resources';
      openChannelDedicatedView(channel);
    }
  });
  tabsRow.appendChild(chatTabBtn);
  tabsRow.appendChild(resourcesTabBtn);
  page.appendChild(tabsRow);

  // Content Area
  if (activeTab === 'chat') {
    // Dedicated Chat Card Container
    const chatCard = createElement('div', { className: 'chat-main-card' });

    const messagesEl = createElement('div', {
      id: 'channel-messages-container',
      className: 'chat-messages-viewport'
    });
    chatCard.appendChild(messagesEl);

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
        placeholder: `Ask a question or share in #${escapeHtml(channel.name)}...`,
        style: { flex: '1', borderRadius: 'var(--radius-full)', padding: '0.6rem 1.2rem' }
      });

      const sendBtn = createElement('button', {
        className: 'btn btn-primary',
        style: { borderRadius: 'var(--radius-full)', padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' },
        textContent: 'Send ➤',
        onClick: () => sendChannelMessage(input)
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendChannelMessage(input);
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
          <div class="text-sm">Join this channel to post questions and participate in discussions!</div>
          <button class="btn btn-primary btn-sm" id="join-channel-prompt-btn">Join Channel Now</button>
        `
      }));

      setTimeout(() => {
        const btn = chatCard.querySelector('#join-channel-prompt-btn');
        if (btn) {
          btn.onclick = async () => {
            try {
              await api.joinChannel(channel._id);
              showToast('Joined channel!', 'success');
              openChannelDedicatedView(channel);
            } catch (err) { showToast(err.message, 'error'); }
          };
        }
      }, 10);
    }

    page.appendChild(chatCard);

    if (!isMember) {
      messagesEl.innerHTML = `
        <div class="flex flex-col items-center justify-center text-center p-8 m-auto" style="max-width: 480px;">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">🔒</div>
          <h3 class="font-bold text-lg mb-2">Mentor Discussion Locked</h3>
          <p class="text-muted text-sm mb-6" style="line-height: 1.6;">
            Join this mentor channel to view message history, ask questions, and participate in discussions.
          </p>
          <button id="main-join-channel-btn" class="btn btn-primary btn-lg" style="padding: 0.75rem 2rem; border-radius: var(--radius-full); font-weight: 600;">
            ➕ Join Channel
          </button>
        </div>
      `;

      setTimeout(() => {
        const btn = messagesEl.querySelector('#main-join-channel-btn');
        if (btn) {
          btn.onclick = async () => {
            try {
              await api.joinChannel(channel._id);
              showToast('Joined channel!', 'success');
              const updated = await api.getChannel(channel._id);
              if (updated?.success) openChannelDedicatedView(updated.data);
            } catch (err) { showToast(err.message, 'error'); }
          };
        }
      }, 10);
    } else {
      // Socket listeners
      const socket = getSocket();
      if (socket) {
        joinRoom('channel', channel._id);
        socket.off('channel-message');
        socket.off('channel-message-deleted');
        socket.off('channel-messages-cleared');

        socket.on('channel-message', (msg) => {
          if (msg.channelId === activeChannelId) {
            appendChannelChatMessage(messagesEl, msg, currentUser, channel, isMentor);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        });

        socket.on('channel-message-deleted', (data) => {
          if (data.channelId === activeChannelId) {
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

        socket.on('channel-messages-cleared', (data) => {
          if (data.channelId === activeChannelId) {
            loadChannelMessages(messagesEl, channel._id, currentUser, isMentor);
          }
        });
      }

      loadChannelMessages(messagesEl, channel._id, currentUser, isMentor);
    }
  } else {
    // Resources View
    const resCard = createElement('div', {
      className: 'card',
      style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem' }
    });
    const resources = channel.resources || [];

    if (resources.length === 0) {
      showEmpty(resCard, '📎', 'No resources yet', isMentor ? 'Upload your first study material, tutorial link, or document.' : 'The mentor has not posted resources to this channel yet.');
    } else {
      const grid = createElement('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }
      });

      resources.forEach(r => {
        const icon = r.type === 'video' ? '🎥' : r.type === 'document' ? '📄' : r.type === 'article' ? '📰' : '🔗';
        const item = createElement('div', {
          className: 'card card-hover flex justify-between items-center',
          style: { padding: '1rem', background: 'var(--bg-tertiary)' }
        });

        item.innerHTML = `
          <div class="flex items-center gap-3" style="min-width:0">
            <span style="font-size:1.5rem">${icon}</span>
            <div style="min-width:0">
              <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" class="font-medium text-sm text-truncate" style="display:block;color:var(--primary-400)">
                ${escapeHtml(r.title)}
              </a>
              <span class="text-xs text-muted" style="text-transform:capitalize">${r.type || 'Link'}</span>
            </div>
          </div>
        `;

        if (isMentor) {
          const delBtn = createElement('button', {
            className: 'btn btn-ghost btn-sm text-danger',
            textContent: '✕',
            title: 'Delete resource',
            onClick: async () => {
              if (confirm('Remove this resource?')) {
                await api.removeResource(channel._id, r._id);
                showToast('Resource removed', 'info');
                openChannelDedicatedView(channel);
              }
            }
          });
          item.appendChild(delBtn);
        }

        grid.appendChild(item);
      });
      resCard.appendChild(grid);
    }

    page.appendChild(resCard);
  }

  currentContainer.appendChild(page);
}

async function loadChannelMessages(container, channelId, currentUser, isMentor) {
  showLoading(container);
  try {
    const result = await api.getChannelMessages(channelId);
    if (!result?.success) return;

    container.innerHTML = '';
    const messages = result.data.messages || [];

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted flex flex-col items-center justify-center" style="margin:auto;padding:2rem">
          <div style="font-size:2.5rem;margin-bottom:0.5rem">💬</div>
          <h4 class="font-semibold text-sm">No messages yet</h4>
          <p class="text-xs text-muted" style="margin-top:0.25rem">Ask a question or start a topic discussion with your mentor!</p>
        </div>
      `;
      return;
    }

    messages.forEach(msg => {
      appendChannelChatMessage(container, msg, currentUser, { _id: channelId }, isMentor);
    });

    container.scrollTop = container.scrollHeight;
  } catch {
    container.innerHTML = '<div class="text-sm text-muted text-center" style="padding:2rem">Failed to load discussion messages.</div>';
  }
}

function sendChannelMessage(input) {
  const content = input.value.trim();
  if (!content || !activeChannelId) return;
  sendMessage('channel', activeChannelId, content);
  input.value = '';
  input.focus();
}

function appendChannelChatMessage(container, msg, currentUser, channel, isMentor) {
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
  const canDelete = !msg.isDeleted && (isOwn || isMentor);
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
        confirmDeleteSingleChannelMessage(channel?._id || activeChannelId, msg._id);
      }
    });
    actions.appendChild(delBtn);
    row.appendChild(actions);
  }

  container.appendChild(row);
}

function confirmDeleteSingleChannelMessage(channelId, messageId) {
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
      const res = await api.deleteChannelMessage(channelId, messageId);
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

function showDeleteChannelMessagesByDateModal(channelId, isMentor, onDeleted) {
  const today = new Date().toISOString().split('T')[0];
  const modal = createElement('div', { className: 'modal', style: { maxWidth: '420px' } });

  modal.innerHTML = `
    <div class="modal-header">
      <h3>📅 Delete Messages by Date</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <form class="modal-body" id="delete-date-form" style="padding:1rem 1.25rem">
      <p class="text-sm text-secondary" style="margin-bottom:1rem">
        ${isMentor ? 'As the mentor, this will delete all messages posted in this channel on the selected date.' : 'This will delete all of your messages posted in this channel on the selected date.'}
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
        const res = await api.deleteChannelMessages(channelId, `date=${dateVal}`);
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

function showClearChannelChatModal(channelId, isMentor, onCleared) {
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
        ${isMentor ? 'Are you sure you want to clear this entire channel discussion history for all members? This action cannot be undone.' : 'Are you sure you want to delete all of your messages from this channel discussion? This action cannot be undone.'}
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
      const res = await api.deleteChannelMessages(channelId);
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

function showAddResourceForm(channelId, onSuccess) {
  const modal = createElement('div', { className: 'modal' });
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Add Learning Resource</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <form class="modal-body" id="resource-form">
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="res-title" required placeholder="e.g., Dijkstra's Algorithm Video Lecture">
      </div>
      <div class="form-group">
        <label class="form-label">Resource URL</label>
        <input class="form-input" type="url" id="res-url" required placeholder="https://...">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="res-type">
          <option value="video">🎥 Video</option>
          <option value="document">📄 Document</option>
          <option value="article">📰 Article</option>
          <option value="link">🔗 Link</option>
        </select>
      </div>
      <div class="modal-footer" style="padding:0;border:none">
        <button type="button" class="btn btn-secondary" id="res-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Add Resource</button>
      </div>
    </form>
  `;

  const overlay = showModal(modal);
  modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#res-cancel-btn').onclick = () => closeModal(overlay);

  modal.querySelector('#resource-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addResource(channelId, {
        title: document.getElementById('res-title').value,
        url: document.getElementById('res-url').value,
        type: document.getElementById('res-type').value
      });
      showToast('Resource added to channel!', 'success');
      closeModal(overlay);
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

function showChannelForm() {
  const modal = createElement('div', { className: 'modal' });
  modal.innerHTML = `
    <div class="modal-header">
      <h3>Create Mentor Channel</h3>
      <button class="modal-close" id="modal-close-btn">✕</button>
    </div>
    <form class="modal-body" id="channel-form">
      <div class="form-group">
        <label class="form-label">Channel Name</label>
        <input class="form-input" id="ch-name" required placeholder="e.g., Advanced System Design & Architecture" maxlength="60">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="ch-desc" placeholder="What subjects and topics will this channel cover?"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Subject</label>
        <input class="form-input" id="ch-subject" placeholder="e.g., Computer Science, System Design">
      </div>
      <div class="modal-footer" style="padding:0;border:none">
        <button type="button" class="btn btn-secondary" id="ch-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Channel</button>
      </div>
    </form>
  `;

  const overlay = showModal(modal);
  modal.querySelector('#modal-close-btn').onclick = () => closeModal(overlay);
  modal.querySelector('#ch-cancel-btn').onclick = () => closeModal(overlay);

  modal.querySelector('#channel-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await api.createChannel({
        name: document.getElementById('ch-name').value,
        description: document.getElementById('ch-desc').value,
        subject: document.getElementById('ch-subject').value
      });
      if (result?.success) {
        showToast('Channel created! You are now a mentor.', 'success');
        closeModal(overlay);
        openChannelDedicatedView(result.data);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}
