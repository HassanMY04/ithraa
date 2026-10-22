import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Shell } from '../../components/Shell';
import { Async, C, display, useToast } from '../../components/ui';
import { download } from '../../lib/api';
import { useAction, useGet } from '../../lib/hooks';

type Homework = {
  id: number; kind: string; title: string; points: number; description: string; due: string;
  rubric: { c: string; p: number }[]; response_type: string; status: 'idle' | 'attached' | 'submitted' | 'graded';
  past_due: boolean; file: { name: string; size: string; id: number; has_file: boolean } | null; on_time: boolean;
  submitted_at: string | null; grades_by: string; score: number | null; feedback: string | null;
};
type SessionData = {
  lesson_id: number; group_id: number; title: string; crumb: string; week_label: string; course: string;
  color: string; tint: string; ink: string; when: string; room: string;
  teacher: { id: number; formal: string; short: string; initials: string; color: string };
  weeks: { lesson_id: number; label: string; title: string; state: 'delivered' | 'next' | 'later'; current: boolean }[];
  slides: { title: string; bullets: string[] }[];
  slides_material: { id: number; name: string; meta: string; has_file: boolean } | null;
  slides_early: boolean;
  materials: { id: number; kind: string; name: string; meta: string; has_file: boolean }[];
  activity: null | { title: string; desc: string; team: string; minutes: number; badge: string | null; open: boolean; my_team: string[] | null; teacher: string };
  homework: Homework | null;
  feedback: null | { label: string; score: number; points: number; text: string; initials: string; color: string };
  checkin: { available: boolean; done: boolean };
};

const KIND: Record<string, { bg: string; fg: string }> = {
  PDF: { bg: '#FFEAE2', fg: '#A8361A' },
  VID: { bg: '#EFE7FF', fg: '#5A27C2' },
  DOC: { bg: '#E4EEFF', fg: '#14509E' },
  IMG: { bg: '#DCF4EA', fg: '#0A6B52' },
};
const card = { borderRadius: 24, background: '#FFFFFF', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' } as const;
const pill = { padding: '6px 12px', borderRadius: 999, background: '#FFFFFF', border: `1px solid ${C.border}`, fontSize: 13 } as const;

export default function Session() {
  const { lessonId } = useParams();
  const q = useGet<SessionData>(lessonId ? `/student/session/${lessonId}` : '/student/session');
  return (
    <Shell role="student" active="session" mainStyle={{ gap: 24 }}>
      <Async q={q}>{(d) => <Body key={d.lesson_id} d={d} />}</Async>
    </Shell>
  );
}

function Body({ d }: { d: SessionData }) {
  const toast = useToast();
  const qc = useQueryClient();
  const firstRich = Math.max(0, d.slides.findIndex((s) => s.bullets.length >= 3));
  const [slide, setSlide] = useState(firstRich);
  const [question, setQuestion] = useState('');
  const ask = useAction<{ teacher_id: number; text: string; context: string }>('/student/questions', {
    success: `Sent to ${d.teacher.short}. You’ll see the reply in your notifications.`,
  });

  const open = async (m: { id: number; name: string; has_file: boolean }) => {
    if (!m.has_file) {
      toast(`${d.teacher.short} hasn’t attached a file for “${m.name}” yet.`);
      return;
    }
    try {
      await download(`/files/material/${m.id}`, m.name);
      qc.invalidateQueries({ queryKey: ['student', 'session'] });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const s = d.slides[slide];
  return (
    <>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <nav aria-label="Breadcrumb" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 14, color: C.muted }}>
          <Link to="/student/session" style={{ color: C.muted }}>Sessions</Link>
          <span aria-hidden="true">/</span>
          <span>{d.crumb}</span>
          <span aria-hidden="true">/</span>
          <span style={{ color: C.ink, fontWeight: 500 }}>{d.week_label}</span>
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{d.title}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ padding: '6px 12px', borderRadius: 999, background: d.tint, color: d.ink, fontSize: 13, fontWeight: 600 }}>{d.course}</span>
            <span style={pill}>{d.when}</span>
            <span style={pill}>{d.room}</span>
            <span style={pill}>{d.teacher.formal}</span>
          </div>
        </div>
      </header>

      <div role="list" aria-label="Module weeks" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: 8 }}>
        {d.weeks.map((w) => {
          const look = w.state === 'delivered' ? { bg: '#FFFFFF', fg: C.ink2, border: C.border }
            : w.state === 'next' ? { bg: d.color, fg: '#FFFFFF', border: d.color }
              : { bg: 'transparent', fg: C.muted, border: C.border2 };
          return (
            <Link key={w.lesson_id} role="listitem" to={`/student/session/${w.lesson_id}`} aria-current={w.current ? 'page' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, borderRadius: 14, background: look.bg, color: look.fg, border: `1.5px solid ${look.border}`, boxShadow: w.current && w.state !== 'next' ? `0 0 0 3px ${C.indigo}` : undefined, textDecoration: 'none' }}>
              <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>{w.label}</span>
              <span style={{ fontSize: 13, lineHeight: 1.3 }}>{w.title}</span>
            </Link>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section aria-label="Slides" style={{ ...card, padding: 20, gap: 14 }}>
            {s ? (
              <div style={{ aspectRatio: '16 / 9', borderRadius: 16, background: '#0F1B3D', color: '#FFFFFF', padding: '7% 8%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, position: 'relative', overflow: 'hidden' }}>
                <div aria-hidden="true" style={{ position: 'absolute', right: -60, bottom: -60, width: 260, height: 260, borderRadius: '50%', border: '36px solid #17306A' }} />
                <span style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7FB0FF', position: 'relative' }}>{s.title}</span>
                <div style={{ display: 'grid', gridTemplateColumns: s.bullets.length > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: 14, position: 'relative', maxWidth: 640 }}>
                  {s.bullets.map((b, i) => (
                    <div key={i} style={{ padding: '14px 16px', borderRadius: 12, background: s.bullets.length === 4 && i === 1 ? d.color : '#17306A', fontSize: 17, fontWeight: s.bullets.length === 4 && i === 1 ? 600 : 400 }}>
                      {s.bullets.length === 4 ? `${i + 1} · ${b}` : b}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ aspectRatio: '16 / 9', borderRadius: 16, background: '#0F1B3D', color: '#FFFFFF', padding: '7% 8%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
                <span style={{ fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7FB0FF' }}>Slides</span>
                <span style={{ fontFamily: display, fontSize: 26, fontWeight: 700 }}>
                  {d.slides_material ? d.slides_material.name : 'Slides aren’t uploaded yet'}
                </span>
                {d.slides_material && (
                  <button onClick={() => open(d.slides_material!)} style={{ alignSelf: 'flex-start', minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', background: C.lime, color: C.navy, fontWeight: 600, cursor: 'pointer' }}>
                    Open slides · {d.slides_material.meta}
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {d.slides.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button aria-label="Previous slide" disabled={slide === 0} onClick={() => setSlide(slide - 1)} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: '#FFFFFF', color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: slide === 0 ? 0.4 : 1 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
                  </button>
                  <span style={{ fontSize: 14, color: C.ink2, minWidth: 96, textAlign: 'center' }}>Slide {slide + 1} of {d.slides.length}</span>
                  <button aria-label="Next slide" disabled={slide >= d.slides.length - 1} onClick={() => setSlide(slide + 1)} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: '#FFFFFF', color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: slide >= d.slides.length - 1 ? 0.4 : 1 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                  </button>
                </div>
              ) : <span />}
              {d.slides_early && <span style={{ fontSize: 13, color: C.muted }}>Slides were shared early so you can preview them</span>}
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 20 }}>
            <div style={{ ...card, padding: 22, gap: 12 }}>
              <h2 style={{ margin: 0, fontFamily: display, fontSize: 19, fontWeight: 700 }}>Materials</h2>
              {d.materials.length === 0 && <span style={{ fontSize: 14, color: C.muted }}>No materials yet.</span>}
              {d.materials.map((m) => {
                const k = KIND[m.kind] ?? KIND.DOC;
                return (
                  <button key={m.id} onClick={() => open(m)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, background: '#F7F7FC', color: C.ink, border: 'none', textAlign: 'start', cursor: 'pointer' }}>
                    <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, background: k.bg, color: k.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{m.kind}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>{m.meta}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {d.activity && (
              <div style={{ borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lime }}>In class · live activity</span>
                <h2 style={{ margin: 0, fontFamily: display, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{d.activity.title}</h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#DAD8F2' }}>{d.activity.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[d.activity.team, d.activity.minutes ? `${d.activity.minutes} min` : '', d.activity.badge ?? ''].filter(Boolean).map((x) => (
                    <span key={x} style={{ padding: '5px 10px', borderRadius: 8, background: C.navy3, fontSize: 12 }}>{x}</span>
                  ))}
                </div>
                {d.activity.my_team && (
                  <span style={{ fontSize: 14, color: C.lime }}>Your team: you, {d.activity.my_team.join(', ')}</span>
                )}
                {d.activity.open ? (
                  <div role="status" style={{ marginTop: 'auto', minHeight: 46, borderRadius: 12, background: C.lime, color: C.navy, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Live now · join your team
                  </div>
                ) : (
                  <button disabled style={{ marginTop: 'auto', minHeight: 46, borderRadius: 12, border: '1.5px dashed #5C58A3', background: 'transparent', color: C.lilac, fontSize: 14, cursor: 'not-allowed' }}>
                    Opens when {d.activity.teacher} starts it in class
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        <aside style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {d.checkin.available && <Checkin lessonId={d.lesson_id} done={d.checkin.done} />}
          {d.homework ? <HomeworkCard hw={d.homework} teacher={d.teacher.short} /> : (
            <section style={{ ...card, padding: 24, gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Homework</span>
              <span style={{ fontSize: 15, color: C.ink2 }}>No homework for this session.</span>
            </section>
          )}
          <section style={{ ...card, padding: 22, gap: 12 }}>
            {d.feedback && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontFamily: display, fontSize: 17, fontWeight: 700 }}>{d.feedback.label}</h2>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0A6B52' }}>{d.feedback.score} / {d.feedback.points}</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: '50%', background: d.feedback.color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{d.feedback.initials}</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#2B2D45' }}>{d.feedback.text || 'No written feedback.'}</p>
                </div>
              </>
            )}
            <label htmlFor="askQ" style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Ask {d.teacher.short} a question</label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!question.trim()) return;
                ask.mutate({ teacher_id: d.teacher.id, text: question, context: `Session · ${d.title}` }, { onSuccess: () => setQuestion('') });
              }}
              style={{ display: 'flex', gap: 8 }}
            >
              <input id="askQ" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Type your question…" style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${C.border2}`, fontSize: 14, color: C.ink, background: '#FFFFFF' }} />
              <button aria-label="Send question" disabled={!question.trim() || ask.isPending} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: 0, background: C.navy, color: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></svg>
              </button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}

function HomeworkCard({ hw, teacher }: { hw: Homework; teacher: string }) {
  const input = useRef<HTMLInputElement>(null);
  const inv = { invalidate: ['student'] };
  const attach = useAction<FormData>(`/student/assignments/${hw.id}/file`, { ...inv, form: true });
  const remove = useAction(`/student/assignments/${hw.id}/file`, { ...inv, method: 'DELETE' });
  const submit = useAction(`/student/assignments/${hw.id}/submit`, {
    ...inv,
    success: (r: { on_time: boolean }) => (r.on_time ? 'Homework submitted on time.' : 'Homework submitted (late).'),
  });
  const pill = {
    idle: hw.past_due ? { b: '#FFE6E8', f: '#8E1A27', s: 'Missing' } : { b: '#FFF1DE', f: '#8A4600', s: 'Not started' },
    attached: { b: '#E4EEFF', f: '#14509E', s: 'Draft' },
    submitted: { b: '#DCF4EA', f: '#0A6B52', s: 'Submitted' },
    graded: { b: '#DCF4EA', f: '#0A6B52', s: `Graded ${hw.score}/${hw.points}` },
  }[hw.status];
  const ext = hw.file ? (hw.file.name.split('.').pop() ?? '').toUpperCase().slice(0, 4) : '';
  const busy = attach.isPending || remove.isPending || submit.isPending;

  const pick = () => input.current?.click();
  const onFile = (f: File | undefined) => {
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    attach.mutate(fd);
    if (input.current) input.current.value = '';
  };

  return (
    <section aria-label="Homework" style={{ ...card, padding: 24, gap: 16 }}>
      <input ref={input} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt,.zip,.py,.html,.mp4" onChange={(e) => onFile(e.target.files?.[0])} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>
          {hw.kind === 'journal' ? 'Journal' : 'Homework'} · {hw.points} pts
        </span>
        <span style={{ padding: '5px 10px', borderRadius: 999, background: pill.b, color: pill.f, fontSize: 12, fontWeight: 600 }}>{pill.s}</span>
      </div>
      <h2 style={{ margin: 0, fontFamily: display, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{hw.title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#8A4600', fontWeight: 500 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        {hw.due}
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#2B2D45' }}>{hw.description}</p>
      {hw.rubric.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 14, background: '#F7F7FC' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>How it’s graded</span>
          {hw.rubric.map((rb) => (
            <div key={rb.c} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, color: '#2B2D45' }}>
              <span>{rb.c}</span>
              <span style={{ color: C.muted, flexShrink: 0 }}>{rb.p} pts</span>
            </div>
          ))}
        </div>
      )}
      {hw.status === 'idle' && (
        <button onClick={pick} disabled={busy} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 22, borderRadius: 16, border: '2px dashed #B9BCD3', background: '#FAFAFD', color: C.ink2, cursor: 'pointer' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.indigo} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{attach.isPending ? 'Uploading…' : 'Add your file or photo'}</span>
          <span style={{ fontSize: 13 }}>PDF, image, or document · up to 20 MB</span>
        </button>
      )}
      {hw.status === 'attached' && hw.file && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: `1px solid ${C.border}` }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: '#FFEAE2', color: '#A8361A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{ext}</span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{hw.file.name}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{hw.file.size}</span>
            </span>
            <button onClick={() => remove.mutate()} disabled={busy} style={{ minHeight: 36, padding: '0 10px', border: 0, background: 'none', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Remove</button>
          </div>
          <button onClick={() => submit.mutate()} disabled={busy} style={{ minHeight: 50, borderRadius: 14, border: 0, background: C.indigo, color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {submit.isPending ? 'Submitting…' : hw.past_due ? 'Submit late' : 'Submit homework'}
          </button>
        </>
      )}
      {hw.status === 'submitted' && (
        <>
          <div style={{ display: 'flex', gap: 12, padding: 16, borderRadius: 16, background: hw.on_time ? '#DCF4EA' : '#FFF1DE', color: hw.on_time ? '#0A4F3D' : '#6B3700' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{hw.on_time ? 'Submitted on time' : 'Submitted late'}</span>
              <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                {hw.file?.name ? `${hw.file.name} · ` : ''}{hw.grades_by}{hw.past_due ? '' : ' You can resubmit until the deadline.'}
              </span>
            </div>
          </div>
          {!hw.past_due && (
            <button onClick={() => remove.mutate()} disabled={busy} style={{ minHeight: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: '#FFFFFF', color: C.ink, fontSize: 14, cursor: 'pointer' }}>
              Replace file
            </button>
          )}
        </>
      )}
      {hw.status === 'graded' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16, borderRadius: 16, background: '#DCF4EA', color: '#0A4F3D' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Graded · {hw.score} / {hw.points}</span>
          {hw.feedback && <span style={{ fontSize: 14, lineHeight: 1.5 }}>“{hw.feedback}” — {teacher}</span>}
        </div>
      )}
    </section>
  );
}

function Checkin({ lessonId, done }: { lessonId: number; done: boolean }) {
  const [code, setCode] = useState('');
  const check = useAction<{ code: string }>(`/student/lessons/${lessonId}/checkin`, { invalidate: ['student'], success: 'Checked in. You’re marked present.' });
  return (
    <section aria-label="Check in" style={{ ...card, padding: 22, gap: 12, background: done ? '#DCF4EA' : '#FFFFFF' }}>
      <h2 style={{ margin: 0, fontFamily: display, fontSize: 17, fontWeight: 700 }}>{done ? 'Checked in ✓' : 'Check in to today’s session'}</h2>
      {!done && (
        <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) check.mutate({ code }); }} style={{ display: 'flex', gap: 8 }}>
          <input inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="4-digit code from class" aria-label="Check-in code" style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${C.border2}`, fontSize: 16, letterSpacing: '0.2em' }} />
          <button disabled={code.length !== 4 || check.isPending} style={{ minHeight: 44, padding: '0 16px', borderRadius: 12, border: 0, background: C.navy, color: C.lime, fontWeight: 600, cursor: 'pointer' }}>Check in</button>
        </form>
      )}
    </section>
  );
}
