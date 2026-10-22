import { Link, useNavigate } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, display } from '../../components/ui';
import { useAction, useGet } from '../../lib/hooks';

export type OverviewData = {
  today: string;
  coordinator: string;
  month: string;
  year: number;
  week: number;
  kpis: {
    students: number; general: number; spec: number; attendance: number | null; attendance_trend: string;
    homework: number | null; homework_target: number; mornings_held: number; mornings_total: number; mornings_note: string;
  };
  sessions: { group: string; track: string; day: string; teacher: string; prep: string; prep_warn: boolean; held: boolean; status: string; color: string }[];
  alerts: { key: string; kind: string; tag: string; tone: string; text: string; action: string; done: boolean; link?: string }[];
  demand: { id: string; name: string; n: number; color: string; w: number }[];
  spec_total: number;
  shortlists: string;
  grades: { label: string; v: number | null; h: number; general: boolean }[];
};

export const TAG_FG: Record<string, string> = { amber: '#FFB547', red: '#FF9AA5', blue: '#A9C8FF' };

export function Kpi({ label, value, sub, total }: { label: string; value: string | number; sub: string; total?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 20, borderRadius: 20, background: C.white, border: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 14, color: C.muted }}>{label}</span>
      <span style={{ fontFamily: display, fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
        {value}
        {total !== undefined && <span style={{ fontSize: 18, color: C.muted }}> / {total}</span>}
      </span>
      <span style={{ fontSize: 13, color: C.ink2 }}>{sub}</span>
    </div>
  );
}

export function AttendanceBars({ grades }: { grades: OverviewData['grades'] }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 14, alignItems: 'end', height: 180, paddingTop: 10 }}>
        {grades.map((g) => (
          <div key={g.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{g.v === null ? '—' : `${g.v}%`}</span>
            <div style={{ width: '100%', maxWidth: 44, height: `${g.h}%`, borderRadius: '8px 8px 4px 4px', background: g.general ? C.indigo : C.navy }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 14, fontSize: 13, color: C.ink2, textAlign: 'center' }}>
        {grades.map((g) => <span key={g.label}>{g.label}</span>)}
      </div>
      <span style={{ fontSize: 13, color: C.muted }}>Bar heights start at 80% so small differences are visible.</span>
    </>
  );
}

export function DemandBars({ demand }: { demand: OverviewData['demand'] }) {
  return (
    <>
      {demand.map((d) => (
        <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 36px', gap: 12, alignItems: 'center', fontSize: 14 }}>
          <span>{d.name}</span>
          <span style={{ height: 22, borderRadius: 6, background: C.chip, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${d.w}%`, borderRadius: 6, background: d.color }} />
          </span>
          <span style={{ textAlign: 'right', fontWeight: 600 }}>{d.n}</span>
        </div>
      ))}
    </>
  );
}

const panel = { borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 16 };
const h2 = { margin: 0, fontFamily: display, fontSize: 20, fontWeight: 700 };

export default function Overview() {
  const q = useGet<OverviewData>('/admin/overview');
  const nav = useNavigate();
  const act = useAction<{ key: string }>('/admin/alerts/act', { invalidate: ['admin'], success: (r) => r.message });

  return (
    <Shell role="admin" active="overview" mainStyle={{ gap: 22 }}>
      <Async q={q}>
        {(d) => {
          const k = d.kpis;
          const open = d.alerts.filter((a) => !a.done).length;
          return (
            <>
              <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 14, color: C.muted }}>{d.today} · {d.coordinator}</span>
                  <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Program overview</h1>
                </div>
                <Link to="/admin/report" style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, background: C.indigo, color: '#FFFFFF', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                  Monthly report for the principal
                </Link>
              </header>

              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 16 }}>
                <Kpi label="Students in the program" value={k.students} sub={`${k.general} general · ${k.spec} specialization`} />
                <Kpi label="Attendance this month" value={k.attendance === null ? '—' : `${k.attendance}%`} sub={k.attendance_trend} />
                <Kpi label="Homework submitted" value={k.homework === null ? '—' : `${k.homework}%`} sub={`Target ${k.homework_target}%`} />
                <Kpi label="Program mornings held" value={k.mornings_held} total={k.mornings_total} sub={k.mornings_note} />
              </section>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <section style={{ ...panel, flex: '999 1 560px', minWidth: 0, gap: 14 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <h2 style={h2}>This week’s sessions</h2>
                    <Link to="/admin/schedule" style={{ fontSize: 13, fontWeight: 500 }}>Week {d.week} · open weekly schedule</Link>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <div role="table" aria-label="This week’s sessions" style={{ minWidth: 640, display: 'flex', flexDirection: 'column' }}>
                      <div role="row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.9fr 1.3fr 1.2fr 1.2fr', gap: 12, padding: '8px 10px', fontSize: 12, fontWeight: 600, color: C.muted }}>
                        {['Group', 'Day', 'Teacher', 'Prepared', 'Status'].map((h) => <span key={h} role="columnheader">{h}</span>)}
                      </div>
                      {d.sessions.map((s, i) => (
                        <div key={i} role="row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.9fr 1.3fr 1.2fr 1.2fr', gap: 12, alignItems: 'center', padding: '11px 10px', borderTop: '1px solid #EEEFF5', fontSize: 14 }}>
                          <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                            <span style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 500 }}>{s.group}</span>
                              <span style={{ fontSize: 12, color: C.muted }}>{s.track}</span>
                            </span>
                          </span>
                          <span role="cell">{s.day}</span>
                          <span role="cell">{s.teacher}</span>
                          <span role="cell" style={{ color: s.prep_warn ? C.warn.ink : C.ok.ink, fontWeight: 500 }}>{s.prep}</span>
                          <span role="cell">
                            <span style={{ padding: '4px 10px', borderRadius: 999, background: s.held ? C.ok.bg : C.info.bg, color: s.held ? C.ok.fg : C.info.fg, fontSize: 12, fontWeight: 600 }}>{s.status}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section style={{ flex: '1 1 340px', minWidth: 0, borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={h2}>Needs your attention</h2>
                    <span style={{ padding: '4px 10px', borderRadius: 999, background: C.lime, color: C.navy, fontSize: 12, fontWeight: 700 }}>{open}</span>
                  </div>
                  {d.alerts.length === 0 && <span style={{ fontSize: 14, color: C.lilac }}>Nothing needs you right now.</span>}
                  {d.alerts.map((a) => (
                    <div key={a.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 16, background: C.navy2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: TAG_FG[a.tone] ?? C.lilac }}>{a.tag}</span>
                      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{a.text}</span>
                      {a.done ? (
                        <span style={{ fontSize: 13, color: C.lime }}>Done ✓</span>
                      ) : (
                        <button
                          disabled={act.isPending}
                          onClick={() => act.mutate({ key: a.key }, { onSuccess: () => a.link && nav(a.link) })}
                          style={{ alignSelf: 'flex-start', minHeight: 36, padding: '0 12px', borderRadius: 10, border: '1.5px solid #5C58A3', background: 'transparent', color: '#FFFFFF', fontSize: 13, cursor: 'pointer' }}
                        >
                          {a.action}
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              </div>

              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 20 }}>
                <div style={panel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <h2 style={h2}>Specialization demand</h2>
                    <span style={{ fontSize: 13, color: C.muted }}>Grades 10–12 · {d.spec_total} students</span>
                  </div>
                  <DemandBars demand={d.demand} />
                  <span style={{ fontSize: 13, color: C.muted }}>
                    {d.shortlists ? `Grade 9 shortlists so far: ${d.shortlists}` : 'No Grade 9 shortlists yet.'}
                  </span>
                </div>
                <div style={panel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h2 style={h2}>Attendance by grade</h2>
                    <span style={{ fontSize: 13, color: C.muted }}>This month</span>
                  </div>
                  <AttendanceBars grades={d.grades} />
                </div>
              </section>
            </>
          );
        }}
      </Async>
    </Shell>
  );
}
