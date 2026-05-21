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
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all select-none
        ${className}
        ${enabled
          ? 'bg-green-50 border-green-300 text-green-800'
          : 'bg-zinc-50 border-zinc-200 text-zinc-600'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-zinc-300 active:scale-[0.98]'}
      `}
      title={isDisabled ? disabledReason : ''}
    >
      <div
        className={`
          relative w-9 h-5 rounded-full transition-colors duration-200
          ${enabled ? 'bg-green-600' : 'bg-zinc-300'}
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
            ${enabled ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </div>
      <span className="text-xs font-semibold whitespace-nowrap">
        Use ARC Pricing
      </span>
      {enabled && (
        <span className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded font-bold leading-none">
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