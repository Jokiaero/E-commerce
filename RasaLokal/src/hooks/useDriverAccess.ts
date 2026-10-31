import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { loadDriverAccess } from '@/lib/driverAccount';
import type { DriverAccess } from '@/lib/driverRegistration';

export function useDriverAccess(onLoaded?: (access: DriverAccess) => void) {
  const [access, setAccess] = useState<DriverAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestGeneration = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++requestGeneration.current;
    setLoading(true);
    setError('');
    try {
      const next = await loadDriverAccess();
      if (request !== requestGeneration.current) return;
      setAccess(next);
      onLoaded?.(next);
    } catch (loadError: unknown) {
      if (request !== requestGeneration.current) return;
      setAccess(null);
      setError(loadError instanceof Error ? loadError.message : 'Akun driver belum dapat dimuat.');
    } finally {
      if (request === requestGeneration.current) setLoading(false);
    }
  }, [onLoaded]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { requestGeneration.current += 1; };
  }, [refresh]));

  return { access, setAccess, loading, error, setError, refresh };
}
