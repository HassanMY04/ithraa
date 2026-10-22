import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

/* ------------------------------------------------------------------ tokens */
export const C = {
  ink: '#13122B',
  ink2: '#3D405C',
  muted: '#5B5E78',
  faint: '#8A8DA6',
  navy: '#16133A',
  navy2: '#221E52',
  navy3: '#2A2660',
  navyLine: '#3A3577',
  lilac: '#C9C7E8',
  lilac2: '#A9A6D6',
  lime: '#C8F25A',
  indigo: '#4E3CF5',
  indigoTint: '#EDEBFF',
  border: '#E3E5EF',
  border2: '#D5D7E5',
  bg: '#F4F5FA',
  chip: '#F1F2F8',
  white: '#FFFFFF',
  ok: { bg: '#DCF4EA', fg: '#0A4F3D', strong: '#0B7D60', ink: '#0A6B52' },
  warn: { bg: '#FFF1DE', fg: '#6B3700', strong: '#B35A00', ink: '#8A4600', line: '#FFE0B8' },
  bad: { bg: '#FFE6E8', fg: '#8E1A27', strong: '#C42B3B' },
  info: { bg: '#E4EEFF', fg: '#14509E' },
};
export const display = "'Bricolage Grotesque', system-ui, sans-serif";

export const card: CSSProperties = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

/* ------------------------------------------------------------------ toasts */
type Toast = { id: number; text: string; tone: 'ok' | 'error' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = ++seq.current;
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" style={{ position: 'fixed', left: 16, right: 16, bottom: 18, zIndex: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        {items.map((t) => (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} style={{ maxWidth: 520, padding: '12px 18px', borderRadius: 14, background: t.tone === 'error' ? C.bad.strong : C.navy, color: '#FFFFFF', fontSize: 14, boxShadow: '0 8px 24px rgba(22,19,58,.25)', animation: 'ithraa-toast .2s ease-out' }}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------------------------------------------------- loading/error */
export function Loading({ label = 'Loading…', dark = false }: { label?: string; dark?: boolean }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48, color: dark ? C.lilac : C.muted, fontSize: 15, flex: 1 }}>
      <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', border: `3px solid ${dark ? C.navyLine : C.border}`, borderTopColor: dark ? C.lime : C.indigo, animation: 'ithraa-spin .8s linear infinite' }} />
      {label}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div role="alert" style={{ ...card, alignItems: 'flex-start', margin: 24, background: C.bad.bg, borderColor: '#F5C2C8', color: C.bad.fg }}>
      <strong style={{ fontSize: 16 }}>We couldn’t load this page</strong>
      <span style={{ fontSize: 14 }}>{msg}</span>
      {retry && (
        <button onClick={retry} style={{ ...btn.primary, background: C.bad.strong }}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Render loading / error / data for a react-query result. */
export function Async<T>({ q, children, dark }: { q: { data?: T; error: unknown; isLoading: boolean; refetch: () => unknown }; children: (d: T) => ReactNode; dark?: boolean }) {
  if (q.isLoading) return <Loading dark={dark} />;
  if (q.error || q.data === undefined) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

/* ----------------------------------------------------------------- buttons */
const base: CSSProperties = { minHeight: 44, padding: '0 18px', borderRadius: 12, fontSize: 15, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' };
export const btn = {
  primary: { ...base, border: 'none', background: C.indigo, color: '#FFFFFF', fontWeight: 600 } as CSSProperties,
  dark: { ...base, border: 'none', background: C.navy, color: C.lime, fontWeight: 600 } as CSSProperties,
  lime: { ...base, border: 'none', background: C.lime, color: C.navy, fontWeight: 600 } as CSSProperties,
  ghost: { ...base, border: `1px solid ${C.border2}`, background: C.white, color: C.ink } as CSSProperties,
  small: { minHeight: 36, padding: '0 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer', border: `1px solid ${C.border2}`, background: C.white, color: C.ink } as CSSProperties,
};

/* ------------------------------------------------------------------- modal */
export function Modal({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(22,19,58,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(22,19,58,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontFamily: display, fontSize: 22, fontWeight: 800 }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 18 }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const field: CSSProperties = { width: '100%', minHeight: 44, padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 15 };
export const label: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: C.ink2 };

/* ----------------------------------------------------------- notifications */
type Note = { id: number; text: string; link: string | null; when: string; unread: boolean };

export function NotificationsButton({ unread, dir = 'ltr' }: { unread: number; dir?: 'ltr' | 'rtl' }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery<Note[]>({ queryKey: ['notifications'], queryFn: () => api('/notifications'), enabled: open });
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      await api('/notifications/read', { method: 'POST' });
      qc.invalidateQueries({ queryKey: ['me'] });
    }
  };
  const label = dir === 'rtl' ? `الإشعارات، ${unread} جديدة` : `Notifications, ${unread} new`;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={toggle} aria-expanded={open} aria-label={label} style={{ position: 'relative', width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: C.white, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span style={{ position: 'absolute', top: 8, [dir === 'rtl' ? 'left' : 'right']: 9, width: 9, height: 9, borderRadius: '50%', background: '#E5542B', border: '2px solid #FFFFFF' }} />}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 52, [dir === 'rtl' ? 'left' : 'right']: 0, zIndex: 40, width: 'min(340px, 86vw)', background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: '0 16px 40px rgba(22,19,58,.18)', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {q.isLoading && <Loading />}
          {q.data?.length === 0 && <span style={{ padding: 14, fontSize: 14, color: C.muted }}>No notifications yet.</span>}
          {q.data?.map((n) => (
            <button key={n.id} onClick={() => { setOpen(false); if (n.link) nav(n.link); }} style={{ textAlign: 'start', display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px', borderRadius: 10, border: 'none', background: n.unread ? C.indigoTint : 'transparent', cursor: n.link ? 'pointer' : 'default', color: C.ink }}>
              <span style={{ fontSize: 14 }}>{n.text}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{n.when}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function UserChip({ initials, name, sub, color = C.indigo }: { initials: string; name: string; sub: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px 4px 4px', borderRadius: 14, background: C.white, border: `1px solid ${C.border}` }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>{initials}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: 12, color: C.muted }}>{sub}</span>
      </div>
    </div>
  );
}

/** EN / عربي switch used on page headers. */
export function LangSwitch({ lang, onChange }: { lang: 'en' | 'ar'; onChange: (l: 'en' | 'ar') => void }) {
  const opt = (l: 'en' | 'ar', text: string) => (
    <button key={l} aria-pressed={lang === l} lang={l} onClick={() => onChange(l)} style={{ minWidth: 52, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, border: 'none', cursor: 'pointer', background: lang === l ? C.white : 'transparent', color: lang === l ? C.ink : C.ink2, fontSize: 14, fontWeight: lang === l ? 600 : 400 }}>
      {text}
    </button>
  );
  return (
    <div role="group" aria-label={lang === 'ar' ? 'اللغة' : 'Language'} style={{ display: 'flex', padding: 4, borderRadius: 12, background: '#E6E7F2', gap: 2 }}>
      {opt('en', 'EN')}
      {opt('ar', 'عربي')}
    </div>
  );
}
