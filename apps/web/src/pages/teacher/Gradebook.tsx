import { useEffect, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, Loading, Modal, btn, display, field, useToast } from '../../components/ui';
import { download } from '../../lib/api';
import { useAction, useGet } from '../../lib/hooks';
import { GroupTabs, ParentMessageModal, textArea } from './common';

type Cell = { state: 'score' | 'todo' | 'due' | 'missing'; score?: number; sub_id?: number | null; due?: number; att: string };
type Row = { student_id: number; name: string; cls: string; flag: boolean; quiz: number | null; avg: number | null; cells: Cell[] };
type Book = {
  groups: { id: number; name: string }[];
  group_id: number;
  title: string;
  kpis: { attendance: number | null; hw_avg: number | null; quiz_avg: number | null; skill: string | null; skill_done: number; n: number };
  columns: { assignment_id: number; label: string; title: string; kind: string; due: string }[];
  rows: Row[];
  queue: { submission_id: number; assignment_id: number; student: string; title: string; submitted: string; late: boolean }[];
};
type Student = {
  id: number; name: string; first: string; ini: string; cls: string; since: string; parent: string; attend: string;
  avg: number | null; quiz: number | null; skills: { n: string; st: string; tone: 'ok' | 'warn' | 'info' | 'muted' }[];
  rec: { track_id: string; name: string; on: boolean; grade: number } | null;
  notes: { who: string; text: string; when: string }[]; flags: string[];
};
type SubDetail = { id: number; student: string; title: string; points: number; rubric: { c: string; p: number }[]; file_name: string | null; has_file: boolean; submitted: string | null; late: boolean; score: number | null; feedback: string; status: string };

const TONE = { ok: C.ok.ink, warn: C.warn.ink, info: C.info.fg, muted: C.muted };
const kpiBox: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: 18, borderRadius: 18, background: C.white, border: `1px solid ${C.border}` };
const kpiNum: CSSProperties = { fontFamily: display, fontSize: 28, fontWeight: 800, lineHeight: 1 };
const sectionLabel: CSSProperties = { fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted };

function cellLook(c: Cell) {
  if (c.state === 'missing') return { bg: C.bad.bg, fg: C.bad.fg, txt: '—' };
  if (c.state === 'todo') return { bg: C.indigoTint, fg: '#3A2BD0', txt: 'To grade' };
  if (c.state === 'due') return { bg: 'transparent', fg: C.muted, txt: `Due ${c.due}` };
  const v = c.score ?? 0;
  if (v >= 17) return { bg: C.ok.bg, fg: C.ok.fg, txt: String(v) };
  if (v >= 14) return { bg: C.chip, fg: C.ink, txt: String(v) };
  return { bg: C.warn.bg, fg: C.warn.fg, txt: String(v) };
}

export default function Gradebook() {
  const [params, setParams] = useSearchParams();
  const group = params.get('group');
  const q = useGet<Book>(`/teacher/gradebook${group ? `?group=${group}` : ''}`);
  return (
    <Shell role="teacher" active="gradebook" mainStyle={{ gap: 22 }}>
      <Async q={q}>{(d) => <Body d={d} assignment={Number(params.get('assignment')) || null} onGroup={(g) => setParams({ group: String(g) })} />}</Async>
    </Shell>
  );
}

function Body({ d, assignment, onGroup }: { d: Book; assignment: number | null; onGroup: (g: number) => void }) {
  const toast = useToast();
  const [sel, setSel] = useState<number | null>(d.rows[0]?.student_id ?? null);
  const [grading, setGrading] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!d.rows.some((r) => r.student_id === sel)) setSel(d.rows[0]?.student_id ?? null);
  }, [d.group_id]);
  useEffect(() => {
    if (!assignment) return;
    const first = d.queue.find((x) => x.assignment_id === assignment);
    if (first) setGrading(first.submission_id);
  }, [assignment, d.group_id]);
  const progress = useAction<void>(`/teacher/gradebook/progress?group=${d.group_id}`, { invalidate: ['teacher'], success: (r) => `Progress sent to ${r.count} parents` });
  const cols = `minmax(180px, 1.8fr) repeat(${d.columns.length}, minmax(46px, 1fr)) 64px 64px`;
  const k = d.kpis;
  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Gradebook</h1>
          <span style={{ fontSize: 15, color: '#4A4D68' }}>{d.title}</span>
          {d.groups.length > 1 && <GroupTabs groups={d.groups} value={d.group_id} onChange={onGroup} />}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => download(`/teacher/gradebook/export.xlsx?group=${d.group_id}`, 'gradebook.xlsx').catch((e) => toast(e.message, 'error'))} style={{ minHeight: 46, padding: '0 16px', borderRadius: 14, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>
            Export to Excel
          </button>
          <button onClick={() => setConfirm(true)} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: 0, background: C.indigo, color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Send progress to parents
          </button>
        </div>
      </header>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
        <div style={kpiBox}><span style={{ fontSize: 13, color: C.muted }}>Attendance</span><span style={kpiNum}>{k.attendance ?? '—'}{k.attendance !== null && '%'}</span></div>
        <div style={kpiBox}><span style={{ fontSize: 13, color: C.muted }}>Homework average</span><span style={kpiNum}>{k.hw_avg ?? '—'}<span style={{ fontSize: 16, color: C.muted }}>/20</span></span></div>
        <div style={kpiBox}><span style={{ fontSize: 13, color: C.muted }}>Quiz average</span><span style={kpiNum}>{k.quiz_avg ?? '—'}{k.quiz_avg !== null && '%'}</span></div>
        {k.skill ? (
          <div style={{ ...kpiBox, gap: 8 }}><span style={{ fontSize: 13, color: C.muted }}>{k.skill} mastered</span><span style={kpiNum}>{k.skill_done}<span style={{ fontSize: 16, color: C.muted }}> of {k.n}</span></span></div>
        ) : (
          <div style={{ ...kpiBox, gap: 8 }}><span style={{ fontSize: 13, color: C.muted }}>Waiting for feedback</span><span style={kpiNum}>{d.queue.length}</span></div>
        )}
      </section>
      {d.queue.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 18, borderRadius: 20, background: C.indigoTint }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#3A2BD0' }}>To grade · {d.queue.length}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.queue.map((x) => (
              <button key={x.submission_id} onClick={() => setGrading(x.submission_id)} style={{ ...btn.small, background: x.assignment_id === assignment ? C.navy : C.white, color: x.assignment_id === assignment ? '#FFFFFF' : C.ink, border: 0 }}>
                {x.student} · {x.title.length > 28 ? `${x.title.slice(0, 28)}…` : x.title}{x.late ? ' · late' : ''}
              </button>
            ))}
          </div>
        </section>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <section aria-label="Grades" style={{ flex: '999 1 640px', minWidth: 0, borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: '8px 8px 12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '14px 16px', fontSize: 13, color: C.ink2 }}>
            {[[C.ok.bg, '17–20'], [C.chip, '14–16'], [C.warn.bg, 'Below 14'], [C.bad.bg, 'Missing'], [C.indigoTint, 'To grade']].map(([bg, t]) => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: bg }} />{t}</span>
            ))}
            <span>Small label under a score: late or absent that week</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div role="table" aria-label={`${d.title} grades`} style={{ minWidth: 330 + d.columns.length * 52, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, padding: '6px 8px', color: C.muted, fontSize: 12, fontWeight: 600 }}>
                <span role="columnheader" style={{ paddingLeft: 4 }}>Student</span>
                {d.columns.map((c) => <span key={c.assignment_id} role="columnheader" title={`${c.title} · ${c.due}`} style={{ textAlign: 'center' }}>{c.label}</span>)}
                <span role="columnheader" style={{ textAlign: 'center' }}>Quizzes</span>
                <span role="columnheader" style={{ textAlign: 'right', paddingRight: 4 }}>Average</span>
              </div>
              {d.rows.map((r) => {
                const on = r.student_id === sel;
                return (
                  <div key={r.student_id} role="row" style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, alignItems: 'center', padding: '3px 8px', borderRadius: 12, background: on ? C.indigoTint : C.white }}>
                    <span role="rowheader">
                      <button onClick={() => setSel(r.student_id)} aria-pressed={on} style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, padding: 4, border: 0, background: 'transparent', color: C.ink, textAlign: 'left', cursor: 'pointer' }}>
                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</span>
                          <span style={{ fontSize: 12, color: C.muted }}>{r.cls}</span>
                        </span>
                        {r.flag && <span style={{ padding: '3px 8px', borderRadius: 999, background: C.warn.bg, color: C.warn.ink, fontSize: 11, fontWeight: 600 }}>Check in</span>}
                      </button>
                    </span>
                    {r.cells.map((c, i) => {
                      const look = cellLook(c);
                      const style: CSSProperties = { height: 44, borderRadius: 10, background: look.bg, color: look.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 600, lineHeight: 1.1, border: c.state === 'due' ? `1.5px dashed ${C.border2}` : 0, fontSize: c.state === 'score' || c.state === 'missing' ? 14 : 12 };
                      const inner = (<><span>{look.txt}</span>{c.att && <span style={{ fontSize: 10, fontWeight: 500 }}>{c.att}</span>}</>);
                      return c.state === 'todo' || (c.state === 'score' && c.sub_id) ? (
                        <button key={i} role="cell" onClick={() => setGrading(c.sub_id!)} aria-label={`${r.name} ${d.columns[i].label}: ${c.state === 'todo' ? 'to grade' : look.txt}`} style={{ ...style, cursor: 'pointer' }}>{inner}</button>
                      ) : (
                        <span key={i} role="cell" style={style}>{inner}</span>
                      );
                    })}
                    <span role="cell" style={{ textAlign: 'center', fontWeight: 600, color: r.quiz !== null && r.quiz < 65 ? C.warn.ink : C.ink }}>{r.quiz ?? '—'}{r.quiz !== null && '%'}</span>
                    <span role="cell" style={{ textAlign: 'right', fontWeight: 700, paddingRight: 4 }}>{r.avg ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        {sel && <StudentPanel groupId={d.group_id} studentId={sel} />}
      </div>
      {grading && <GradeModal id={grading} onClose={() => setGrading(null)} />}
      {confirm && (
        <Modal title="Send progress to parents" onClose={() => setConfirm(false)}>
          <span style={{ fontSize: 15, color: C.ink2 }}>Each parent of the {d.rows.length} students in this group gets a short message with their child’s attendance, homework average, quiz average and any missing work.</span>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirm(false)} style={btn.ghost}>Cancel</button>
            <button disabled={progress.isPending} onClick={() => progress.mutate(undefined, { onSuccess: () => setConfirm(false) })} style={btn.primary}>Send to {d.rows.length} parents</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function StudentPanel({ groupId, studentId }: { groupId: number; studentId: number }) {
  const q = useGet<Student>(`/teacher/gradebook/students/${studentId}?group=${groupId}`);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(false);
  const saveNote = useAction<{ text: string }>(`/teacher/students/${studentId}/notes`, { invalidate: ['teacher'], success: 'Note saved. The coordinator can see it too.' });
  const rec = useAction<{ track_id: string }>(`/teacher/students/${studentId}/recommend`, { invalidate: ['teacher'], success: (r) => (r.on ? 'Recommendation saved — it now counts toward the student’s match' : 'Recommendation removed') });
  useEffect(() => setNote(''), [studentId]);
  const box: CSSProperties = { flex: '1 1 320px', minWidth: 0, borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 };
  if (q.isLoading || !q.data) return <aside aria-label="Selected student" style={box}><Loading /></aside>;
  const s = q.data;
  return (
    <aside aria-label="Selected student" style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: C.indigo, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{s.ini}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: display, fontSize: 22, fontWeight: 700 }}>{s.name}</span>
          <span style={{ fontSize: 13, color: C.muted }}>{s.cls} · {s.since}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {[[s.attend, 'attended'], [s.avg ?? '—', 'homework'], [s.quiz !== null ? `${s.quiz}%` : '—', 'quizzes']].map(([v, l]) => (
          <div key={String(l)} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 12, borderRadius: 12, background: '#F7F7FC' }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{v}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
          </div>
        ))}
      </div>
      {s.flags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, borderRadius: 12, background: C.warn.bg, color: C.warn.fg, fontSize: 13 }}>
          {s.flags.map((f) => <span key={f}>{f}</span>)}
        </div>
      )}
      {s.skills.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={sectionLabel}>Skills this level</span>
          {s.skills.map((k) => (
            <div key={k.n} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
              <span>{k.n}</span>
              <span style={{ fontWeight: 500, color: TONE[k.tone] }}>{k.st}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="tNote" style={sectionLabel}>Private note</label>
        <textarea id="tNote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only teachers and the coordinator can see this" style={{ ...textArea, padding: 12 }} />
        {note.trim() && (
          <button onClick={() => saveNote.mutate({ text: note }, { onSuccess: () => setNote('') })} disabled={saveNote.isPending} style={{ ...btn.small, alignSelf: 'flex-start' }}>Save note</button>
        )}
        {s.notes.map((n, i) => (
          <div key={i} style={{ fontSize: 13, color: C.ink2, lineHeight: 1.45 }}>
            <span style={{ color: C.muted }}>{n.who} · {n.when}: </span>{n.text}
          </div>
        ))}
      </div>
      {s.rec && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 16, background: C.navy, color: '#FFFFFF' }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lime }}>Specialization input</span>
          <span style={{ fontSize: 14, lineHeight: 1.5, color: '#DAD8F2' }}>
            Your recommendation counts for 20% of this student’s match{s.rec.grade <= 9 ? ` in Grade ${s.rec.grade}` : ''}.
          </span>
          <button onClick={() => rec.mutate({ track_id: s.rec!.track_id })} disabled={rec.isPending} style={{ minHeight: 44, borderRadius: 12, border: 0, background: s.rec.on ? C.lime : C.navy3, color: s.rec.on ? C.navy : '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {s.rec.on ? `Recommended for ${s.rec.name} ✓` : `Recommend for ${s.rec.name}`}
          </button>
        </div>
      )}
      <button onClick={() => setMsg(true)} style={{ minHeight: 44, borderRadius: 12, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>Message parent</button>
      {msg && <ParentMessageModal student={{ student_id: s.id, name: s.name, first: s.first, parent: s.parent }} onClose={() => setMsg(false)} />}
    </aside>
  );
}

function GradeModal({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast();
  const q = useGet<SubDetail>(`/teacher/submissions/${id}`);
  const [score, setScore] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [portfolio, setPortfolio] = useState(false);
  useEffect(() => {
    if (q.data) {
      setScore(q.data.score !== null ? String(q.data.score) : '');
      setFeedback(q.data.feedback);
    }
  }, [q.data?.id]);
  const grade = useAction<{ score: number; feedback: string; portfolio: boolean }>(`/teacher/submissions/${id}/grade`, {
    invalidate: ['teacher'],
    success: (r) => (r.portfolio ? 'Graded and added to the portfolio. The student was notified.' : 'Graded. The student was notified.'),
  });
  const s = q.data;
  const n = Number(score);
  const valid = score !== '' && Number.isFinite(n) && s && n >= 0 && n <= s.points;
  return (
    <Modal title={s ? `${s.student} · ${s.title}` : 'Grade'} onClose={onClose} width={600}>
      {!s ? <Loading /> : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 14, color: C.ink2 }}>
            <span>{s.submitted ? `Submitted ${s.submitted}${s.late ? ' · late' : ' · on time'}` : 'Not submitted'}</span>
            {s.has_file ? (
              <button onClick={() => download(`/files/submission/${s.id}`, s.file_name ?? 'submission').catch((e) => toast(e.message, 'error'))} style={btn.small}>Open {s.file_name}</button>
            ) : s.file_name && <span style={{ color: C.muted }}>{s.file_name} (no file stored)</span>}
          </div>
          {s.rubric.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 14, background: '#F7F7FC' }}>
              <span style={sectionLabel}>Rubric</span>
              {s.rubric.map((r) => (
                <div key={r.c} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}><span>{r.c}</span><span style={{ fontWeight: 600 }}>{r.p} pts</span></div>
              ))}
            </div>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: C.ink2 }}>
            Score out of {s.points}
            <input type="number" min={0} max={s.points} value={score} autoFocus onChange={(e) => setScore(e.target.value)} style={{ ...field, maxWidth: 140 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: C.ink2 }}>
            Feedback
            <textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, and one thing to improve" style={textArea} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <input type="checkbox" checked={portfolio} onChange={(e) => setPortfolio(e.target.checked)} />
            Add to the student’s portfolio
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btn.ghost}>Cancel</button>
            <button disabled={!valid || grade.isPending} onClick={() => grade.mutate({ score: n, feedback, portfolio }, { onSuccess: onClose })} style={btn.primary}>
              {s.status === 'graded' ? 'Update grade' : 'Save grade'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
