import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { api } from './api';
import { useToast } from '../components/ui';

/** GET a screen's data. The query key is the path, so invalidating a prefix refreshes related screens. */
export function useGet<T>(path: string | null, opts: { refetchInterval?: number } = {}) {
  return useQuery<T>({
    queryKey: path ? path.split(/[/?&]/).filter(Boolean) : ['none'],
    queryFn: () => api<T>(path as string),
    enabled: !!path,
    refetchInterval: opts.refetchInterval,
  });
}

type ActionOpts<V> = {
  method?: string;
  /** Path prefixes to refresh afterwards, e.g. ['student'] refreshes every /student/... screen. */
  invalidate?: string[];
  success?: string | ((data: any, vars: V) => string | undefined);
  form?: boolean;
};

/** POST/PUT/DELETE an action, show a toast, refresh affected screens. */
export function useAction<V = void, R = any>(path: string | ((vars: V) => string), opts: ActionOpts<V> = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<R, Error, V>({
    mutationFn: (vars: V) => {
      const p = typeof path === 'function' ? path(vars) : path;
      if (opts.form) return api<R>(p, { method: opts.method ?? 'POST', form: vars as unknown as FormData });
      return api<R>(p, { method: opts.method ?? 'POST', body: vars === undefined ? {} : vars });
    },
    onSuccess: (data, vars) => {
      for (const prefix of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: prefix.split('/').filter(Boolean) as QueryKey });
      qc.invalidateQueries({ queryKey: ['me'] });
      const msg = typeof opts.success === 'function' ? opts.success(data, vars) : opts.success;
      if (msg) toast(msg);
    },
    onError: (e) => toast(e.message, 'error'),
  });
}
