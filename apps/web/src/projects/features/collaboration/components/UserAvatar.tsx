// UserAvatar.tsx — Profile picture circle for collaboration messages & threads.
// Renders real avatar image when available, with deterministic fallback to
// illustrated MEP team face assets or crisp initials.
import React, { useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';
export type AvatarFallbackType = 'auto' | 'initials' | 'face';

interface Props {
  name?: string | null;
  avatarUrl?: string | null;
  userId?: string | null;
  size?: AvatarSize;
  fallbackType?: AvatarFallbackType;
  className?: string;
  showTooltip?: boolean;
}

const SIZE_CLASSES: Record<AvatarSize, { box: string; text: string; icon: string }> = {
  xs: { box: 'size-6', text: 'text-[10px]', icon: 'size-4' },
  sm: { box: 'size-8', text: 'text-xs font-semibold', icon: 'size-5' },
  md: { box: 'size-10', text: 'text-sm font-semibold', icon: 'size-6' },
  lg: { box: 'size-12', text: 'text-base font-bold', icon: 'size-8' },
};

// Deterministic gradient palettes for initials/avatar backgrounds
const PALETTES = [
  { bg: 'from-blue-500 to-indigo-600', text: 'text-white', border: 'border-blue-400/30' },
  { bg: 'from-emerald-500 to-teal-600', text: 'text-white', border: 'border-emerald-400/30' },
  { bg: 'from-violet-500 to-purple-600', text: 'text-white', border: 'border-violet-400/30' },
  { bg: 'from-amber-500 to-orange-600', text: 'text-white', border: 'border-amber-400/30' },
  { bg: 'from-rose-500 to-pink-600', text: 'text-white', border: 'border-rose-400/30' },
  { bg: 'from-cyan-500 to-blue-600', text: 'text-white', border: 'border-cyan-400/30' },
  { bg: 'from-teal-500 to-emerald-700', text: 'text-white', border: 'border-teal-400/30' },
  { bg: 'from-indigo-500 to-blue-700', text: 'text-white', border: 'border-indigo-400/30' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name?: string | null): string {
  if (!name || name.trim().length === 0) return '';
  const clean = name.replace(/^@/, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * 6 Built-in Illustrated MEP Team Face Avatars (Pure SVG, zero network latency)
 * 0: Hardhat Engineer (Yellow Safety Helmet)
 * 1: Project Architect (Glasses & Modern Hair)
 * 2: Site Supervisor (White Safety Helmet with Visor)
 * 3: Field Specialist (Safety Cap & Headset)
 * 4: Technical Designer (Neat Crop & Collar)
 * 5: Project Lead (Clean Professional)
 */
function MepFaceAsset({ index, className = 'size-full' }: { index: number; className?: string }) {
  const variant = index % 6;

  if (variant === 0) {
    // Hardhat Engineer
    return (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="18" cy="18" r="18" fill="#FBBF24" fillOpacity="0.2" />
        <rect x="9" y="16" width="18" height="15" rx="7.5" fill="#F59E0B" fillOpacity="0.4" />
        {/* Head */}
        <circle cx="18" cy="18" r="8" fill="#FED7AA" />
        {/* Eyes & Smile */}
        <circle cx="15.5" cy="18" r="1" fill="#78350F" />
        <circle cx="20.5" cy="18" r="1" fill="#78350F" />
        <path d="M16 21C16.8 22 19.2 22 20 21" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" />
        {/* Yellow Hardhat */}
        <path d="M10 15C10 10.5817 13.5817 7 18 7C22.4183 7 26 10.5817 26 15H10Z" fill="#F59E0B" />
        <rect x="8" y="14.5" width="20" height="2" rx="1" fill="#D97706" />
        <rect x="16.5" y="6" width="3" height="4" rx="1.5" fill="#FBBF24" />
      </svg>
    );
  }

  if (variant === 1) {
    // Project Architect with Glasses
    return (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="18" cy="18" r="18" fill="#3B82F6" fillOpacity="0.2" />
        {/* Hair */}
        <path d="M11 15C11 10 14 7 18 7C22 7 25 10 25 15H11Z" fill="#1E293B" />
        {/* Face */}
        <circle cx="18" cy="18" r="7.5" fill="#FCD34D" fillOpacity="0.8" />
        {/* Glasses */}
        <rect x="13" y="16" width="4.5" height="3" rx="1" stroke="#0F172A" strokeWidth="1.2" fill="none" />
        <rect x="18.5" y="16" width="4.5" height="3" rx="1" stroke="#0F172A" strokeWidth="1.2" fill="none" />
        <line x1="17.5" y1="17.5" x2="18.5" y2="17.5" stroke="#0F172A" strokeWidth="1.2" />
        {/* Smile */}
        <path d="M16.5 21C17 21.8 19 21.8 19.5 21" stroke="#0F172A" strokeWidth="1.2" strokeLinecap="round" />
        {/* Shirt Collar */}
        <path d="M12 30C12 26 15 24 18 24C21 24 24 26 24 30" fill="#2563EB" />
      </svg>
    );
  }

  if (variant === 2) {
    // White Supervisor Helmet with Safety Stripe
    return (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="18" cy="18" r="18" fill="#10B981" fillOpacity="0.2" />
        {/* Face */}
        <circle cx="18" cy="19" r="7.5" fill="#FDBA74" />
        {/* Eyes & Smile */}
        <circle cx="15.5" cy="19" r="1" fill="#431407" />
        <circle cx="20.5" cy="19" r="1" fill="#431407" />
        <path d="M16 22C16.8 22.8 19.2 22.8 20 22" stroke="#431407" strokeWidth="1.2" strokeLinecap="round" />
        {/* White Safety Helmet */}
        <path d="M10 15C10 10.5 13.5 7 18 7C22.5 7 26 10.5 26 15H10Z" fill="#F8FAFC" />
        <rect x="8" y="14" width="20" height="2" rx="1" fill="#E2E8F0" />
        <rect x="16" y="8" width="4" height="2" rx="0.5" fill="#10B981" />
        {/* Vest */}
        <path d="M11 31C11 26 14 24.5 18 24.5C22 24.5 25 26 25 31" fill="#059669" />
      </svg>
    );
  }

  if (variant === 3) {
    // Field Specialist with Cap
    return (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="18" cy="18" r="18" fill="#8B5CF6" fillOpacity="0.2" />
        {/* Face */}
        <circle cx="18" cy="18" r="7.5" fill="#FED7AA" />
        {/* Eyes & Smile */}
        <circle cx="15.5" cy="18" r="1" fill="#4C1D95" />
        <circle cx="20.5" cy="18" r="1" fill="#4C1D95" />
        <path d="M16.5 21C17 21.8 19 21.8 19.5 21" stroke="#4C1D95" strokeWidth="1.2" strokeLinecap="round" />
        {/* Cap */}
        <path d="M10.5 14C10.5 10 14 7.5 18 7.5C22 7.5 25.5 10 25.5 14H10.5Z" fill="#7C3AED" />
        <path d="M10 14H28C28 14 27 16 23 16H10V14Z" fill="#6D28D9" />
      </svg>
    );
  }

  if (variant === 4) {
    // Technical Designer (Cyan / Teal)
    return (
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="18" cy="18" r="18" fill="#06B6D4" fillOpacity="0.2" />
        {/* Hair */}
        <path d="M11 15C11 9 14 6 18 6C22 6 25 9 25 15H11Z" fill="#334155" />
        {/* Face */}
        <circle cx="18" cy="18" r="7.5" fill="#FFEDD5" />
        <circle cx="15.5" cy="17.5" r="1" fill="#0F172A" />
        <circle cx="20.5" cy="17.5" r="1" fill="#0F172A" />
        <path d="M16 21C16.8 22 19.2 22 20 21" stroke="#0F172A" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M12 30C12 26 15 24 18 24C21 24 24 26 24 30" fill="#0891B2" />
      </svg>
    );
  }

  // Variant 5: Team Lead / Director
  return (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="18" cy="18" r="18" fill="#EC4899" fillOpacity="0.2" />
      {/* Hair */}
      <circle cx="18" cy="12" r="6" fill="#475569" />
      {/* Face */}
      <circle cx="18" cy="18" r="7.5" fill="#FED7AA" />
      <circle cx="15.5" cy="17.5" r="1" fill="#831843" />
      <circle cx="20.5" cy="17.5" r="1" fill="#831843" />
      <path d="M16 21.5C16.8 22.5 19.2 22.5 20 21.5" stroke="#831843" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 31C11 26 14 24 18 24C22 24 25 26 25 31" fill="#DB2777" />
    </svg>
  );
}

export function UserAvatar({
  name,
  avatarUrl,
  userId,
  size = 'sm',
  fallbackType = 'auto',
  className = '',
  showTooltip = false,
}: Props) {
  const [imgError, setImgError] = useState(false);

  // Hash key based on userId or name for consistent deterministic coloring/assets
  const seed = (userId ?? '') + (name ?? 'unknown');
  const hash = hashString(seed);
  const palette = PALETTES[hash % PALETTES.length];
  const initials = getInitials(name);
  const sizeConfig = SIZE_CLASSES[size];

  const hasValidPhoto = !!avatarUrl && !imgError;

  // Decide whether to show initials or illustrated face asset when photo is absent
  const showFaceAsset =
    fallbackType === 'face' || (fallbackType === 'auto' && (!initials || initials.length === 0));

  return (
    <div
      className={`relative shrink-0 rounded-full select-none overflow-hidden ring-1 shadow-xs transition-transform duration-150 hover:scale-105 ${sizeConfig.box} ${palette.border} ${className}`}
      title={showTooltip ? (name ?? 'User') : undefined}
      data-testid="collab-user-avatar"
    >
      {hasValidPhoto ? (
        <img
          src={avatarUrl!}
          alt={name ?? 'User avatar'}
          onError={() => setImgError(true)}
          className="size-full object-cover rounded-full"
          loading="lazy"
        />
      ) : showFaceAsset ? (
        <div className="size-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
          <MepFaceAsset index={hash} className="size-full" />
        </div>
      ) : (
        <div
          className={`size-full flex items-center justify-center bg-gradient-to-br ${palette.bg} ${palette.text} ${sizeConfig.text} tracking-wider font-sans`}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
