import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface NestedSubTabItem {
  id: string;
  label: string;
  path?: string;
  matchPrefix?: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface NestedSubTabsProps {
  tabs: NestedSubTabItem[];
  activeTabId?: string;
  onTabChange?: (tab: NestedSubTabItem) => void;
  twoRows?: boolean;
  variant?: 'pill' | 'tab';
  size?: 'md' | 'sm';
  className?: string;
  ariaLabel?: string;
}

/**
 * Settings / Nested Sub-Tabs Button UI Design System
 * 
 * Supports:
 * 1. twoRows={true}  -> Settings 2-row layout: splits items across Row 1 and Row 2 with compact pills.
 * 2. twoRows={false} -> 1-row layout with smooth horizontal wheel scrolling, chevron controls, & tab dividers.
 */
export const NestedSubTabs: React.FC<NestedSubTabsProps> = ({
  tabs = [],
  activeTabId,
  onTabChange,
  twoRows = true,
  variant = 'pill',
  size = 'md',
  className = '',
  ariaLabel = 'Section navigation',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isSm = size === 'sm';

  const currentTabId =
    activeTabId ||
    tabs.find(
      (t) =>
        t.path &&
        (location.pathname === t.path ||
          (t.matchPrefix ? location.pathname.startsWith(t.matchPrefix) : location.pathname.startsWith(t.path)))
    )?.id ||
    tabs[0]?.id;

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  }, []);

  useEffect(() => {
    if (twoRows) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, tabs, twoRows]);

  const scrollByOffset = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY * 0.85;
      }
    }
  };

  // Auto-scroll active tab into view
  useEffect(() => {
    if (twoRows) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const activeEl = el.querySelector(`[data-tab-id="${currentTabId}"]`);
    if (activeEl) {
      const containerRect = el.getBoundingClientRect();
      const tabRect = activeEl.getBoundingClientRect();
      if (tabRect.left < containerRect.left + 40 || tabRect.right > containerRect.right - 40) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    }
  }, [currentTabId, twoRows]);

  const handleTabClick = (tab: NestedSubTabItem) => {
    if (tab.disabled) return;
    onTabChange?.(tab);
    if (tab.path) {
      navigate(tab.path);
    }
  };

  const renderPill = (tab: NestedSubTabItem) => {
    const isActive = currentTabId === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        role="tab"
        data-tab-id={tab.id}
        aria-selected={isActive}
        disabled={tab.disabled}
        onClick={() => handleTabClick(tab)}
        className={`
          relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] 
          px-3 py-1.5 text-[12px] font-medium leading-none cursor-pointer transition-all duration-150 select-none
          ${
            isActive
              ? 'bg-white text-[#0F172A] font-semibold border border-slate-300 shadow-[0_1px_3px_rgba(15,23,42,0.08)]'
              : 'bg-transparent text-[#44474E] border border-transparent hover:bg-white/80 hover:border-slate-300 hover:text-[#1A1C1E]'
          }
          ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
      >
        {tab.icon && (
          <span className={`inline-flex shrink-0 items-center justify-center ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
            {tab.icon}
          </span>
        )}
        <span>{tab.label}</span>

        {tab.badge !== undefined && (
          <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
            {tab.badge}
          </span>
        )}

        {/* Active bottom emerald indicator */}
        {isActive && (
          <span className="absolute -bottom-[1px] left-[6px] right-[6px] h-[2px] rounded-[2px] bg-[#008744]" />
        )}
      </button>
    );
  };

  const twoRowContainerRef = useRef<HTMLDivElement>(null);
  const [splitIndex, setSplitIndex] = useState<number>(() => Math.min(tabs.length, 10));

  const calculateSplit = useCallback(() => {
    const container = twoRowContainerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    if (!containerWidth) return;

    // Available width for pills: container width minus padding (px-3 on each side = 24px)
    const availableWidth = containerWidth - 28;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-tab-id]'));
    if (buttons.length === 0) return;

    let usedWidth = 0;
    let fitCount = 0;
    const gap = 6; // gap-1.5 is 6px

    for (let i = 0; i < tabs.length; i++) {
      const btn = buttons[i];
      const btnWidth = btn ? btn.offsetWidth : 110;
      const nextWidth = usedWidth === 0 ? btnWidth : usedWidth + gap + btnWidth;
      if (nextWidth <= availableWidth) {
        usedWidth = nextWidth;
        fitCount++;
      } else {
        break;
      }
    }

    // Keep at least 1 tab in row 1
    const newSplit = Math.max(1, fitCount);
    setSplitIndex((prev) => (prev !== newSplit ? newSplit : prev));
  }, [tabs.length]);

  useEffect(() => {
    if (!twoRows) return;
    calculateSplit();
    const container = twoRowContainerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      calculateSplit();
    });
    ro.observe(container);

    return () => ro.disconnect();
  }, [twoRows, calculateSplit]);

  // ==========================================
  // VARIANT 1: TWO-ROW PILL LAYOUT (Default: Fill top row first, then overflow to second row)
  // ==========================================
  if (twoRows && tabs.length > 0) {
    const row1Tabs = tabs.slice(0, splitIndex);
    const row2Tabs = tabs.slice(splitIndex);

    return (
      <div
        ref={twoRowContainerRef}
        className={`flex w-full flex-col bg-[#F4FAFD] border-b border-[#E0E0E0] ${className}`.trim()}
        role="tablist"
        aria-label={ariaLabel}
      >
        {/* Row 1: Fills available width first */}
        <div
          onWheel={handleWheel}
          className={`flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
            row2Tabs.length > 0 ? 'border-b border-slate-200/60' : ''
          }`}
        >
          {row1Tabs.map(renderPill)}
        </div>

        {/* Row 2: Overflow items */}
        {row2Tabs.length > 0 && (
          <div
            onWheel={handleWheel}
            className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {row2Tabs.map(renderPill)}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VARIANT 1-B: SINGLE-ROW PILL LAYOUT (If variant === 'pill' and twoRows === false)
  // ==========================================
  if (variant === 'pill') {
    return (
      <div
        className={`relative flex w-full items-center bg-[#F4FAFD] border-b border-[#E0E0E0] ${className}`.trim()}
        role="tablist"
        aria-label={ariaLabel}
      >
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByOffset(-240)}
            className="absolute left-0 top-0 bottom-0 z-30 flex items-center justify-center w-7 bg-gradient-to-r from-[#F4FAFD] via-[#F4FAFD]/95 to-transparent text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            title="Scroll left"
            aria-label="Scroll left"
          >
            <div className="p-0.5 rounded-full bg-white/95 border border-slate-200 shadow-xs hover:bg-white hover:scale-105 transition-all">
              <ChevronLeft size={12} strokeWidth={2.5} />
            </div>
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onWheel={handleWheel}
          className="flex-1 min-w-0 flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map(renderPill)}
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByOffset(240)}
            className="absolute right-0 top-0 bottom-0 z-30 flex items-center justify-center w-7 bg-gradient-to-l from-[#F4FAFD] via-[#F4FAFD]/95 to-transparent text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
            title="Scroll right"
            aria-label="Scroll right"
          >
            <div className="p-0.5 rounded-full bg-white/95 border border-slate-200 shadow-xs hover:bg-white hover:scale-105 transition-all">
              <ChevronRight size={12} strokeWidth={2.5} />
            </div>
          </button>
        )}
      </div>
    );
  }

  // ==========================================
  // VARIANT 2: 1-ROW SCROLLABLE TAB STRIP
  // ==========================================
  return (
    <div className={`relative flex w-full items-center bg-[#F4FAFD] border-b border-[#E0E0E0] ${className}`.trim()}>
      {/* Left Scroll Arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByOffset(-240)}
          className={`absolute left-0 top-0 bottom-0 z-30 flex items-center justify-center ${isSm ? 'w-7' : 'w-9'} bg-gradient-to-r from-[#F4FAFD] via-[#F4FAFD]/95 to-transparent text-slate-600 hover:text-slate-900 transition-all cursor-pointer`}
          title="Scroll left"
          aria-label="Scroll left"
        >
          <div className={`${isSm ? 'p-0.5' : 'p-1'} rounded-full bg-white/95 border border-slate-200 shadow-xs hover:bg-white hover:scale-105 transition-all`}>
            <ChevronLeft size={isSm ? 12 : 14} strokeWidth={2.5} />
          </div>
        </button>
      )}

      {/* Tab Strip */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        role="tablist"
        aria-label={ariaLabel}
        className={`
          flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scroll-smooth
          [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]
          [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300
          ${isSm ? 'min-h-[32px] px-2 pt-1' : 'min-h-[44px] px-4 pt-2'}
        `}
      >
        {tabs.map((tab, idx) => {
          const isActive = currentTabId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab-id={tab.id}
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => handleTabClick(tab)}
              className={`
                relative inline-flex items-center justify-center whitespace-nowrap cursor-pointer transition-all duration-150 select-none
                ${isSm ? 'min-h-[28px] px-3 py-1 text-[12px] gap-1.5' : 'min-h-[38px] px-5 py-2 text-[13px] gap-2'}
                ${
                  isActive
                    ? 'z-10 -mb-[1px] bg-white text-[#0F172A] font-bold rounded-t-[8px] border border-slate-300 border-t-[2.5px] border-t-slate-600 border-b-white shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_4px_14px_-2px_rgba(15,23,42,0.12)]'
                    : 'bg-transparent text-[#44474E] font-medium border-0 rounded-t-[6px] hover:text-[#008744]'
                }
                ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}
              `}
            >
              {/* Inactive tab divider line */}
              {!isActive && idx > 0 && (
                <span className="absolute left-0 top-[25%] bottom-[25%] w-[1px] bg-[#E0E0E0]" />
              )}

              {tab.icon && (
                <span className={`inline-flex shrink-0 items-center justify-center ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-slate-200 text-slate-600">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right Scroll Arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByOffset(240)}
          className={`absolute right-0 top-0 bottom-0 z-30 flex items-center justify-center ${isSm ? 'w-7' : 'w-9'} bg-gradient-to-l from-[#F4FAFD] via-[#F4FAFD]/95 to-transparent text-slate-600 hover:text-slate-900 transition-all cursor-pointer`}
          title="Scroll right"
          aria-label="Scroll right"
        >
          <div className={`${isSm ? 'p-0.5' : 'p-1'} rounded-full bg-white/95 border border-slate-200 shadow-xs hover:bg-white hover:scale-105 transition-all`}>
            <ChevronRight size={isSm ? 12 : 14} strokeWidth={2.5} />
          </div>
        </button>
      )}
    </div>
  );
};

export const NestedSubTab = NestedSubTabs;
export const SettingsSubTabs = NestedSubTabs;
export default NestedSubTabs;
