import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shell } from '../../components/Shell';
import { Async, C, LangSwitch, Modal, NotificationsButton, UserChip, btn, display, field, useToast } from '../../components/ui';
import { download } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { useAction, useGet } from '../../lib/hooks';

type Tone = 'amber' | 'blue' | 'green';
type HomeData = {
  date: string;
  greeting: string;
  user: { name: string; initials: string; sub: string; color: string };
  next: null | { lesson_id: number; when: string; place: string; context: string; title: string; teacher: string; prep: { text: string; done: boolean }[] };
  year: { week: number; total: number; streak: number; streak_note: string };
  badges: { short: string; name: string; color: string }[];
  next_badge: null | { name: string; done: number; total: number; pct: number; hint: string; color: string };
  todos: { kind: string; title: string; meta: string; status: string; tone: Tone; href: string }[];
  tips: { id: number; teacher_id: number; color: string; initials: string; name: string; short: string; course: string; when: string; text: string; saved: boolean }[];
  new_tips: number;
  tracks: { id: string; name: string; state: string; color: string; tint: string; ink: string; cells: { label: string; state: string }[] }[];
  spec: { title: string; matches: { name: string; score: number }[]; note: string };
};

export const PILL: Record<Tone, { bg: string; fg: string }> = {
  amber: { bg: '#FFF1DE', fg: '#8A4600' },
  blue: { bg: '#E4EEFF', fg: '#14509E' },
  green: { bg: '#DCF4EA', fg: '#0A6B52' },
};

const T = {
  en: {
    before: 'Before you come', open: 'Open session', cal: 'Add to calendar', year: 'This year',
    week: (w: number, t: number) => `Week ${w} of ${t}`, weeks: (n: number) => `${n} weeks`,
    badges: (n: number) => `Badges earned · ${n}`, nextBadge: (n: string) => `Next badge: ${n}`, todo: 'To do',
    all: 'All work', tips: 'Tips from your teachers', fresh: (n: number) => `${n} new`, ask: 'Ask a question',
    save: 'Save', saved: 'Saved', tree: 'Knowledge tree', fullTree: 'Open full tree', spec: 'Specialization match',
    seeAll: 'See all tracks and what they lead to', noSession: 'No sessions scheduled yet', noTodo: 'Nothing due. Nice.',
    noTips: 'No tips from your teachers yet.', askTitle: (n: string) => `Ask ${n} a question`, send: 'Send question',
    sent: 'Question sent. Your teacher will reply in class or on the platform.', placeholder: 'Type your question…',
  },
  ar: {
    before: 'قبل أن تأتي', open: 'افتح الحصة', cal: 'أضف إلى التقويم', year: 'هذه السنة',
    week: (w: number, t: number) => `الأسبوع ${w} من ${t}`, weeks: (n: number) => `${n} أسبوعًا`,
    badges: (n: number) => `الشارات المكتسبة · ${n}`, nextBadge: (n: string) => `الشارة التالية: ${n}`, todo: 'المهام',
    all: 'كل الأعمال', tips: 'نصائح من معلّميك', fresh: (n: number) => (n === 2 ? '2 جديدتان' : `${n} جديدة`),
    ask: 'اطرح سؤالًا', save: 'حفظ', saved: 'محفوظ', tree: 'شجرة المعرفة', fullTree: 'افتح الشجرة كاملة',
    spec: 'مطابقة التخصص', seeAll: 'اطّلع على كل المسارات وإلى أين تقود', noSession: 'لا توجد حصص قادمة بعد',
    noTodo: 'لا مهام مستحقة.', noTips: 'لا توجد نصائح بعد.', askTitle: (n: string) => `اطرح سؤالًا على ${n}`,
    send: 'أرسل السؤال', sent: 'أُرسل السؤال.', placeholder: 'اكتب سؤالك…',
  },
};

const h2 = (ar: boolean) => ({ margin: 0, fontFamily: ar ? undefined : display, fontSize: 20, fontWeight: 700 }) as const;
const panel = { borderRadius: 24, background: '#FFFFFF', border: '1px solid #E3E5EF', padding: 26, display: 'flex', flexDirection: 'column', gap: 16 } as const;

export default function Home({ lang = 'en' }: { lang?: 'en' | 'ar' }) {
  const ar = lang === 'ar';
  const q = useGet<HomeData>(`/student/home?lang=${lang}`);
  const me = useMe().data;
  const nav = useNavigate();
  return (
    <Shell role="student" active="home" lang={lang}>
      <Async q={q}>{(d) => <Body d={d} ar={ar} unread={me?.unread ?? 0} onLang={(l) => nav(l === 'ar' ? '/student/ar' : '/student')} />}</Async>
    </Shell>
  );
}

function Body({ d, ar, unread, onLang }: { d: HomeData; ar: boolean; unread: number; onLang: (l: 'en' | 'ar') => void }) {
  const t = T[ar ? 'ar' : 'en'];
  const toast = useToast();
  const [asking, setAsking] = useState<HomeData['tips'][number] | null>(null);
  const save = useAction<number>((id) => `/student/tips/${id}/save`, { invalidate: ['student', 'home'] });
  const side = ar ? 'left' : 'right';

  return (
    <>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 14, color: C.muted }}>{d.date}</span>
          <h1 style={ar ? { margin: 0, fontSize: 34, fontWeight: 700 } : { margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>{d.greeting}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LangSwitch lang={ar ? 'ar' : 'en'} onChange={onLang} />
          <NotificationsButton unread={unread} dir={ar ? 'rtl' : 'ltr'} />
          <UserChip initials={d.user.initials} name={d.user.name} sub={d.user.sub} color={d.user.color} />
        </div>
      </header>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '999 1 520px', minWidth: 0, position: 'relative', overflow: 'hidden', borderRadius: 24, background: C.indigo, color: '#FFFFFF', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div aria-hidden="true" style={{ position: 'absolute', [side]: -80, top: -80, width: 320, height: 320, borderRadius: '50%', border: '40px solid #5D4DF7' }} />
          <div aria-hidden="true" style={{ position: 'absolute', [side]: 40, bottom: -120, width: 220, height: 220, borderRadius: '50%', border: '28px solid #5D4DF7' }} />
          {d.next ? (
            <>
              <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <span style={{ padding: '6px 12px', borderRadius: 999, background: C.lime, color: C.navy, fontSize: 13, fontWeight: 600 }}>{d.next.when}</span>
                <span style={{ padding: '6px 12px', borderRadius: 999, background: '#3A2BD0', fontSize: 13 }}>{d.next.place}</span>
              </div>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 14, color: '#DCD8FF' }}>{d.next.context}</span>
                <h2 style={ar ? { margin: 0, fontSize: 32, fontWeight: 700, lineHeight: 1.3, textWrap: 'balance' } as CSSProperties : { margin: 0, fontFamily: display, fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, textWrap: 'balance' } as CSSProperties}>
                  {d.next.title}
                </h2>
                <span style={{ fontSize: 15, color: '#DCD8FF' }}>{d.next.teacher}</span>
              </div>
              {d.next.prep.length > 0 && (
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px', borderRadius: 16, background: '#3A2BD0', maxWidth: 560 }}>
                  <span style={ar ? { fontSize: 14, fontWeight: 600, color: C.lime } : { fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.lime }}>{t.before}</span>
                  {d.next.prep.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                      {p.done ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Done"><path d="m5 12 4 4 10-10" /></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DCD8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>
                      )}
                      {p.text}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link to={`/student/session/${d.next.lesson_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '0 22px', borderRadius: 14, background: C.lime, color: C.navy, textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>
                  {t.open}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: ar ? 'scaleX(-1)' : undefined }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
                <button
                  onClick={() => download(`/student/lessons/${d.next!.lesson_id}/calendar.ics`, 'ithraa-session.ics').catch((e) => toast(e.message, 'error'))}
                  style={{ minHeight: 48, padding: '0 20px', borderRadius: 14, border: '1.5px solid #8F84FF', background: 'transparent', color: '#FFFFFF', fontSize: 15, cursor: 'pointer' }}
                >
                  {t.cal}
                </button>
              </div>
            </>
          ) : (
            <h2 style={{ position: 'relative', margin: 0, fontFamily: ar ? undefined : display, fontSize: 28, fontWeight: 800 }}>{t.noSession}</h2>
          )}
        </div>

        <div style={{ flex: '1 1 300px', minWidth: 0, ...panel, gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={h2(ar)}>{t.year}</h2>
            <span style={{ fontSize: 13, color: C.muted }}>{t.week(d.year.week, d.year.total)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FFF1DE', color: '#B35A00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z" /></svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={ar ? { fontSize: 26, fontWeight: 700, lineHeight: 1.2 } : { fontFamily: display, fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{t.weeks(d.year.streak)}</span>
              <span style={{ fontSize: 14, color: C.muted }}>{d.year.streak_note}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t.badges(d.badges.length)}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {d.badges.map((b, i) => (
                <div key={i} title={b.name} style={{ width: 40, height: 40, borderRadius: 12, background: b.color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{b.short}</div>
              ))}
            </div>
          </div>
          {d.next_badge && (
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 14, background: C.bg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{t.nextBadge(d.next_badge.name)}</span>
                <span style={{ color: C.muted }}>{d.next_badge.done} / {d.next_badge.total}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
                <div style={{ width: `${d.next_badge.pct}%`, height: '100%', borderRadius: 4, background: d.next_badge.color }} />
              </div>
              <span style={{ fontSize: 13, color: C.muted }}>{d.next_badge.hint}</span>
            </div>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 20 }}>
        <div style={panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={h2(ar)}>{t.todo}</h2>
            <Link to="/student/session" style={{ fontSize: 14, fontWeight: 500 }}>{t.all}</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.todos.length === 0 && <span style={{ fontSize: 14, color: C.muted }}>{t.noTodo}</span>}
            {d.todos.map((td, i) => (
              <Link key={i} to={td.href} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, border: `1px solid ${C.border}`, color: C.ink, textDecoration: 'none' }}>
                <div style={{ width: ar ? 52 : 46, height: 46, flexShrink: 0, borderRadius: 12, background: '#E4EEFF', color: '#1F6FEB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{td.kind}</div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{td.title}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{td.meta}</span>
                </div>
                <span style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: PILL[td.tone].bg, color: PILL[td.tone].fg }}>{td.status}</span>
              </Link>
            ))}
          </div>
        </div>
        <div style={panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={h2(ar)}>{t.tips}</h2>
            {d.new_tips > 0 && <span style={{ padding: '4px 10px', borderRadius: 999, background: C.indigoTint, color: '#3A2BD0', fontSize: 12, fontWeight: 600 }}>{t.fresh(d.new_tips)}</span>}
          </div>
          {d.tips.length === 0 && <span style={{ fontSize: 14, color: C.muted }}>{t.noTips}</span>}
          {d.tips.map((tip) => (
            <div key={tip.id} style={{ display: 'flex', gap: 14, padding: 16, borderRadius: 16, background: '#F7F7FC' }}>
              <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', background: tip.color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600 }}>{tip.initials}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{tip.name}</span>
                  <span style={{ fontSize: 13, color: C.muted }}>{tip.course} · {tip.when}</span>
                </div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#2B2D45' }}>{tip.text}</p>
                <div style={{ display: 'flex', gap: 16 }}>
                  <button onClick={() => setAsking(tip)} style={{ padding: 0, border: 0, background: 'none', color: C.indigo, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 28 }}>{t.ask}</button>
                  <button aria-pressed={tip.saved} onClick={() => save.mutate(tip.id)} style={{ padding: 0, border: 0, background: 'none', color: tip.saved ? C.ok.ink : C.muted, fontSize: 13, fontWeight: tip.saved ? 600 : 400, cursor: 'pointer', minHeight: 28 }}>
                    {tip.saved ? `${t.saved} ✓` : t.save}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '999 1 520px', minWidth: 0, ...panel, gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={h2(ar)}>{t.tree}</h2>
            <Link to="/student/tree" style={{ fontSize: 14, fontWeight: 500 }}>{t.fullTree}</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
            {d.tracks.map((tr) => (
              <div key={tr.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 16, background: tr.tint }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{tr.name}</span>
                  <span style={{ fontSize: 13, color: C.ink2 }}>{tr.state}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                  {tr.cells.map((c, i) => (
                    <div key={i} style={c.state === 'done'
                      ? { height: 34, borderRadius: 10, background: tr.color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }
                      : { height: 34, borderRadius: 10, background: '#FFFFFF', color: tr.ink, border: `2px dashed ${tr.color}`, opacity: c.state === 'next' ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Link to="/student/specialization" style={{ flex: '1 1 300px', minWidth: 0, borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 26, display: 'flex', flexDirection: 'column', gap: 16, textDecoration: 'none' }}>
          <span style={ar ? { fontSize: 14, fontWeight: 600, color: C.lime } : { fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.lime }}>{t.spec}</span>
          <span style={{ fontFamily: ar ? undefined : display, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{d.spec.title}</span>
          {d.spec.note && <span style={{ fontSize: 14, color: C.lilac }}>{d.spec.note}</span>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.spec.matches.map((m) => (
              <div key={m.name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>{m.name}</span>
                  <span style={{ color: C.lilac }}>{m.score}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#2F2A6B', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${m.score}%`, borderRadius: 3, background: C.lime }} />
                </div>
              </div>
            ))}
          </div>
          <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: C.lime }}>
            {t.seeAll}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: ar ? 'scaleX(-1)' : undefined }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </Link>
      </section>

      {asking && (
        <AskModal
          title={t.askTitle(ar ? asking.name : asking.short)}
          send={t.send} sent={t.sent} placeholder={t.placeholder}
          teacherId={asking.teacher_id} context={`Tip: ${asking.text.slice(0, 120)}`}
          onClose={() => setAsking(null)}
        />
      )}
    </>
  );
}

export function AskModal({ title, teacherId, context, onClose, send = 'Send question', sent = 'Question sent. Your teacher will reply in class or on the platform.', placeholder = 'Type your question…' }: {
  title: string; teacherId: number; context: string; onClose: () => void; send?: string; sent?: string; placeholder?: string;
}) {
  const [text, setText] = useState('');
  const ask = useAction<{ teacher_id: number; text: string; context: string }>('/student/questions', { success: sent });
  return (
    <Modal title={title} onClose={onClose}>
      <textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} style={{ ...field, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btn.ghost}>Cancel</button>
        <button disabled={!text.trim() || ask.isPending} onClick={() => ask.mutate({ teacher_id: teacherId, text, context }, { onSuccess: onClose })} style={{ ...btn.primary, opacity: text.trim() ? 1 : 0.5 }}>
          {send}
        </button>
      </div>
    </Modal>
  );
}
