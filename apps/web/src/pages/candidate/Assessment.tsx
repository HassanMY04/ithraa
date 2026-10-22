import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { C, ErrorState, Loading, display, useToast } from '../../components/ui';
import { resLook } from '../admin/Assessments';

type State = {
  name: string; first: string; ini: string; cls: string; intake: string; results_month: string;
  preview: boolean; done: boolean; num: number; answered: number; dots: ('main' | 'clarify' | 'current' | 'empty')[];
  q: { id: string; type: 'mcq' | 'tf' | 'interest' | 'open' | 'short'; type_label: string; text: string; lead: string; hint: string; options: string[] } | null;
  ai?: {
    why_title: string; why: string; samples: [string, string] | null; context: string[]; note: string;
    signals: { name: string; color: string; v: number | null }[]; interest: string;
    rec: string | null; rec_tone: 'ok' | 'warn' | 'info' | 'bad';
    hist: { n: string; label: string; follow: boolean; tag: string; res: string }[];
  };
};

const DOT = { main: '#4E3CF5', clarify: '#C8F25A', current: '#16133A', empty: '#DDDFEC' };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const REC = { ok: { bg: '#DCF4EA', fg: '#0A4F3D' }, warn: { bg: '#FFF1DE', fg: '#6B3700' }, info: { bg: '#EDEBFF', fg: '#2A2660' }, bad: { bg: '#FFE6E8', fg: '#8E1A27' } };

/** Grade 6 discovery assessment. `preview` = the coordinator trying it, with the AI's reasoning panel. */
export default function Assessment({ preview = false }: { preview?: boolean }) {
  const params = useParams();
  const toast = useToast();
  const [token, setToken] = useState<string | null>(preview ? null : params.token ?? null);
  const [st, setSt] = useState<State | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAI, setShowAI] = useState(true);

  const start = useCallback(async () => {
    setError(null);
    try {
      let t = token;
      if (preview && !t) {
        t = (await api<{ token: string }>('/admin/assessments/preview', { method: 'POST' })).token;
        setToken(t);
      }
      if (t) setSt(await api<State>(`/assess/${t}`));
    } catch (e) {
      setError(e);
    }
  }, [preview, token]);

  useEffect(() => {
    if (!st) start();
  }, [st, start]);

  const send = async (path: string, body?: object) => {
    setBusy(true);
    try {
      setSt(await api<State>(`/assess/${token}/${path}`, { method: 'POST', body: body ?? {} }));
      setChoice(null);
      setText('');
      window.scrollTo(0, 0);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState error={error} retry={start} />;
  if (!st) return <Loading />;

  const q = st.q;
  const isChoice = q && ['mcq', 'tf', 'interest'].includes(q.type);
  const answered = q ? (isChoice ? choice !== null : text.trim().length > 0) : false;
  const ai = st.preview && showAI ? st.ai : undefined;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: C.navy, color: '#FFFFFF', padding: '14px 32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: C.lime, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22 }}>إ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: display, fontSize: 19, fontWeight: 700 }}>Discovery assessment</span>
            <span style={{ fontSize: 13, color: C.lilac }}>{st.intake}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {st.preview && (
            <Link to="/admin/assessments" style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', color: C.lilac, textDecoration: 'none', fontSize: 14 }}>
              ← Back to AI assessments
            </Link>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 6px', borderRadius: 12, background: C.navy3 }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: C.indigo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>{st.ini}</span>
            <span style={{ fontSize: 14 }}>{st.name} · {st.cls}</span>
          </span>
          {st.preview && (
            <button onClick={() => setShowAI(!showAI)} aria-pressed={showAI} style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${showAI ? C.lime : '#5C58A3'}`, background: showAI ? C.lime : 'transparent', color: showAI ? C.navy : '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {showAI ? 'Hide AI reasoning' : 'Show AI reasoning (demo)'}
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 1320, margin: '0 auto', padding: '32px 24px 56px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <section aria-label="Assessment" style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {q && !st.done && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, fontSize: 14, color: C.ink2 }}>
                  <span style={{ fontWeight: 600, color: C.ink }}>Question {st.num}</span>
                  <span>Usually 8–10 questions · no time limit</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {st.dots.map((d, i) => <span key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: DOT[d] }} />)}
                </div>
              </div>
              <div style={{ borderRadius: 28, background: C.white, border: `1px solid ${C.border}`, padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  {q.lead && <span style={{ padding: '6px 12px', borderRadius: 999, background: C.navy, color: C.lime, fontSize: 13, fontWeight: 600 }}>{q.lead}</span>}
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: C.indigoTint, color: '#3A2BD0', fontSize: 13, fontWeight: 600 }}>{q.type_label}</span>
                </div>
                <h1 style={{ margin: 0, fontFamily: display, fontSize: 30, fontWeight: 700, lineHeight: 1.25 }}>{q.text}</h1>
                {q.hint && (
                  <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderRadius: 14, background: C.warn.bg, color: C.warn.fg, fontSize: 15, lineHeight: 1.5 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
                      <path d="M9 18h6M10 21h4" />
                      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
                    </svg>
                    <span>{q.hint}</span>
                  </div>
                )}
                {isChoice && (
                  <div role="group" aria-label="Answers" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
                    {q.options.map((o, k) => {
                      const on = choice === k;
                      return (
                        <button key={k} onClick={() => setChoice(k)} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 64, padding: '12px 16px', borderRadius: 16, border: `2px solid ${on ? C.indigo : C.border}`, background: on ? C.indigoTint : C.white, color: C.ink, textAlign: 'left', cursor: 'pointer' }}>
                          <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, background: on ? C.indigo : C.chip, color: on ? '#FFFFFF' : C.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{LETTERS[k]}</span>
                          <span style={{ fontSize: 17, lineHeight: 1.35 }}>{o}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {q.type === 'open' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label htmlFor="ansOpen" style={{ fontSize: 14, fontWeight: 600 }}>Your answer, in your own words (Arabic or English)</label>
                    <textarea id="ansOpen" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="There’s no single right answer. Explain your thinking." style={{ width: '100%', resize: 'vertical', padding: '14px 16px', borderRadius: 16, border: `2px solid ${C.border2}`, fontSize: 17, lineHeight: 1.5, color: C.ink, background: C.white }} />
                  </div>
                )}
                {q.type === 'short' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label htmlFor="ansShort" style={{ fontSize: 14, fontWeight: 600 }}>Your answer</label>
                    <input id="ansShort" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && answered && send('answer', { text })} placeholder="Type the decoded word" style={{ minHeight: 60, padding: '0 18px', borderRadius: 16, border: `2px solid ${C.border2}`, fontSize: 22, letterSpacing: '0.08em', color: C.ink, background: C.white }} />
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: C.muted }}>Your answers help us choose the right activities for you. There are no trick scores.</span>
                  <button onClick={() => send('answer', isChoice ? { choice } : { text })} disabled={!answered || busy} style={{ minHeight: 52, padding: '0 28px', borderRadius: 14, border: 0, background: answered ? C.navy : '#DDDFEC', color: answered ? C.lime : C.muted, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
                    {busy ? 'Saving…' : 'Next'}
                  </button>
                </div>
              </div>
            </>
          )}
          {st.done && (
            <div style={{ borderRadius: 28, background: C.navy, color: '#FFFFFF', padding: '48px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden="true" style={{ position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: '50%', border: `34px solid ${C.navy2}` }} />
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lime, position: 'relative' }}>All done</span>
              <span style={{ fontFamily: display, fontSize: 40, fontWeight: 800, position: 'relative' }}>Great thinking, {st.first}!</span>
              <span style={{ fontSize: 17, lineHeight: 1.6, color: '#DAD8F2', maxWidth: 520, position: 'relative' }}>
                You answered {st.answered} questions. The Ithraa team will share the results with your family in {st.results_month}.
              </span>
              {st.preview && (
                <button onClick={() => send('restart')} disabled={busy} style={{ minHeight: 48, padding: '0 20px', borderRadius: 14, border: '1.5px solid #5C58A3', background: 'transparent', color: '#FFFFFF', fontSize: 15, cursor: 'pointer', position: 'relative' }}>
                  Restart the demo
                </button>
              )}
            </div>
          )}
        </section>

        {ai && (
          <aside aria-label="How the AI adapts" style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '10px 14px', borderRadius: 12, background: C.warn.bg, color: C.warn.fg, fontSize: 13, lineHeight: 1.5 }}>
              Demo view for the school team. Candidates never see this panel.
            </div>
            <section style={{ borderRadius: 22, background: C.navy, color: '#FFFFFF', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lime }}>{ai.why_title}</span>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#E6E4F8' }}>{ai.why}</p>
              {ai.samples && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                  <button onClick={() => setText(ai.samples![0])} style={{ minHeight: 36, padding: '0 12px', borderRadius: 10, border: 0, background: C.lime, color: C.navy, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fill a strong answer</button>
                  <button onClick={() => setText(ai.samples![1])} style={{ minHeight: 36, padding: '0 12px', borderRadius: 10, border: '1.5px solid #5C58A3', background: 'transparent', color: '#FFFFFF', fontSize: 13, cursor: 'pointer' }}>Fill a weak answer</button>
                </div>
              )}
              {st.done && (
                <Link to="/admin/assessments" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 14px', borderRadius: 10, background: C.lime, color: C.navy, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                  Open the admin report
                </Link>
              )}
            </section>
            <section style={side}>
              <h2 style={sideH}>Context the AI uses</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ai.context.map((c) => <span key={c} style={{ padding: '5px 10px', borderRadius: 8, background: C.chip, fontSize: 13 }}>{c}</span>)}
              </div>
              {ai.note && <p style={{ margin: 0, padding: '10px 12px', borderRadius: 10, background: '#F7F7FC', fontSize: 13, lineHeight: 1.5, color: '#2B2D45' }}>{ai.note}</p>}
            </section>
            <section style={side}>
              <h2 style={sideH}>Signals so far</h2>
              {ai.signals.map((s) => (
                <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 40px', gap: 10, alignItems: 'center', fontSize: 13 }}>
                  <span>{s.name}</span>
                  <span style={{ height: 8, borderRadius: 4, background: C.chip, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${s.v ?? 0}%`, borderRadius: 4, background: s.color }} />
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: 600, color: C.ink2 }}>{s.v ?? '—'}</span>
                </div>
              ))}
              <span style={{ fontSize: 13, color: C.ink2 }}>Interest: <strong>{ai.interest}</strong></span>
              {st.done && ai.rec && (
                <div style={{ marginTop: 4, padding: '12px 14px', borderRadius: 12, background: REC[ai.rec_tone].bg, color: REC[ai.rec_tone].fg, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>AI recommendation</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{ai.rec}</span>
                </div>
              )}
            </section>
            <section style={{ ...side, gap: 4 }}>
              <h2 style={{ ...sideH, margin: '0 0 6px' }}>Answer path</h2>
              {ai.hist.length === 0 && <span style={{ fontSize: 13, color: C.muted }}>The path appears as {st.first} answers.</span>}
              {ai.hist.map((h) => {
                const L = resLook(h.res);
                return (
                  <div key={h.n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: `8px 0 8px ${h.follow ? 14 : 0}px`, borderTop: '1px solid #EEEFF5', fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, color: C.muted }}>{h.n}</span>
                      <span>{h.label}</span>
                    </span>
                    <span style={{ flexShrink: 0, padding: '3px 8px', borderRadius: 999, background: L.bg, color: L.fg, fontSize: 11, fontWeight: 600 }}>{h.tag}</span>
                  </div>
                );
              })}
            </section>
          </aside>
        )}
      </main>
    </div>
  );
}

const side = { borderRadius: 22, background: C.white, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column' as const, gap: 10 };
const sideH = { margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: C.muted };
