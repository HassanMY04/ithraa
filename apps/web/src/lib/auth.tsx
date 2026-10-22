import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken } from './api';
import { Loading } from '../components/ui';

export type Role = 'student' | 'teacher' | 'admin';

export type Me = {
  id: number;
  role: Role;
  name: string;
  first_name: string;
  formal: string;
  initials: string;
  avatar: string;
  name_ar: string | null;
  unread: number;
  demo: boolean;
  today: string;
  week: number;
  total_weeks: number;
  year: string;
  student?: { grade: number; class_name: string; year: number; bars: number[]; journey_note: string; general: boolean };
  teacher?: { color: string; short: string; groups: { id: number; name: string; day: string }[] };
  admin?: { job: string; pct: number };
};

export const HOME: Record<Role, string> = { student: '/student', teacher: '/teacher', admin: '/admin' };

type Auth = {
  token: string | null;
  signIn: (email: string, password: string) => Promise<Role>;
  viewAs: (role: Role) => Promise<void>;
  signOut: () => void;
};
const AuthCtx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(getToken());
  const qc = useQueryClient();
  const nav = useNavigate();

  const apply = useCallback((t: string | null) => {
    setToken(t);
    setTok(t);
    qc.clear();
  }, [qc]);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; role: Role }>('/auth/login', { body: { email, password } });
    apply(r.token);
    return r.role;
  }, [apply]);

  const viewAs = useCallback(async (role: Role) => {
    const r = await api<{ token: string; role: Role }>(`/auth/demo/${role}`, { method: 'POST' });
    apply(r.token);
    nav(HOME[r.role]);
  }, [apply, nav]);

  const signOut = useCallback(() => {
    apply(null);
    nav('/login');
  }, [apply, nav]);

  return <AuthCtx.Provider value={{ token, signIn, viewAs, signOut }}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(AuthCtx);
  if (!a) throw new Error('useAuth outside AuthProvider');
  return a;
}

export function useMe() {
  const { token } = useAuth();
  return useQuery<Me>({ queryKey: ['me'], queryFn: () => api<Me>('/me'), enabled: !!token, staleTime: 30_000 });
}

/** Gate a route to one role; sends other roles to their own home. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { token } = useAuth();
  const loc = useLocation();
  const me = useMe();
  if (!token) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (me.isLoading) return <Loading />;
  if (me.error || !me.data) return <Navigate to="/login" replace />;
  if (me.data.role !== role) return <Navigate to={HOME[me.data.role]} replace />;
  return <>{children}</>;
}
