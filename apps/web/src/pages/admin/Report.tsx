import { Link } from 'react-router-dom';
import { Async, C, btn, display } from '../../components/ui';
import { useGet } from '../../lib/hooks';
import { AttendanceBars, DemandBars, Kpi, type OverviewData } from './Overview';

/** Monthly report for the principal: a print-ready page built from the live overview. */
export default function Report() {
  const q = useGet<OverviewData>('/admin/overview');
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, padding: '32px 24px 56px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Async q={q}>
          {(d) => {
            const k = d.kpis;
            const open = d.alerts.filter((a) => !a.done);
            return (
              <>
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <Link to="/admin" style={btn.ghost}>← Back to overview</Link>
                  <button onClick={() => window.print()} style={btn.primary}>Print or save as PDF</button>
                </div>
                <header style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: C.lime, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}>إ</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 14, color: C.muted }}>Ithraa · report for the principal · prepared by {d.coordinator}</span>
                    <h1 style={{ margin: 0, fontFamily: display, fontSize: 32, fontWeight: 800 }}>{d.month} {d.year} · week {d.week}</h1>
                  </div>
                </header>
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
                  <Kpi label="Students in the program" value={k.students} sub={`${k.general} general · ${k.spec} specialization`} />
                  <Kpi label="Attendance this month" value={k.attendance === null ? '—' : `${k.attendance}%`} sub={k.attendance_trend} />
                  <Kpi label="Homework submitted" value={k.homework === null ? '—' : `${k.homework}%`} sub={`Target ${k.homework_target}%`} />
                  <Kpi label="Program mornings held" value={k.mornings_held} total={k.mornings_total} sub={k.mornings_note} />
                </section>
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 20 }}>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 style={{ margin: 0, fontFamily: display, fontSize: 19 }}>Attendance by grade</h2>
                    <AttendanceBars grades={d.grades} />
                  </div>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 style={{ margin: 0, fontFamily: display, fontSize: 19 }}>Specialization demand · {d.spec_total} students</h2>
                    <DemandBars demand={d.demand} />
                    {d.shortlists && <span style={{ fontSize: 13, color: C.muted }}>Grade 9 shortlists so far: {d.shortlists}</span>}
                  </div>
                </section>
                <section style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h2 style={{ margin: 0, fontFamily: display, fontSize: 19 }}>This week’s sessions</h2>
                  {d.sessions.map((s, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1.2fr 1fr 1fr', gap: 10, fontSize: 13, padding: '8px 0', borderTop: '1px solid #EEEFF5' }}>
                      <span><strong style={{ fontWeight: 600 }}>{s.group}</strong> · {s.track}</span>
                      <span>{s.day}</span>
                      <span>{s.teacher}</span>
                      <span style={{ color: s.prep_warn ? C.warn.ink : C.ok.ink }}>{s.prep}</span>
                      <span>{s.status}</span>
                    </div>
                  ))}
                </section>
                <section style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h2 style={{ margin: 0, fontFamily: display, fontSize: 19 }}>Open issues · {open.length}</h2>
                  {open.length === 0 && <span style={{ fontSize: 14, color: C.muted }}>No open issues this month.</span>}
                  {d.alerts.map((a) => (
                    <div key={a.key} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.5 }}>
                      <strong style={{ minWidth: 130, fontWeight: 600 }}>{a.tag}</strong>
                      <span>{a.text}{a.done ? ' (handled)' : ''}</span>
                    </div>
                  ))}
                </section>
              </>
            );
          }}
        </Async>
      </div>
    </div>
  );
}
