import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, LangSwitch, NotificationsButton, btn, display } from '../../components/ui';
import { useMe } from '../../lib/auth';
import { useAction, useGet } from '../../lib/hooks';
import { MyGroups, NoteModal, ParentMessageModal, h2, linkBtn, panel, textArea } from './common';

type ReadyItem = { key: string; t: string; m: string; ok: boolean };
type Flag = { student_id: number; name: string; first: string; cls: string; why: string; parent: string };
type RosterStudent = { id: number; name: string; ini: string; cls: string; status: 'P' | 'L' | 'A' | null };
type TipOption = { key: string; grades: number[]; label: string; n: number };
type Dashboard = {
  date: string;
  greeting: string;
  greeting_ar: string;
  first_name: string;
  kpis: { to_grade: number; to_grade_split: string; attendance: number | null; students: number; hw_on_time: number | null; hw_note: string; attention: number; flag_on: boolean };
  next: null | {
    lesson_id: number; group_id: number; group_name: string; label: string; title: string; classes: string;
    ready: ReadyItem[]; ready_count: number; ready_total: number; has_activity: boolean; teams: number;
    is_today: boolean; activity_open: boolean; checkin_code: string | null;
  };
  flags: Flag[];
  roster: null | { lesson_id: number; group: string; when: string; students: RosterStudent[] };
  to_grade: { assignment_id: number; group_id: number; t: string; m: string; n: number }[];
  tip: { options: TipOption[]; default: string | null; schedule_label: string; schedule_at: string };
  questions: { id: number; student: string; cls: string; context: string; text: string; when: string; answer: string | null }[];
};

const LOOK = {
  P: { label: 'Present', bg: C.ok.bg, fg: C.ok.fg, border: C.ok.strong },
  L: { label: 'Late', bg: C.warn.bg, fg: C.warn.fg, border: C.warn.strong },
  A: { label: 'Absent', bg: C.bad.bg, fg: C.bad.fg, border: C.bad.strong },
} as const;
const OK = { bg: C.navy2, border: C.navy2, borderStyle: 'solid', dot: C.lime, mark: '✓' };
const TODO = { bg: 'transparent', border: C.lime, borderStyle: 'dashed', dot: '#FFB547', mark: '!' };

const kpiTile: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: 20, borderRadius: 20, background: C.white, border: `1px solid ${C.border}`, color: C.ink, textDecoration: 'none' };
const kpiNum: CSSProperties = { fontFamily: display, fontSize: 34, fontWeight: 800, lineHeight: 1 };

export default function Dashboard() {
  const q = useGet<Dashboard>('/teacher/dashboard');
  const me = useMe().data;
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  return (
    <Shell role="teacher" active="dashboard" sidebarExtra={<MyGroups activeGroupId={q.data?.next?.group_id} />} mainStyle={{ gap: 24 }}>
      <Async q={q}>
        {(d) => (
          <>
            <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, color: C.muted }}>{d.date}</span>
                <h1 lang={lang} dir={lang === 'ar' ? 'rtl' : undefined} style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {lang === 'ar' ? `${d.greeting_ar} يا ${me?.name_ar?.split(' ')[0] ?? d.first_name}` : `${d.greeting}, ${d.first_name}`}
                </h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <LangSwitch lang={lang} onChange={setLang} />
                <NotificationsButton unread={me?.unread ?? 0} />
                <Link to="/teacher/planner" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 46, padding: '0 18px', borderRadius: 14, background: C.indigo, color: '#FFFFFF', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  Plan a session
                </Link>
              </div>
            </header>
            <Kpis d={d} />
            <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              <NextSession d={d} />
              <Attention flags={d.flags} flagOn={d.kpis.flag_on} />
            </section>
            <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
              <Roster d={d} />
              <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <ToGrade d={d} />
                <SendTip d={d} />
                <Questions d={d} />
              </div>
            </section>
          </>
        )}
      </Async>
    </Shell>
  );
}

function Kpis({ d }: { d: Dashboard }) {
  const k = d.kpis;
  const warn = k.attention > 0;
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 16 }}>
      <Link to="/teacher/gradebook" style={kpiTile}>
        <span style={{ fontSize: 14, color: C.muted }}>To grade</span>
        <span style={kpiNum}>{k.to_grade}</span>
        <span style={{ fontSize: 13, color: C.ink2 }}>{k.to_grade_split}</span>
      </Link>
      <div style={kpiTile}>
        <span style={{ fontSize: 14, color: C.muted }}>Attendance this term</span>
        <span style={kpiNum}>{k.attendance ?? '—'}{k.attendance !== null && '%'}</span>
        <span style={{ fontSize: 13, color: C.ink2 }}>Across {k.students} students</span>
      </div>
      <div style={kpiTile}>
        <span style={{ fontSize: 14, color: C.muted }}>Homework on time</span>
        <span style={kpiNum}>{k.hw_on_time ?? '—'}{k.hw_on_time !== null && '%'}</span>
        <span style={{ fontSize: 13, color: C.ink2 }}>{k.hw_note}</span>
      </div>
      <a href="#attention" style={{ ...kpiTile, background: warn ? C.warn.bg : C.white, border: `1px solid ${warn ? C.warn.line : C.border}` }}>
        <span style={{ fontSize: 14, color: warn ? C.warn.fg : C.muted }}>Need attention</span>
        <span style={{ ...kpiNum, color: warn ? C.warn.ink : C.ink }}>{k.attention}</span>
        <span style={{ fontSize: 13, color: warn ? C.warn.fg : C.ink2 }}>{k.flag_on ? 'Flagged automatically' : 'Flagging is turned off'}</span>
      </a>
    </section>
  );
}

function NextSession({ d }: { d: Dashboard }) {
  const n = d.next;
  const teams = useAction<void>(() => `/teacher/lessons/${n!.lesson_id}/teams`, { invalidate: ['teacher'], success: (r) => `${r.teams} teams of ${r.size} created, mixing classes` });
  const activity = useAction<{ open: boolean }>(() => `/teacher/lessons/${n!.lesson_id}/activity`, { invalidate: ['teacher'], success: (r) => (r.open ? 'Live activity is open for students' : 'Live activity closed') });
  if (!n) {
    return (
      <div style={{ flex: '999 1 520px', minWidth: 0, borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 28 }}>
        <h2 style={{ ...h2, fontSize: 24 }}>No upcoming sessions on the schedule</h2>
      </div>
    );
  }
  return (
    <div style={{ flex: '999 1 520px', minWidth: 0, borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.lime }}>{n.label}</span>
          <h2 style={{ margin: 0, fontFamily: display, fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>{n.title}</h2>
          <span style={{ fontSize: 14, color: C.lilac }}>{n.classes}</span>
        </div>
        <span style={{ padding: '8px 12px', borderRadius: 12, background: C.navy3, fontSize: 14 }}>
          {n.ready_count} of {n.ready_total} ready
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10 }}>
        {n.ready.map((r) => {
          const s = r.ok ? OK : TODO;
          return (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: s.bg, border: `1.5px ${s.borderStyle} ${s.border}` }}>
              <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: '50%', background: s.dot, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{s.mark}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{r.t}</span>
                <span style={{ fontSize: 12, color: C.lilac }}>{r.m}</span>
              </span>
            </div>
          );
        })}
      </div>
      {n.checkin_code && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: C.navy2 }}>
          <span style={{ fontSize: 14, color: C.lilac }}>Check-in code to show in class</span>
          <span style={{ fontFamily: display, fontSize: 26, fontWeight: 800, letterSpacing: '0.2em', color: C.lime }}>{n.checkin_code}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {n.has_activity && (
          <button onClick={() => teams.mutate()} disabled={teams.isPending} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: 0, background: C.lime, color: C.navy, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {n.teams ? 'Teams created ✓' : 'Auto-create teams of 3'}
          </button>
        )}
        {n.is_today && n.has_activity && (
          <button onClick={() => activity.mutate({ open: !n.activity_open })} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: `1.5px solid ${C.lime}`, background: n.activity_open ? C.lime : 'transparent', color: n.activity_open ? C.navy : '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {n.activity_open ? 'Close live activity' : 'Start live activity'}
          </button>
        )}
        <Link to={`/teacher/planner?group=${n.group_id}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 46, padding: '0 18px', borderRadius: 14, border: '1.5px solid #5C58A3', color: '#FFFFFF', textDecoration: 'none', fontSize: 15 }}>
          Open session plan
        </Link>
      </div>
    </div>
  );
}

function Attention({ flags, flagOn }: { flags: Flag[]; flagOn: boolean }) {
  const [msg, setMsg] = useState<Flag | null>(null);
  const [note, setNote] = useState<Flag | null>(null);
  return (
    <div id="attention" style={{ flex: '1 1 320px', minWidth: 0, ...panel }}>
      <h2 style={h2}>Need attention</h2>
      {!flags.length && (
        <span style={{ fontSize: 14, color: C.muted }}>
          {flagOn ? 'Nobody is slipping right now. Flags appear here automatically.' : 'Turn on “Flag students who are slipping” in the session planner to see flags here.'}
        </span>
      )}
      {flags.map((f) => (
        <div key={f.student_id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 16, background: '#F7F7FC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{f.name}</span>
            <span style={{ fontSize: 13, color: C.muted }}>{f.cls}</span>
          </div>
          <span style={{ fontSize: 14, lineHeight: 1.45, color: C.warn.ink }}>{f.why}</span>
          <div style={{ display: 'flex', gap: 14 }}>
            <button onClick={() => setMsg(f)} style={linkBtn}>Message parent</button>
            <button onClick={() => setNote(f)} style={{ ...linkBtn, color: C.ink2, fontWeight: 400 }}>Add note</button>
          </div>
        </div>
      ))}
      {msg && <ParentMessageModal student={msg} onClose={() => setMsg(null)} />}
      {note && <NoteModal student={note} onClose={() => setNote(null)} />}
    </div>
  );
}

function Roster({ d }: { d: Dashboard }) {
  const r = d.roster;
  const [all, setAll] = useState(false);
  const [local, setLocal] = useState<Record<number, 'P' | 'L' | 'A'>>({});
  useEffect(() => setLocal({}), [r?.lesson_id]);
  const mark = useAction<{ student_id: number; status: string }>(() => `/teacher/lessons/${r!.lesson_id}/attendance`, { method: 'PUT', invalidate: ['teacher'] });
  const allPresent = useAction<void>(() => `/teacher/lessons/${r!.lesson_id}/attendance/all-present`, { invalidate: ['teacher'], success: 'Everyone marked present' });
  if (!r) {
    return (
      <div style={{ flex: '999 1 520px', minWidth: 0, ...panel }}>
        <h2 style={h2}>Attendance</h2>
        <span style={{ fontSize: 14, color: C.muted }}>No sessions have run yet for this group.</span>
      </div>
    );
  }
  const status = (s: RosterStudent) => local[s.id] ?? s.status;
  const count = (k: string) => r.students.filter((s) => status(s) === k).length;
  const shown = all ? r.students : r.students.slice(0, 10);
  const set = (sid: number, k: 'P' | 'L' | 'A') => {
    setLocal((x) => ({ ...x, [sid]: k }));
    mark.mutate({ student_id: sid, status: k });
  };
  return (
    <div style={{ flex: '999 1 520px', minWidth: 0, ...panel }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 style={h2}>Attendance · {r.group}</h2>
          <span style={{ fontSize: 13, color: C.muted }}>
            Last session · {r.when} · {count('P')} present · {count('L')} late · {count('A')} absent
          </span>
        </div>
        <button onClick={() => { setLocal(Object.fromEntries(r.students.map((s) => [s.id, 'P' as const]))); allPresent.mutate(); }} style={{ minHeight: 40, padding: '0 14px', borderRadius: 12, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>
          Mark all present
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {shown.map((s) => (
          <div key={s.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 4px', borderBottom: '1px solid #EEEFF5' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: C.indigoTint, color: '#3A2BD0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{s.ini}</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{s.cls}</span>
              </span>
            </span>
            <span role="group" aria-label={`Attendance for ${s.name}`} style={{ display: 'flex', gap: 6 }}>
              {(['P', 'L', 'A'] as const).map((k) => {
                const on = status(s) === k;
                const l = LOOK[k];
                return (
                  <button key={k} onClick={() => set(s.id, k)} aria-pressed={on} style={{ minWidth: 78, minHeight: 36, borderRadius: 10, border: `1.5px solid ${on ? l.border : C.border}`, background: on ? l.bg : C.white, color: on ? l.fg : C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    {l.label}
                  </button>
                );
              })}
            </span>
          </div>
        ))}
      </div>
      {r.students.length > 10 && (
        <button onClick={() => setAll(!all)} style={{ ...linkBtn, alignSelf: 'flex-start', fontSize: 14, fontWeight: 500, textDecoration: 'underline' }}>
          {all ? 'Show fewer' : `Show all ${r.students.length} students`}
        </button>
      )}
    </div>
  );
}

function ToGrade({ d }: { d: Dashboard }) {
  return (
    <div style={{ ...panel, gap: 12 }}>
      <h2 style={h2}>To grade</h2>
      {!d.to_grade.length && <span style={{ fontSize: 14, color: C.muted }}>All caught up.</span>}
      {d.to_grade.map((g) => (
        <Link key={g.assignment_id} to={`/teacher/gradebook?group=${g.group_id}&assignment=${g.assignment_id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: 14, border: `1px solid ${C.border}`, color: C.ink, textDecoration: 'none' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{g.t}</span>
            <span style={{ fontSize: 13, color: C.muted }}>{g.m}</span>
          </span>
          <span style={{ flexShrink: 0, padding: '6px 10px', borderRadius: 10, background: C.indigoTint, color: '#3A2BD0', fontSize: 13, fontWeight: 600 }}>{g.n} left</span>
        </Link>
      ))}
    </div>
  );
}

function SendTip({ d }: { d: Dashboard }) {
  const [aud, setAud] = useState<Record<string, boolean>>(() => (d.tip.default ? { [d.tip.default]: true } : {}));
  const [text, setText] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const send = useAction<{ grades: number[]; text: string; send_at?: string }>('/teacher/tips', { invalidate: ['teacher'] });
  const grades = d.tip.options.filter((o) => aud[o.key]).flatMap((o) => o.grades);
  const count = d.tip.options.filter((o) => aud[o.key]).reduce((s, o) => s + o.n, 0);
  const go = (schedule: boolean) =>
    send.mutate(
      { grades, text, send_at: schedule ? d.tip.schedule_at : undefined },
      {
        onSuccess: (r) => {
          setSent(r.scheduled ? `Scheduled for ${r.when} · ${r.count} students. It appears on their home page then.` : `Sent to ${r.count} students. It appears on their home page.`);
          setText('');
        },
      },
    );
  return (
    <div id="tips" style={{ ...panel, gap: 12 }}>
      <h2 style={h2}>Send a tip</h2>
      <div role="group" aria-label="Send to" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {d.tip.options.map((o) => {
          const on = !!aud[o.key];
          return (
            <button key={o.key} onClick={() => { setSent(null); setAud({ ...aud, [o.key]: !on }); }} aria-pressed={on} style={{ minHeight: 36, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${on ? C.navy : C.border2}`, background: on ? C.navy : C.white, color: on ? '#FFFFFF' : C.ink, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {o.label}
            </button>
          );
        })}
      </div>
      <label htmlFor="tipText" style={{ fontSize: 13, fontWeight: 600 }}>Message</label>
      <textarea id="tipText" rows={4} value={text} onChange={(e) => { setSent(null); setText(e.target.value); }} placeholder="Bring your device count tomorrow — we’ll use it in the smart-home activity." style={textArea} />
      {sent ? (
        <div role="status" style={{ padding: '12px 14px', borderRadius: 12, background: C.ok.bg, color: C.ok.fg, fontSize: 14, fontWeight: 500 }}>{sent}</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => go(false)} disabled={!grades.length || text.trim().length < 3 || send.isPending} style={{ flex: '1 1 140px', minHeight: 46, borderRadius: 12, border: 0, background: C.navy, color: C.lime, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !grades.length || text.trim().length < 3 ? 0.6 : 1 }}>
            Send now{count ? ` · ${count}` : ''}
          </button>
          <button onClick={() => go(true)} disabled={!grades.length || text.trim().length < 3 || send.isPending} style={{ flex: '1 1 140px', minHeight: 46, borderRadius: 12, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>
            {d.tip.schedule_label}
          </button>
        </div>
      )}
    </div>
  );
}

function Questions({ d }: { d: Dashboard }) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const answer = useAction<{ id: number; answer: string }>((v) => `/teacher/questions/${v.id}/answer`, { invalidate: ['teacher'], success: 'Answer sent to the student' });
  return (
    <div style={{ ...panel, gap: 12 }}>
      <h2 style={h2}>Questions from students</h2>
      {!d.questions.length && <span style={{ fontSize: 14, color: C.muted }}>No questions yet. Students can ask from their home and session pages.</span>}
      {d.questions.map((q) => (
        <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 16, background: q.answer ? '#F7F7FC' : C.indigoTint }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{q.student} · {q.cls}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{q.when}</span>
          </div>
          {q.context && <span style={{ fontSize: 12, color: C.muted }}>{q.context}</span>}
          <span style={{ fontSize: 14, lineHeight: 1.45 }}>{q.text}</span>
          {q.answer ? (
            <span style={{ fontSize: 13, color: C.ok.ink }}>You answered: {q.answer}</span>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input aria-label={`Answer ${q.student}`} value={drafts[q.id] ?? ''} onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })} placeholder="Type your answer…" style={{ flex: 1, minWidth: 0, minHeight: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${C.border2}`, fontSize: 14 }} />
              <button disabled={!(drafts[q.id] ?? '').trim()} onClick={() => answer.mutate({ id: q.id, answer: drafts[q.id] })} style={{ ...btn.small, background: C.navy, color: C.lime, border: 0, fontWeight: 600 }}>Send</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
