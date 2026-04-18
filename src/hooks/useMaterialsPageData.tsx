import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import { memo, useCallback } from 'react';
import { formatCurrency } from '../utils/formatters';
import { queryKeys } from '../utils/queryKeys';

interface MaterialsPageData {
  materials: any[];
  stock: any[];
  categories: any[];
  units: any[];
  variants: any[];
  warehouses: any[];
}

const isMissingRelationError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || /does not exist/i.test(message) || /schema cache/i.test(message);
};

/**
 * Optimized Materials Page Data Hook
 * 
 * Fetches all materials-related data in PARALLEL using Promise.all.
 * This replaces 6 separate sequential queries with a single parallel query.
 * 
 * Cache Strategy:
 * - staleTime: 5 min - Data stays fresh for 5 minutes
 * - gcTime: 10 min - Cache survives 10 minutes of inactivity
 * - refetchOnWindowFocus: false - Prevent query storms on tab return
 * - refetchOnMount: 'ifStale' - Only refetch if data is stale
 */
export function useMaterialsPageData(orgId?: string | null) {
  const { organisation } = useAuth();
  const effectiveOrgId = orgId ?? organisation?.id;

  return useQuery<MaterialsPageData>({
    queryKey: queryKeys.materialsPageData(effectiveOrgId),
    queryFn: async () => {
      // Parallel execution of all queries for optimal performance
      const [
        materialsResult,
        stockResult,
        categoriesResult,
        unitsResult,
        variantsResult,
        warehousesResult,
      ] = await Promise.all([
        timedSupabaseQuery(
          supabase
            .from('materials')
            .select('*')
            .eq('organisation_id', effectiveOrgId)
            .order('name'),
          'Materials'
        ),

        (async () => {
          try {
            return await timedSupabaseQuery(
              supabase.from('item_stock').select('*').eq('organisation_id', effectiveOrgId),
              'Item Stock'
            );
          } catch (error) {
            if (isMissingRelationError(error)) {
              console.log('item_stock table not found');
              return [];
            }
            throw error;
          }
        })(),

        (async () => {
          try {
            return await timedSupabaseQuery(
              supabase.from('item_categories').select('*').eq('organisation_id', effectiveOrgId).eq('is_active', true).order('category_name'),
              'Item Categories'
            );
          } catch (error) {
            if (isMissingRelationError(error)) {
              console.log('item_categories table not found, using defaults');
              return [];
            }
            throw error;
          }
        })(),

        (async () => {
          try {
            return await timedSupabaseQuery(
              supabase.from('item_units').select('*').eq('organisation_id', effectiveOrgId).eq('is_active', true).order('unit_name'),
              'Item Units'
            );
          } catch (error) {
            if (isMissingRelationError(error)) {
              console.log('item_units table not found, using defaults');
              return [{ unit_code: 'nos', unit_name: 'Numbers' }];
            }
            throw error;
          }
        })(),

        (async () => {
          try {
            return await timedSupabaseQuery(
              supabase.from('company_variants').select('*').eq('organisation_id', effectiveOrgId).eq('is_active', true).order('variant_name'),
              'Company Variants'
            );
          } catch (error) {
            if (isMissingRelationError(error)) {
              console.log('company_variants table not found');
              return [];
            }
            throw error;
          }
        })(),

        (async () => {
          try {
            return await timedSupabaseQuery(
              supabase.from('warehouses').select('*').eq('organisation_id', effectiveOrgId).eq('is_active', true).order('warehouse_name'),
              'Warehouses'
            );
          } catch (error) {
            if (isMissingRelationError(error)) {
              console.log('warehouses table not found');
              return [];
            }
            throw error;
          }
        })(),
      ]);

      return {
        materials: materialsResult || [],
        stock: stockResult || [],
        categories: categoriesResult || [],
        units: unitsResult || [],
        variants: variantsResult || [],
        warehouses: warehousesResult || [],
      };
    },
    enabled: !!effectiveOrgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'ifStale',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMOIZED CELL COMPONENTS
// These components are memoized to prevent unnecessary re-renders
// ═══════════════════════════════════════════════════════════════════════════════

export const MaterialNameCell = memo(function MaterialNameCell({ 
  material, 
  onSelect 
}: { 
  material: any; 
  onSelect: (m: any) => void;
}) {
  return (
    <div className="item-main-cell">
      <div className="item-avatar">{(material.display_name || material.name || '?').slice(0, 1).toUpperCase()}</div>
      <div>
        <button type="button" className="item-name-link" onClick={() => onSelect(material)}>
          {material.display_name || material.name}
        </button>
        <div className="item-main-sub">{material.material || material.size || 'Item'}</div>
      </div>
    </div>
  );
});

export const MaterialStockCell = memo(function MaterialStockCell({ 
  material, 
  stockData 
}: { 
  material: any; 
  stockData: Record<string, number>;
}) {
  const stock = stockData[material.id] || 0;
  return (
    <span style={{ color: stock < (material.low_stock_level || 0) ? '#b42318' : '#067647', fontWeight: 600 }}>
      {stock}
    </span>
  );
});

export const MaterialStatusCell = memo(function MaterialStatusCell({ 
  material 
}: { 
  material: any; 
}) {
  const isActive = material.is_active !== false;
  return (
    <span className={`status-chip ${isActive ? 'active' : 'inactive'}`}>{isActive ? 'Active' : 'Inactive'}</span>
  );
});

export const MaterialActionsCell = memo(function MaterialActionsCell({ 
  material, 
  onEdit, 
  onToggleActive, 
  onDelete 
}: { 
  material: any; 
  onEdit: (m: any) => void;
  onToggleActive: (m: any) => void;
  onDelete: (m: any) => void;
}) {
  return (
    <div className="item-actions-cell">
      <button className="btn btn-sm btn-secondary" onClick={() => onEdit(material)}>Edit</button>
      <button className="btn btn-sm btn-secondary" onClick={() => onToggleActive(material)}>
        {material.is_active ? 'Disable' : 'Enable'}
      </button>
      <button className="btn btn-sm btn-secondary" onClick={() => onDelete(material)}>Delete</button>
    </div>
  );
});

export const MemoizedTextCell = memo(function MemoizedTextCell({ 
  value 
}: { 
  value: string | number | null | undefined;
}) {
  return <span>{value || '-'}</span>;
});

export const MemoizedPriceCell = memo(function MemoizedPriceCell({ 
  value 
}: { 
  value: number | null | undefined;
}) {
  if (value === null || value === undefined || value === 0) return <span>-</span>;
  return <span>{formatCurrency(value)}</span>;
});

export const MemoizedGstCell = memo(function MemoizedGstCell({ 
  value 
}: { 
  value: number | null | undefined;
}) {
  if (value === null || value === undefined) return <span>-</span>;
  return <span>{value}%</span>;
});

export const MemoizedBoolCell = memo(function MemoizedBoolCell({ 
  value 
}: { 
  value: boolean | null | undefined;
}) {
  return <span>{value ? 'Yes' : 'No'}</span>;
});

/**
 * Hook for managing material table callbacks
 * Returns memoized callbacks to prevent unnecessary re-renders
 */
export function useMaterialTableCallbacks(
  onEdit: (m: any) => void,
  onToggleActive: (m: any) => void,
  onDelete: (m: any) => void,
  onSelect: (m: any) => void
) {
  const handleEdit = useCallback((material: any) => onEdit(material), [onEdit]);
  const handleToggleActive = useCallback((material: any) => onToggleActive(material), [onToggleActive]);
  const handleDelete = useCallback((material: any) => onDelete(material), [onDelete]);
  const handleSelect = useCallback((material: any) => onSelect(material), [onSelect]);

  return {
    handleEdit,
    handleToggleActive,
    handleDelete,
    handleSelect,
  };
}

/**
 * Create a memoized stock data map
 * This is optimized for large datasets by avoiding repeated calculations
 */
export function useStockDataMap(stock: any[]) {
  return useMemo(() => {
    const stockMap: Record<string, number> = {};
    for (const s of stock) {
      if (!stockMap[s.item_id]) stockMap[s.item_id] = 0;
      stockMap[s.item_id] += parseFloat(s.current_stock) || 0;
    }
    return stockMap;
  }, [stock]);
}

export default useMaterialsPageData;
