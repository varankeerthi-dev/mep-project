import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SubTabItem {
  id: string;
  label: string;
  path: string;
  matchPrefix?: string;
}

export interface SubTabsNavProps {
  tabs: SubTabItem[];
  activeTabId?: string;
  onTabChange?: (tab: SubTabItem) => void;
  className?: string;
}

const SCROLL_STEP = 220;

/**
 * SubTabsNav - Reusable Sub-Tabs Navigation Bar Component
 * Based on Paper 2.0 Design System Specifications
 *
 * Adds left/right chevron scroll buttons when the tab bar overflows
 * horizontally, so every tab remains reachable without a native scrollbar.
 */
export const SubTabsNav: React.FC<SubTabsNavProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const currentTabId =
    activeTabId ||
    tabs.find((t) => location.pathname === t.path || location.pathname.startsWith(t.matchPrefix ?? t.path))?.id ||
    tabs[0]?.id;

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const atStart = scrollLeft <= 1;
    const atEnd = scrollLeft >= scrollWidth - clientWidth - 1;
    setCanScrollLeft(!atStart);
    setCanScrollRight(!atEnd);
  }, []);

  const scrollBy = useCallback((deltaX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: deltaX, behavior: 'smooth' });
    setTimeout(updateScrollButtons, 300);
  }, [updateScrollButtons]);

  const scrollLeft = useCallback(() => scrollBy(-SCROLL_STEP), [scrollBy]);
  const scrollRight = useCallback(() => scrollBy(SCROLL_STEP), [scrollBy]);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateScrollButtons();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [updateScrollButtons, tabs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeIndex = tabs.findIndex((t) => t.id === currentTabId);
    if (activeIndex < 0) return;
    el.querySelectorAll<HTMLButtonElement>('[data-tab-index]').forEach((btn, i) => {
      btn.style.opacity = String(i === activeIndex ? 1 : 0.7);
    });
    const activeBtn = el.querySelector<HTMLElement>('[data-tab-index="' + activeIndex + '"]');
    if (activeBtn) {
      const containerRect = el.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      if (btnRect.right > containerRect.right - 40) {
        activeBtn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    }
  }, [currentTabId, tabs]);

  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontSynthesis: 'none',
        gap: '8px',
        MozOsxFontSmoothing: 'grayscale',
        WebkitFontSmoothing: 'antialiased',
        width: '100%',
        borderBottom: '1px solid #E5E7EB',
        marginBottom: '16px',
        paddingBottom: '4px',
      }}
      className={className}
    >
      {canScrollLeft && (
        <Button
          variant="ghost"
          size="sm"
          onClick={scrollLeft}
          aria-label="Scroll tabs left"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '36px',
            width: '36px',
            minWidth: '36px',
            padding: '4px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            zIndex: 2,
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={16} />
        </Button>
      )}
      {canScrollRight && (
        <Button
          variant="ghost"
          size="sm"
          onClick={scrollRight}
          aria-label="Scroll tabs right"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            height: '36px',
            width: '36px',
            minWidth: '36px',
            padding: '4px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            zIndex: 2,
            cursor: 'pointer',
          }}
        >
          <ChevronRight size={16} />
        </Button>
      )}
      <div
        ref={scrollRef}
        style={{
          alignItems: 'center',
          boxSizing: 'border-box',
          display: 'flex',
          flexShrink: '0',
          gap: '8px',
          height: '36px',
          justifyContent: 'flex-start',
          padding: '3px 6px',
          width: '100%',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollBehavior: 'smooth',
          maskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
        }}
      >
        {tabs.map((tab, idx) => {
          const isActive = currentTabId === tab.id;
          return (
            <Button variant="ghost" size="sm"
              key={tab.id}
              data-tab-index={String(idx)}
              onClick={() => {
                if (onTabChange) {
                  onTabChange(tab);
                } else {
                  navigate(tab.path);
                }
              }}
              style={{
                alignItems: 'center',
                borderColor: '#00000000',
                borderRadius: '8px',
                borderStyle: 'solid',
                borderWidth: '0.888889px',
                boxSizing: 'border-box',
                display: 'flex',
                flexShrink: 0,
                gap: '6px',
                height: 'calc(100% - 1px)',
                justifyContent: 'center',
                paddingBlock: '2px',
                paddingInline: '10px',
                position: 'relative',
                background: 'transparent',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <span
                style={{
                  boxSizing: 'border-box',
                  color: isActive ? '#16A34A' : '#0A0A0A99',
                  display: 'flex',
                  flexShrink: '0',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  lineHeight: '142.857%',
                  textAlign: 'center',
                  width: 'max-content',
                  transition: 'color 0.15s ease',
                }}
              >
                {tab.label}
              </span>
              {isActive && (
                <div
                  style={{
                    backgroundColor: '#16A34A',
                    bottom: '-5px',
                    boxSizing: 'border-box',
                    height: '2px',
                    left: '0px',
                    position: 'absolute',
                    right: '0px',
                    width: '100%',
                  }}
                />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default SubTabsNav;
