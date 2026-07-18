import { lazy } from 'react';
import type { RouteConfig } from '../../app/routing/types';

const QuotationList = lazy(() => import('../../pages/QuotationList'));
const CreateQuotation = lazy(() => import('../../pages/CreateQuotation'));
const QuotationView = lazy(() => import('../../pages/QuotationView'));

export const quotationRoutes: RouteConfig[] = [
  {
    id: 'quotation',
    path: '/quotation',
    component: QuotationList,
    module: 'quotation',
    title: 'Quotations',
    showInSidebar: true,
    searchable: true,
    breadcrumb: true,
    order: 1,
    permission: 'quotation.read',
  },
  {
    id: 'quotation.create',
    path: '/quotation/create',
    component: CreateQuotation,
    module: 'quotation',
    title: 'Create Quotation',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    quickCreate: true,
    permission: 'quotation.create',
  },
  {
    id: 'quotation.view',
    path: '/quotation/view',
    component: QuotationView,
    module: 'quotation',
    title: 'View Quotation',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    permission: 'quotation.read',
  },
  {
    id: 'quotation.edit',
    path: '/quotation/edit',
    component: CreateQuotation,
    module: 'quotation',
    title: 'Edit Quotation',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    permission: 'quotation.update',
  },
];
