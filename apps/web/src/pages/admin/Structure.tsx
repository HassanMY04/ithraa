import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, Modal, btn, display, field, label } from '../../components/ui';
import { useAction, useGet } from '../../lib/hooks';

type StructureData = {
  general: { name: string; teacher: string; color: string; tint: string; ink: string; cells: { level: string; n: number }[] }[];
  spec: { id: string; name: string; teacher: string; color: string; cells: number[] }[];
  totals: number[];
  teachers: { id: number; name: string; ini: string; color: string; teaches: string; groups: number; slides: string; slides_bad: boolean; grading: string; grading_bad: boolean; status: string; ok: boolean }[];
  days: { day: string; who: string; detail: string; spec?: boolean; friday?: boolean }[];
  timing: string;
  teacher_options: { id: number; name: string }[];
};

const GRID = '1.3fr repeat(3, minmax(0, 1fr))';
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu']] as const;
const SWATCHES = ['#4E3CF5', '#1F6FEB', '#7B3FF2', '#0B7D60', '#D2461F', '#B26B00', '#C42B3B'];

export default function Structure() {
  const q = useGet<StructureData>('/admin/structure');
  const [track, setTrack] = useState<{ name: string; short: string; pitch: string; color: string; teacher_id: number | null } | null>(null);
  const [invite, setInvite] = useState<{ first_name: string; last_name: string; title: string; email: string; teaches: string; available_days: string[] } | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const addTrack = useAction<object>('/admin/spec-tracks', { invalidate: ['admin'], success: 'Track added' });
  const sendInvite = useAction<object>('/admin/teachers/invite', { invalidate: ['admin'] });

  return (
    <Shell role="admin" active="structure" mainStyle={{ gap: 22 }}>
      <Async q={q}>
        {(d) => {
          const maxSpec = Math.max(1, ...d.spec.flatMap((s) => s.cells));
          return (
            <>
              <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Program structure</h1>
                  <span style={{ fontSize: 15, color: '#4A4D68' }}>The six-year structure, who teaches what, and when each group meets</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button onClick={() => setTrack({ name: '', short: '', pitch: '', color: SWATCHES[0], teacher_id: d.teacher_options[0]?.id ?? null })} style={{ minHeight: 46, padding: '0 16px', borderRadius: 14, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>
                    Add a track
                  </button>
                  <button onClick={() => setInvite({ first_name: '', last_name: '', title: 'Ms.', email: '', teaches: '', available_days: [] })} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: 0, background: C.indigo, color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Invite a teacher
                  </button>
                </div>
              </header>

              <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
                <div style={{ flex: '1 1 520px', minWidth: 0, borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.indigo }}>Grades 7–9</span>
                    <h2 style={{ margin: 0, fontFamily: display, fontSize: 22, fontWeight: 700 }}>General Awareness</h2>
                    <span style={{ fontSize: 13, color: C.muted }}>Every student takes every track, one level per year. Cells show this week’s sessions from the weekly schedule.</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 480, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, fontSize: 12, fontWeight: 600, color: C.muted }}>
                        <span>Track · teacher</span><span>Grade 7</span><span>Grade 8</span><span>Grade 9</span>
                      </div>
                      {d.general.map((g) => (
                        <div key={g.name} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'stretch' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '10px 0' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 3, background: g.color }} />
                              {g.name}
                            </span>
                            <span style={{ fontSize: 12, color: C.muted }}>{g.teacher}</span>
                          </div>
                          {g.cells.map((c) => {
                            const bg = c.n > 1 ? g.color : c.n ? g.tint : '#F7F7FC';
                            const fg = c.n > 1 ? '#FFFFFF' : c.n ? g.ink : C.muted;
                            const border = c.n > 1 ? g.color : c.n ? g.tint : C.border;
                            return (
                              <div key={c.level} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 12px', borderRadius: 12, background: bg, color: fg, border: `1.5px solid ${border}` }}>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.level}</span>
                                <span style={{ fontSize: 12, opacity: 0.9 }}>{c.n ? `${c.n} session${c.n > 1 ? 's' : ''} this week` : 'Not this week'}</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Link to="/admin/schedule" style={{ fontSize: 13, fontWeight: 500 }}>Change this week’s mix in the weekly schedule</Link>
                </div>

                <div style={{ flex: '1 1 520px', minWidth: 0, borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lime }}>Grades 10–12</span>
                    <h2 style={{ margin: 0, fontFamily: display, fontSize: 22, fontWeight: 700 }}>Specialization</h2>
                    <span style={{ fontSize: 13, color: C.lilac }}>One track for three years, ending with a capstone project. Numbers are students per grade.</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 480, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, fontSize: 12, fontWeight: 600, color: C.lilac2 }}>
                        <span>Track · teacher</span><span>G10 · Foundations</span><span>G11 · Applied</span><span>G12 · Capstone</span>
                      </div>
                      {d.spec.map((s) => (
                        <div key={s.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'stretch' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '8px 0' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                              {s.name}
                            </span>
                            <span style={{ fontSize: 12, color: C.lilac2 }}>{s.teacher}</span>
                          </div>
                          {s.cells.map((n, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '10px 12px', borderRadius: 12, background: C.navy2 }}>
                              <span style={{ fontFamily: display, fontSize: 20, fontWeight: 700 }}>{n}</span>
                              <span style={{ flex: 1, maxWidth: 60, height: 6, borderRadius: 3, background: C.navyLine, overflow: 'hidden' }}>
                                <span style={{ display: 'block', height: '100%', width: `${Math.round((n / maxSpec) * 100)}%`, background: s.color }} />
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, paddingTop: 8, borderTop: `1px solid ${C.navy3}`, fontSize: 13, color: C.lilac }}>
                        <span>Total</span>
                        {d.totals.map((t, i) => <span key={i}>{t}</span>)}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ margin: 0, fontFamily: display, fontSize: 20, fontWeight: 700 }}>Teachers</h2>
                  <Link to="/admin/teachers" style={{ fontSize: 13, fontWeight: 500 }}>Full teacher profiles</Link>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <div role="table" aria-label="Teachers" style={{ minWidth: 760, display: 'flex', flexDirection: 'column' }}>
                    <div role="row" style={{ display: 'grid', gridTemplateColumns: '1.3fr 2fr 0.9fr 1fr 1.1fr 1fr', gap: 12, padding: '8px 6px', fontSize: 12, fontWeight: 600, color: C.muted }}>
                      {['Teacher', 'Teaches', 'Groups now', 'Slides on time', 'Grading time', 'Status'].map((h) => <span key={h} role="columnheader">{h}</span>)}
                    </div>
                    {d.teachers.map((t) => (
                      <div key={t.id} role="row" style={{ display: 'grid', gridTemplateColumns: '1.3fr 2fr 0.9fr 1fr 1.1fr 1fr', gap: 12, alignItems: 'center', padding: '12px 6px', borderTop: '1px solid #EEEFF5', fontSize: 14 }}>
                        <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', background: t.color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{t.ini}</span>
                          <span style={{ fontWeight: 500 }}>{t.name}</span>
                        </span>
                        <span role="cell" style={{ color: C.ink2 }}>{t.teaches}</span>
                        <span role="cell">{t.groups}</span>
                        <span role="cell" style={{ fontWeight: 600, color: t.slides_bad ? C.warn.ink : C.ok.ink }}>{t.slides}</span>
                        <span role="cell" style={{ color: t.grading_bad ? C.warn.ink : C.ink }}>{t.grading}</span>
                        <span role="cell">
                          <span style={{ padding: '4px 10px', borderRadius: 999, background: t.ok ? C.ok.bg : C.warn.bg, color: t.ok ? C.ok.fg : C.warn.fg, fontSize: 12, fontWeight: 600 }}>{t.status}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ margin: 0, fontFamily: display, fontSize: 20, fontWeight: 700 }}>Weekly timetable</h2>
                  <Link to="/admin/schedule" style={{ fontSize: 13, fontWeight: 500 }}>{d.timing} · edit in Weekly schedule</Link>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 12 }}>
                  {d.days.map((x) => (
                    <div key={x.day} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderRadius: 18, background: x.spec ? C.indigoTint : x.friday ? C.white : '#F7F7FC', border: `1px solid ${x.spec ? '#D9D4FF' : x.friday ? C.border : '#F7F7FC'}` }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{x.day}</span>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>{x.who}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: C.ink2 }}>{x.detail}</span>
                    </div>
                  ))}
                </div>
              </section>

              {track && (
                <Modal title="Add a specialization track" onClose={() => setTrack(null)}>
                  <label style={label}>Track name<input value={track.name} onChange={(e) => setTrack({ ...track, name: e.target.value })} placeholder="e.g. Game Design" style={field} /></label>
                  <label style={label}>Short name (optional)<input value={track.short} onChange={(e) => setTrack({ ...track, short: e.target.value })} placeholder="Shown in tight spaces" style={field} /></label>
                  <label style={label}>One-line pitch for students<textarea rows={3} value={track.pitch} onChange={(e) => setTrack({ ...track, pitch: e.target.value })} style={{ ...field, minHeight: 80 }} /></label>
                  <label style={label}>
                    Track teacher
                    <select value={track.teacher_id ?? ''} onChange={(e) => setTrack({ ...track, teacher_id: Number(e.target.value) })} style={field}>
                      {d.teacher_options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                  <div style={label}>
                    Color
                    <div role="radiogroup" aria-label="Track color" style={{ display: 'flex', gap: 8 }}>
                      {SWATCHES.map((c) => (
                        <button key={c} role="radio" aria-checked={track.color === c} aria-label={c} onClick={() => setTrack({ ...track, color: c })} style={{ width: 32, height: 32, borderRadius: 9, background: c, border: track.color === c ? `3px solid ${C.ink}` : '3px solid transparent', cursor: 'pointer' }} />
                      ))}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: C.muted }}>New tracks start with 0 students. Grade 9 students see it in their specialization matches once inputs are added.</span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => setTrack(null)} style={btn.ghost}>Cancel</button>
                    <button disabled={track.name.trim().length < 2 || !track.teacher_id || addTrack.isPending} onClick={() => addTrack.mutate(track, { onSuccess: () => setTrack(null) })} style={btn.primary}>Add track</button>
                  </div>
                </Modal>
              )}

              {invite && (
                <Modal title="Invite a teacher" onClose={() => setInvite(null)}>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 10 }}>
                    <label style={label}>Title<select value={invite.title} onChange={(e) => setInvite({ ...invite, title: e.target.value })} style={field}><option>Ms.</option><option>Mr.</option><option>Dr.</option></select></label>
                    <label style={label}>First name<input value={invite.first_name} onChange={(e) => setInvite({ ...invite, first_name: e.target.value })} style={field} /></label>
                    <label style={label}>Last name<input value={invite.last_name} onChange={(e) => setInvite({ ...invite, last_name: e.target.value })} style={field} /></label>
                  </div>
                  <label style={label}>School email<input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} style={field} /></label>
                  <label style={label}>Teaches<input value={invite.teaches} onChange={(e) => setInvite({ ...invite, teaches: e.target.value })} placeholder="e.g. Media Literacy, Grades 7–9" style={field} /></label>
                  <div style={label}>
                    Available days
                    <div style={{ display: 'flex', gap: 8 }}>
                      {DAYS.map(([id, text]) => {
                        const on = invite.available_days.includes(id);
                        return (
                          <button key={id} aria-pressed={on} onClick={() => setInvite({ ...invite, available_days: on ? invite.available_days.filter((x) => x !== id) : [...invite.available_days, id] })} style={{ minHeight: 38, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${on ? C.navy : C.border2}`, background: on ? C.navy : C.white, color: on ? '#FFFFFF' : C.ink, cursor: 'pointer' }}>
                            {text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => setInvite(null)} style={btn.ghost}>Cancel</button>
                    <button
                      disabled={!invite.first_name.trim() || !invite.last_name.trim() || !invite.email.includes('@') || !invite.teaches.trim() || sendInvite.isPending}
                      onClick={() => sendInvite.mutate(invite, { onSuccess: (r) => { setInvite(null); setCreated({ email: r.email, password: r.password }); } })}
                      style={btn.primary}
                    >
                      Create account
                    </button>
                  </div>
                </Modal>
              )}

              {created && (
                <Modal title="Teacher account created" onClose={() => setCreated(null)} width={480}>
                  <span style={{ fontSize: 14, lineHeight: 1.5, color: C.ink2 }}>Share these sign-in details with the teacher. The temporary password is shown only once.</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 12, background: C.bg, fontSize: 15 }}>
                    <span>Email: <strong>{created.email}</strong></span>
                    <span>Temporary password: <strong style={{ fontFamily: 'monospace' }}>{created.password}</strong></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => navigator.clipboard?.writeText(`${created.email} / ${created.password}`)} style={btn.ghost}>Copy</button>
                    <button onClick={() => setCreated(null)} style={btn.primary}>Done</button>
                  </div>
                </Modal>
              )}
            </>
          );
        }}
      </Async>
    </Shell>
  );
}
