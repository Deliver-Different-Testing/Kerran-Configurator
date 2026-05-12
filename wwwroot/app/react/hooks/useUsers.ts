import { useCallback, useEffect, useState } from 'react';
import { userService } from '@/services/np_userService';
import type { User } from '@/types';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);

  const refresh = useCallback(() => {
    let alive = true;
    userService.getAll().then(rows => {
      if (alive) setUsers(rows);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    return refresh();
  }, [refresh]);

  // Splice a single updated user into the loaded list — saves a roundtrip
  // after a Save in the edit modal.
  const replace = useCallback((u: User) => {
    setUsers(prev => prev.map(p => (p.id === u.id ? u : p)));
  }, []);

  return { users, refresh, replace };
}
