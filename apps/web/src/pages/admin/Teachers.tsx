import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, Modal, btn, display, field, label, useToast } from '../../components/ui';
import { download } from '../../lib/api';
import { useAction, useGet } from '../../lib/hooks';

type TeacherRow = { id: number; name: string; ini: string; color: string; short: string; status: string; bad: boolean };
type Detail = {
  id: number; name: string; formal: string; ini: string; color: string; role: string;
  days: { l: string; on: boolean }[];
  kpis: { label: string; v: string; sub: string; bad: boolean }[];
  groups: { id: number; name: string; n: number; avg_label: string; w: number; on: number | null; risk: number }[];
  log: { when: string; text: string; warn: boolean }[];
  week: { day: string; n: number; h: number }[]; week_text: string;
  survey: { q: string; v: string; w: number }[];
  flags: string[]; flag_title: string; bad: boolean;
  upcoming: { lesson_id: number; label: string }[];
};

const h2 = { margin: 0, fontFamily: display, fontSize: 18, fontWeight: 700 } as const;
const panel = { borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column' as const, gap: 12 };

export default function Teachers() {
  const toast = useToast();
  const list = useGet<TeacherRow[]>('/admin/teachers');
  const [sel, setSel] = useState<number | null>(null);
  const current = sel ?? list.data?.[0]?.id ?? null;
  const exportAll = () => download('/admin/teachers/export.xlsx', 'ithraa-teachers-term-report.xlsx').catch((e) => toast(e.message, 'error'));

  return (
    <Shell role="admin" active="teachers" mainStyle={{ gap: 22 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Teachers</h1>
          <span style={{ fontSize: 15, color: '#4A4D68' }}>{list.data?.length ?? '…'} teachers · performance tracked automatically from sessions, uploads and grading</span>
        </div>
        <button onClick={exportAll} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>
          Export term report
        </button>
      </header>
      <Async q={list}>
        {(rows) => (
          <>
            <section aria-label="Teacher list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
              {rows.map((t) => {
                const on = t.id === current;
                return (
                  <button key={t.id} onClick={() => setSel(t.id)} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, border: `2px solid ${on ? C.indigo : C.border}`, background: on ? C.indigoTint : C.white, color: C.ink, textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ width: 42, height: 42, flexShrink: 0, borderRadius: '50%', background: t.color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>{t.ini}</span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>{t.short}</span>
                    </span>
                    <span title={t.status} aria-label={t.status} style={{ width: 10, height: 10, flexShrink: 0, borderRadius: '50%', background: t.bad ? '#E0A100' : C.ok.strong }} />
                  </button>
                );
              })}
            </section>
            {current && <TeacherDetail id={current} />}
          </>
        )}
      </Async>
    </Shell>
  );
}

function TeacherDetail({ id }: { id: number }) {
  const toast = useToast();
  const q = useGet<Detail>(`/admin/teachers/${id}`);
  const [msg, setMsg] = useState<string | null>(null);
  const [visit, setVisit] = useState<{ lesson: number | null; note: string } | null>(null);
  const message = useAction<{ text: string }>(`/admin/teachers/${id}/message`, { success: 'Message sent' });
  const plan = useAction<{ lesson_id: number; note: string }>(`/admin/teachers/${id}/visit`, {
    invalidate: ['admin', 'teachers'], success: (r) => `Visit planned for ${r.when}. The teacher has been told.`,
  });

  return (
    <Async q={q}>
      {(d) => (
        <>
          <section style={{ borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: d.color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: display, fontSize: 22, fontWeight: 800 }}>{d.ini}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: display, fontSize: 26, fontWeight: 700 }}>{d.name}</span>
                <span style={{ fontSize: 14, color: C.lilac }}>{d.role}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.lilac2 }}>Available</span>
                  {d.days.map((dy) => (
                    <span key={dy.l} style={{ padding: '3px 9px', borderRadius: 8, background: dy.on ? C.lime : C.navy3, color: dy.on ? C.navy : '#8F8BC4', fontSize: 12, fontWeight: 600 }}>{dy.l}</span>
                  ))}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={() => setMsg('')} style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: 0, background: C.lime, color: C.navy, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Message</button>
              <button onClick={() => setVisit({ lesson: d.upcoming[0]?.lesson_id ?? null, note: '' })} style={ghostDark}>Plan a class visit</button>
              <button onClick={() => download(`/admin/teachers/${id}/export.xlsx`, 'teacher-report.xlsx').catch((e) => toast(e.message, 'error'))} style={ghostDark}>Export report</button>
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 14 }}>
            {d.kpis.map((k) => (
              <div key={k.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 18, borderRadius: 18, background: k.bad ? C.warn.bg : C.white, border: `1px solid ${k.bad ? C.warn.line : C.border}` }}>
                <span style={{ fontSize: 13, color: k.bad ? C.warn.fg : C.muted }}>{k.label}</span>
                <span style={{ fontFamily: display, fontSize: 28, fontWeight: 800, lineHeight: 1, color: k.bad ? C.warn.ink : C.ink }}>{k.v}</span>
                <span style={{ fontSize: 12, color: k.bad ? C.warn.fg : C.muted }}>{k.sub}</span>
              </div>
            ))}
          </section>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
            <section style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={panel}>
                <h2 style={h2}>Their groups &amp; student results</h2>
                <div style={{ overflowX: 'auto' }}>
                  <div role="table" aria-label="Groups" style={{ minWidth: 560, display: 'flex', flexDirection: 'column' }}>
                    <div role="row" style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.8fr 1fr 1fr 0.9fr', gap: 12, padding: '8px 4px', fontSize: 12, fontWeight: 600, color: C.muted }}>
                      {['Group', 'Students', 'Avg homework', 'On time', 'Need help'].map((h) => <span key={h} role="columnheader">{h}</span>)}
                    </div>
                    {d.groups.map((g) => (
                      <div key={g.id} role="row" style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.8fr 1fr 1fr 0.9fr', gap: 12, alignItems: 'center', padding: '12px 4px', borderTop: '1px solid #EEEFF5', fontSize: 14 }}>
                        <span role="cell" style={{ fontWeight: 500 }}>{g.name}</span>
                        <span role="cell">{g.n}</span>
                        <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ flex: 1, maxWidth: 70, height: 6, borderRadius: 3, background: C.chip, overflow: 'hidden' }}>
                            <span style={{ display: 'block', height: '100%', width: `${g.w}%`, background: d.color }} />
                          </span>
                          {g.avg_label}
                        </span>
                        <span role="cell" style={{ color: g.on !== null && g.on < 85 ? C.warn.ink : C.ink }}>{g.on === null ? '—' : `${g.on}%`}</span>
                        <span role="cell">
                          <span style={{ padding: '3px 9px', borderRadius: 999, background: g.risk ? C.warn.bg : C.ok.bg, color: g.risk ? C.warn.fg : C.ok.fg, fontSize: 12, fontWeight: 600 }}>
                            {g.risk ? `${g.risk} student${g.risk > 1 ? 's' : ''}` : 'None'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={panel}>
                <h2 style={h2}>Activity on the platform</h2>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
                  {d.log.map((l, i) => (
                    <li key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12, padding: '10px 0', borderTop: '1px solid #EEEFF5', fontSize: 14 }}>
                      <span style={{ color: C.muted, fontSize: 13 }}>{l.when}</span>
                      <span style={{ color: l.warn ? C.warn.ink : C.ink }}>{l.text}</span>
                    </li>
                  ))}
                  {d.log.length === 0 && <li style={{ fontSize: 14, color: C.muted }}>No activity yet.</li>}
                </ol>
              </div>
            </section>

            <aside style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={panel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h2 style={h2}>This week</h2>
                  <Link to="/admin/schedule" style={{ fontSize: 13, fontWeight: 500 }}>Open schedule</Link>
                </div>
                <span style={{ fontSize: 14, color: C.ink2 }}>{d.week_text}</span>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${d.week.length}, minmax(0, 1fr))`, gap: 10, alignItems: 'end', height: 120 }}>
                  {d.week.map((w) => (
                    <div key={w.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{w.n}</span>
                      <div style={{ width: '100%', maxWidth: 40, height: `${w.h}%`, minHeight: 4, borderRadius: '8px 8px 4px 4px', background: w.n ? d.color : C.border }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${d.week.length}, minmax(0, 1fr))`, gap: 10, textAlign: 'center', fontSize: 12, color: C.ink2 }}>
                  {d.week.map((w) => <span key={w.day}>{w.day}</span>)}
                </div>
              </div>
              <div style={panel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h2 style={h2}>Student survey</h2>
                  <span style={{ fontSize: 12, color: C.muted }}>End of last module</span>
                </div>
                {d.survey.map((s) => (
                  <div key={s.q} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 34px', gap: 10, alignItems: 'center', fontSize: 14 }}>
                    <span>{s.q}</span>
                    <span style={{ height: 8, borderRadius: 4, background: C.chip, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${s.w}%`, borderRadius: 4, background: d.color }} />
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{s.v}</span>
                  </div>
                ))}
                {d.survey.length === 0 && <span style={{ fontSize: 14, color: C.muted }}>No survey results yet.</span>}
              </div>
              <div style={{ borderRadius: 24, background: d.bad ? C.warn.bg : C.ok.bg, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: d.bad ? C.warn.fg : C.ok.fg }}>{d.flag_title}</span>
                {d.flags.map((f) => <span key={f} style={{ fontSize: 14, lineHeight: 1.5, color: d.bad ? C.warn.fg : C.ok.fg }}>{f}</span>)}
              </div>
            </aside>
          </div>

          {msg !== null && (
            <Modal title={`Message ${d.formal}`} onClose={() => setMsg(null)}>
              <span style={{ fontSize: 14, color: C.muted }}>It appears in their notifications.</span>
              <textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write your message…" style={{ ...field, minHeight: 120 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setMsg(null)} style={btn.ghost}>Cancel</button>
                <button disabled={!msg.trim() || message.isPending} onClick={() => message.mutate({ text: msg }, { onSuccess: () => setMsg(null) })} style={btn.primary}>Send</button>
              </div>
            </Modal>
          )}
          {visit && (
            <Modal title="Plan a class visit" onClose={() => setVisit(null)}>
              {d.upcoming.length === 0 ? (
                <span style={{ fontSize: 14, color: C.muted }}>{d.name} has no sessions in the next two weeks.</span>
              ) : (
                <>
                  <label style={label}>
                    Session
                    <select value={visit.lesson ?? ''} onChange={(e) => setVisit({ ...visit, lesson: Number(e.target.value) })} style={field}>
                      {d.upcoming.map((u) => <option key={u.lesson_id} value={u.lesson_id}>{u.label}</option>)}
                    </select>
                  </label>
                  <label style={label}>
                    Note for the teacher (optional)
                    <textarea rows={3} value={visit.note} onChange={(e) => setVisit({ ...visit, note: e.target.value })} style={{ ...field, minHeight: 80 }} />
                  </label>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setVisit(null)} style={btn.ghost}>Cancel</button>
                <button disabled={!visit.lesson || plan.isPending} onClick={() => visit.lesson && plan.mutate({ lesson_id: visit.lesson, note: visit.note }, { onSuccess: () => setVisit(null) })} style={btn.primary}>
                  Plan visit
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </Async>
  );
}

const ghostDark = { minHeight: 44, padding: '0 16px', borderRadius: 12, border: '1.5px solid #5C58A3', background: 'transparent', color: '#FFFFFF', fontSize: 14, cursor: 'pointer' } as const;
