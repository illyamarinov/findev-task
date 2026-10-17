import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Dashboard | Market Simulator',
    loadComponent: () => import('@pages/dashboard/dashboard').then((module) => module.Dashboard),
  },
  {
    path: 'settings',
    title: 'Settings | Market Simulator',
    loadComponent: () => import('@pages/settings/settings').then((module) => module.Settings),
  },
  { path: '**', redirectTo: '' },
];
