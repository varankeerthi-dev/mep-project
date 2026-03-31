import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';

export type Organisation = {
  id?: string;
  name?: string;
  [key: string]: unknown;
};

export type OrganisationMember = {
  organisation?: Organisation;
  organisation_id?: string;
  role?: string;
};

export type AuthContextValue = {
  user: User | null;
  organisation: Organisation | null;
  organisations: OrganisationMember[];
  handleLogout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthContext provider');
  }
  return ctx;
}

export { AuthContext };
export default AuthContext;
