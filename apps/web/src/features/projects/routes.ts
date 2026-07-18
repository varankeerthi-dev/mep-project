import { lazy } from 'react';
import type { RouteConfig } from '../../app/routing/types';

const ProjectList = lazy(() => import('../../pages/ProjectList'));
const CreateProject = lazy(() => import('../../pages/CreateProject'));

export const projectRoutes: RouteConfig[] = [
  {
    id: 'projects',
    path: '/projects',
    component: ProjectList,
    module: 'projects',
    title: 'Projects',
    showInSidebar: true,
    searchable: true,
    breadcrumb: true,
    order: 1,
    permission: 'projects.read',
  },
  {
    id: 'projects.new',
    path: '/projects/new',
    component: CreateProject,
    module: 'projects',
    title: 'New Project',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    quickCreate: true,
    permission: 'projects.create',
  },
  {
    id: 'projects.edit',
    path: '/projects/edit',
    component: CreateProject,
    module: 'projects',
    title: 'Edit Project',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    permission: 'projects.update',
  },
  {
    id: 'projects.editById',
    path: '/projects/:id/edit',
    component: CreateProject,
    module: 'projects',
    title: 'Edit Project',
    showInSidebar: false,
    searchable: false,
    breadcrumb: true,
    permission: 'projects.update',
  },
  {
    id: 'projects.overview',
    path: '/projects-overview',
    component: ProjectList,
    module: 'projects',
    title: 'Project Overview',
    showInSidebar: false,
    searchable: true,
    breadcrumb: true,
  },
];
