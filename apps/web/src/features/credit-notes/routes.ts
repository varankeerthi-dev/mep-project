import { lazy } from 'react';
import type { RouteConfig } from '../../app/routing/types';

const CreditNoteListPage = lazy(() => import('../../credit-notes/pages/CreditNoteListPage'));
const CreditNoteViewPage = lazy(() => import('../../credit-notes/pages/CreditNoteViewPage'));
const CreditNoteEditorPage = lazy(() => import('../../credit-notes/pages/CreditNoteEditorPage'));

export const creditNoteRoutes: RouteConfig[] = [
  {
    id: 'credit-notes',
    path: '/credit-notes',
    component: CreditNoteListPage,
    module: 'credit-notes',
    title: 'Credit Notes',
    showInSidebar: true,
    searchable: true,
    breadcrumb: true,
    order: 1,
  },
  {
    id: 'credit-notes.view',
    path: '/credit-notes/view',
    component: CreditNoteViewPage,
    module: 'credit-notes',
    title: 'View Credit Note',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
  },
  {
    id: 'credit-notes.create',
    path: '/credit-notes/create',
    component: CreditNoteEditorPage,
    module: 'credit-notes',
    title: 'Create Credit Note',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    quickCreate: true,
  },
  {
    id: 'credit-notes.edit',
    path: '/credit-notes/edit',
    component: CreditNoteEditorPage,
    module: 'credit-notes',
    title: 'Edit Credit Note',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
  },
];
