import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, display } from '../../components/ui';
import { useAction, useGet } from '../../lib/hooks';
import { SelectionSteps } from './Selection';

type Cat = 'fit' | 'unclear' | 'other' | 'support';
type ListData = {
  cats: { id: 'all' | Cat; label: string; n: number; sub: string }[];
  list: { id: number; name: string; cls: string; cat: Cat; overall: number; decision: string | null }[];
  finished: number; unfinished: number;
};
type Detail = {
  id: number; name: string; cls: string; by: string; qs: number; mins: number; overall: number; conf: string;
  summary: string; cat: Cat; domain: string | null; suggest: string; decision: string | null;
  decisions: { id: string; label: string }[];
  dims: { v: number; med: number }[];
  interests: [string, number][]; why: string[]; advice: string; context: string[]; note: string;
  path: { type: string; label: string; res: string; tag: string; note: string; follow: boolean }[];
};

export const CAT: Record<Cat, { label: string; bg: string; fg: string; dot: string }> = {
  fit: { label: 'Strong fit', bg: '#DCF4EA', fg: '#0A4F3D', dot: '#0B7D60' },
  unclear: { label: 'Needs a closer look', bg: '#FFF1DE', fg: '#6B3700', dot: '#E0A100' },
  other: { label: 'Better fit elsewhere', bg: '#EDEBFF', fg: '#2A2660', dot: '#7B3FF2' },
  support: { label: 'Not ready yet', bg: '#FFE6E8', fg: '#8E1A27', dot: '#C42B3B' },
};
const DIMS: [string, string][] = [['Reasoning', '#4E3CF5'], ['Digital awareness', '#1F6FEB'], ['Creativity', '#D2461F'], ['Persistence', '#0B7D60'], ['Communication', '#7B3FF2']];
const IC: Record<string, string> = { Coding: '#0B7D60', AI: '#7B3FF2', Cyber: '#1F6FEB', Design: '#D2461F', 'Life sciences': '#2E8B3A', 'Arts & music': '#B26B00' };
const OUTSIDE = new Set(['Life sciences', 'Arts & music']);
const DEC_SHORT: Record<string, string> = { accept: 'Accepted', waitlist: 'Waitlist', interview: 'Interview', refer: 'Referred', notyet: 'Not this year' };
const RULES = [
  'Every question depends on the answers before it.',
  'Mix of multiple choice, true/false, open and short answers.',
  'A right answer on a guessable question gets a “why?” follow-up.',
  'A wrong answer gets a clarifying question to tell a misread from a real gap.',
  'Grades, teacher notes and earlier answers shape the questions.',
  'Arabic or English, 8–12 questions, no time limit.',
];
export function resLook(r: string) {
  if (r === 'right' || r === 'strong') return { bg: '#DCF4EA', fg: '#0A4F3D' };
  if (r === 'wrong') return { bg: '#FFE6E8', fg: '#8E1A27' };
  if (r === 'weak') return { bg: '#FFF1DE', fg: '#6B3700' };
  return { bg: '#EDEBFF', fg: '#3A2BD0' };
}
const h3 = { margin: 0, fontFamily: display, fontSize: 18, fontWeight: 700 } as const;
const panel = { borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column' as const, gap: 12 };

export default function Assessments() {
  const [filter, setFilter] = useState<'all' | Cat>('all');
  const [sel, setSel] = useState<number | null>(null);
  const q = useGet<ListData>(`/admin/assessments?filter=${filter}`);
  const remind = useAction<void>('/admin/assessments/remind', { invalidate: ['admin'], success: (r) => `Reminder sent to ${r.reminded} families` });
  const current = sel !== null && q.data?.list.some((x) => x.id === sel) ? sel : q.data?.list[0]?.id ?? null;

  return (
    <Shell role="admin" active="selection" mainStyle={{ gap: 22 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SelectionSteps step={2} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 720 }}>
            <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>AI assessments</h1>
            <span style={{ fontSize: 15, lineHeight: 1.5, color: '#4A4D68' }}>
              Each nominee takes an adaptive assessment. The AI sorts them into four groups and explains why, then you decide.
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link to="/admin/try-assessment" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 46, padding: '0 16px', borderRadius: 14, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, textDecoration: 'none', fontSize: 14 }}>
              Try the student experience
            </Link>
            <button onClick={() => remind.mutate()} disabled={!q.data?.unfinished || remind.isPending} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: 0, background: C.indigo, color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {q.data?.unfinished ? `Remind ${q.data.unfinished} who haven’t finished` : 'Everyone has finished'}
            </button>
          </div>
        </div>
      </header>
      <Async q={q}>
        {(d) => (
          <>
            <section role="tablist" aria-label="Filter by AI category" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 }}>
              {d.cats.map((c) => {
                const on = filter === c.id;
                const k = c.id === 'all' ? null : CAT[c.id];
                return (
                  <button key={c.id} role="tab" aria-selected={on} onClick={() => { setFilter(c.id); setSel(null); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 16, borderRadius: 18, border: `2px solid ${on ? (k ? k.dot : C.navy) : C.border}`, background: on ? (k ? k.bg : C.navy) : C.white, color: on ? (k ? k.fg : '#FFFFFF') : C.ink, textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: k ? k.dot : on ? C.lime : C.navy }} />
                      {c.label}
                    </span>
                    <span style={{ fontFamily: display, fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{c.n}</span>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>{c.sub}</span>
                  </button>
                );
              })}
            </section>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <section aria-label="Candidates" style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {d.list.map((s) => {
                    const on = s.id === current;
                    return (
                      <button key={s.id} onClick={() => setSel(s.id)} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '8px 10px', borderRadius: 12, border: 0, background: on ? C.indigoTint : 'transparent', color: C.ink, textAlign: 'left', cursor: 'pointer' }}>
                        <span style={{ width: 10, height: 10, flexShrink: 0, borderRadius: '50%', background: CAT[s.cat]?.dot }} />
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>{s.cls} · {CAT[s.cat]?.label}</span>
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{s.overall}</span>
                          <span style={{ fontSize: 11, color: s.decision ? C.ok.ink : C.muted }}>{s.decision ?? 'To decide'}</span>
                        </span>
                      </button>
                    );
                  })}
                  {d.list.length === 0 && <span style={{ padding: 10, fontSize: 14, color: C.muted }}>No finished assessments in this group.</span>}
                  <span style={{ padding: '8px 10px 2px', fontSize: 12, color: C.muted }}>Showing {d.list.length} of {d.finished} finished assessments</span>
                </section>
                <section style={{ borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h2 style={{ margin: 0, fontFamily: display, fontSize: 17, fontWeight: 700 }}>How the assessment adapts</h2>
                  {RULES.map((r) => (
                    <div key={r} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.5, color: '#E6E4F8' }}>
                      <span style={{ width: 6, height: 6, marginTop: 8, flexShrink: 0, borderRadius: '50%', background: C.lime }} />
                      <span>{r}</span>
                    </div>
                  ))}
                </section>
              </div>
              <div style={{ flex: '999 1 620px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {current && <Report id={current} />}
              </div>
            </div>
          </>
        )}
      </Async>
    </Shell>
  );
}

function Report({ id }: { id: number }) {
  const q = useGet<Detail>(`/admin/assessments/${id}`);
  const decide = useAction<{ decision: string }>(`/admin/assessments/${id}/decision`, { method: 'PUT', invalidate: ['admin'] });
  return (
    <Async q={q}>
      {(d) => {
        const k = CAT[d.cat];
        const chosen = d.decision;
        return (
          <>
            <section style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #EEEFF5' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span style={{ padding: '6px 12px', borderRadius: 999, background: k.bg, color: k.fg, fontSize: 13, fontWeight: 600 }}>{k.label}{d.domain ? ` · ${d.domain}` : ''}</span>
                    <span style={{ fontSize: 13, color: C.muted }}>AI confidence: {d.conf}</span>
                  </div>
                  <h2 style={{ margin: 0, fontFamily: display, fontSize: 30, fontWeight: 800, letterSpacing: '-0.01em' }}>{d.name}</h2>
                  <span style={{ fontSize: 14, color: C.ink2 }}>{d.cls} · nominated by {d.by} · {d.qs} questions in {d.mins} min</span>
                  <p style={{ margin: '4px 0 0', fontSize: 16, lineHeight: 1.55 }}>{d.summary}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <span style={{ fontFamily: display, fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{d.overall}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>assessment score</span>
                </div>
              </div>
              <div style={{ padding: '18px 24px', background: '#F7F7FC', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>Your decision</span>
                <div role="group" aria-label="Decision" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {d.decisions.map((x) => {
                    const on = chosen === x.id;
                    const ai = d.suggest === x.id;
                    return (
                      <button key={x.id} onClick={() => decide.mutate({ decision: x.id })} disabled={decide.isPending} aria-pressed={on} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 42, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${on ? C.navy : ai ? k.dot : C.border2}`, background: on ? C.navy : C.white, color: on ? '#FFFFFF' : C.ink, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                        {x.label}
                        {ai && <span style={{ padding: '2px 7px', borderRadius: 6, background: on ? C.lime : k.bg, color: on ? C.navy : k.fg, fontSize: 11, fontWeight: 700 }}>AI suggests</span>}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: 13, color: chosen ? C.ok.ink : C.muted }}>
                  {chosen
                    ? `Saved: ${DEC_SHORT[chosen]}. A letter to the family is drafted in Arabic and English for you to review.`
                    : 'No decision yet. The AI’s suggestion is outlined; you can choose anything.'}
                </span>
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 20 }}>
              <div style={panel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 style={h3}>Skills</h3>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted }}>
                    <span style={{ width: 2, height: 12, background: C.ink }} />group median
                  </span>
                </div>
                {d.dims.map((m, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 34px', gap: 10, alignItems: 'center', fontSize: 14 }}>
                    <span>{DIMS[i]?.[0]}</span>
                    <span style={{ position: 'relative', height: 10, borderRadius: 5, background: C.chip }}>
                      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${m.v}%`, borderRadius: 5, background: DIMS[i]?.[1] }} />
                      <span style={{ position: 'absolute', left: `${m.med}%`, top: -3, width: 2, height: 16, background: C.ink }} />
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{m.v}</span>
                  </div>
                ))}
              </div>
              <div style={panel}>
                <h3 style={h3}>Interest profile</h3>
                <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', gap: 2 }}>
                  {d.interests.map(([name, p]) => <span key={name} style={{ flex: `${p} 1 0`, background: IC[name] ?? C.faint }} />)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {d.interests.map(([name, p]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: IC[name] ?? C.faint }} />
                        {name}
                      </span>
                      <span style={{ color: C.ink2 }}>{p}%{OUTSIDE.has(name) ? ' · not offered' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section style={panel}>
              <h3 style={h3}>Why the AI says this</h3>
              {d.why.map((w) => (
                <div key={w} style={{ display: 'flex', gap: 10, fontSize: 15, lineHeight: 1.5 }}>
                  <span style={{ width: 8, height: 8, marginTop: 8, flexShrink: 0, borderRadius: '50%', background: k.dot }} />
                  <span>{w}</span>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, padding: '14px 16px', borderRadius: 14, background: k.bg, color: k.fg }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Suggested next step</span>
                <span style={{ fontSize: 15, lineHeight: 1.5 }}>{d.advice}</span>
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 20, alignItems: 'start' }}>
              <div style={{ ...panel, gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8 }}>
                  <h3 style={h3}>Question path</h3>
                  <span style={{ fontSize: 12, color: C.muted }}>Indented = follow-up</span>
                </div>
                {d.path.map((p, i) => {
                  const L = resLook(p.res);
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: `9px 0 9px ${p.follow ? 18 : 0}px`, borderTop: '1px solid #EEEFF5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 14 }}>
                          <span style={{ flexShrink: 0, minWidth: 44, padding: '2px 6px', borderRadius: 6, background: C.chip, color: C.ink2, fontSize: 11, fontWeight: 700, textAlign: 'center' }}>{p.type}</span>
                          <span>{p.label}</span>
                        </span>
                        <span style={{ flexShrink: 0, padding: '3px 8px', borderRadius: 999, background: L.bg, color: L.fg, fontSize: 11, fontWeight: 600 }}>{p.tag}</span>
                      </div>
                      <span style={{ fontSize: 12, color: C.muted, paddingLeft: 52 }}>→ {p.note}</span>
                    </div>
                  );
                })}
              </div>
              <div style={panel}>
                <h3 style={h3}>Context the AI used</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {d.context.map((c) => <span key={c} style={{ padding: '6px 10px', borderRadius: 8, background: C.chip, fontSize: 13 }}>{c}</span>)}
                </div>
                {d.note && <p style={{ margin: 0, padding: '12px 14px', borderRadius: 12, background: '#F7F7FC', fontSize: 14, lineHeight: 1.5 }}>{d.note}</p>}
                <span style={{ fontSize: 12, lineHeight: 1.5, color: C.muted }}>
                  The AI suggests; the school decides. Families see the decision and next steps, never the AI category or scores.
                </span>
              </div>
            </section>
          </>
        );
      }}
    </Async>
  );
}
