import { useState } from 'react';
import { Shell } from '../../components/Shell';
import { Async, C, display } from '../../components/ui';
import { useAction, useGet } from '../../lib/hooks';
import { useMe } from '../../lib/auth';

type Course = { key: string; name: string; teacher: string; room: string; kind: string; warn: boolean };
type Row =
  | { kind: 'break'; time: string; mins: number }
  | { kind: 'session' | 'short'; index: number; time: string; label: string; from: number; to: number; cells: (Course | null)[] };
type Timing = { start: number; end: number; sess: number; brk: number; per: number };
type ScheduleData = {
  week: number; total_weeks: number; label: string; custom: boolean; default: Timing; override: Timing | null;
  note: string | null; pattern: string; summary: string;
  days: { id: string; label: string; short: string; date: string; group: string; n: number; grade_key: string }[];
  rows: Row[];
  options: Record<string, { key: string; name: string; teacher: string; kind: string; bad: boolean }[]>;
  unused: { mins: number; time: string } | null;
  conflicts: number;
  load: { name: string; color: string; minutes: number; text: string; w: number }[];
  published: boolean;
};

/** Colors per course kind, as in the prototype. */
const T: Record<string, { color: string; tint: string; ink: string }> = {
  cyber: { color: '#1F6FEB', tint: '#E4EEFF', ink: '#14509E' },
  ai: { color: '#7B3FF2', tint: '#EFE7FF', ink: '#5A27C2' },
  design: { color: '#D2461F', tint: '#FFEAE2', ink: '#A8361A' },
  coding: { color: '#0B7D60', tint: '#DCF4EA', ink: '#0A6B52' },
  spec: { color: '#16133A', tint: '#EDEBFF', ink: '#2A2660' },
  talk: { color: '#B26B00', tint: '#FFF1DE', ink: '#6B3700' },
  plain: { color: '#5B5E78', tint: '#F1F2F8', ink: '#3D405C' },
};
const look = (kind: string) => T[kind] ?? T.plain;

const clockFmt = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h > 12 ? h - 12 : h}:${mm < 10 ? '0' : ''}${mm}`;
};
const FIELDS: [keyof Timing, string, (v: number) => string][] = [
  ['start', 'Day starts', clockFmt],
  ['end', 'Day ends', clockFmt],
  ['sess', 'Session length', (v) => `${v} min`],
  ['brk', 'Break length', (v) => `${v} min`],
  ['per', 'Sessions before a break', (v) => String(v)],
];

export default function Schedule() {
  const me = useMe().data;
  const [week, setWeek] = useState<number | null>(null);
  const [mode, setMode] = useState<'week' | 'default'>('week');
  const [sel, setSel] = useState<{ day: string; i: number } | null>(null);
  const w = week ?? me?.week ?? null;
  const q = useGet<ScheduleData>(w ? `/admin/schedule?week=${w}` : null);
  const inv = { invalidate: ['admin'] };
  const timing = useAction<{ week: number; mode: string; field: string; dir: number }>('/admin/schedule/timing', { method: 'PUT', ...inv });
  const reset = useAction<void>(() => `/admin/schedule/timing/${w}`, { method: 'DELETE', ...inv, success: 'Back to the default timing' });
  const slot = useAction<{ week: number; day: string; index: number; course_key: string | null }>('/admin/schedule/slot', { method: 'PUT', ...inv });
  const publish = useAction<void>(() => `/admin/schedule/${w}/publish`, { ...inv, success: (r) => `Published. ${r.notified} teachers and students notified.` });
  const copy = useAction<void>(() => `/admin/schedule/${w}/copy-next`, { ...inv, success: `Copied to week ${(w ?? 0) + 1}` });

  return (
    <Shell role="admin" active="schedule" mainStyle={{ gap: 22 }}>
      <Async q={q}>
        {(d) => {
          const sessions = d.rows.filter((r): r is Extract<Row, { cells: unknown }> => r.kind !== 'break');
          const defaultDay = d.days.find((x) => x.id === 'thu')?.id ?? d.days[0]?.id;
          const cur = sel && sessions.some((r) => r.index === sel.i) ? sel : { day: defaultDay, i: sessions[0]?.index ?? 0 };
          const selDay = d.days.find((x) => x.id === cur.day) ?? d.days[0];
          const dayIdx = d.days.findIndex((x) => x.id === selDay.id);
          const selRow = sessions.find((r) => r.index === cur.i) ?? sessions[0];
          const curKey = selRow?.cells[dayIdx]?.key ?? null;
          const shown = mode === 'default' ? d.default : d.override ?? d.default;
          const isCustom = d.custom && mode === 'week';
          const pubBg = d.conflicts > 0 ? C.chip : d.published ? C.ok.bg : C.indigo;
          const pubFg = d.conflicts > 0 ? C.muted : d.published ? C.ok.fg : '#FFFFFF';
          const pubLabel = d.conflicts > 0
            ? `Fix ${d.conflicts} conflict${d.conflicts > 1 ? 's' : ''} to publish`
            : d.published ? 'Published ✓ teachers & students notified' : `Publish week ${d.week}`;
          const assign = (key: string | null) => selRow && slot.mutate({ week: d.week, day: selDay.id, index: selRow.index, course_key: key });
          return (
            <>
              <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h1 style={{ margin: 0, fontFamily: display, fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em' }}>Weekly schedule</h1>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 14, background: C.white, border: `1px solid ${C.border}` }}>
                      <button onClick={() => setWeek(Math.max(1, d.week - 1))} disabled={d.week <= 1} aria-label="Previous week" style={arrow}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                      </button>
                      <span style={{ minWidth: 170, textAlign: 'center', fontSize: 15, fontWeight: 600 }}>{d.label}</span>
                      <button onClick={() => setWeek(Math.min(d.total_weeks, d.week + 1))} disabled={d.week >= d.total_weeks} aria-label="Next week" style={arrow}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                      </button>
                    </div>
                    <span style={{ padding: '6px 12px', borderRadius: 999, background: d.custom ? C.warn.bg : C.indigoTint, color: d.custom ? C.warn.fg : '#3A2BD0', fontSize: 13, fontWeight: 600 }}>
                      {d.custom ? 'Custom timing this week' : 'Default timing'}
                    </span>
                    {d.note && <span style={{ fontSize: 13, color: C.warn.fg }}>{d.note}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button onClick={() => copy.mutate()} disabled={copy.isPending || d.week >= d.total_weeks} style={{ minHeight: 46, padding: '0 16px', borderRadius: 14, border: `1px solid ${C.border2}`, background: C.white, color: C.ink, fontSize: 14, cursor: 'pointer' }}>
                    Copy to next week
                  </button>
                  <button onClick={() => publish.mutate()} disabled={d.conflicts > 0 || d.published || publish.isPending} style={{ minHeight: 46, padding: '0 18px', borderRadius: 14, border: 0, background: pubBg, color: pubFg, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {pubLabel}
                  </button>
                </div>
              </header>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <section aria-label="Week grid" style={{ flex: '999 1 720px', minWidth: 0, borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 20 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 820, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: `96px repeat(${d.days.length}, minmax(0, 1fr))`, gap: 10 }}>
                        <span style={{ fontSize: 12, color: C.muted, alignSelf: 'end', paddingBottom: 6 }}>{d.summary}</span>
                        {d.days.map((day) => (
                          <div key={day.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 14px', borderRadius: 14, background: C.navy, color: '#FFFFFF' }}>
                            <span style={{ fontSize: 12, color: C.lime, fontWeight: 600 }}>{day.label} · {day.date}</span>
                            <span style={{ fontSize: 15, fontWeight: 600 }}>{day.group}</span>
                            <span style={{ fontSize: 12, color: C.lilac }}>{day.n} students</span>
                          </div>
                        ))}
                      </div>
                      {d.rows.map((r, ri) =>
                        r.kind === 'break' ? (
                          <div key={ri} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: C.muted }}>{r.time}</span>
                            <div style={{ height: 40, borderRadius: 12, background: 'repeating-linear-gradient(135deg, #F4F5FA 0 10px, #ECEDF5 10px 20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: C.ink2 }}>
                              Break · {r.mins} min
                            </div>
                          </div>
                        ) : (
                          <div key={ri} style={{ display: 'grid', gridTemplateColumns: `96px repeat(${d.days.length}, minmax(0, 1fr))`, gap: 10, alignItems: 'stretch' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{r.time}</span>
                              <span style={{ fontSize: 12, color: C.muted }}>{r.label}</span>
                            </div>
                            {r.cells.map((c, ci) => {
                              const day = d.days[ci];
                              const selected = cur.day === day.id && cur.i === r.index;
                              const L = c ? look(c.kind) : null;
                              return (
                                <button
                                  key={day.id}
                                  onClick={() => setSel({ day: day.id, i: r.index })}
                                  aria-pressed={selected}
                                  aria-label={`${day.label} ${r.time}${c ? `, ${c.name}` : ', empty'}`}
                                  style={{ minHeight: 84, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 3, padding: '10px 12px', borderRadius: 14, border: `2px ${c ? 'solid' : 'dashed'} ${c?.warn ? '#B35A00' : L ? L.tint : C.border2}`, background: L ? L.tint : C.white, color: C.ink, textAlign: 'left', cursor: 'pointer', boxShadow: selected ? `0 0 0 3px ${C.indigo}` : 'none' }}
                                >
                                  {c && L ? (
                                    <>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 600, color: L.ink }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: L.color, flexShrink: 0 }} />
                                        {c.name}
                                      </span>
                                      <span style={{ fontSize: 12, color: C.ink2 }}>{c.teacher}</span>
                                      <span style={{ fontSize: 12, color: C.muted }}>{c.room}</span>
                                      {c.warn && (
                                        <span style={{ marginTop: 2, padding: '2px 8px', borderRadius: 6, background: C.warn.bg, color: C.warn.fg, fontSize: 11, fontWeight: 600 }}>
                                          Not available on {day.short}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span style={{ fontSize: 13, fontWeight: 500, color: C.indigo }}>+ Assign a course</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ),
                      )}
                      {d.unused && (
                        <div style={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: C.muted }}>{d.unused.time}</span>
                          <div style={{ padding: '10px 14px', borderRadius: 12, border: `1.5px dashed ${C.border2}`, fontSize: 13, color: C.muted }}>
                            {d.unused.mins} min left unused before the day ends
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <aside style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <section aria-label="Day timing" style={{ borderRadius: 24, background: C.navy, color: '#FFFFFF', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <h2 style={{ margin: 0, fontFamily: display, fontSize: 19, fontWeight: 700 }}>Day timing</h2>
                      {isCustom && (
                        <button onClick={() => reset.mutate()} style={{ minHeight: 32, padding: '0 10px', borderRadius: 9, border: '1.5px solid #5C58A3', background: 'transparent', color: '#FFFFFF', fontSize: 12, cursor: 'pointer' }}>
                          Reset to default
                        </button>
                      )}
                    </div>
                    <div role="tablist" aria-label="Apply timing to" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, padding: 4, borderRadius: 12, background: C.navy2 }}>
                      {([['week', 'This week only'], ['default', 'Default · all weeks']] as const).map(([id, text]) => (
                        <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} style={{ minHeight: 38, borderRadius: 9, border: 0, background: mode === id ? C.lime : 'transparent', color: mode === id ? C.navy : C.lilac, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          {text}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, lineHeight: 1.5, color: C.lilac }}>
                      {mode === 'week' ? `Changes apply to week ${d.week} only. Other weeks keep their timing.` : 'Changes apply to every week without custom timing.'}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {FIELDS.map(([key, text, fmt]) => {
                        const changed = isCustom && d.override && d.override[key] !== d.default[key];
                        const step = (dir: number) => timing.mutate({ week: d.week, mode, field: key, dir });
                        return (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderTop: `1px solid ${C.navy3}` }}>
                            <span style={{ fontSize: 14 }}>{text}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button onClick={() => step(-1)} disabled={timing.isPending} aria-label={`Decrease ${text}`} style={stepBtn}>−</button>
                              <span style={{ minWidth: 64, textAlign: 'center', fontSize: 15, fontWeight: 600, color: changed ? C.lime : '#FFFFFF' }}>{fmt(shown[key])}</span>
                              <button onClick={() => step(1)} disabled={timing.isPending} aria-label={`Increase ${text}`} style={stepBtn}>+</button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: C.navy2, fontSize: 13, lineHeight: 1.5, color: '#E6E4F8' }}>{d.pattern}</div>
                  </section>

                  {selRow && selDay && (
                    <section aria-label="Selected slot" style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>Selected slot</span>
                        <h2 style={{ margin: 0, fontFamily: display, fontSize: 19, fontWeight: 700 }}>{selDay.label} · {selDay.group}</h2>
                        <span style={{ fontSize: 13, color: C.ink2 }}>
                          {selRow.kind === 'short' ? 'Short block' : `Session ${selRow.index + 1}`} · {clockFmt(selRow.from)}–{clockFmt(selRow.to)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(d.options[selDay.id] ?? []).map((o) => {
                          const on = o.key === curKey;
                          const L = look(o.kind);
                          return (
                            <button key={o.key} onClick={() => assign(o.key)} disabled={slot.isPending} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48, padding: '8px 12px', borderRadius: 12, border: `1.5px solid ${on ? L.color : C.border}`, background: on ? L.tint : C.white, color: C.ink, textAlign: 'left', cursor: 'pointer' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: L.color, flexShrink: 0 }} />
                                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <span style={{ fontSize: 14, fontWeight: 500 }}>{o.name}</span>
                                  <span style={{ fontSize: 12, color: C.muted }}>{o.teacher}</span>
                                </span>
                              </span>
                              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: on ? L.ink : C.warn.ink }}>
                                {on ? 'Assigned' : o.bad ? `Not available ${selDay.short}` : ''}
                              </span>
                            </button>
                          );
                        })}
                        <button onClick={() => assign(null)} disabled={slot.isPending || !curKey} style={{ minHeight: 40, borderRadius: 12, border: `1.5px dashed ${C.border2}`, background: 'transparent', color: C.ink2, fontSize: 13, cursor: 'pointer' }}>
                          Leave this slot empty
                        </button>
                      </div>
                    </section>
                  )}

                  <section aria-label="Teacher load" style={{ borderRadius: 24, background: C.white, border: `1px solid ${C.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h2 style={{ margin: 0, fontFamily: display, fontSize: 17, fontWeight: 700 }}>Teacher load this week</h2>
                    {d.load.map((l) => (
                      <div key={l.name} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 92px', gap: 10, alignItems: 'center', fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{l.name}</span>
                        <span style={{ height: 8, borderRadius: 4, background: C.chip, overflow: 'hidden' }}>
                          <span style={{ display: 'block', height: '100%', width: `${l.w}%`, borderRadius: 4, background: l.color }} />
                        </span>
                        <span style={{ textAlign: 'right', color: C.ink2 }}>{l.text}</span>
                      </div>
                    ))}
                  </section>
                </aside>
              </div>
            </>
          );
        }}
      </Async>
    </Shell>
  );
}

const arrow = { width: 40, height: 40, borderRadius: 10, border: 0, background: 'transparent', color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as const;
const stepBtn = { width: 34, height: 34, borderRadius: 9, border: 0, background: C.navy3, color: '#FFFFFF', fontSize: 18, cursor: 'pointer' } as const;
