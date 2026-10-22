import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useMe, type Role } from '../lib/auth';
import { C, display } from './ui';

/* Icons from the prototype's side navigation (24×24 strokes). */
const ICONS: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
  tree: <><circle cx="6" cy="5" r="2.5" /><circle cx="18" cy="5" r="2.5" /><circle cx="12" cy="19" r="2.5" /><path d="M6 7.5v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-2" /><path d="M12 12.5v4" /></>,
  book: <><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z" /><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20" /></>,
  check: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m8 12 3 3 5-6" /></>,
  case: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  dash: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>,
  bars: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14a6 6 0 0 1 3.5 6" /></>,
  board: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  add: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M19 8v6M16 11h6" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
};

type NavItem = { to: string; icon: string; label: string; key: string };

const NAV: Record<Role, NavItem[]> = {
  student: [
    { key: 'home', to: '/student', icon: 'home', label: 'Home' },
    { key: 'tree', to: '/student/tree', icon: 'tree', label: 'Knowledge tree' },
    { key: 'session', to: '/student/session', icon: 'book', label: 'Sessions & homework' },
    { key: 'quiz', to: '/student/quiz', icon: 'check', label: 'Quizzes & activities' },
    { key: 'portfolio', to: '/student/portfolio', icon: 'case', label: 'Portfolio' },
    { key: 'spec', to: '/student/specialization', icon: 'compass', label: 'Specialization' },
  ],
  teacher: [
    { key: 'dashboard', to: '/teacher', icon: 'dash', label: 'Dashboard' },
    { key: 'planner', to: '/teacher/planner', icon: 'cal', label: 'Session planner' },
    { key: 'gradebook', to: '/teacher/gradebook', icon: 'grid', label: 'Gradebook' },
    { key: 'tips', to: '/teacher#tips', icon: 'bulb', label: 'Tips & messages' },
  ],
  admin: [
    { key: 'overview', to: '/admin', icon: 'bars', label: 'Overview' },
    { key: 'schedule', to: '/admin/schedule', icon: 'cal', label: 'Weekly schedule' },
    { key: 'students', to: '/admin/students', icon: 'people', label: 'Students' },
    { key: 'teachers', to: '/admin/teachers', icon: 'board', label: 'Teachers' },
    { key: 'selection', to: '/admin/selection', icon: 'add', label: 'Student selection' },
    { key: 'structure', to: '/admin/structure', icon: 'layers', label: 'Program structure' },
  ],
};
const NAV_AR: Record<string, string> = {
  home: 'الرئيسية', tree: 'شجرة المعرفة', session: 'الحصص والواجبات', quiz: 'الاختبارات والأنشطة',
  portfolio: 'ملف الإنجاز', spec: 'التخصص',
};
const ROLE_LABEL: Record<Role, string> = { student: 'الإثراء المعرفي', teacher: 'Teacher', admin: 'School admin' };

function Icon({ name, active }: { name: string; active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? C.lime : 'currentColor'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const box: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 16, background: C.navy2 };

function Sidebar({ role, active, lang, extra }: { role: Role; active: string; lang: 'en' | 'ar'; extra?: ReactNode }) {
  const { viewAs, signOut } = useAuth();
  const me = useMe().data;
  const ar = lang === 'ar';
  const roles: [Role, string, string][] = [['student', 'Student', 'طالب'], ['teacher', 'Teacher', 'معلّم'], ['admin', 'Admin', 'إدارة']];
  return (
    <aside className="side-nav" style={{ flex: '1 1 248px', maxWidth: '100%', background: C.navy, color: C.lilac, padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px' }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: C.lime, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22 }}>إ</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: ar ? undefined : display, fontWeight: 700, fontSize: ar ? 20 : 21, color: '#FFFFFF', lineHeight: ar ? 1.1 : 1 }}>{ar ? 'إثراء' : 'Ithraa'}</span>
          <span style={{ fontSize: 13, color: C.lilac2 }}>{ROLE_LABEL[role]}</span>
        </div>
      </div>
      <nav aria-label={ar ? 'قائمة الطالب' : role[0].toUpperCase() + role.slice(1)} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV[role].map((n) => {
          const on = n.key === active;
          const to = ar && n.key === 'home' ? '/student/ar' : n.to;
          return (
            <Link key={n.key} to={to} aria-current={on ? 'page' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, padding: '10px 14px', borderRadius: 12, background: on ? C.navy3 : undefined, color: on ? '#FFFFFF' : C.lilac, textDecoration: 'none', fontSize: 15, fontWeight: on ? 500 : undefined }}>
              <Icon name={n.icon} active={on} />
              {ar ? NAV_AR[n.key] ?? n.label : n.label}
            </Link>
          );
        })}
      </nav>
      {role === 'student' && me?.student && (
        <div style={box}>
          <span style={{ fontSize: ar ? 13 : 12, letterSpacing: ar ? undefined : '0.08em', textTransform: ar ? undefined : 'uppercase', color: C.lilac2 }}>{ar ? 'رحلتك' : 'Your journey'}</span>
          <span style={{ fontFamily: ar ? undefined : display, fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
            {ar ? `السنة ${me.student.year} من 6` : `Year ${me.student.year} of 6`}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
            {me.student.bars.map((b, i) => (
              <div key={i} style={{ height: 6, borderRadius: 3, background: b >= 1 ? C.lime : b > 0 ? `linear-gradient(90deg, ${C.lime} ${Math.round(b * 100)}%, ${C.navyLine} ${Math.round(b * 100)}%)` : C.navyLine }} />
            ))}
          </div>
          <span style={{ fontSize: 13, color: C.lilac, lineHeight: ar ? 1.6 : undefined }}>
            {ar && me.student.general ? `الصف ${me.student.grade} · التوعية العامة. يبدأ التخصص في الصف العاشر.` : me.student.journey_note}
          </span>
        </div>
      )}
      {role === 'admin' && me && (
        <div style={{ ...box, gap: 6 }}>
          <span style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lilac2 }}>School year</span>
          <span style={{ fontFamily: display, fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{me.year} · Week {me.week} of {me.total_weeks}</span>
          <div style={{ height: 6, borderRadius: 3, background: C.navyLine, overflow: 'hidden' }}>
            <div style={{ width: `${me.admin?.pct ?? 0}%`, height: '100%', background: C.lime }} />
          </div>
        </div>
      )}
      {extra}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '0 8px' }}>
        {me?.demo && (
          <>
            <span style={{ fontSize: 12, color: C.lilac2 }}>{ar ? 'عرض تجريبي · الدخول بصفة' : 'Demo · view as'}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {roles.map(([r, en, arl]) => (
                <button key={r} onClick={() => r !== role && viewAs(r)} aria-pressed={r === role} style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: r === role ? C.lime : C.navy3, color: r === role ? C.navy : '#FFFFFF', fontWeight: r === role ? 600 : 400 }}>
                  {ar ? arl : en}
                </button>
              ))}
            </div>
          </>
        )}
        <button onClick={signOut} style={{ alignSelf: 'flex-start', marginTop: 4, padding: 0, border: 'none', background: 'none', color: C.lilac2, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
          {ar ? 'تسجيل الخروج' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}

/** Page frame: dark side navigation + main column, as in the prototype. */
export function Shell({ role, active, children, lang = 'en', sidebarExtra, mainStyle }: {
  role: Role;
  active: string;
  children: ReactNode;
  lang?: 'en' | 'ar';
  sidebarExtra?: ReactNode;
  mainStyle?: CSSProperties;
}) {
  return (
    <div dir={lang === 'ar' ? 'rtl' : undefined} lang={lang} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', minHeight: '100vh', background: C.bg, color: C.ink }}>
      <Sidebar role={role} active={active} lang={lang} extra={sidebarExtra} />
      <main style={{ flex: '999 1 560px', minWidth: 0, padding: '28px 40px 48px', display: 'flex', flexDirection: 'column', gap: 28, ...mainStyle }}>
        {children}
      </main>
    </div>
  );
}
