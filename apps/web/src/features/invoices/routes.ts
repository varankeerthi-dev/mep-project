import { lazy } from 'react';
import type { RouteConfig } from '../../app/routing/types';

const InvoiceListPage = lazy(() => import('../../invoices/pages/InvoiceListPage'));
const InvoiceEditorPage = lazy(() => import('../../invoices/pages/InvoiceEditorPage'));
const InvoiceView = lazy(() => import('../../invoices/pages/InvoiceView'));

export const invoiceRoutes: RouteConfig[] = [
  {
    id: 'invoices',
    path: '/invoices',
    component: InvoiceListPage,
    module: 'invoices',
    title: 'Invoices',
    showInSidebar: true,
    searchable: true,
    breadcrumb: true,
    order: 1,
    permission: 'invoices.read',
  },
  {
    id: 'invoices.create',
    path: '/invoices/create',
    component: InvoiceEditorPage,
    module: 'invoices',
    title: 'Create Invoice',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    quickCreate: true,
    permission: 'invoices.create',
  },
  {
    id: 'invoices.view',
    path: '/invoices/view',
    component: InvoiceView,
    module: 'invoices',
    title: 'View Invoice',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    permission: 'invoices.read',
  },
  {
    id: 'invoices.edit',
    path: '/invoices/edit',
    component: InvoiceEditorPage,
    module: 'invoices',
    title: 'Edit Invoice',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    permission: 'invoices.update',
  },
];
