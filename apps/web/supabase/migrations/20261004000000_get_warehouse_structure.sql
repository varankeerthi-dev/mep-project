-- Migration: 20261004000000_get_warehouse_structure.sql
-- Description: Adds get_warehouse_structure(p_org_id), a single read-only RPC that
--   returns the six warehouse structure tables (floors, zones, layouts, racks,
--   tiers, bins) as one JSON object.
--   Audit: FE-001 / BE-001 (warehouse structure fan-out).
--
-- Context
--   src/warehouse/services/warehouseService.ts fetchOrgStructure() issued six
--   PostgREST requests, and it was called from inside fetchBinCandidates,
--   fetchCycleCounts, fetchPickLists and fetchSearchIndex. Each React Query key
--   in useWarehouseData.ts therefore opened its own six-request fan, producing
--   124 Supabase requests per /warehouse page view. This function lets the
--   client collapse those into one request.
--
-- Guarantees
--   * This migration creates a function only. It does not create, alter or drop
--     any table, column, index, policy or row of data.
--   * SECURITY INVOKER is stated explicitly (it is also the default) so that the
--     existing row-level security on all six tables keeps filtering these reads
--     exactly as it does for the current REST calls. Making this SECURITY
--     DEFINER would silently bypass RLS and expose other organisations' rows.
--   * search_path is pinned so the function cannot be hijacked via the caller's
--     search_path.
--   * STABLE, because it only reads.

-- 1. The function
CREATE OR REPLACE FUNCTION public.get_warehouse_structure(p_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    -- 1a. warehouse_floors — id, name, warehouse_id
    'floors', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',           f.id,
               'name',         f.name,
               'warehouse_id', f.warehouse_id
             ) ORDER BY f.id)
        FROM public.warehouse_floors f
       WHERE f.organisation_id = p_org_id
         AND f.deleted_at IS NULL
    ), '[]'::jsonb),

    -- 1b. warehouse_zones — id, name, floor_id, storage_role
    'zones', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',           z.id,
               'name',         z.name,
               'floor_id',     z.floor_id,
               'storage_role', z.storage_role
             ) ORDER BY z.id)
        FROM public.warehouse_zones z
       WHERE z.organisation_id = p_org_id
         AND z.deleted_at IS NULL
    ), '[]'::jsonb),

    -- 1c. warehouse_layouts — id, zone_id
    --     DELIBERATELY NOT filtered on deleted_at.
    --     fetchOrgStructure does not filter layouts either, even though the
    --     column exists. Soft-deleted layouts must keep appearing so that bins
    --     hanging off them still resolve their zone, rack and tier. Adding the
    --     filter here would silently break the bin -> tier -> rack -> layout ->
    --     zone chain in fetchBinCandidates and fetchSearchIndex.
    'layouts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',      l.id,
               'zone_id', l.zone_id
             ) ORDER BY l.id)
        FROM public.warehouse_layouts l
       WHERE l.organisation_id = p_org_id
    ), '[]'::jsonb),

    -- 1d. warehouse_racks — id, layout_id, name, position_x, position_y
    'racks', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',          r.id,
               'layout_id',   r.layout_id,
               'name',        r.name,
               'position_x',  r.position_x,
               'position_y',  r.position_y
             ) ORDER BY r.id)
        FROM public.warehouse_racks r
       WHERE r.organisation_id = p_org_id
         AND r.deleted_at IS NULL
    ), '[]'::jsonb),

    -- 1e. warehouse_tiers — id, rack_id
    'tiers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',      t.id,
               'rack_id', t.rack_id
             ) ORDER BY t.id)
        FROM public.warehouse_tiers t
       WHERE t.organisation_id = p_org_id
         AND t.deleted_at IS NULL
    ), '[]'::jsonb),

    -- 1f. warehouse_bins — id, tier_id, name, max_quantity, max_weight_kg, status
    'bins', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id',            b.id,
               'tier_id',       b.tier_id,
               'name',          b.name,
               'max_quantity',  b.max_quantity,
               'max_weight_kg', b.max_weight_kg,
               'status',        b.status
             ) ORDER BY b.id)
        FROM public.warehouse_bins b
       WHERE b.organisation_id = p_org_id
         AND b.deleted_at IS NULL
    ), '[]'::jsonb)
  );
$$;

-- 2. Permissions.
--    Required because the function is owned by the migration role, and it is the
--    role PostgREST uses for signed-in users. This grants EXECUTE on the new
--    function only; it grants nothing on any table and changes no policy.
--    Postgres grants EXECUTE to PUBLIC on new functions by default, and PUBLIC
--    includes anon. RLS would still stop anon reading rows, so this is hygiene
--    rather than a leak, but there is no reason to leave the endpoint callable.
GRANT EXECUTE ON FUNCTION public.get_warehouse_structure(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_warehouse_structure(uuid) FROM PUBLIC, anon;

-- 3. Notes for the reviewer
--    * Row ORDER inside each array is now deterministic (ORDER BY id). The
--      original REST calls had no ORDER BY, so Postgres returned rows in an
--      unspecified order. Callers only ever look rows up by id or map them into
--      objects, so this is a tightening rather than a behaviour change.
--    * After applying, PostgREST may need its schema cache reloaded before the
--      endpoint appears (POSTGREST_SCHEMA_CACHE reload / a Supabase "restart"
--      or the auto-reload event trigger). Until the client sees the function it
--      will fall back to the six-request path, which is why that fallback ships
--      in the same change.