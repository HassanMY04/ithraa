import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { Async, C, Modal, btn, display, field, useToast } from '../../components/ui';
import { useAction, useGet } from '../../lib/hooks';

export type PortfolioData = {
  student: { name: string; initials: string; color: string; line: string; bio: string };
  skills: { name: string; n: number; tint: string; ink: string }[];
  visibility: { key: string; label: string };
  token: string | null;
  filters: { id: string; label: string; n: number }[];
  items: {
    id: number; track: string; title: string; kind: string; meta: string; score: string; feedback: string;
    teacher: string; featured: boolean; art: number[]; color: string; tint: string; ink: string;
  }[];
};

const NEXT_VISIBILITY: Record<string, string> = {
  teachers_parents: 'teachers_only',
  teachers_only: 'public_link',
  public_link: 'teachers_parents',
};

export default function Portfolio() {
  const q = useGet<PortfolioData>('/student/portfolio');
  return (
    <Shell role="student" active="portfolio" mainStyle={{ gap: 24 }}>
      <Async q={q}>{(d) => <PortfolioView d={d} />}</Async>
    </Shell>
  );
}

/** The portfolio body; `readOnly` is the public, shared version. */
export function PortfolioView({ d, readOnly = false }: { d: PortfolioData; readOnly?: boolean }) {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(d.student.bio);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const update = useAction<{ bio?: string; visibility?: string }>('/student/portfolio', { method: 'PATCH', invalidate: ['student', 'portfolio'] });
  const share = useAction<void, { token: string; path: string }>('/student/portfolio/share', { invalidate: ['student', 'portfolio'] });
  const first = d.student.name.split(' ')[0];
  const items = d.items.filter((p) => filter === 'all' || p.track === filter);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast('Copy the link from the box');
    }
  };

  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Portfolio</h1>
          <p style={{ margin: 0, fontSize: 16, color: '#4A4D68' }}>
            {readOnly ? `${d.student.name}’s best work from Ithraa.` : 'Your best work from all six years, ready to share with universities.'}
          </p>
        </div>
        <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 46, padding: '0 18px', borderRadius: 14, border: `1px solid ${C.border2}`, background: '#FFFFFF', color: C.ink, fontSize: 14, cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
            Export PDF
          </button>
          {!readOnly && (
            <button
              onClick={() => share.mutate(undefined, { onSuccess: (r) => setShareUrl(`${window.location.origin}${r.path}`) })}
              disabled={share.isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 46, padding: '0 18px', borderRadius: 14, border: 0, background: C.indigo, color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
              Share link
            </button>
          )}
        </div>
      </header>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '999 1 480px', minWidth: 0, borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 28, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
          <div style={{ width: 96, height: 96, borderRadius: 28, background: C.lime, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: display, fontSize: 36, fontWeight: 800 }}>{d.student.initials}</div>
          <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontFamily: display, fontSize: 26, fontWeight: 700 }}>{d.student.name}</span>
            <span style={{ fontSize: 14, color: C.lilac }}>{d.student.line}</span>
            {d.student.bio && <p style={{ margin: '4px 0 0', fontSize: 15, lineHeight: 1.55, color: '#E6E4F8' }}>“{d.student.bio}”</p>}
            {!readOnly && (
              <button onClick={() => { setBio(d.student.bio); setEditing(true); }} className="no-print" style={{ alignSelf: 'flex-start', padding: 0, border: 0, background: 'none', fontSize: 12, color: C.lilac2, cursor: 'pointer', textDecoration: 'underline' }}>
                {d.student.bio ? `Written by ${first} · edit any time` : 'Add a few words about yourself'}
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0, borderRadius: 24, background: '#FFFFFF', border: `1px solid ${C.border}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ margin: 0, fontFamily: display, fontSize: 18, fontWeight: 700 }}>Top skills, with proof</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.skills.length === 0 && <span style={{ fontSize: 14, color: C.muted }}>Skills appear here as projects are added.</span>}
            {d.skills.map((s) => (
              <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, background: s.tint, color: s.ink, fontSize: 13, fontWeight: 500 }}>
                {s.name}
                <span style={{ opacity: 0.75 }}>· {s.n}</span>
              </span>
            ))}
          </div>
          {!readOnly && (
            <div className="no-print" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 12, borderTop: '1px solid #E9EAF3' }}>
              <span style={{ fontSize: 13, color: C.ink2 }}>{d.visibility.label}</span>
              <button
                onClick={() => update.mutate({ visibility: NEXT_VISIBILITY[d.visibility.key] ?? 'teachers_parents' })}
                style={{ minHeight: 36, padding: '0 12px', borderRadius: 10, border: `1px solid ${C.border2}`, background: '#FFFFFF', fontSize: 13, color: C.ink, cursor: 'pointer' }}
              >
                Change
              </button>
            </div>
          )}
        </div>
      </section>

      <div role="tablist" aria-label="Filter by track" className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {d.filters.map((f) => {
          const on = f.id === filter;
          return (
            <button key={f.id} role="tab" aria-selected={on} onClick={() => setFilter(f.id)} style={{ minHeight: 42, padding: '0 16px', borderRadius: 12, border: `1.5px solid ${on ? C.navy : C.border2}`, background: on ? C.navy : '#FFFFFF', color: on ? '#FFFFFF' : C.ink, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              {f.label} · {f.n}
            </button>
          );
        })}
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20 }}>
        {items.length === 0 && <span style={{ fontSize: 15, color: C.muted }}>No projects in this track yet.</span>}
        {items.map((p) => (
          <article key={p.id} style={{ borderRadius: 22, background: '#FFFFFF', border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', breakInside: 'avoid' }}>
            <div style={{ height: 150, background: p.tint, position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden="true" style={{ position: 'absolute', left: `${p.art[0] ?? 56}%`, top: 24, width: 110, height: 110, borderRadius: 28, background: p.color, transform: 'rotate(12deg)' }} />
              <div aria-hidden="true" style={{ position: 'absolute', left: `${p.art[1] ?? 30}%`, top: 60, width: 76, height: 76, borderRadius: '50%', border: `14px solid ${p.color}`, opacity: 0.45 }} />
              <span style={{ position: 'absolute', left: 16, top: 16, padding: '5px 10px', borderRadius: 8, background: '#FFFFFF', color: p.ink, fontSize: 12, fontWeight: 600 }}>{p.kind}</span>
              {p.featured && (
                <span style={{ position: 'absolute', right: 16, top: 16, padding: '5px 10px', borderRadius: 8, background: C.navy, color: C.lime, fontSize: 12, fontWeight: 600 }}>Featured</span>
              )}
            </div>
            <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{p.title}</h3>
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#0A6B52' }}>{p.score}</span>
              </div>
              <span style={{ fontSize: 13, color: C.muted }}>{p.meta}</span>
              {p.feedback && (
                <p style={{ margin: 0, padding: 12, borderRadius: 12, background: '#F7F7FC', fontSize: 13, lineHeight: 1.5, color: '#2B2D45' }}>
                  “{p.feedback}” <span style={{ color: C.muted }}>— {p.teacher}</span>
                </p>
              )}
            </div>
          </article>
        ))}
      </section>

      {editing && (
        <Modal title="About you" onClose={() => setEditing(false)}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: C.ink2 }}>
            A few sentences universities will read first
            <textarea rows={4} maxLength={600} value={bio} onChange={(e) => setBio(e.target.value)} style={{ ...field, resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={btn.ghost}>Cancel</button>
            <button onClick={() => update.mutate({ bio }, { onSuccess: () => { setEditing(false); toast('Saved'); } })} disabled={update.isPending} style={btn.primary}>Save</button>
          </div>
        </Modal>
      )}
      {shareUrl && (
        <Modal title="Share your portfolio" onClose={() => setShareUrl(null)}>
          <p style={{ margin: 0, fontSize: 15, color: C.ink2, lineHeight: 1.5 }}>
            Anyone with this link can view your portfolio. Use “Change” to make it private again.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} aria-label="Portfolio link" style={{ ...field, flex: 1, minWidth: 0 }} />
            <button onClick={() => copy(shareUrl)} style={btn.primary}>Copy</button>
          </div>
        </Modal>
      )}
    </>
  );
}
