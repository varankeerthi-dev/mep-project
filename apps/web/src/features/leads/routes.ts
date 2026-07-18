import { lazy } from 'react';
import type { RouteConfig } from '../../app/routing/types';

const LeadsModule = lazy(() => import('../../modules/Leads/LeadsModule'));

export const leadsRoutes: RouteConfig[] = [
  {
    id: 'leads',
    path: '/leads',
    component: LeadsModule,
    module: 'leads',
    title: 'Leads',
    showInSidebar: true,
    searchable: true,
    breadcrumb: true,
    order: 1,
  },
  {
    id: 'leads.kanban',
    path: '/leads/kanban',
    component: LeadsModule,
    module: 'leads',
    title: 'Leads Kanban',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
  },
  {
    id: 'leads.settings',
    path: '/leads/settings',
    component: LeadsModule,
    module: 'leads',
    title: 'Lead Settings',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
  },
];
