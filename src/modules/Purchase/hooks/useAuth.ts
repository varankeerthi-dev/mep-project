// Re-export useAuth from App.tsx to avoid circular dependency issues
// This file provides a centralized location for the useAuth hook
export { useAuth } from '../../App';

// Also re-export types if needed
export type { AuthContextValue } from '../../App';
