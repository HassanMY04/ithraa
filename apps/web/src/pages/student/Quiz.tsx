import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Shell } from '../../components/Shell';
import { Async, C, display } from '../../components/ui';
import { useAction, useGet } from '../../lib/hooks';

type QuizState = {
  quiz: { id: number; title: string; context: string; total: number; closed: boolean; color: string };
  attempt: { started: boolean; index: number; answered: number; results: boolean[]; correct: number; xp: number; done: boolean; score_pct: number | null };
  question: { text: string; options: string[] } | null;
  time_left: number;
  skill: string | null;
  skill_updated: boolean;
  result_line: string;
};
type Empty = { quiz: null; history: { id: number; title: string; score: number; when: string }[] };
type CheckResult = { correct: boolean; answer: number; why: string; finished: boolean; state: QuizState };

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function Quiz() {
  const { quizId } = useParams();
  const q = useGet<QuizState | Empty>(quizId ? `/student/quiz/${quizId}` : '/student/quiz');
  return (
    <Async q={q}>
      {(d) => (d.quiz === null ? <NoQuiz d={d as Empty} /> : <Play key={d.quiz.id} d={d as QuizState} />)}
    </Async>
  );
}

function NoQuiz({ d }: { d: Empty }) {
  return (
    <Shell role="student" active="quiz">
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Quizzes & activities</h1>
        <p style={{ margin: 0, fontSize: 16, color: '#4A4D68' }}>No quiz is open right now. New quizzes show up on your home page.</p>
      </header>
      <section style={{ borderRadius: 24, background: '#FFFFFF', border: `1px solid ${C.border}`, padding: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: 0, fontFamily: display, fontSize: 20, fontWeight: 700 }}>Your recent results</h2>
        {d.history.length === 0 && <span style={{ fontSize: 14, color: C.muted }}>You haven’t finished a quiz yet.</span>}
        {d.history.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 14, background: '#F7F7FC' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{h.title}</span>
              <span style={{ fontSize: 13, color: C.muted }}>{h.when}</span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: h.score >= 75 ? '#0A6B52' : '#8A4600' }}>{h.score}%</span>
          </div>
        ))}
      </section>
    </Shell>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Play({ d }: { d: QuizState }) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState<null | (CheckResult & { question: { text: string; options: string[] } })>(null);
  const [left, setLeft] = useState(d.time_left);
  const state = checked ? checked.state : d;
  const total = d.quiz.total;

  useEffect(() => setLeft(d.time_left), [d.time_left]);
  useEffect(() => {
    if (state.attempt.done || left <= 0) return;
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [state.attempt.done, left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = useAction<{ choice: number }, CheckResult>(`/student/quiz/${d.quiz.id}/check`);
  const restart = useAction(`/student/quiz/${d.quiz.id}/restart`, { invalidate: ['student', 'quiz'] });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['student', 'quiz'] });
    qc.invalidateQueries({ queryKey: ['student', 'home'] });
    qc.invalidateQueries({ queryKey: ['student', 'tree'] });
  };

  const question = checked ? checked.question : d.question;
  const done = !checked && d.attempt.done;
  const results = state.attempt.results;
  const current = checked ? results.length - 1 : d.attempt.answered;
  const steps = Array.from({ length: total }, (_, k) =>
    k < results.length ? (results[k] ? '#0B7D60' : '#C42B3B') : k === current ? C.indigo : '#DDDFEC');

  const onCheck = () => {
    if (picked === null || !question) return;
    check.mutate({ choice: picked }, { onSuccess: (r) => setChecked({ ...r, question }) });
  };
  const onNext = () => {
    setChecked(null);
    setPicked(null);
    refresh();
  };
  const onRestart = () => restart.mutate(undefined, { onSuccess: () => { setChecked(null); setPicked(null); } });

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: C.navy, color: '#FFFFFF', padding: '16px 32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/student" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 14px', borderRadius: 12, background: C.navy3, color: '#FFFFFF', textDecoration: 'none', fontSize: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            Exit quiz
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: display, fontSize: 19, fontWeight: 700 }}>{d.quiz.title}</span>
            <span style={{ fontSize: 13, color: C.lilac }}>{d.quiz.context}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!done && !d.quiz.closed && (
            <span role="timer" aria-label="Suggested time left" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, background: C.navy3, fontSize: 14 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
              {left > 0 ? `${fmt(left)} left` : 'Take your time'}
            </span>
          )}
          <span style={{ padding: '8px 14px', borderRadius: 12, background: C.lime, color: C.navy, fontSize: 14, fontWeight: 600 }}>+{state.attempt.xp} XP</span>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 820, margin: '0 auto', padding: '40px 24px 56px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {!done && question && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: C.ink2 }}>
                <span style={{ fontWeight: 600 }}>Question {current + 1} of {total}</span>
                <span>{state.attempt.correct} correct so far</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`, gap: 6 }}>
                {steps.map((bg, i) => <div key={i} style={{ height: 8, borderRadius: 4, background: bg }} />)}
              </div>
            </div>
            <section style={{ borderRadius: 28, background: '#FFFFFF', border: `1px solid ${C.border}`, padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
              <h1 style={{ margin: 0, fontFamily: display, fontSize: 28, fontWeight: 700, lineHeight: 1.25, textWrap: 'pretty' } as CSSProperties}>{question.text}</h1>
              <div role="group" aria-label="Answers" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {question.options.map((text, k) => {
                  const isPicked = picked === k;
                  const isRight = checked ? k === checked.answer : false;
                  let o = { border: C.border, bg: '#FFFFFF', badgeBg: C.chip, badgeFg: C.ink2, opacity: 1, tag: '', tagFg: '#0A6B52' };
                  if (!checked && isPicked) o = { ...o, border: C.indigo, bg: C.indigoTint, badgeBg: C.indigo, badgeFg: '#FFFFFF' };
                  if (checked && isRight) o = { ...o, border: '#0B7D60', bg: '#DCF4EA', badgeBg: '#0B7D60', badgeFg: '#FFFFFF', tag: 'Correct answer' };
                  if (checked && isPicked && !isRight) o = { ...o, border: '#C42B3B', bg: '#FFE6E8', badgeBg: '#C42B3B', badgeFg: '#FFFFFF', tag: 'Your answer', tagFg: '#A11F2E' };
                  if (checked && !isPicked && !isRight) o.opacity = 0.55;
                  return (
                    <button key={k} onClick={() => !checked && setPicked(k)} aria-pressed={isPicked} style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 64, padding: '12px 16px', borderRadius: 16, border: `2px solid ${o.border}`, background: o.bg, color: C.ink, textAlign: 'left', cursor: checked ? 'default' : 'pointer', opacity: o.opacity }}>
                      <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: o.badgeBg, color: o.badgeFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>{LETTERS[k]}</span>
                      <span style={{ flex: 1, fontSize: 17 }}>{text}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: o.tagFg }}>{o.tag}</span>
                    </button>
                  );
                })}
              </div>
              {checked && (
                <div role="status" style={{ display: 'flex', gap: 12, padding: '16px 18px', borderRadius: 16, background: checked.correct ? '#DCF4EA' : '#FFF1DE', color: checked.correct ? '#0A4F3D' : '#6B3700' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{checked.correct ? 'Nice — that’s right.' : 'Not quite.'}</span>
                    <span style={{ fontSize: 15, lineHeight: 1.5 }}>{checked.why}</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: C.muted }}>Your teacher sees your answers after the quiz closes</span>
                {!checked ? (
                  <button onClick={onCheck} disabled={picked === null || check.isPending} style={{ minHeight: 50, padding: '0 26px', borderRadius: 14, border: 0, background: picked === null ? '#DDDFEC' : C.navy, color: picked === null ? C.muted : C.lime, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                    Check answer
                  </button>
                ) : (
                  <button onClick={onNext} style={{ minHeight: 50, padding: '0 26px', borderRadius: 14, border: 0, background: C.indigo, color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                    {checked.finished ? 'See results' : 'Next question'}
                  </button>
                )}
              </div>
            </section>
          </>
        )}
        {!done && !question && (
          <section style={{ borderRadius: 28, background: '#FFFFFF', border: `1px solid ${C.border}`, padding: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h1 style={{ margin: 0, fontFamily: display, fontSize: 26, fontWeight: 700 }}>This quiz has closed</h1>
            <span style={{ fontSize: 15, color: C.muted }}>You didn’t finish it before it closed. Your teacher can see the answers you gave.</span>
            <Link to="/student" style={{ fontSize: 15, fontWeight: 600 }}>Back to home</Link>
          </section>
        )}
        {done && (
          <section style={{ borderRadius: 28, background: C.navy, color: '#FFFFFF', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden="true" style={{ position: 'absolute', left: -70, top: -70, width: 240, height: 240, borderRadius: '50%', border: `32px solid ${C.navy2}` }} />
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lime, position: 'relative' }}>Quiz complete</span>
            <span style={{ fontFamily: display, fontSize: 72, fontWeight: 800, lineHeight: 1, position: 'relative' }}>
              {d.attempt.correct}
              <span style={{ fontSize: 36, color: C.lilac2 }}>/{total}</span>
            </span>
            <span style={{ fontSize: 17, color: '#DAD8F2', position: 'relative' }}>{d.result_line}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, position: 'relative' }}>
              <span style={{ padding: '8px 14px', borderRadius: 12, background: C.lime, color: C.navy, fontSize: 14, fontWeight: 600 }}>+{d.attempt.xp} XP</span>
              {d.skill && (
                <span style={{ padding: '8px 14px', borderRadius: 12, background: C.navy3, fontSize: 14 }}>
                  {d.skill_updated ? `${d.skill} skill updated` : `${d.skill}: keep practising`}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8, position: 'relative' }}>
              {!d.quiz.closed && (
                <button onClick={onRestart} disabled={restart.isPending} style={{ minHeight: 48, padding: '0 20px', borderRadius: 14, border: '1.5px solid #5C58A3', background: 'transparent', color: '#FFFFFF', fontSize: 15, cursor: 'pointer' }}>
                  Try again
                </button>
              )}
              <Link to="/student/session" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, padding: '0 22px', borderRadius: 14, background: C.lime, color: C.navy, textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>
                Go to the session
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
