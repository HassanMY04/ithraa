import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, Loading, Modal, btn, display, field, label } from '../../components/ui';
import { useAction, useGet } from '../../lib/hooks';

type Row = {
  id: number; rank: number; name: string; cls: string; by: string; avg: number; interest: number;
  challenge: number | null; assessing: boolean; score: number; status: 'acc' | 'wait' | 'pend'; full: boolean;
};
type SelectionData = {
  label: string; seats: number; per_class: number; nominated: number; counts: Record<'acc' | 'wait' | 'pend', number>;
  rows: Row[]; quotas: { cls: string; n: number }[];
  weights: { assessment: number; interest: number; grades: number }; drafts: number; results_month: string;
};
type Letter = { id: number; name: string; cls: string; decision: string; en: string; ar: string };

export function SelectionSteps({ step }: { step: 1 | 2 }) {
  const tab = (n: 1 | 2, to: string, text: string) => (
    <Link to={to} aria-current={step === n ? 'page' : undefined} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 38, padding: '0 14px', borderRadius: 10, background: step === n ? C.white : 'transparent', color: step === n ? C.ink : C.ink2, textDecoration: 'none', fontSize: 14, fontWeight: step === n ? 600 : 400 }}>
      {text}
    </Link>
  );
  return (
    <nav aria-label="Selection steps" style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 14, background: '#E6E7F2', alignSelf: 'flex-start', marginBottom: 8 }}>
      {tab(1, '/admin/selection', '1 · Nominees')}
      {tab(2, '/admin/assessments', '2 · AI assessments')}
    </nav>
  );
}

const FILTERS = [['all', 'All'], ['pend', 'To review'], ['acc', 'Accepted'], ['wait', 'Waitlist']] as const;
const GRID = '36px 1.6fr 0.6fr 0.7fr 0.7fr 0.8fr 0.7fr 1.6fr';

export default function Selection() {
  const q = useGet<SelectionData>('/admin/selection');
  const [filter, setFilter] = useState<string>('all');
  const [weights, setWeights] = useState<SelectionData['weights'] | null>(null);
  const [lettersOpen, setLettersOpen] = useState(false);
  const inv = { invalidate: ['admin'] };
  const setStatus = useAction<{ id: number; status: string }>((v) => `/admin/nominees/${v.id}/status`, { method: 'PUT', ...inv });
  const ask = useAction<void>('/admin/selection/request-nominations', { success: (r) => r.message });
  const saveWeights = useAction<SelectionData['weights']>('/admin/selection/weights', { method: 'PUT', ...inv, success: 'Weights saved. Scores updated.' });
  const send = useAction<void>('/admin/selection/send-letters', {
    ...inv, success: (r) => (r.sent ? `${r.sent} letters sent to families` : 'No letters waiting to be sent'),
  });

  return (
    <Shell role="admin" active="selection" mainStyle={{ gap: 22 }}>
      <Async q={q}>
        {(d) => {
          const rows = d.rows.filter((r) => filter === 'all' || r.status === filter);
          const top = d.rows.filter((r) => !r.assessing).slice(0, 10);
          const curious = top.length ? top.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;
          const w = d.weights;
          return (
            <>
              <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SelectionSteps step={1} />
                  <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Student selection</h1>
                  <span style={{ fontSize: 15, color: '#4A4D68' }}>{d.label} · nominations from current Grade 6 classes</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button onClick={() => ask.mutate()} disabled={ask.isPending} style={{ minHeight: 46, padding: '0 16px', borderRadius: 14, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>
                    Ask teachers for nominations
                  </button>
                  <button onClick={() => setLettersOpen(true)} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: 0, background: C.indigo, color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Send letters to families{d.drafts ? ` · ${d.drafts}` : ''}
                  </button>
                </div>
              </header>

              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 14 }}>
                <Stat label="Seats" value={d.seats} sub={`${d.per_class} per class`} bg={C.navy} fg="#FFFFFF" sfg={C.lilac} />
                <Stat label="Nominated" value={d.nominated} bg={C.white} fg={C.ink} sfg={C.muted} border />
                <Stat label="Accepted" value={d.counts.acc} bg={C.ok.bg} fg={C.ok.fg} sfg={C.ok.fg} />
                <Stat label="Waitlist" value={d.counts.wait} bg={C.warn.bg} fg={C.warn.fg} sfg={C.warn.fg} />
                <Stat label="To review" value={d.counts.pend} bg={C.info.bg} fg={C.info.fg} sfg={C.info.fg} />
              </section>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <section style={{ flex: '999 1 620px', minWidth: 0, borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <h2 style={{ margin: 0, fontFamily: display, fontSize: 20, fontWeight: 700 }}>Nominees, ranked by score</h2>
                    <div role="tablist" aria-label="Filter by status" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {FILTERS.map(([id, text]) => {
                        const on = filter === id;
                        return (
                          <button key={id} role="tab" aria-selected={on} onClick={() => setFilter(id)} style={{ minHeight: 36, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${on ? C.navy : C.border2}`, background: on ? C.navy : C.white, color: on ? '#FFFFFF' : C.ink, fontSize: 13, cursor: 'pointer' }}>
                            {id === 'pend' ? `${text} · ${d.counts.pend}` : text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <div role="table" aria-label="Nominees" style={{ minWidth: 720, display: 'flex', flexDirection: 'column' }}>
                      <div role="row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '8px 6px', fontSize: 12, fontWeight: 600, color: C.muted }}>
                        {['#', 'Student', 'Class', 'Grades', 'Interest', 'Assessment', 'Score', 'Decision'].map((h) => <span key={h} role="columnheader">{h}</span>)}
                      </div>
                      {rows.map((r) => {
                        const busy = setStatus.isPending && setStatus.variables?.id === r.id;
                        return (
                          <div key={r.id} role="row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center', padding: '10px 6px', borderTop: '1px solid #EEEFF5', fontSize: 14 }}>
                            <span role="cell" style={{ color: C.muted, fontWeight: 600 }}>{r.rank}</span>
                            <span role="cell" style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 500 }}>{r.name}</span>
                              <span style={{ fontSize: 12, color: C.muted }}>by {r.by}</span>
                            </span>
                            <span role="cell">{r.cls}</span>
                            <span role="cell">{r.avg}%</span>
                            <span role="cell">{r.interest}/10</span>
                            <span role="cell" style={{ color: r.assessing ? C.muted : C.ink }}>{r.assessing ? 'In progress' : `${r.challenge}/20`}</span>
                            <span role="cell" style={{ fontWeight: 700 }}>{r.assessing ? '—' : r.score}</span>
                            <span role="cell" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                              {r.status === 'pend' ? (
                                <>
                                  <button onClick={() => setStatus.mutate({ id: r.id, status: 'acc' })} disabled={r.full || busy} style={{ minHeight: 34, padding: '0 10px', borderRadius: 9, border: 0, background: r.full ? C.chip : C.ok.strong, color: r.full ? C.muted : '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                    {r.full ? 'Class full' : 'Accept'}
                                  </button>
                                  <button onClick={() => setStatus.mutate({ id: r.id, status: 'wait' })} disabled={busy} style={{ minHeight: 34, padding: '0 10px', borderRadius: 9, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 13, cursor: 'pointer' }}>
                                    Waitlist
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ padding: '5px 10px', borderRadius: 999, background: r.status === 'acc' ? C.ok.bg : C.warn.bg, color: r.status === 'acc' ? C.ok.fg : C.warn.fg, fontSize: 12, fontWeight: 600 }}>
                                    {r.status === 'acc' ? 'Accepted' : 'Waitlist'}
                                  </span>
                                  <button onClick={() => setStatus.mutate({ id: r.id, status: 'pend' })} disabled={busy} style={{ minHeight: 30, padding: '0 6px', border: 0, background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>
                                    Undo
                                  </button>
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: C.muted }}>
                    Showing {rows.length} of {d.nominated} nominees. Waitlisted students are offered seats automatically if one opens.
                  </span>
                </section>

                <aside style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <section style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 style={{ margin: 0, fontFamily: display, fontSize: 18, fontWeight: 700 }}>Seats per class</h2>
                    {d.quotas.map((qq) => (
                      <div key={qq.cls} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: 12, alignItems: 'center', fontSize: 14 }}>
                        <span style={{ fontWeight: 600 }}>{qq.cls}</span>
                        <span style={{ display: 'grid', gridTemplateColumns: `repeat(${d.per_class}, minmax(0, 1fr))`, gap: 4 }}>
                          {Array.from({ length: d.per_class }, (_, k) => (
                            <span key={k} style={{ height: 14, borderRadius: 4, background: k < qq.n ? C.ok.strong : C.border }} />
                          ))}
                        </span>
                        <span style={{ textAlign: 'right', color: C.ink2 }}>{qq.n}/{d.per_class}</span>
                      </div>
                    ))}
                  </section>
                  <section style={{ borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <h2 style={{ margin: 0, fontFamily: display, fontSize: 18, fontWeight: 700 }}>How the score works</h2>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: C.lilac }}>Every nominee needs a teacher nomination. Then:</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {([['AI assessment (adaptive)', w.assessment], ['Interest form', w.interest], ['Grade average', w.grades]] as const).map(([t, v]) => (
                        <div key={t} style={{ display: 'grid', gridTemplateColumns: '1fr 48px', gap: 10, fontSize: 14 }}>
                          <span>{t}</span>
                          <span style={{ textAlign: 'right', color: C.lime, fontWeight: 700 }}>{v}%</span>
                        </div>
                      ))}
                    </div>
                    {curious && (
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: C.lilac }}>
                        Curiosity counts more than marks: {curious.name} ranks #{curious.rank} with a {curious.avg}% average.
                      </span>
                    )}
                    <button onClick={() => setWeights(w)} style={{ alignSelf: 'flex-start', minHeight: 38, padding: '0 12px', borderRadius: 10, border: '1.5px solid #5C58A3', background: 'transparent', color: '#FFFFFF', fontSize: 13, cursor: 'pointer' }}>
                      Edit weights
                    </button>
                  </section>
                </aside>
              </div>

              {weights && (
                <Modal title="Edit score weights" onClose={() => setWeights(null)} width={460}>
                  {([['assessment', 'AI assessment (adaptive)'], ['interest', 'Interest form'], ['grades', 'Grade average']] as const).map(([k, t]) => (
                    <label key={k} style={label}>
                      {t} (%)
                      <input type="number" min={0} max={100} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} style={field} />
                    </label>
                  ))}
                  {(() => {
                    const sum = weights.assessment + weights.interest + weights.grades;
                    return (
                      <>
                        <span style={{ fontSize: 14, color: sum === 100 ? C.ok.ink : C.bad.strong }}>Total {sum}% {sum === 100 ? '✓' : '· must add up to 100%'}</span>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                          <button onClick={() => setWeights(null)} style={btn.ghost}>Cancel</button>
                          <button disabled={sum !== 100 || saveWeights.isPending} onClick={() => saveWeights.mutate(weights, { onSuccess: () => setWeights(null) })} style={btn.primary}>Save weights</button>
                        </div>
                      </>
                    );
                  })()}
                </Modal>
              )}
              {lettersOpen && <LettersModal onClose={() => setLettersOpen(false)} onSend={() => send.mutate(undefined, { onSuccess: () => setLettersOpen(false) })} sending={send.isPending} />}
            </>
          );
        }}
      </Async>
    </Shell>
  );
}

function Stat({ label: l, value, sub, bg, fg, sfg, border }: { label: string; value: number; sub?: string; bg: string; fg: string; sfg: string; border?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 18, borderRadius: 18, background: bg, color: fg, border: border ? `1px solid ${C.border}` : undefined }}>
      <span style={{ fontSize: 13, color: sfg }}>{l}</span>
      <span style={{ fontFamily: display, fontSize: 30, fontWeight: 800, lineHeight: 1, color: fg }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: sfg }}>{sub}</span>}
    </div>
  );
}

function LettersModal({ onClose, onSend, sending }: { onClose: () => void; onSend: () => void; sending: boolean }) {
  const q = useGet<Letter[]>('/admin/selection/letters');
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Modal title="Letters to families" onClose={onClose} width={640}>
      {q.isLoading ? <Loading /> : (
        <>
          <span style={{ fontSize: 14, color: C.muted }}>
            {q.data?.length ? `${q.data.length} letters are drafted in Arabic and English. Families see the decision and next steps, never the AI category or scores.` : 'No letters are waiting. Letters are drafted when you decide on a nominee.'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
            {q.data?.map((l) => (
              <div key={l.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, border: 0, background: 'none', padding: 0, cursor: 'pointer', fontSize: 14, color: C.ink, textAlign: 'left' }}>
                  <span><strong style={{ fontWeight: 600 }}>{l.name}</strong> · {l.cls}</span>
                  <span style={{ color: C.muted }}>{l.decision} {open === l.id ? '▲' : '▼'}</span>
                </button>
                {open === l.id && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 10 }}>
                    <p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.6, background: C.bg, borderRadius: 10, padding: 10 }}>{l.en}</p>
                    <p dir="rtl" lang="ar" style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.8, background: C.bg, borderRadius: 10, padding: 10 }}>{l.ar}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={btn.ghost}>Close</button>
            <button disabled={!q.data?.length || sending} onClick={onSend} style={btn.primary}>Send {q.data?.length ?? 0} letters</button>
          </div>
        </>
      )}
    </Modal>
  );
}
