import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { Async, C, Loading, Modal, btn, display, field, useToast } from '../../components/ui';
import { download } from '../../lib/api';
import { useAction, useGet } from '../../lib/hooks';

type ListData = { total: number; list: { id: number; name: string; ini: string; avatar: string; sub: string; att: number | null; flagged: boolean }[] };
type Profile = {
  id: number; name: string; ini: string; headline: string; parent: string; parent_email: string | null; since: string;
  kpis: { label: string; v: string; sub: string; bad: boolean }[];
  heat: { label: string; week: number; cells: string[] }[]; heat_label: string;
  tracks: { name: string; pct: number; note: string; color: string }[];
  spec_title: string; spec_text: string; flags: string[];
  notes: { who: string; text: string; when: string }[];
  activity: { when: string; text: string }[];
};

const FILTERS = [['all', 'All'], ['gen', 'Grades 7–9'], ['spec', 'Grades 10–12'], ['flag', 'Need attention']] as const;
const CELL: Record<string, { bg: string; fg: string; l: string; t: string }> = {
  P: { bg: '#0B7D60', fg: '#FFFFFF', l: '', t: 'Present' },
  L: { bg: '#FFC34D', fg: '#4A3000', l: 'L', t: 'Late' },
  A: { bg: '#C42B3B', fg: '#FFFFFF', l: 'A', t: 'Absent' },
};
const h2 = { margin: 0, fontFamily: display, fontSize: 18, fontWeight: 700 } as const;
const panel = { borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column' as const, gap: 14 };

export default function Students() {
  const toast = useToast();
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const list = useGet<ListData>(`/admin/students?filter=${filter}`);
  const visible = (list.data?.list ?? []).filter((s) => {
    const q = query.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.sub.toLowerCase().includes(q);
  });
  const current = sel ?? visible[0]?.id ?? null;

  const exportAll = () => download('/admin/students/export.xlsx', 'ithraa-students.xlsx').catch((e) => toast(e.message, 'error'));

  return (
    <Shell role="admin" active="students" mainStyle={{ gap: 22 }}>
      <header className="no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Students</h1>
          <span style={{ fontSize: 15, color: '#4A4D68' }}>{list.data?.total ?? '…'} students · attendance, work, scores and teacher notes in one place</span>
        </div>
        <button onClick={exportAll} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>
          Export all students to Excel
        </button>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <section className="no-print" aria-label="Student list" style={{ flex: '1 1 320px', minWidth: 0, borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label htmlFor="findStudent" style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>Find a student</label>
          <input id="findStudent" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or class, e.g. 9-B" style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${C.border2}`, fontSize: 14, color: C.ink, background: C.white }} />
          <div role="tablist" aria-label="Filter" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {FILTERS.map(([id, text]) => {
              const on = filter === id;
              return (
                <button key={id} role="tab" aria-selected={on} onClick={() => { setFilter(id); setSel(null); }} style={{ minHeight: 34, padding: '0 10px', borderRadius: 9, border: `1.5px solid ${on ? C.navy : C.border2}`, background: on ? C.navy : C.white, color: on ? '#FFFFFF' : C.ink, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  {text}
                </button>
              );
            })}
          </div>
          {list.isLoading ? <Loading /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 640, overflowY: 'auto' }}>
              {visible.map((s) => {
                const on = s.id === current;
                return (
                  <button key={s.id} onClick={() => setSel(s.id)} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '8px 10px', borderRadius: 12, border: 0, background: on ? C.indigoTint : 'transparent', color: C.ink, textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: s.avatar, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>{s.ini}</span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>{s.sub}</span>
                    </span>
                    {s.flagged && <span style={{ padding: '3px 8px', borderRadius: 999, background: C.warn.bg, color: C.warn.ink, fontSize: 11, fontWeight: 600 }}>Check in</span>}
                    <span style={{ fontSize: 13, fontWeight: 600, color: s.att !== null && s.att < 85 ? C.warn.ink : C.ink }}>{s.att === null ? '—' : `${s.att}%`}</span>
                  </button>
                );
              })}
              {visible.length === 0 && <span style={{ padding: 10, fontSize: 14, color: C.muted }}>No students match.</span>}
            </div>
          )}
          <span style={{ fontSize: 12, color: C.muted }}>Showing {visible.length} of {list.data?.total ?? 0}{visible.length > 10 ? ' · scroll for more' : ''}</span>
        </section>
        <div style={{ flex: '999 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {current ? <StudentProfile id={current} /> : !list.isLoading && <span style={{ color: C.muted }}>Pick a student to see their profile.</span>}
        </div>
      </div>
    </Shell>
  );
}

function StudentProfile({ id }: { id: number }) {
  const q = useGet<Profile>(`/admin/students/${id}`);
  const [msg, setMsg] = useState<string | null>(null);
  const send = useAction<{ text: string }>(`/admin/students/${id}/message`, { invalidate: ['admin', 'students'], success: (r) => `Message sent to ${r.parent}` });
  return (
    <Async q={q}>
      {(p) => (
        <>
          <section style={{ borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: C.lime, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: display, fontSize: 24, fontWeight: 800 }}>{p.ini}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontFamily: display, fontSize: 26, fontWeight: 700 }}>{p.name}</span>
                <span style={{ fontSize: 14, color: C.lilac }}>{p.headline}</span>
                <span style={{ fontSize: 13, color: C.lilac2 }}>Parent: {p.parent} · in Ithraa since {p.since}</span>
              </div>
            </div>
            <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button onClick={() => setMsg('')} style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: 0, background: C.lime, color: C.navy, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Message parent</button>
              <button onClick={() => window.print()} style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: '1.5px solid #5C58A3', background: 'transparent', color: '#FFFFFF', fontSize: 14, cursor: 'pointer' }}>Export profile (PDF)</button>
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 14 }}>
            {p.kpis.map((k) => (
              <div key={k.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 18, borderRadius: 18, background: k.bad ? C.warn.bg : C.white, border: `1px solid ${k.bad ? C.warn.line : C.border}` }}>
                <span style={{ fontSize: 13, color: k.bad ? C.warn.fg : C.muted }}>{k.label}</span>
                <span style={{ fontFamily: display, fontSize: 28, fontWeight: 800, lineHeight: 1, color: k.bad ? C.warn.ink : C.ink }}>{k.v}</span>
                <span style={{ fontSize: 12, color: k.bad ? C.warn.fg : C.muted }}>{k.sub}</span>
              </div>
            ))}
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 20 }}>
            <div style={panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <h2 style={h2}>Attendance by session</h2>
                <span style={{ fontSize: 12, color: C.muted }}>{p.heat_label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {p.heat.map((w) => (
                  <div key={w.week} style={{ display: 'grid', gridTemplateColumns: `64px repeat(${Math.max(1, ...p.heat.map((x) => x.cells.length))}, minmax(0, 1fr))`, gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{w.label}</span>
                    {w.cells.map((c, k) => {
                      const L = CELL[c] ?? CELL.P;
                      return (
                        <span key={k} title={`${w.label}, session ${k + 1}: ${L.t}`} style={{ height: 26, borderRadius: 7, background: L.bg, color: L.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
                          {L.l}
                        </span>
                      );
                    })}
                  </div>
                ))}
                {p.heat.length === 0 && <span style={{ fontSize: 14, color: C.muted }}>No attendance recorded yet.</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: C.ink2 }}>
                {Object.values(CELL).map((L) => (
                  <span key={L.t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: L.bg }} />
                    {L.t}
                  </span>
                ))}
              </div>
            </div>
            <div style={panel}>
              <h2 style={h2}>Progress</h2>
              {p.tracks.map((t) => (
                <div key={t.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                    <span style={{ fontWeight: 500 }}>{t.name}</span>
                    <span style={{ color: C.ink2 }}>{t.note}</span>
                  </div>
                  <span style={{ display: 'block', height: 8, borderRadius: 4, background: C.chip, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${t.pct}%`, borderRadius: 4, background: t.color }} />
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 4, padding: 14, borderRadius: 14, background: C.indigoTint, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#3A2BD0' }}>{p.spec_title}</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: C.ink }}>{p.spec_text}</span>
              </div>
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 20 }}>
            <div style={{ ...panel, gap: 12 }}>
              <h2 style={h2}>Flags &amp; teacher notes</h2>
              {p.flags.map((fl) => (
                <div key={fl} style={{ padding: '12px 14px', borderRadius: 12, background: C.warn.bg, color: C.warn.fg, fontSize: 14, lineHeight: 1.45 }}>{fl}</div>
              ))}
              {p.flags.length === 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: C.ok.bg, color: C.ok.fg, fontSize: 14 }}>No automatic flags. On track.</div>
              )}
              {p.notes.map((n, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px', borderRadius: 12, background: '#F7F7FC' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{n.who} · {n.when}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}>{n.text}</span>
                </div>
              ))}
            </div>
            <div style={{ ...panel, gap: 12 }}>
              <h2 style={h2}>Recent activity</h2>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
                {p.activity.map((a, i) => (
                  <li key={i} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 12, padding: '10px 0', borderTop: '1px solid #EEEFF5', fontSize: 14 }}>
                    <span style={{ color: C.muted, fontSize: 13 }}>{a.when}</span>
                    <span>{a.text}</span>
                  </li>
                ))}
                {p.activity.length === 0 && <li style={{ fontSize: 14, color: C.muted }}>No activity yet.</li>}
              </ol>
            </div>
          </section>

          {msg !== null && (
            <Modal title={`Message ${p.parent}`} onClose={() => setMsg(null)}>
              <span style={{ fontSize: 14, color: C.muted }}>About {p.name}{p.parent_email ? ` · sent to ${p.parent_email}` : ''}</span>
              <textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write your message…" style={{ ...field, minHeight: 120 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setMsg(null)} style={btn.ghost}>Cancel</button>
                <button disabled={!msg.trim() || send.isPending} onClick={() => send.mutate({ text: msg }, { onSuccess: () => setMsg(null) })} style={btn.primary}>Send message</button>
              </div>
            </Modal>
          )}
        </>
      )}
    </Async>
  );
}
