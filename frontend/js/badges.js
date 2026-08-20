/* StudyTrack - Badges Module */
import { api, createElement, showLoading, showEmpty } from './utils.js';

export async function initBadges(container, user) {
  container.innerHTML = '';
  const page = createElement('div', { className: 'animate-fade-in-up' });

  page.appendChild(createElement('div', { className: 'page-header' }, [
    createElement('h1', { className: 'page-title', textContent: 'Badges & Achievements' }),
    createElement('p', { className: 'page-subtitle', textContent: 'Track your milestones and unlock achievements' })
  ]));

  // Summary card
  const summaryCard = createElement('div', { className: 'card card-gradient', style: { marginBottom: '1.5rem' } });
  summaryCard.innerHTML = `
    <div class="flex items-center gap-6 flex-wrap">
      <div style="font-size:3.5rem">🏆</div>
      <div>
        <div id="badge-summary-title" style="font-size:1.5rem;font-weight:800">Loading...</div>
        <div class="text-muted">Keep studying to unlock more achievements</div>
      </div>
      <div style="flex:1;min-width:200px">
        <div class="progress-bar" style="height:10px">
          <div class="progress-fill" id="badge-progress" style="width:0%"></div>
        </div>
      </div>
    </div>
  `;
  page.appendChild(summaryCard);

  // Badge grid
  const grid = createElement('div', { className: 'badge-grid', id: 'badge-grid' });
  page.appendChild(grid);

  container.appendChild(page);
  await loadBadges();
}

async function loadBadges() {
  const grid = document.getElementById('badge-grid');
  if (!grid) return;

  showLoading(grid);

  try {
    const result = await api.getBadges();
    if (!result?.success) return;

    const { badges, totalEarned, totalAvailable } = result.data;

    // Update summary
    const summaryTitle = document.getElementById('badge-summary-title');
    if (summaryTitle) {
      summaryTitle.textContent = `${totalEarned} of ${totalAvailable} Badges Earned`;
    }

    const progressBar = document.getElementById('badge-progress');
    if (progressBar) {
      const pct = totalAvailable > 0 ? Math.round((totalEarned / totalAvailable) * 100) : 0;
      progressBar.style.width = `${pct}%`;
    }

    grid.innerHTML = '';

    if (badges.length === 0) {
      showEmpty(grid, '🏅', 'No badges available', 'Badges will appear here as you use StudyTrack.');
      return;
    }

    // Sort: earned first, then locked
    const sorted = [...badges].sort((a, b) => {
      if (a.earned && !b.earned) return -1;
      if (!a.earned && b.earned) return 1;
      return 0;
    });

    sorted.forEach((badge, index) => {
      const card = createElement('div', {
        className: `badge-card ${badge.earned ? 'earned' : 'locked'}`,
        style: { animationDelay: `${index * 50}ms`, animation: 'fadeInUp 0.4s ease both' }
      }, [
        createElement('span', { className: 'badge-icon-large', textContent: badge.icon || '🏅' }),
        createElement('div', { className: 'badge-name', textContent: badge.name }),
        createElement('div', { className: 'badge-desc', textContent: badge.description }),
        badge.earned && badge.earnedAt
          ? createElement('div', {
              className: 'badge-date',
              textContent: `Earned ${new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            })
          : createElement('div', { className: 'badge-date', textContent: badge.earned ? 'Earned' : '🔒 Locked' })
      ]);

      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = '<div class="text-sm text-muted text-center" style="padding:2rem">Failed to load badges</div>';
  }
}
