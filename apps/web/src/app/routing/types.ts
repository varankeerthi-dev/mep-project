/**
 * Core route configuration types for the Navigation Platform.
 * @see ARCHITECTURE-PLAN.md — Phase 1: Navigation Platform
 */

export interface RouteConfig {
  /** Unique route identifier (e.g. "quotation.create") */
  id: string;

  /** React Router path pattern (e.g. "/quotation/create", "/issue/:id") */
  path: string;

  /** Lazy-loaded page component */
  component: React.LazyExoticComponent<React.ComponentType<any>>;

  /** Module/group this route belongs to (e.g. "quotation", "purchase") */
  module: string;

  /** Human-readable title for breadcrumbs and page headers */
  title: string;

  /** Lucide icon for sidebar navigation */
  icon?: React.ComponentType<{ className?: string }>;

  /** Whether to show this route in the sidebar */
  showInSidebar?: boolean;

  /** Whether this route supports quick-create from the QuickAccessBar */
  quickCreate?: boolean;

  /** Whether this route appears in global search */
  searchable?: boolean;

  /** Whether to render a breadcrumb for this route */
  breadcrumb?: boolean;

  /** Sort order within its module group */
  order?: number;

  /** Permission key required to access this route (e.g. "quotation.create") */
  permission?: string;

  /** Whether this route requires admin role */
  adminOnly?: boolean;

  /** Whether this route is public (no auth required) */
  public?: boolean;
}
