/**
 * Type for ARC pricing row from material_client_pricing table
 */
export interface ArcPricingRow {
  item_id: string;
  arc_rate: number;
  company_variant_id: string | null;
  pricing_type: string;
  is_active: boolean;
}

/**
 * Get variant-specific ARC rate from a pre-fetched map.
 * Prioritizes variant-specific rate, falls back to item-level rate.
 */
export function getArcRateFromMap(
  arcPricingMap: Record<string, ArcPricingRow[]>,
  itemId: string,
  variantId?: string | null
): number | null {
  const rates = arcPricingMap[itemId];
  if (!rates || rates.length === 0) {
    return null;
  }

  // Try variant-specific rate first
  if (variantId) {
    const variantRate = rates.find(r => r.company_variant_id === variantId);
    if (variantRate) {
      return variantRate.arc_rate;
    }
  }

  // Fall back to item-level rate (null company_variant_id)
  const itemLevelRate = rates.find(r => r.company_variant_id === null);
  if (itemLevelRate) {
    return itemLevelRate.arc_rate;
  }

  // If only variant-specific rates exist and no item-level, return the first variant rate
  if (rates.length > 0) {
    return rates[0].arc_rate;
  }

  return null;
}

interface ArcPricingToggleProps {
  clientId: string | null;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

export function ArcPricingToggle({
  clientId,
  enabled,
  onChange,
  disabled = false,
  disabledReason = 'Select a client first to use ARC pricing',
  className = '',
}: ArcPricingToggleProps) {
  const isDisabled = disabled || !clientId;

  return (
    <div
      onClick={() => !isDisabled && onChange(!enabled)}
      role="switch"
      aria-checked={enabled}
      aria-disabled={isDisabled}
      tabIndex={isDisabled ? -1 : 0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
          e.preventDefault();
          onChange(!enabled);
        }
      }}
      className={`arc-toggle-oval ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 16px',
        borderRadius: '9999px',
        border: '1px solid',
        borderColor: enabled ? '#86efac' : '#e4e4e7',
        backgroundColor: enabled ? '#f0fdf4' : '#fafafa',
        color: enabled ? '#166534' : '#52525b',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        userSelect: 'none',
        opacity: isDisabled ? 0.5 : 1,
      }}
      title={isDisabled ? disabledReason : ''}
    >
      <div
        style={{
          position: 'relative',
          width: '36px',
          height: '20px',
          borderRadius: '9999px',
          backgroundColor: enabled ? '#16a34a' : '#d4d4d8',
          transition: 'background-color 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            width: '16px',
            height: '16px',
            backgroundColor: 'white',
            borderRadius: '9999px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            transform: enabled ? 'translateX(16px)' : 'translateX(0)',
            transition: 'transform 0.2s',
          }}
        />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
        Use ARC Pricing
      </span>
      {enabled && (
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            backgroundColor: '#16a34a',
            color: 'white',
            borderRadius: '9999px',
            fontWeight: 'bold',
            lineHeight: 1,
          }}
        >
          ON
        </span>
      )}
    </div>
  );
}

interface ArcPricingStatusBadgeProps {
  totalItems: number;
  itemsWithArcRate: number;
  itemsWithoutArcRate: number;
  className?: string;
}

export function ArcPricingStatusBadge({
  totalItems,
  itemsWithArcRate,
  itemsWithoutArcRate,
  className = '',
}: ArcPricingStatusBadgeProps) {
  if (totalItems === 0) {
    return null;
  }

  if (itemsWithoutArcRate === 0 && itemsWithArcRate > 0) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-bold">
          ARC
        </span>
        <span className="text-xs text-green-700">
          {itemsWithArcRate} {itemsWithArcRate === 1 ? 'item' : 'items'}
        </span>
      </div>
    );
  }

  if (itemsWithoutArcRate > 0) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="text-xs text-amber-600">
          {itemsWithoutArcRate} {itemsWithoutArcRate === 1 ? 'item' : 'items'} use standard pricing
        </span>
      </div>
    );
  }

  return null;
}

interface ArcRateBadgeProps {
  arcRate: number;
  originalRate?: number;
  className?: string;
}

export function ArcRateBadge({
  arcRate,
  originalRate,
  className = '',
}: ArcRateBadgeProps) {
  const showComparison = originalRate !== undefined && Math.abs(originalRate - arcRate) > 0.01;

  return (
    <span
      className={`
        text-[9px] px-1.5 py-0.5 rounded font-bold leading-none
        bg-green-100 text-green-700 border border-green-200
        ${className}
      `}
      title={
        showComparison
          ? `ARC: Rs.${arcRate.toFixed(2)} | Std: Rs.${originalRate.toFixed(2)}`
          : `ARC: Rs.${arcRate.toFixed(2)}`
      }
    >
      ARC
    </span>
  );
}

interface StandardRateBadgeProps {
  className?: string;
}

export function StandardRateBadge({
  className = '',
}: StandardRateBadgeProps) {
  return (
    <span
      className={`
        text-[9px] px-1.5 py-0.5 rounded font-medium leading-none
        bg-zinc-100 text-zinc-500 border border-zinc-200
        ${className}
      `}
      title="No ARC rate available - using standard pricing"
    >
      STD
    </span>
  );
}