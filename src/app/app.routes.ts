import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell';

/** Route titles are translation keys, resolved by TranslatedTitleStrategy. */
export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'nav.dashboard',
        loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'pipeline',
        title: 'nav.pipeline',
        loadComponent: () => import('./features/pipeline/pipeline-page').then((m) => m.PipelinePage),
      },
      {
        path: 'deals/:id',
        title: 'deals.detailTitle',
        loadComponent: () => import('./features/deals/deal-detail-page').then((m) => m.DealDetailPage),
      },
      {
        path: 'contacts',
        title: 'nav.contacts',
        loadComponent: () => import('./features/contacts/contacts-page').then((m) => m.ContactsPage),
      },
      {
        path: 'contacts/:id',
        title: 'contacts.detailTitle',
        loadComponent: () =>
          import('./features/contacts/contact-detail-page').then((m) => m.ContactDetailPage),
      },
      {
        path: 'companies',
        title: 'nav.companies',
        loadComponent: () => import('./features/companies/companies-page').then((m) => m.CompaniesPage),
      },
      {
        path: 'companies/:id',
        title: 'companies.detailTitle',
        loadComponent: () =>
          import('./features/companies/company-detail-page').then((m) => m.CompanyDetailPage),
      },
      {
        path: 'activities',
        title: 'nav.activities',
        loadComponent: () => import('./features/activities/activities-page').then((m) => m.ActivitiesPage),
      },
      {
        path: 'reports',
        title: 'nav.reports',
        loadComponent: () => import('./features/reports/reports-page').then((m) => m.ReportsPage),
      },
      {
        path: 'settings',
        title: 'nav.settings',
        loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: 'showcase',
        title: 'showcase.title',
        loadComponent: () => import('./features/showcase/form-showcase-page').then((m) => m.FormShowcasePage),
      },
      {
        path: '**',
        title: 'notFound.title',
        loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
