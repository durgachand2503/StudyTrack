/* StudyTrack - Theme Manager */

const THEME_KEY = 'st_theme';

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'system';
}

function getEffectiveTheme() {
  const theme = getTheme();
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(theme) {
  const effective = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  document.documentElement.setAttribute('data-theme', effective);
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

function cycleTheme() {
  const current = getTheme();
  const order = ['light', 'dark', 'system'];
  const next = order[(order.indexOf(current) + 1) % order.length];
  setTheme(next);
  return next;
}

function getThemeIcon() {
  const theme = getTheme();
  if (theme === 'light') return '☀️';
  if (theme === 'dark') return '🌙';
  return '💻';
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getTheme() === 'system') {
    applyTheme('system');
  }
});

// Apply immediately on load (before DOM ready)
applyTheme(getTheme());

export { getTheme, getEffectiveTheme, applyTheme, setTheme, cycleTheme, getThemeIcon };
