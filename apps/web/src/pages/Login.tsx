import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { HOME, useAuth, useMe, type Role } from '../lib/auth';
import { C, display, field } from '../components/ui';

const ROLES: { role: Role; tag: string; title: string; who: string; screens: string[] }[] = [
  { role: 'student', tag: 'Student view', title: 'Student', who: 'Karim Haddad · Grade 9',
    screens: ['Home', 'Knowledge tree', 'Session & homework', 'Quiz', 'Portfolio', 'Specialization match', 'Home (Arabic)'] },
  { role: 'teacher', tag: 'Teacher view', title: 'Teacher', who: 'Ms. Rana Khoury · Cyber Awareness',
    screens: ['Dashboard', 'Session planner', 'Gradebook'] },
  { role: 'admin', tag: 'Admin view', title: 'Admin', who: 'Program coordinator',
    screens: ['Overview', 'Weekly schedule', 'Students', 'Teachers', 'Student selection', 'AI assessments',
      'Adaptive assessment (Grade 6)', 'Program structure'] },
];

export default function Login() {
  const { token, signIn, viewAs } = useAuth();
  const me = useMe();
  const nav = useNavigate();
  // Retry for a while so the demo cards appear even if the API is still starting.
  const demo = useQuery<{ enabled: boolean }>({ queryKey: ['demo'], queryFn: () => api('/auth/demo'), retry: 10, retryDelay: 1500 });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (token && me.data) return <Navigate to={HOME[me.data.role]} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      nav(HOME[await signIn(email, password)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };
  const open = async (role: Role) => {
    try {
      await viewAs(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the demo');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.navy, color: '#FFFFFF', padding: '56px 24px 72px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 36 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: C.lime, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 26 }}>إ</div>
            <span style={{ fontSize: 15, color: C.lilac }}>Ithraa · الإثراء المعرفي</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 48, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05 }}>Sign in</h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: '#DAD8F2' }}>
            One platform for students, teachers and the program team. Sign in with your school account
            {demo.data?.enabled ? ', or open a demo view below. Inside, the sidebar’s “Demo · view as” switches between roles.' : '.'}
          </p>
        </header>

        <form onSubmit={submit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', background: C.navy2, borderRadius: 24, padding: 26, maxWidth: 760 }}>
          <label style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: C.lilac }}>
            Email
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
          </label>
          <label style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: C.lilac }}>
            Password
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={field} />
          </label>
          <button disabled={busy} style={{ minHeight: 44, padding: '0 22px', borderRadius: 12, border: 'none', background: C.lime, color: C.navy, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <span role="alert" style={{ flexBasis: '100%', color: '#FF9AA5', fontSize: 14 }}>{error}</span>}
        </form>

        {demo.data?.enabled && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20 }}>
            {ROLES.map((r) => (
              <section key={r.role} style={{ background: C.navy2, borderRadius: 24, padding: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 999, background: '#2F2A6B', color: C.lime, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.tag}</span>
                <h2 style={{ margin: 0, fontFamily: display, fontSize: 28, fontWeight: 800 }}>{r.title}</h2>
                <p style={{ margin: 0, color: C.lilac, fontSize: 14 }}>{r.who}</p>
                <button onClick={() => open(r.role)} style={{ minHeight: 48, margin: '8px 0 6px', borderRadius: 14, border: 'none', background: C.lime, color: C.navy, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                  Open {r.role} view
                </button>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {r.screens.map((s) => (
                    <li key={s} style={{ display: 'flex', alignItems: 'center', minHeight: 36, padding: '0 12px', borderRadius: 10, color: '#E6E4F8', fontSize: 15 }}>{s}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
