import { useState, type CSSProperties } from 'react';
import { C, Modal, btn, display } from '../../components/ui';
import { useMe } from '../../lib/auth';
import { useAction } from '../../lib/hooks';

export const h2: CSSProperties = { margin: 0, fontFamily: display, fontSize: 20, fontWeight: 700 };
export const panel: CSSProperties = { borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 };
export const linkBtn: CSSProperties = { padding: 0, minHeight: 30, border: 0, background: 'none', color: C.indigo, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
export const textArea: CSSProperties = { width: '100%', resize: 'vertical', padding: '12px 14px', borderRadius: 12, border: `1px solid ${C.border2}`, fontSize: 14, lineHeight: 1.5, color: C.ink, background: C.white };

/** "My groups" block for the teacher sidebar; outlines the group of the next session. */
export function MyGroups({ activeGroupId }: { activeGroupId?: number }) {
  const groups = useMe().data?.teacher?.groups ?? [];
  if (!groups.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ padding: '0 8px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.lilac2 }}>My groups</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {groups.map((g) => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', borderRadius: 12, background: C.navy2, fontSize: 14, border: g.id === activeGroupId ? `1.5px solid ${C.lime}` : '1.5px solid transparent' }}>
            <span style={{ color: '#FFFFFF' }}>{g.name}</span>
            <span>{g.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Group tabs used by the planner and gradebook. */
export function GroupTabs({ groups, value, onChange }: { groups: { id: number; name: string }[]; value: number; onChange: (id: number) => void }) {
  return (
    <div role="tablist" aria-label="Group" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {groups.map((g) => {
        const on = g.id === value;
        return (
          <button key={g.id} role="tab" aria-selected={on} onClick={() => onChange(g.id)} style={{ minHeight: 40, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${on ? C.navy : C.border2}`, background: on ? C.navy : C.white, color: on ? '#FFFFFF' : C.ink, fontSize: 14, cursor: 'pointer' }}>
            {g.name}
          </button>
        );
      })}
    </div>
  );
}

export function ParentMessageModal({ student, onClose, prefill }: { student: { student_id: number; name: string; first: string; parent: string; why?: string }; onClose: () => void; prefill?: string }) {
  const me = useMe().data;
  const [text, setText] = useState(
    prefill ?? `Dear ${student.parent}, I wanted to let you know about ${student.first}’s work in our sessions. ${student.why ?? ''} Could we find a moment to talk this week? — ${me?.formal ?? ''}`.replace(/\s+/g, ' '),
  );
  const send = useAction<{ text: string }>(`/teacher/students/${student.student_id}/parent-message`, { invalidate: ['teacher'], success: `Message to ${student.parent} queued` });
  return (
    <Modal title={`Message ${student.parent}`} onClose={onClose}>
      <span style={{ fontSize: 14, color: C.muted }}>Parent of {student.name}. Sent through the school’s messaging service.</span>
      <textarea aria-label="Message" rows={6} value={text} onChange={(e) => setText(e.target.value)} style={textArea} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btn.ghost}>Cancel</button>
        <button disabled={!text.trim() || send.isPending} onClick={() => send.mutate({ text }, { onSuccess: onClose })} style={btn.dark}>Send message</button>
      </div>
    </Modal>
  );
}

export function NoteModal({ student, onClose }: { student: { student_id: number; name: string }; onClose: () => void }) {
  const [text, setText] = useState('');
  const save = useAction<{ text: string }>(`/teacher/students/${student.student_id}/notes`, { invalidate: ['teacher'], success: 'Note saved. The coordinator can see it too.' });
  return (
    <Modal title={`Note on ${student.name}`} onClose={onClose}>
      <span style={{ fontSize: 14, color: C.muted }}>Only teachers and the coordinator can see notes.</span>
      <textarea aria-label="Note" rows={4} value={text} autoFocus onChange={(e) => setText(e.target.value)} style={textArea} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btn.ghost}>Cancel</button>
        <button disabled={!text.trim() || save.isPending} onClick={() => save.mutate({ text }, { onSuccess: onClose })} style={btn.primary}>Save note</button>
      </div>
    </Modal>
  );
}
