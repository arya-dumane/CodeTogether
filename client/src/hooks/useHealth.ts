import { useCallback, useEffect, useState } from 'react';
import { fetchHealth, type HealthPayload } from '../lib/api/health';

interface HealthState {
  data: HealthPayload | null;
  error: string | null;
  isLoading: boolean;
}

const initialState: HealthState = {
  data: null,
  error: null,
  isLoading: true,
};

export function useHealth() {
  const [state, setState] = useState<HealthState>(initialState);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const data = await fetchHealth();
      if (isActive()) {
        setState({ data, error: null, isLoading: false });
      }
    } catch (error) {
      if (isActive()) {
        setState({
          data: null,
          error: error instanceof Error ? error.message : 'The API health check failed.',
          isLoading: false,
        });
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void load(() => active);

    return () => {
      active = false;
    };
  }, [load]);

  const refetch = useCallback(() => {
    void load();
  }, [load]);

  return {
    ...state,
    refetch,
  };
}
