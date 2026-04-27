import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import { memo, useCallback } from 'react';
import { formatCurrency } from '../utils/formatters';

interface MaterialsPageData {
  materials: any[];
  stock: any[];
  categories: any[];
  units: any[];
  variants: any[];
  warehouses: any[];
  clients: any[];
}

const isMissingRelationError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || /does not exist/i.test(message) || /schema cache/i.test(message);
};

export function useMaterialsPageData(orgId?: string | null) {
  return useQuery<MaterialsPageData>({
    queryKey: ['materials-page-data', orgId],
    queryFn: async () => {
      const [
        materialsResult,
        stockResult,
        categoriesResult,
        unitsResult,
        variantsResult,
        warehousesResult,
        clientsResult,
      ] = await Promise.all([
        timedSupabaseQuery(
          (() => {
            let query = supabase.from('materials').select('*, mappings:material_client_mappings(*)').order('name');
            if (orgId) {
              query = query.eq('organisation_id', orgId);
            }
            return query;
          })(),
          'Materials'
        ),

        (async () => {
          try {
            let query = supabase.from('item_stock').select('*');
            if (orgId) {
              query = query.eq('organisation_id', orgId);
            }
            return await timedSupabaseQuery(query, 'Item Stock');
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
            let query = supabase.from('item_categories').select('*').eq('is_active', true).order('category_name');
            if (orgId) {
              query = query.eq('organisation_id', orgId);
            }
            return await timedSupabaseQuery(query, 'Item Categories');
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
            let query = supabase.from('item_units').select('*').eq('is_active', true).order('unit_name');
            if (orgId) {
              query = query.eq('organisation_id', orgId);
            }
            return await timedSupabaseQuery(query, 'Item Units');
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
            let query = supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name');
            if (orgId) {
              query = query.eq('organisation_id', orgId);
            }
            return await timedSupabaseQuery(query, 'Company Variants');
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
            let query = supabase.from('warehouses').select('*').eq('is_active', true).order('warehouse_name');
            if (orgId) {
              query = query.eq('organisation_id', orgId);
            }
            return await timedSupabaseQuery(query, 'Warehouses');
          } catch (error) {
            if (isMissingRelationError(error)) {
              console.log('warehouses table not found');
              return [];
            }
            throw error;
          }
        })(),
        (async () => {
          try {
            let query = supabase.from('clients').select('*').order('client_name');
            if (orgId) {
              query = query.eq('organisation_id', orgId);
            }
            return await timedSupabaseQuery(query, 'Clients');
          } catch (error) {
            console.log('clients load error in materials page', error);
            return [];
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
        clients: clientsResult || [],
      };
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

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

export default useMaterialsPageData;
