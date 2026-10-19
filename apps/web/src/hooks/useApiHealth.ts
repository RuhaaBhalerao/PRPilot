import { useQuery } from '@tanstack/react-query';
import { fetchApiHealth } from '../lib/api';

export function useApiHealth() {
  return useQuery({
    queryKey: ['apiHealth'],
    queryFn: fetchApiHealth,
    refetchInterval: 10000, // Poll every 10 seconds to keep connection status fresh
    retry: 2,
    staleTime: 5000,
  });
}
