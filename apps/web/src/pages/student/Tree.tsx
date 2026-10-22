import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, display } from '../../components/ui';
import { useGet } from '../../lib/hooks';

type State = 'done' | 'now' | 'next';
type Node = { id: string; title: string; sub: string; pct: number; state: State; color: string };
type Detail = {
  track: string; color: string; tint: string; ink: string; level_label: string; title: string; pct: number; sub: string;
  status_label: string; state: State; skills: { name: string; status: State }[]; work: { title: string; score: string } | null;
  majors: string[]; careers: string;
};
type TreeData = {
  skills_done: number; skills_total: number; levels_done: number; levels_total: number; specs: string[];
  rows: { grade: string; level: string; nodes: Node[]; links: { lit: boolean; color: string }[] }[];
  details: Record<string, Detail>; default: string; grade: number;
  tracks: { id: string; short: string; color: string }[];
};

const TRACK_ICON: Record<string, ReactNode> = {
  cyber: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />,
  ai: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M10 10h4v4h-4zM12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  design: <><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 6l3 3" /></>,
  coding: <path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14" />,
};
const lock = <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>;
const grid = { display: 'grid', gridTemplateColumns: '92px repeat(4, minmax(0, 1fr))', gap: 16 } as const;

export default function Tree() {
  const q = useGet<TreeData>('/student/tree');
  return (
    <Shell role="student" active="tree" mainStyle={{ gap: 24 }}>
      <Async q={q}>{(d) => <Body d={d} />}</Async>
    </Shell>
  );
}

function Stat({ n, of, label }: { n: number; of: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 18px', borderRadius: 16, background: '#FFFFFF', border: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: display, fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
        {n}
        <span style={{ fontSize: 16, color: C.muted, fontWeight: 600 }}> / {of}</span>
      </span>
      <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
    </div>
  );
}

function Body({ d }: { d: TreeData }) {
  const [picked, setPicked] = useState(d.default);
  const sel = d.details[picked] ?? d.details[d.default];
  const skillLook = {
    done: { dot: '#0B7D60', label: 'Mastered', fg: '#0A6B52' },
    now: { dot: sel.color, label: 'In progress', fg: sel.ink },
    next: { dot: '#A3A6BD', label: 'Coming up', fg: C.muted },
  };
  const h3 = { margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted } as const;

  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 640 }}>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Knowledge tree</h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: '#4A4D68' }}>
            Every skill you earn from Grade 7 to Grade 12. Select a level to see its skills, your work, and the university majors it leads to.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Stat n={d.skills_done} of={d.skills_total} label="skills mastered" />
          <Stat n={d.levels_done} of={d.levels_total} label="levels complete" />
        </div>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <section aria-label="Skill tree" style={{ flex: '999 1 640px', minWidth: 0, borderRadius: 28, backgroundColor: C.navy, backgroundImage: 'radial-gradient(#2C2866 1.2px, transparent 1.2px)', backgroundSize: '22px 22px', color: '#FFFFFF', padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, color: C.lilac }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: C.lime }} />Mastered</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: '50%', border: `3px solid ${C.lime}` }} />In progress</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px dashed #8F8BC4' }} />Coming up</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 760, display: 'flex', flexDirection: 'column' }}>
              <div style={{ ...grid, gridTemplateColumns: '92px minmax(0, 1fr)', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.lime }}>Grades 10–12</span>
                  <span style={{ fontSize: 12, color: C.lilac2 }}>Specialization</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14, borderRadius: 18, border: '1.5px dashed #4E4A92', background: '#1C1847' }}>
                  {d.specs.map((s) => (
                    <div key={s} style={{ flex: '1 1 120px', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: C.navy2, color: '#DAD8F2', fontSize: 13, fontWeight: 500 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8F8BC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{lock}</svg>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ...grid, height: 36 }}>
                <div />
                {d.tracks.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 0, height: '100%', borderLeft: '2px dashed #4E4A92' }} />
                  </div>
                ))}
              </div>
              {d.rows.map((r) => (
                <div key={r.level} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ ...grid, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>{r.grade}</span>
                      <span style={{ fontSize: 12, color: C.lilac2 }}>{r.level}</span>
                    </div>
                    {r.nodes.map((n) => {
                      const on = n.id === picked;
                      const glow = `${n.color}40`;
                      return (
                        <button key={n.id} onClick={() => setPicked(n.id)} aria-pressed={on} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '14px 8px', borderRadius: 20, background: on ? '#262163' : 'transparent', border: `2px solid ${on ? C.lime : 'transparent'}`, color: '#FFFFFF', cursor: 'pointer' }}>
                          {n.state === 'done' && (
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: n.color, boxShadow: `0 0 0 6px ${glow}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg>
                            </div>
                          )}
                          {n.state === 'now' && (
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: `conic-gradient(${n.color} ${n.pct}%, #2F2A6B 0)`, boxShadow: `0 0 0 6px ${glow}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: 50, height: 50, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{n.pct}%</div>
                            </div>
                          )}
                          {n.state === 'next' && (
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.navy2, border: '2px dashed #5C58A3', color: '#8F8BC4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{lock}</svg>
                            </div>
                          )}
                          <span style={{ fontSize: 14, fontWeight: 600, textAlign: 'center', lineHeight: 1.25 }}>{n.title}</span>
                          <span style={{ fontSize: 12, color: n.state === 'next' ? C.lilac2 : n.state === 'now' ? C.lime : C.lilac }}>{n.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                  {r.links.length > 0 && (
                    <div style={{ ...grid, height: 30 }}>
                      <div />
                      {r.links.map((l, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                          <div style={{ width: 0, height: '100%', borderLeft: `3px ${l.lit ? 'solid' : 'dashed'} ${l.lit ? l.color : '#4E4A92'}` }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ ...grid, height: 30 }}>
                <div />
                {d.tracks.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 0, height: '100%', borderLeft: `3px solid ${t.color}` }} />
                  </div>
                ))}
              </div>
              <div style={{ ...grid, alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>Tracks</span>
                  <span style={{ fontSize: 12, color: C.lilac2 }}>Grades 7–9</span>
                </div>
                {d.tracks.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 14, background: t.color, fontSize: 14, fontWeight: 600 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TRACK_ICON[t.id]}</svg>
                    {t.short}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside aria-label="Selected level" style={{ flex: '1 1 340px', minWidth: 0, borderRadius: 28, background: '#FFFFFF', border: `1px solid ${C.border}`, padding: 26, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ padding: '5px 10px', borderRadius: 999, background: sel.tint, color: sel.ink, fontSize: 13, fontWeight: 600 }}>{sel.track}</span>
              <span style={{ padding: '5px 10px', borderRadius: 999, background: C.chip, color: C.ink2, fontSize: 13 }}>{sel.level_label}</span>
            </div>
            <h2 style={{ margin: 0, fontFamily: display, fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{sel.title}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{sel.status_label}</span>
                <span style={{ color: C.muted }}>{sel.pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: '#E9EAF3', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${sel.pct}%`, background: sel.color, borderRadius: 4 }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={h3}>Skills</h3>
            {sel.skills.map((sk) => {
              const look = skillLook[sk.status];
              return (
                <div key={sk.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 14, background: '#F7F7FC' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: look.dot }} />
                    {sk.name}
                  </span>
                  <span style={{ fontSize: 13, color: look.fg, fontWeight: 500 }}>{look.label}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={h3}>Your work</h3>
            {sel.work ? (
              <Link to="/student/portfolio" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: `1px solid ${C.border}`, color: C.ink, textDecoration: 'none' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.indigo} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
                <span style={{ flex: 1, fontSize: 14 }}>{sel.work.title}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0A6B52' }}>{sel.work.score}</span>
              </Link>
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: C.muted }}>Nothing yet. {sel.sub}.</p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 18, borderRadius: 18, background: C.navy, color: '#FFFFFF' }}>
            <h3 style={{ ...h3, color: C.lime }}>Leads to these majors</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sel.majors.map((mj) => (
                <span key={mj} style={{ padding: '7px 12px', borderRadius: 10, background: C.navy3, fontSize: 13 }}>{mj}</span>
              ))}
            </div>
            <h3 style={{ ...h3, margin: '8px 0 0', color: C.lime }}>Careers</h3>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: '#DAD8F2' }}>{sel.careers}</span>
          </div>
        </aside>
      </div>
    </>
  );
}
