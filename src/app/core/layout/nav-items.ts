export interface NavItem {
  path: string;
  /** Translation key. */
  label: string;
  icon: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { path: '/dashboard', label: 'nav.dashboard', icon: 'layout-dashboard' },
  { path: '/pipeline', label: 'nav.pipeline', icon: 'kanban' },
  { path: '/contacts', label: 'nav.contacts', icon: 'users' },
  { path: '/companies', label: 'nav.companies', icon: 'building' },
  { path: '/activities', label: 'nav.activities', icon: 'list-todo' },
];

export const INSIGHT_NAV: readonly NavItem[] = [{ path: '/reports', label: 'nav.reports', icon: 'chart-column' }];

export const SETTINGS_NAV: NavItem = { path: '/settings', label: 'nav.settings', icon: 'settings' };
