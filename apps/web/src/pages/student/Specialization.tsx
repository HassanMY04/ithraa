import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { Async, C, display } from '../../components/ui';
import { useAction, useGet } from '../../lib/hooks';

type Step = { n: string; title: string; meta: string; state: 'done' | 'now' | 'later' };
type Track = {
  id: string; name: string; color: string; tint: string; ink: string; score: number; pitch: string;
  parts: { label: string; v: number }[]; why: string[]; years: { g: string; t: string }[]; majors: string[];
  shortlisted: boolean; talk_requested: boolean;
};
type SpecData = { available: boolean; message?: string; steps?: Step[]; updated?: string; tracks?: Track[] };

const STEP_LOOK = {
  done: { bg: '#DCF4EA', border: '#DCF4EA', fg: '#0A4F3D', numBg: '#0B7D60', numFg: '#FFFFFF' },
  now: { bg: '#16133A', border: '#16133A', fg: '#FFFFFF', numBg: '#C8F25A', numFg: '#16133A' },
  later: { bg: '#FFFFFF', border: '#E3E5EF', fg: '#13122B', numBg: '#F1F2F8', numFg: '#3D405C' },
};
const h3 = { margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted } as const;

export default function Specialization() {
  const q = useGet<SpecData>('/student/specialization');
  return (
    <Shell role="student" active="spec" mainStyle={{ gap: 24 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 760 }}>
        <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Specialization match</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: '#4A4D68' }}>
          In Grade 10 you choose one track for your last three years. These matches use your results, your interests and your teachers’ notes. They’re guidance: the choice is yours.
        </p>
      </header>
      <Async q={q}>{(d) => <Body d={d} />}</Async>
    </Shell>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label="Steps to choosing" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 12 }}>
      {steps.map((s) => {
        const l = STEP_LOOK[s.state];
        return (
          <li key={s.n} style={{ display: 'flex', gap: 12, padding: 16, borderRadius: 18, background: l.bg, border: `1px solid ${l.border}`, color: l.fg }}>
            <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', background: l.numBg, color: l.numFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>{s.n}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{s.title}</span>
              <span style={{ fontSize: 13, opacity: 0.85 }}>{s.meta}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Body({ d }: { d: SpecData }) {
  const tracks = d.tracks ?? [];
  const [id, setId] = useState(tracks[0]?.id);
  const t = tracks.find((x) => x.id === id) ?? tracks[0];
  const inv = { invalidate: ['student'] };
  const shortlist = useAction(`/student/specialization/${t?.id}/shortlist`, {
    ...inv, success: (r: { shortlisted: boolean }) => (r.shortlisted ? `${t?.name} saved to your shortlist.` : `${t?.name} removed from your shortlist.`),
  });
  const talk = useAction(`/student/specialization/${t?.id}/talk`, {
    ...inv, success: 'Request sent. The program team will set up a chat with a Grade 11 student.',
  });

  if (!d.available || !t) {
    return (
      <>
        {d.steps && <Steps steps={d.steps} />}
        <section style={{ borderRadius: 24, background: '#FFFFFF', border: `1px solid ${C.border}`, padding: 26, fontSize: 16, lineHeight: 1.55, color: C.ink2 }}>{d.message}</section>
      </>
    );
  }

  return (
    <>
      <Steps steps={d.steps ?? []} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <section aria-label="Your matches" style={{ flex: '1 1 380px', minWidth: 0, borderRadius: 24, background: '#FFFFFF', border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 6px 8px' }}>
            <h2 style={{ margin: 0, fontFamily: display, fontSize: 20, fontWeight: 700 }}>Your matches</h2>
            <span style={{ fontSize: 13, color: C.muted }}>{d.updated}</span>
          </div>
          {tracks.map((x) => {
            const on = x.id === t.id;
            return (
              <button key={x.id} onClick={() => setId(x.id)} aria-pressed={on} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 18, border: `2px solid ${on ? x.color : '#E9EAF3'}`, background: on ? x.tint : '#FFFFFF', color: C.ink, textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 600 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: x.color }} />
                    {x.name}
                    {x.shortlisted && <span style={{ fontSize: 12, fontWeight: 600, color: x.ink }}>· Shortlisted</span>}
                  </span>
                  <span style={{ fontFamily: display, fontSize: 22, fontWeight: 800 }}>{x.score}%</span>
                </span>
                <span style={{ display: 'block', width: '100%', height: 8, borderRadius: 4, background: '#E9EAF3', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${x.score}%`, borderRadius: 4, background: x.color }} />
                </span>
              </button>
            );
          })}
          <p style={{ margin: '6px 6px 0', fontSize: 13, lineHeight: 1.5, color: C.muted }}>
            Match = 40% your results in related levels + 40% interest survey + 20% teacher recommendations.
          </p>
        </section>

        <section aria-label="Track details" style={{ flex: '999 1 520px', minWidth: 0, borderRadius: 24, background: '#FFFFFF', border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: C.navy, color: '#FFFFFF', padding: 28, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 20, position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden="true" style={{ position: 'absolute', right: -50, top: -50, width: 200, height: 200, borderRadius: '50%', border: `30px solid ${t.color}`, opacity: 0.55 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', maxWidth: 440 }}>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lime }}>Grades 10–12 track</span>
              <h2 style={{ margin: 0, fontFamily: display, fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>{t.name}</h2>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#DAD8F2' }}>{t.pitch}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
              <span style={{ fontFamily: display, fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{t.score}%</span>
              <span style={{ fontSize: 13, color: C.lilac }}>match</span>
            </div>
          </div>
          <div style={{ padding: '26px 28px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 14 }}>
              {t.parts.map((p) => (
                <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 14, background: '#F7F7FC' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.ink2 }}>
                    <span>{p.label}</span>
                    <span style={{ fontWeight: 700, color: C.ink }}>{p.v}</span>
                  </span>
                  <span style={{ display: 'block', height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${p.v}%`, borderRadius: 3, background: t.color }} />
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={h3}>Why it fits you</h3>
              {t.why.map((w) => (
                <div key={w} style={{ display: 'flex', gap: 10, fontSize: 15, lineHeight: 1.5 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B7D60" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}><path d="m5 12 4 4 10-10" /></svg>
                  <span>{w}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={h3}>Your three years</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 12 }}>
                {t.years.map((y) => (
                  <div key={y.g} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16, borderRadius: 16, border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.ink }}>{y.g}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{y.t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h3 style={h3}>University majors it prepares you for</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {t.majors.map((m) => (
                  <span key={m} style={{ padding: '8px 12px', borderRadius: 10, background: t.tint, color: t.ink, fontSize: 14, fontWeight: 500 }}>{m}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 4 }}>
              <button onClick={() => shortlist.mutate()} disabled={shortlist.isPending} aria-pressed={t.shortlisted} style={{ minHeight: 48, padding: '0 20px', borderRadius: 14, border: 0, background: t.shortlisted ? '#DCF4EA' : C.indigo, color: t.shortlisted ? '#0A4F3D' : '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                {t.shortlisted ? 'On your shortlist ✓' : 'Save to my shortlist'}
              </button>
              <button onClick={() => talk.mutate()} disabled={t.talk_requested || talk.isPending} style={{ minHeight: 48, padding: '0 20px', borderRadius: 14, border: `1px solid ${C.border2}`, background: '#FFFFFF', color: C.ink, fontSize: 15, cursor: t.talk_requested ? 'default' : 'pointer' }}>
                {t.talk_requested ? 'Chat requested ✓' : 'Talk to a Grade 11 student in this track'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
