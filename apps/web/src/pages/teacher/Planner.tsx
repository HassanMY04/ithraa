import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, Modal, btn, display, field, label as labelStyle } from '../../components/ui';
import { useAction, useGet } from '../../lib/hooks';
import { GroupTabs, h2, textArea } from './common';

type Block = { kind: string; min: number; t: string; d: string; desc?: string; badge?: string };
type Week = { week: number; n: number; t: string; state: 'delivered' | 'next' | 'later'; label: string; lesson_id: number };
type Homework = { id: number; title: string; description: string; due_at: string; due_label: string; points: number; rubric: { c: string; p: number }[]; response_type: string; published: boolean; status_line: string };
type PlannerData = {
  groups: { id: number; name: string }[];
  group_id: number;
  module_label: string;
  weeks: Week[];
  lesson: {
    id: number; week: number; n: number; of: number; title: string; time_label: string; minutes: number;
    published: boolean; updated_after_publish: boolean; blocks: Block[]; skills: { id: number; name: string }[];
    extra_skills: string[]; available_skills: { id: number; name: string }[];
    student_prep: { en: string; ar?: string }[]; slides: number; teacher: string; group_name: string; room: string;
  };
  homework: Homework | null;
  materials: { id: number; kind: string; name: string; line: string; meta: string; is_slides: boolean; has_file: boolean }[];
  automations: { key: string; t: string; d: string; on: boolean }[];
  library: { id: number; title: string; target_week: number; meta: string; used: boolean }[];
  previous: { id: number; title: string; meta: string; blocks: Block[] } | null;
  size: number;
};

const KIND: Record<string, { kind: string; color: string; tint: string; ink: string }> = {
  talk: { kind: 'Discussion', color: '#7B3FF2', tint: '#EFE7FF', ink: '#5A27C2' },
  teach: { kind: 'Slides', color: '#1F6FEB', tint: '#E4EEFF', ink: '#14509E' },
  act: { kind: 'Live activity', color: '#D2461F', tint: '#FFEAE2', ink: '#A8361A' },
  quiz: { kind: 'Exit quiz', color: '#0B7D60', tint: '#DCF4EA', ink: '#0A6B52' },
  wrap: { kind: 'Wrap-up', color: '#8A8DA6', tint: '#F1F2F8', ink: '#3D405C' },
};
const MAT: Record<string, { bg: string; fg: string }> = {
  PDF: { bg: '#FFEAE2', fg: '#A8361A' }, VID: { bg: '#EFE7FF', fg: '#5A27C2' }, DOC: { bg: '#E4EEFF', fg: '#14509E' },
  IMG: { bg: '#DCF4EA', fg: '#0A6B52' }, LINK: { bg: '#F1F2F8', fg: '#3D405C' },
};
const outlineBtn = { minHeight: 46, padding: '0 16px', borderRadius: 14, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' } as const;
const dashedBtn = { minHeight: 40, padding: '0 14px', borderRadius: 12, border: '1.5px dashed #B9BCD3', background: 'transparent', color: C.ink2, fontSize: 14, cursor: 'pointer' } as const;

export default function Planner() {
  const [params, setParams] = useSearchParams();
  const group = params.get('group');
  const week = params.get('week');
  const qs = [group && `group=${group}`, week && `week=${week}`].filter(Boolean).join('&');
  const q = useGet<PlannerData>(`/teacher/planner${qs ? `?${qs}` : ''}`);
  const pick = (g: number, w?: number) => setParams(w ? { group: String(g), week: String(w) } : { group: String(g) });
  return (
    <Shell role="teacher" active="planner" mainStyle={{ gap: 22 }} sidebarExtra={q.data && <ModuleWeeks d={q.data} onPick={(w) => pick(q.data!.group_id, w)} />}>
      <Async q={q}>{(d) => <PlannerBody d={d} onGroup={(g) => pick(g)} />}</Async>
    </Shell>
  );
}

function ModuleWeeks({ d, onPick }: { d: PlannerData; onPick: (w: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ padding: '0 8px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lilac2 }}>{d.module_label}</span>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {d.weeks.map((w) => {
          const sel = w.week === d.lesson.week;
          const look = w.state === 'delivered'
            ? { stColor: C.lilac2, numBg: C.navy3, numFg: C.lilac }
            : w.state === 'next' ? { stColor: C.lime, numBg: C.lime, numFg: C.navy } : { stColor: '#FFB547', numBg: C.navy3, numFg: C.lilac };
          return (
            <li key={w.week}>
              <button onClick={() => onPick(w.week)} aria-current={sel ? 'step' : undefined} style={{ width: '100%', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, cursor: 'pointer', background: sel ? C.navy3 : 'transparent', border: `1.5px solid ${sel ? C.lime : w.state === 'later' ? C.navyLine : 'transparent'}` }}>
                <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 8, background: look.numBg, color: look.numFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{w.n}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: '#FFFFFF', lineHeight: 1.3 }}>{w.t}</span>
                  <span style={{ fontSize: 11, color: look.stColor }}>{w.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PlannerBody({ d, onGroup }: { d: PlannerData; onGroup: (g: number) => void }) {
  const L = d.lesson;
  const [title, setTitle] = useState(L.title);
  const [modal, setModal] = useState<null | 'block' | 'homework' | 'preview' | 'copy' | 'compare' | 'skill'>(null);
  useEffect(() => setTitle(L.title), [L.id, L.title]);
  const save = useAction<Partial<{ title: string; blocks: Block[]; skill_ids: number[]; extra_skills: string[] }>>(`/teacher/lessons/${L.id}`, { method: 'PUT', invalidate: ['teacher'] });
  const publish = useAction<void>(`/teacher/lessons/${L.id}/publish`, { invalidate: ['teacher'], success: 'Saved and published. Students were notified.' });
  const copy = useAction<void>(`/teacher/lessons/${L.id}/copy-previous`, { invalidate: ['teacher'], success: 'Last year’s flow copied into this session' });
  const published = L.published && !L.updated_after_publish;
  const planned = L.blocks.reduce((s, b) => s + b.min, 0);
  const setBlocks = (blocks: Block[]) => save.mutate({ blocks });
  const move = (i: number, dir: -1 | 1) => {
    const b = [...L.blocks];
    const j = i + dir;
    if (j < 0 || j >= b.length) return;
    [b[i], b[j]] = [b[j], b[i]];
    setBlocks(b);
  };
  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Session planner</h1>
          <GroupTabs groups={d.groups} value={d.group_id} onChange={onGroup} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {d.previous && <button onClick={() => setModal('copy')} style={outlineBtn}>Copy from last year</button>}
          <button onClick={() => setModal('preview')} style={outlineBtn}>Preview as student</button>
          <button onClick={() => (title !== L.title ? save.mutate({ title }, { onSuccess: () => publish.mutate() }) : publish.mutate())} disabled={publish.isPending} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: 0, background: published ? C.ok.bg : C.indigo, color: published ? C.ok.fg : '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {published ? 'Saved & published ✓' : 'Save & publish'}
          </button>
        </div>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ padding: '5px 10px', borderRadius: 999, background: C.info.bg, color: C.info.fg, fontSize: 13, fontWeight: 600 }}>Week {L.n} of {L.of}</span>
              <span style={{ padding: '5px 10px', borderRadius: 999, background: C.chip, color: C.ink2, fontSize: 13 }}>{L.time_label}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="sessTitle" style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>Session title</label>
              <input id="sessTitle" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== L.title && save.mutate({ title })} style={{ minHeight: 52, padding: '0 16px', borderRadius: 14, border: `1px solid ${C.border2}`, fontSize: 20, fontWeight: 600, color: C.ink, background: C.white }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>Skills this session builds</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {L.skills.map((s) => (
                  <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.navy, color: '#FFFFFF', fontSize: 13 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="6" cy="5" r="2.5" /><circle cx="18" cy="5" r="2.5" /><circle cx="12" cy="19" r="2.5" /><path d="M6 7.5v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-2" /><path d="M12 12.5v4" />
                    </svg>
                    {s.name}
                    <button aria-label={`Unlink ${s.name}`} onClick={() => save.mutate({ skill_ids: L.skills.filter((x) => x.id !== s.id).map((x) => x.id) })} style={{ border: 0, background: 'none', color: C.lilac, cursor: 'pointer', padding: 0, fontSize: 14 }}>×</button>
                  </span>
                ))}
                {L.extra_skills.map((s) => (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, background: C.chip, color: C.ink2, fontSize: 13 }}>
                    {s}
                    <button aria-label={`Remove ${s}`} onClick={() => save.mutate({ extra_skills: L.extra_skills.filter((x) => x !== s) })} style={{ border: 0, background: 'none', color: C.muted, cursor: 'pointer', padding: 0, fontSize: 14 }}>×</button>
                  </span>
                ))}
                <button onClick={() => setModal('skill')} style={{ ...dashedBtn, minHeight: 34, padding: '0 12px', fontSize: 13 }}>+ Link a skill</button>
              </div>
              <span style={{ fontSize: 12, color: C.muted }}>Grades on this session update these nodes in each student’s knowledge tree.</span>
            </div>
          </section>

          <section style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={h2}>Session flow</h2>
              <span style={{ fontSize: 14, color: planned > L.minutes && L.minutes ? C.warn.ink : C.ink2 }}>
                {planned} of {L.minutes || planned} min planned
              </span>
            </div>
            {L.blocks.length > 0 && (
              <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
                {L.blocks.map((b, i) => <div key={i} style={{ flex: `${b.min} 1 0`, background: (KIND[b.kind] ?? KIND.teach).color }} />)}
                {L.minutes > planned && <div style={{ flex: `${L.minutes - planned} 1 0`, background: C.chip }} />}
              </div>
            )}
            {!L.blocks.length && <span style={{ fontSize: 14, color: C.muted }}>No blocks yet. Add the parts of the session, or copy a plan from the library.</span>}
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {L.blocks.map((b, i) => {
                const k = KIND[b.kind] ?? KIND.teach;
                return (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 14, border: '1px solid #E9EAF3' }}>
                    <span style={{ width: 54, flexShrink: 0, fontSize: 14, fontWeight: 600, color: C.ink2 }}>{b.min} min</span>
                    <span style={{ width: 10, height: 36, flexShrink: 0, borderRadius: 5, background: k.color }} />
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{b.t}</span>
                      <span style={{ fontSize: 13, color: C.muted }}>{b.d}</span>
                    </span>
                    <span style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 8, background: k.tint, color: k.ink, fontSize: 12, fontWeight: 600 }}>{k.kind}</span>
                    <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button aria-label={`Move ${b.t} up`} disabled={i === 0} onClick={() => move(i, -1)} style={iconBtn}>↑</button>
                      <button aria-label={`Move ${b.t} down`} disabled={i === L.blocks.length - 1} onClick={() => move(i, 1)} style={iconBtn}>↓</button>
                      <button aria-label={`Remove ${b.t}`} onClick={() => setBlocks(L.blocks.filter((_, j) => j !== i))} style={iconBtn}>×</button>
                    </span>
                  </li>
                );
              })}
            </ol>
            <button onClick={() => setModal('block')} style={{ ...dashedBtn, alignSelf: 'flex-start' }}>+ Add block</button>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 20 }}>
            <HomeworkCard hw={d.homework} onEdit={() => setModal('homework')} />
            <Materials d={d} />
          </section>
        </div>
        <aside style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Automations d={d} />
          <Library d={d} onCompare={() => setModal('compare')} />
        </aside>
      </div>
      {modal === 'block' && <BlockModal onClose={() => setModal(null)} onAdd={(b) => { setBlocks([...L.blocks, b]); setModal(null); }} />}
      {modal === 'skill' && <SkillModal d={d} onClose={() => setModal(null)} onSave={(v) => { save.mutate(v); setModal(null); }} />}
      {modal === 'homework' && <HomeworkModal lessonId={L.id} hw={d.homework} size={d.size} onClose={() => setModal(null)} />}
      {modal === 'preview' && <PreviewModal d={d} onClose={() => setModal(null)} />}
      {modal === 'copy' && d.previous && (
        <Modal title="Copy from last year" onClose={() => setModal(null)}>
          <span style={{ fontSize: 14, color: C.ink2 }}>{d.previous.title} · {d.previous.meta}. This replaces the {L.blocks.length} blocks in week {L.n} with last year’s {d.previous.blocks.length}.</span>
          <BlockList blocks={d.previous.blocks} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(null)} style={btn.ghost}>Cancel</button>
            <button onClick={() => copy.mutate(undefined, { onSuccess: () => setModal(null) })} style={btn.primary}>Copy the flow</button>
          </div>
        </Modal>
      )}
      {modal === 'compare' && d.previous && (
        <Modal title="Compare with last year" onClose={() => setModal(null)} width={820}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong style={{ fontSize: 14 }}>This year · week {L.n} · {planned} min</strong>
              <BlockList blocks={L.blocks} other={d.previous.blocks} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{d.previous.meta} · {d.previous.blocks.reduce((s, b) => s + b.min, 0)} min</strong>
              <BlockList blocks={d.previous.blocks} other={L.blocks} />
            </div>
          </div>
          <span style={{ fontSize: 13, color: C.muted }}>Highlighted blocks only appear in one version.</span>
        </Modal>
      )}
    </>
  );
}

const iconBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.ink2, cursor: 'pointer', fontSize: 14 } as const;

function BlockList({ blocks, other }: { blocks: Block[]; other?: Block[] }) {
  const titles = new Set((other ?? []).map((b) => b.t));
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {blocks.map((b, i) => {
        const k = KIND[b.kind] ?? KIND.teach;
        const diff = other && !titles.has(b.t);
        return (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${diff ? '#FFB547' : '#E9EAF3'}`, background: diff ? C.warn.bg : C.white }}>
            <span style={{ width: 8, height: 28, borderRadius: 4, background: k.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, width: 48, flexShrink: 0 }}>{b.min} min</span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{b.t}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{b.d}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function HomeworkCard({ hw, onEdit }: { hw: Homework | null; onEdit: () => void }) {
  return (
    <div style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ ...h2, fontSize: 18 }}>Homework</h2>
        {hw && (
          <span style={{ padding: '4px 10px', borderRadius: 999, background: hw.published ? C.ok.bg : C.warn.bg, color: hw.published ? C.ok.ink : C.warn.fg, fontSize: 12, fontWeight: 600 }}>
            {hw.published ? 'Published' : 'Draft'}
          </span>
        )}
      </div>
      {hw ? (
        <>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{hw.title}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[hw.due_label, `${hw.points} pts · ${hw.rubric.length} criteria`, hw.response_type].map((t) => (
              <span key={t} style={{ padding: '6px 10px', borderRadius: 8, background: C.chip, fontSize: 13 }}>{t}</span>
            ))}
          </div>
          <span style={{ fontSize: 13, color: C.muted }}>{hw.status_line}</span>
        </>
      ) : (
        <span style={{ fontSize: 14, color: C.muted }}>No homework set for this session yet.</span>
      )}
      <button onClick={onEdit} style={{ marginTop: 'auto', alignSelf: 'flex-start', minHeight: 40, padding: '0 14px', borderRadius: 12, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>
        {hw ? 'Edit homework' : 'Set homework'}
      </button>
    </div>
  );
}

function Materials({ d }: { d: PlannerData }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useAction<FormData>(`/teacher/lessons/${d.lesson.id}/materials`, { form: true, invalidate: ['teacher'], success: (r) => (r.slides ? 'Slides uploaded and shared with students' : 'File added to the session') });
  const remove = useAction<number>((id) => `/teacher/materials/${id}`, { method: 'DELETE', invalidate: ['teacher'], success: 'File removed' });
  const [drag, setDrag] = useState(false);
  const send = (f: File | undefined) => {
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    upload.mutate(fd);
  };
  return (
    <div style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ ...h2, fontSize: 18 }}>Materials</h2>
        <span style={{ fontSize: 13, color: C.muted }}>{d.materials.length} file{d.materials.length === 1 ? '' : 's'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {d.materials.map((m) => {
          const look = MAT[m.kind] ?? MAT.DOC;
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9, background: look.bg, color: look.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{m.kind}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{m.line}</span>
              <button aria-label={`Remove ${m.name}`} onClick={() => remove.mutate(m.id)} style={iconBtn}>×</button>
            </div>
          );
        })}
      </div>
      <input ref={input} type="file" hidden onChange={(e) => { send(e.target.files?.[0]); e.target.value = ''; }} />
      <button
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files[0]); }}
        disabled={upload.isPending}
        style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 14, borderRadius: 14, border: `2px dashed ${drag ? C.indigo : '#B9BCD3'}`, background: drag ? C.indigoTint : '#FAFAFD', color: C.ink2, fontSize: 14, cursor: 'pointer' }}
      >
        {upload.isPending ? 'Uploading…' : 'Drop files or pick from your computer'}
        <span style={{ fontSize: 12, color: C.muted }}>PDF, slides, images or video · up to 20 MB</span>
      </button>
    </div>
  );
}

function Automations({ d }: { d: PlannerData }) {
  const toggle = useAction<{ key: string; enabled: boolean }>((v) => `/teacher/automations/${v.key}`, { method: 'PUT', invalidate: ['teacher'] });
  return (
    <section style={{ borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lime }}>Automations</span>
        <h2 style={h2}>Let the platform handle it</h2>
      </div>
      {d.automations.map((a) => (
        <div key={a.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '12px 0', borderTop: `1px solid ${C.navy3}` }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{a.t}</span>
            <span style={{ fontSize: 12, color: C.lilac2 }}>{a.d}</span>
          </span>
          <button role="switch" aria-checked={a.on} aria-label={a.t} onClick={() => toggle.mutate({ key: a.key, enabled: !a.on })} style={{ flexShrink: 0, width: 52, height: 30, padding: 3, borderRadius: 15, border: 0, background: a.on ? C.lime : C.navyLine, display: 'flex', justifyContent: a.on ? 'flex-end' : 'flex-start', cursor: 'pointer' }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: a.on ? C.navy : C.lilac }} />
          </button>
        </div>
      ))}
    </section>
  );
}

function Library({ d, onCompare }: { d: PlannerData; onCompare: () => void }) {
  const target = (w: number) => d.weeks.find((x) => x.week === w);
  const use = useAction<{ id: number; lesson_id: number }>((v) => `/teacher/library/${v.id}/use`, { invalidate: ['teacher'], success: (r) => `Added to week ${r.week}` });
  return (
    <section style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ ...h2, fontSize: 18 }}>From the shared library</h2>
      {d.library.map((item) => {
        const t = target(item.target_week);
        return (
          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, background: '#F7F7FC' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</span>
            <span style={{ fontSize: 13, color: C.muted }}>{item.meta}</span>
            {t && (
              <button onClick={() => use.mutate({ id: item.id, lesson_id: t.lesson_id })} style={{ alignSelf: 'flex-start', ...btn.small }}>
                Add to week {t.n}
              </button>
            )}
          </div>
        );
      })}
      {d.previous && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, background: '#F7F7FC' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{d.previous.title}</span>
          <span style={{ fontSize: 13, color: C.muted }}>{d.previous.meta}</span>
          <button onClick={onCompare} style={{ alignSelf: 'flex-start', ...btn.small }}>Compare</button>
        </div>
      )}
      {!d.library.length && !d.previous && <span style={{ fontSize: 14, color: C.muted }}>Nothing shared for this track yet.</span>}
    </section>
  );
}

function BlockModal({ onClose, onAdd }: { onClose: () => void; onAdd: (b: Block) => void }) {
  const [b, setB] = useState<Block>({ kind: 'teach', min: 10, t: '', d: '' });
  return (
    <Modal title="Add a block" onClose={onClose}>
      <label style={labelStyle}>Type
        <select value={b.kind} onChange={(e) => setB({ ...b, kind: e.target.value })} style={field}>
          {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.kind}</option>)}
        </select>
      </label>
      <label style={labelStyle}>Minutes
        <input type="number" min={1} max={180} value={b.min} onChange={(e) => setB({ ...b, min: Number(e.target.value) })} style={field} />
      </label>
      <label style={labelStyle}>Title
        <input value={b.t} onChange={(e) => setB({ ...b, t: e.target.value })} style={field} autoFocus />
      </label>
      <label style={labelStyle}>Details
        <input value={b.d} onChange={(e) => setB({ ...b, d: e.target.value })} placeholder="Teams of 3 · worksheet" style={field} />
      </label>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btn.ghost}>Cancel</button>
        <button disabled={!b.t.trim() || b.min < 1} onClick={() => onAdd(b)} style={btn.primary}>Add block</button>
      </div>
    </Modal>
  );
}

function SkillModal({ d, onClose, onSave }: { d: PlannerData; onClose: () => void; onSave: (v: { skill_ids?: number[]; extra_skills?: string[] }) => void }) {
  const linked = new Set(d.lesson.skills.map((s) => s.id));
  const [ids, setIds] = useState<Set<number>>(linked);
  const [extra, setExtra] = useState('');
  return (
    <Modal title="Link a skill" onClose={onClose}>
      {d.lesson.available_skills.length > 0 && <span style={{ fontSize: 14, color: C.muted }}>Skills from this level’s knowledge tree</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {d.lesson.available_skills.map((s) => (
          <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
            <input type="checkbox" checked={ids.has(s.id)} onChange={() => { const n = new Set(ids); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); setIds(n); }} />
            {s.name}
          </label>
        ))}
      </div>
      <label style={labelStyle}>Other skill (not in the tree)
        <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Teamwork" style={field} />
      </label>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btn.ghost}>Cancel</button>
        <button onClick={() => onSave({ skill_ids: [...ids], ...(extra.trim() ? { extra_skills: [...d.lesson.extra_skills, extra.trim()] } : {}) })} style={btn.primary}>Save skills</button>
      </div>
    </Modal>
  );
}

function defaultDue(): string {
  const d = new Date(Date.now() + 7 * 86400000);
  return `${d.toISOString().slice(0, 10)}T23:59`;
}

function HomeworkModal({ lessonId, hw, size, onClose }: { lessonId: number; hw: Homework | null; size: number; onClose: () => void }) {
  const [f, setF] = useState({
    title: hw?.title ?? '', description: hw?.description ?? '', due_at: hw?.due_at ?? defaultDue(), points: hw?.points ?? 20,
    rubric: hw?.rubric?.length ? hw.rubric : [{ c: '', p: 10 }], response_type: hw?.response_type ?? 'File or photo',
  });
  const save = useAction<typeof f & { publish: boolean }>(`/teacher/lessons/${lessonId}/homework`, { method: 'PUT', invalidate: ['teacher'], success: (_, v) => (v.publish ? `Homework published to ${size} students` : 'Homework saved as a draft') });
  const total = f.rubric.reduce((s, r) => s + (Number(r.p) || 0), 0);
  const submit = (publish: boolean) => save.mutate({ ...f, publish }, { onSuccess: onClose });
  return (
    <Modal title={hw ? 'Edit homework' : 'Set homework'} onClose={onClose} width={640}>
      <label style={labelStyle}>Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={field} /></label>
      <label style={labelStyle}>Instructions<textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} style={textArea} /></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <label style={{ ...labelStyle, flex: '1 1 200px' }}>Due<input type="datetime-local" value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} style={field} /></label>
        <label style={{ ...labelStyle, flex: '1 1 100px' }}>Points<input type="number" min={1} max={100} value={f.points} onChange={(e) => setF({ ...f, points: Number(e.target.value) })} style={field} /></label>
        <label style={{ ...labelStyle, flex: '1 1 160px' }}>Hand in as
          <select value={f.response_type} onChange={(e) => setF({ ...f, response_type: e.target.value })} style={field}>
            {['File or photo', 'Link', 'Written answer'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.ink2 }}>How it’s graded · {total} pts{total !== f.points ? ` (points total ${f.points})` : ''}</span>
        {f.rubric.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <input aria-label={`Criterion ${i + 1}`} value={r.c} onChange={(e) => setF({ ...f, rubric: f.rubric.map((x, j) => (j === i ? { ...x, c: e.target.value } : x)) })} placeholder="At least 5 devices mapped" style={{ ...field, flex: 1 }} />
            <input aria-label={`Points for criterion ${i + 1}`} type="number" min={0} value={r.p} onChange={(e) => setF({ ...f, rubric: f.rubric.map((x, j) => (j === i ? { ...x, p: Number(e.target.value) } : x)) })} style={{ ...field, width: 80 }} />
            <button aria-label={`Remove criterion ${i + 1}`} onClick={() => setF({ ...f, rubric: f.rubric.filter((_, j) => j !== i) })} style={{ ...iconBtn, width: 44, height: 44 }}>×</button>
          </div>
        ))}
        <button onClick={() => setF({ ...f, rubric: [...f.rubric, { c: '', p: 4 }] })} style={{ ...dashedBtn, alignSelf: 'flex-start' }}>+ Add criterion</button>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={onClose} style={btn.ghost}>Cancel</button>
        {!hw?.published && <button disabled={!f.title.trim() || save.isPending} onClick={() => submit(false)} style={btn.ghost}>Save draft</button>}
        <button disabled={!f.title.trim() || save.isPending} onClick={() => submit(true)} style={btn.primary}>{hw?.published ? 'Save changes' : 'Publish to students'}</button>
      </div>
    </Modal>
  );
}

function PreviewModal({ d, onClose }: { d: PlannerData; onClose: () => void }) {
  const L = d.lesson;
  const act = L.blocks.find((b) => b.kind === 'act');
  return (
    <Modal title="Preview as student" onClose={onClose} width={680}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 20, borderRadius: 20, background: '#1F6FEB', color: '#FFFFFF' }}>
        <span style={{ fontSize: 13, opacity: 0.85 }}>{L.group_name} · Week {L.n}</span>
        <span style={{ fontFamily: display, fontSize: 24, fontWeight: 800 }}>{L.title}</span>
        <span style={{ fontSize: 14 }}>{L.time_label} · {L.teacher}</span>
      </div>
      {L.student_prep.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 14 }}>Before you come</strong>
          {L.student_prep.map((p, i) => <span key={i} style={{ fontSize: 14 }}>• {p.en}</span>)}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ fontSize: 14 }}>Materials</strong>
        {d.materials.length ? d.materials.map((m) => <span key={m.id} style={{ fontSize: 14 }}>{m.kind} · {m.name}</span>) : <span style={{ fontSize: 14, color: C.muted }}>No materials yet.</span>}
      </div>
      {act && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 16, borderRadius: 16, background: '#FFEAE2', color: '#A8361A' }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>In class · live activity</span>
          <strong style={{ fontSize: 16, color: C.ink }}>{act.t}</strong>
          <span style={{ fontSize: 14, color: C.ink2 }}>{act.desc ?? act.d}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ fontSize: 14 }}>Homework</strong>
        {d.homework ? (
          <>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{d.homework.title} · {d.homework.points} pts</span>
            <span style={{ fontSize: 13, color: C.muted }}>{d.homework.due_label}{d.homework.published ? '' : ' · not visible until published'}</span>
            <span style={{ fontSize: 14, color: C.ink2 }}>{d.homework.description}</span>
          </>
        ) : <span style={{ fontSize: 14, color: C.muted }}>No homework for this session.</span>}
      </div>
      {!L.published && <span style={{ fontSize: 13, color: C.warn.ink }}>Students see this session once you publish it.</span>}
    </Modal>
  );
}
