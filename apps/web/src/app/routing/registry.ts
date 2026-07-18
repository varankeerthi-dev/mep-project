/**
 * Route Registry — the single source of truth for all routes.
 *
 * Each feature module exports its own routes array.
 * The app router combines them via `combineRoutes()`.
 *
 * @see ARCHITECTURE-PLAN.md — Phase 1: Navigation Platform
 */

import type { RouteConfig } from './types';

// Re-export the type so consumers can import from the registry directly.
export type { RouteConfig } from './types';

/**
 * Combine multiple feature route arrays into a single registry.
 * Throws if duplicate route IDs are found.
 */
export function combineRoutes(...routeGroups: RouteConfig[][]): RouteConfig[] {
  const all: RouteConfig[] = [];
  const seen = new Set<string>();

  for (const group of routeGroups) {
    for (const route of group) {
      if (seen.has(route.id)) {
        throw new Error(`Duplicate route id: "${route.id}". Route IDs must be unique.`);
      }
      seen.add(route.id);
      all.push(route);
    }
  }

  return all;
}

/**
 * Filter routes for sidebar display.
 */
export function getSidebarRoutes(routes: RouteConfig[]): RouteConfig[] {
  return routes
    .filter((r) => r.showInSidebar)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Filter routes for quick-create display.
 */
export function getQuickCreateRoutes(routes: RouteConfig[]): RouteConfig[] {
  return routes.filter((r) => r.quickCreate);
}

/**
 * Filter routes for search.
 */
export function getSearchableRoutes(routes: RouteConfig[]): RouteConfig[] {
  return routes.filter((r) => r.searchable);
}
