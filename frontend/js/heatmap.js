/* StudyTrack - Heatmap Module */
import { createElement } from './utils.js';

export function initHeatmap(container, heatmapData) {
  container.innerHTML = '';

  if (!heatmapData || heatmapData.length === 0) {
    container.innerHTML = '<div class="text-sm text-muted text-center" style="padding:2rem">No study data yet. Start studying to see your heatmap!</div>';
    return;
  }

  // Build a map for quick lookup
  const dataMap = new Map();
  let maxMinutes = 0;
  heatmapData.forEach(d => {
    const key = d.date || d.localDate;
    if (key) {
      dataMap.set(key, d.totalMinutes || 0);
      if (d.totalMinutes > maxMinutes) maxMinutes = d.totalMinutes;
    }
  });

  // Generate cells for last 365 days
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);

  // Align to Sunday
  while (startDate.getDay() !== 0) {
    startDate.setDate(startDate.getDate() - 1);
  }

  const wrapper = createElement('div', { className: 'heatmap-container' });

  // Month labels
  const monthLabels = createElement('div', {
    style: { display: 'flex', paddingLeft: '30px', marginBottom: '4px', gap: '0' }
  });

  // Day labels
  const dayLabels = createElement('div', {
    style: { display: 'flex', flexDirection: 'column', gap: '3px', marginRight: '6px', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }
  });
  ['', 'Mon', '', 'Wed', '', 'Fri', ''].forEach(label => {
    dayLabels.appendChild(createElement('div', {
      style: { height: '14px', lineHeight: '14px' },
      textContent: label
    }));
  });

  const gridWrapper = createElement('div', { className: 'flex' });
  gridWrapper.appendChild(dayLabels);

  const grid = createElement('div', { className: 'heatmap-grid' });

  const current = new Date(startDate);
  let lastMonth = -1;
  let weekCount = 0;

  while (current <= today) {
    // Track months for labels
    if (current.getMonth() !== lastMonth) {
      const monthName = current.toLocaleDateString('en-US', { month: 'short' });
      monthLabels.appendChild(createElement('div', {
        style: { minWidth: `${(weekCount === 0 ? 0 : 17) * 1}px`, fontSize: '0.6875rem', color: 'var(--text-tertiary)' },
        textContent: weekCount === 0 ? '' : monthName
      }));
      lastMonth = current.getMonth();
      weekCount = 0;
    }

    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    const minutes = dataMap.get(dateStr) || 0;

    let level = 0;
    if (minutes > 0) {
      const ratio = minutes / Math.max(maxMinutes, 1);
      if (ratio <= 0.25) level = 1;
      else if (ratio <= 0.5) level = 2;
      else if (ratio <= 0.75) level = 3;
      else level = 4;
    }

    const cell = createElement('div', {
      className: `heatmap-cell ${level > 0 ? `level-${level}` : ''}`,
      dataset: { date: dateStr, minutes: String(minutes) }
    });

    // Tooltip on hover
    cell.addEventListener('mouseenter', (e) => {
      showHeatmapTooltip(e, dateStr, minutes);
    });
    cell.addEventListener('mouseleave', hideHeatmapTooltip);

    grid.appendChild(cell);

    current.setDate(current.getDate() + 1);
    if (current.getDay() === 0) weekCount++;
  }

  gridWrapper.appendChild(grid);
  wrapper.appendChild(monthLabels);
  wrapper.appendChild(gridWrapper);

  // Legend
  const legend = createElement('div', {
    className: 'flex items-center gap-2',
    style: { marginTop: '0.75rem', justifyContent: 'flex-end' }
  }, [
    createElement('span', { className: 'text-xs text-muted', textContent: 'Less' }),
    createElement('div', { className: 'heatmap-cell', style: { width: '12px', height: '12px' } }),
    createElement('div', { className: 'heatmap-cell level-1', style: { width: '12px', height: '12px' } }),
    createElement('div', { className: 'heatmap-cell level-2', style: { width: '12px', height: '12px' } }),
    createElement('div', { className: 'heatmap-cell level-3', style: { width: '12px', height: '12px' } }),
    createElement('div', { className: 'heatmap-cell level-4', style: { width: '12px', height: '12px' } }),
    createElement('span', { className: 'text-xs text-muted', textContent: 'More' })
  ]);

  wrapper.appendChild(legend);
  container.appendChild(wrapper);
}

let tooltipEl = null;

function showHeatmapTooltip(event, dateStr, minutes) {
  hideHeatmapTooltip();

  const formatted = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });

  tooltipEl = createElement('div', { className: 'heatmap-tooltip' }, [
    document.createTextNode(`${minutes} minutes on ${formatted}`)
  ]);

  document.body.appendChild(tooltipEl);

  const rect = event.target.getBoundingClientRect();
  tooltipEl.style.left = `${rect.left + rect.width / 2 - tooltipEl.offsetWidth / 2}px`;
  tooltipEl.style.top = `${rect.top - tooltipEl.offsetHeight - 6}px`;
}

function hideHeatmapTooltip() {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}
