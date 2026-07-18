import { lazy } from 'react';
import type { RouteConfig } from '../../app/routing/types';

const ProformaListPage = lazy(() => import('../../proforma-invoices/pages/ProformaListPage'));
const ProformaEditorPage = lazy(() => import('../../proforma-invoices/pages/ProformaEditorPage'));

export const proformaRoutes: RouteConfig[] = [
  {
    id: 'proforma-invoices',
    path: '/proforma-invoices',
    component: ProformaListPage,
    module: 'proforma',
    title: 'Proforma Invoices',
    showInSidebar: true,
    searchable: true,
    breadcrumb: true,
    order: 1,
  },
  {
    id: 'proforma-invoices.create',
    path: '/proforma-invoices/create',
    component: ProformaEditorPage,
    module: 'proforma',
    title: 'Create Proforma',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    quickCreate: true,
  },
  {
    id: 'proforma-invoices.edit',
    path: '/proforma-invoices/edit',
    component: ProformaEditorPage,
    module: 'proforma',
    title: 'Edit Proforma',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
  },
];
