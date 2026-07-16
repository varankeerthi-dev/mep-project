import { useEffect, useState } from 'react';
import { supabase } from '../../../supabase';

export interface PresenceUser {
  user_id: string;
  user_name: string;
  email: string;
  online_at: string;
}

export function usePresence(quotationId: string | null, currentUser: any) {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!quotationId || !currentUser) {
      setActiveUsers([]);
      return;
    }

    const channel = supabase.channel(`quote_presence_${quotationId}`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    const syncUsers = () => {
      const state = channel.presenceState();
      const users: PresenceUser[] = [];

      Object.keys(state).forEach((key) => {
        // Exclude current user
        if (key === currentUser.id) return;
        
        const presences = state[key] as any[];
        if (presences && presences.length > 0) {
          presences.forEach((p) => {
            users.push({
              user_id: key,
              user_name: p.user_name || 'Someone',
              email: p.email || '',
              online_at: p.online_at || new Date().toISOString(),
            });
          });
        }
      });

      setActiveUsers(users);
    };

    channel
      .on('presence', { event: 'sync' }, syncUsers)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Someone',
            email: currentUser.email || '',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [quotationId, currentUser]);

  return activeUsers;
}
