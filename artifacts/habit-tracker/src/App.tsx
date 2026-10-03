import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Download, Edit3, Flame, History as HistoryIcon, LayoutGrid, Menu, Moon, MoreHorizontal, Plus, RotateCcw, Settings as SettingsIcon, SlidersHorizontal, Sun, Target, X } from 'lucide-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

type Tracking = 'yes-no' | 'count' | 'minutes' | 'hours' | 'quantity';
type Habit = { id: string; name: string; category: string; customCategory?: string; frequency: 'daily' | 'weekdays' | 'custom'; days: number[]; tracking: Tracking; target: number; note: string; active: boolean };
type DayRecord = { values: Record<string, number>; note: string };
type Store = { habits: Habit[]; records: Record<string, DayRecord>; settings: { theme: 'dark' | 'light'; weekStarts: 0 | 1 } };

const todayKey = () => new Date().toISOString().slice(0, 10);
const fmtDate = (key: string, options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }) => new Intl.DateTimeFormat('en-US', options).format(new Date(`${key}T12:00:00`));
const shiftDate = (key: string, amount: number) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + amount); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const initialStore: Store = { habits: [], records: {}, settings: { theme: 'dark', weekStarts: 1 } };
const storeKey = (userId: string) => `habitr-store:${userId}`;
const legacyStoreKeys = (userId: string) => [`stead-store:${userId}`];
const habitCategories = ['Spirituality', 'Academic', 'Fitness', 'Work', 'Personal Development', 'Content', 'Other'];

function loadStore(userId: string): Store {
  try {
    const saved = [storeKey(userId), ...legacyStoreKeys(userId)].map(key => localStorage.getItem(key)).find(Boolean);
    return saved ? normalizeStore({ ...initialStore, ...JSON.parse(saved) }) : initialStore;
  } catch { return initialStore; }
}
function normalizeStore(store: Store): Store {
  return {
    ...initialStore,
    ...store,
    habits: (store.habits || []).map(habit => {
      if (habitCategories.includes(habit.category)) return habit;
      return { ...habit, category: 'Other', customCategory: habit.customCategory || habit.category };
    }),
  };
}
function categoryLabel(habit: Habit) { return habit.category === 'Other' && habit.customCategory?.trim() ? habit.customCategory.trim() : habit.category === 'Other' ? 'Other' : habit.category; }
function isScheduled(habit: Habit, key: string) { const day = new Date(`${key}T12:00:00`).getDay(); return habit.frequency === 'daily' || (habit.frequency === 'weekdays' && day > 0 && day < 6) || (habit.frequency === 'custom' && habit.days.includes(day)); }
function met(habit: Habit, value = 0) { return habit.tracking === 'yes-no' ? value >= 1 : value >= habit.target; }
function unit(habit: Habit) { return habit.tracking === 'yes-no' ? 'done' : habit.tracking; }
function completion(habits: Habit[], record: DayRecord | undefined) { const scheduled = habits.filter(h => isScheduled(h, todayKey())); return scheduled.length ? Math.round(scheduled.filter(h => met(h, record?.values[h.id])).length / scheduled.length * 100) : 0; }

const navItems = [
  { href: '/today', label: 'Today', icon: CalendarDays },
  { href: '/habits', label: 'Habits', icon: LayoutGrid },
  { href: '/progress', label: 'Progress', icon: Target },
  { href: '/history', label: 'History', icon: HistoryIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

function AppShell({ children, store, onNavigate, user, onSignOut }: { children: ReactNode; store: Store; onNavigate: () => void; user: any; onSignOut: () => void }) {
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const today = todayKey();
  const todayPct = completion(store.habits.filter(h => h.active), store.records[today]);
  const email = user?.email || '';
  const accountName = email.split('@')[0] || 'Your account';
  const requestSignOut = () => {
    if (window.confirm('Are you sure you want to log out of Habitr? Your saved data will remain on this device.')) {
      onSignOut();
    }
  };
  return <div className="min-h-[100dvh] bg-background text-foreground">
    <aside className={`fixed inset-y-0 left-0 z-30 w-[246px] border-r hairline bg-card px-5 py-6 transition-transform md:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-12 flex items-center justify-between">
        <Link href="/today" onClick={() => { setMobileNav(false); onNavigate(); }} className="flex items-center gap-3" data-testid="link-logo">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><SlidersHorizontal size={16} /></span>
          <span className="text-[15px] font-bold tracking-[-.02em]">Habitr</span>
        </Link>
        <button onClick={() => setMobileNav(false)} className="text-muted-foreground md:hidden" aria-label="Close navigation" data-testid="button-close-nav"><X size={18} /></button>
      </div>
      <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Workspace</p>
      <nav className="space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => { setMobileNav(false); onNavigate(); }} data-testid={`link-nav-${label.toLowerCase()}`} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${location === href ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}>
          <Icon size={16} strokeWidth={1.8} /><span>{label}</span>{label === 'Today' && todayPct > 0 && <span className="mono ml-auto text-[10px] text-primary">{todayPct}%</span>}
        </Link>)}
      </nav>
      <div className="absolute bottom-6 left-5 right-5 border-t hairline pt-5">
        <div className="flex items-center justify-between px-3"><span className="text-xs text-muted-foreground">Today</span><span className="mono text-[11px] text-foreground">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date())}</span></div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${todayPct}%` }} /></div>
      </div>
    </aside>
    {mobileNav && <button className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setMobileNav(false)} aria-label="Close menu" data-testid="button-nav-overlay" />}
    <main className="md:pl-[246px]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b hairline bg-background/95 px-5 backdrop-blur md:px-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileNav(true)} className="text-muted-foreground md:hidden" aria-label="Open navigation" data-testid="button-open-nav"><Menu size={20} /></button>
          <span className="text-sm font-bold tracking-[-.02em]" data-testid="text-workspace-title">Habitr</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono hidden text-[10px] uppercase tracking-[.18em] text-muted-foreground sm:inline">Personal practice</span>
          <div className="size-2 rounded-full bg-primary" title="Saved to this account" />
          <button type="button" onClick={requestSignOut} className="rounded-lg border hairline bg-card px-3 py-2 text-left transition-colors hover:bg-secondary" title="Sign out" data-testid="button-signout">
            <span className="block max-w-[110px] truncate text-[11px] font-semibold">{accountName}</span>
            <span className="block max-w-[110px] truncate text-[10px] text-muted-foreground">{email}</span>
          </button>
        </div>
      </header>
      <div className="shell-grid min-h-[calc(100dvh-4rem)]"><div className="mx-auto max-w-[1180px] px-5 py-8 md:px-10 md:py-12">{children}</div></div>
    </main>
  </div>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p><h1 className="text-3xl font-bold tracking-[-.05em]">{title}</h1>{description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action && <div>{action}</div>}</div>;
}
function Button({ children, onClick, variant = 'solid', type = 'button', className = '', disabled = false, testId }: { children: ReactNode; onClick?: () => void; variant?: 'solid' | 'outline'; type?: 'button' | 'submit'; className?: string; disabled?: boolean; testId?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-all ${variant === 'solid' ? 'bg-primary text-primary-foreground hover:brightness-110' : 'border hairline bg-background hover:bg-secondary'} disabled:opacity-50 ${className}`}>{children}</button>;
}
function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="border-l-2 border-primary/40 pl-4"><p className="mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{label}</p><p className="text-lg font-bold">{value}</p>{detail && <p className="text-xs text-muted-foreground">{detail}</p>}</div>; }
function Section({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) { return <section className={className}><div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-bold">{title}</h2>{action}</div>{children}</section>; }

function Today({ store, selectedDate, setSelectedDate, saveRecord }: { store: Store; selectedDate: string; setSelectedDate: (v: string) => void; saveRecord: (date: string, habitId: string, value: number, note?: string) => void }) {
  const active = store.habits.filter(h => h.active && isScheduled(h, selectedDate));
  const record = store.records[selectedDate];
  const pct = active.length ? Math.round(active.filter(h => met(h, record?.values[h.id])).length / active.length * 100) : 0;
  const isToday = selectedDate === todayKey();
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDate(selectedDate, i - 6));
  const dayPct = (key: string) => { const hs = store.habits.filter(h => h.active && isScheduled(h, key)); return hs.length ? Math.round(hs.filter(h => met(h, store.records[key]?.values[h.id])).length / hs.length * 100) : 0; };
  return <div className="fade-in">
    <PageIntro eyebrow={isToday ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()) : 'Daily record'} title={isToday ? 'Make today count.' : fmtDate(selectedDate)} />
    <div className="mb-9 grid gap-5 md:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-xl border hairline bg-card p-6 md:p-8"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">{isToday ? 'Your check-in' : 'Day record'}</p><p className="mt-1 text-xs text-muted-foreground">Completed {active.filter(h => met(h, record?.values[h.id])).length} of {active.length}</p></div></div><div className="mt-6"><div className="text-4xl font-bold">{pct}%</div></div></div>
      <div className="rounded-xl border hairline bg-card p-6 md:p-8"><div className="flex items-center gap-2"><Flame size={15} className="text-accent" /><p className="text-sm font-semibold">Streak</p></div><div className="mt-4 text-3xl font-bold">{currentHabitStreak(store, store.habits[0], selectedDate)}</div></div>
    </div>
    <Section title="Daily practices" action={<span className="mono text-[10px] text-muted-foreground">{active.filter(h => met(h, record?.values[h.id])).length} / {active.length}</span>}>
      {active.length === 0 ? <Empty title="Nothing scheduled" text="Add an active habit or enjoy the space." action={<Link href="/habits" className="text-xs font-bold text-primary">Manage habits →</Link>} /> : <div className="rounded-xl border hairline bg-card overflow-hidden">{active.map((h, i) => <HabitCheck key={h.id} habit={h} value={record?.values[h.id] ?? 0} onSave={(v) => saveRecord(selectedDate, h.id, v)} last={i === active.length - 1} />)}</div>}
    </Section>
    <Section title="This week" className="mt-10"><div className="grid grid-cols-7 gap-1.5 md:gap-3">{weekDays.map(key => <button key={key} onClick={() => setSelectedDate(key)} data-testid={`button-day-${key}`} className={`flex flex-col items-center gap-2 rounded-lg p-2 text-xs font-medium transition-colors ${selectedDate === key ? 'bg-primary text-primary-foreground' : 'border hairline hover:bg-secondary'}`}><span>{new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(new Date(`${key}T12:00:00`))}</span><span className="text-[10px]">{dayPct(key)}%</span></button>)}</div>
    </Section>
  </div>;
}
function HabitCheck({ habit, value, onSave, last }: { habit: Habit; value: number; onSave: (v: number) => void; last: boolean }) {
  const [draft, setDraft] = useState(String(value || ''));
  useEffect(() => setDraft(value ? String(value) : ''), [value]);
  const done = met(habit, value);
  const submit = () => onSave(habit.tracking === 'yes-no' ? done ? 0 : 1 : Math.max(0, Number(draft) || 0));
  return <div className={`flex items-center gap-4 px-5 py-4 ${!last ? 'border-b hairline' : ''}`}><button onClick={submit} aria-label={`Mark ${habit.name}`} data-testid={`button-complete-${habit.id}`} className={`flex size-6 items-center justify-center rounded-lg border-2 transition-colors ${done ? 'border-primary bg-primary' : 'border-border hover:border-primary'}`}>{done && <Check size={14} className="text-primary-foreground" />}</button><div className="flex-1"><p className="text-sm font-medium">{habit.name}</p><p className="text-xs text-muted-foreground">{unit(habit)}</p></div>{habit.tracking !== 'yes-no' && <input type="number" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={submit} className="w-16 rounded border border-input bg-background px-2 py-1 text-right text-xs focus:border-primary focus:outline-none" />}</div>;
}
function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) { return <div className="rounded-xl border border-dashed hairline bg-card/40 px-6 py-12 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</div>; }

function currentStreak(store: Store, from: string) {
  let count = 0; let key = from;
  while (true) { const hs = store.habits.filter(h => h.active && isScheduled(h, key)); if (!hs.length || hs.some(h => !met(h, store.records[key]?.values[h.id]))) break; count++; key = shiftDate(key, -1); }
  return count;
}
function currentHabitStreak(store: Store, habit: Habit, from: string) {
  let count = 0; let key = from;
  while (true) {
    if (!isScheduled(habit, key)) { key = shiftDate(key, -1); continue; }
    if (!met(habit, store.records[key]?.values[habit.id])) break;
    count++; key = shiftDate(key, -1);
  }
  return count;
}
function longestStreak(store: Store, habit: Habit) {
  const keys = Object.keys(store.records).sort();
  if (!keys.length) return 0;
  let best = 0; let run = 0; let key = keys[0];
  while (key <= keys[keys.length - 1]) {
    if (!isScheduled(habit, key)) { key = shiftDate(key, 1); continue; }
    if (met(habit, store.records[key]?.values[habit.id])) run++;
    else { best = Math.max(best, run); run = 0; }
    key = shiftDate(key, 1);
  }
  return Math.max(best, run);
}

function Habits({ store, setStore }: { store: Store; setStore: (fn: (s: Store) => Store) => void }) {
  const [editing, setEditing] = useState<Habit | null>(null);
  const [showForm, setShowForm] = useState(false);
  const active = store.habits.filter(h => h.active), inactive = store.habits.filter(h => !h.active);
  const grouped = (habits: Habit[]) => habitCategories.map(category => ({ category, habits: habits.filter(habit => habit.category === category) })).filter(group => group.habits.length);
  const save = (habit: Habit) => { setStore(s => ({ ...s, habits: s.habits.some(h => h.id === habit.id) ? s.habits.map(h => h.id === habit.id ? habit : h) : [...s.habits, habit] })); setShowForm(false); setEditing(null); };
  const remove = (id: string) => { if (window.confirm('Delete this habit and its recorded values?')) setStore(s => ({ ...s, habits: s.habits.filter(h => h.id !== id) })); };
  const renderGroups = (habits: Habit[]) => <div className="space-y-8">{grouped(habits).map(group => <section key={group.category} data-testid={`section-category-${group.category.toLowerCase().replace(/\s/g, '-')}`}><h3 className="text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground mb-3">{group.category}</h3><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{group.habits.map(h => <HabitCard key={h.id} habit={h} store={store} onEdit={() => { setEditing(h); setShowForm(true); }} onDelete={() => remove(h.id)} onToggle={() => setStore(s => ({ ...s, habits: s.habits.map(x => x.id === h.id ? { ...x, active: !x.active } : x) }))} />)}</div></section>))};
  return <div className="fade-in"><PageIntro eyebrow="Your system" title="Habits" description="Keep the list honest. A habit only shows up on the days and schedule you give it." action={<Button onClick={() => { setShowForm(true); setEditing(null); }}>+ Add habit</Button>} />
    {showForm && <HabitForm initial={editing} onSave={save} onCancel={() => { setShowForm(false); setEditing(null); }} />}
    <div className="mb-10"><Section title={`Active · ${active.length}`}>{active.length ? renderGroups(active) : <Empty title="Your active list is clear" text="Add one practice you can return to." action={<Button onClick={() => { setShowForm(true); setEditing(null); }}>Start with one</Button>} />}</Section>
      {inactive.length > 0 && <Section title={`Inactive · ${inactive.length}`}>{renderGroups(inactive)}</Section>}
  </div>;
}
function HabitCard({ habit, store, onEdit, onDelete, onToggle }: { habit: Habit; store: Store; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const values = Object.values(store.records).map(r => r.values[habit.id]).filter(v => v !== undefined); const done = values.filter(v => met(habit, v)).length; const rate = values.length ? Math.round(done / values.length * 100) : 0;
  return <article className="rounded-xl border hairline bg-card p-5 transition-colors hover:border-primary/40"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-semibold">{habit.name}</h3></div><p className="mt-1 text-xs text-muted-foreground">{categoryLabel(habit)}</p><p className="mt-3 text-xs">{done} of {values.length} completed</p></div><button onClick={onToggle} data-testid={`button-toggle-${habit.id}`} className={`rounded-full p-2 transition-colors ${habit.active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}><Circle size={16} /></button></div><div className="mt-4 flex gap-2"><button onClick={onEdit} data-testid={`button-edit-${habit.id}`} className="flex-1 rounded border hairline px-2 py-1.5 text-xs font-medium hover:bg-secondary transition-colors">Edit</button><button onClick={onDelete} data-testid={`button-delete-${habit.id}`} className="flex-1 rounded border border-destructive/40 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">Delete</button></div></article>;
}
function HabitForm({ initial, onSave, onCancel }: { initial: Habit | null; onSave: (h: Habit) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || ''); const [category, setCategory] = useState(initial?.category || 'Personal Development'); const [customCategory, setCustomCategory] = useState(initial?.customCategory || ''); const [frequency, setFrequency] = useState(initial?.frequency || 'daily'); const [tracking, setTracking] = useState(initial?.tracking || 'yes-no'); const [target, setTarget] = useState(String(initial?.target || 1));
  const submit = (e: FormEvent) => { e.preventDefault(); if (!name.trim() || (category === 'Other' && !customCategory.trim())) return; onSave({ id: initial?.id || uid(), name: name.trim(), category, customCategory: customCategory.trim(), frequency: frequency as any, days: [], tracking: tracking as any, target: parseInt(target) || 1, note: '', active: true }); };
  return <form onSubmit={submit} className="mb-8 rounded-xl border border-primary/40 bg-card p-6 md:p-8"><div className="mb-6 flex items-center justify-between"><h2 className="text-sm font-bold">{initial ? 'Edit habit' : 'New habit'}</h2><button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X size={18} /></button></div><div className="space-y-4"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Habit name" className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" /><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none">{habitCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>{category === 'Other' && <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Custom category" className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />}<select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"><option value="daily">Daily</option><option value="weekdays">Weekdays</option></select><select value={tracking} onChange={(e) => setTracking(e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"><option value="yes-no">Yes/No</option><option value="count">Count</option><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="quantity">Quantity</option></select>{tracking !== 'yes-no' && <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />}</div><div className="mt-6 flex gap-3"><button type="submit" className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:brightness-110">Save</button><button type="button" onClick={onCancel} className="flex-1 rounded-lg border hairline px-4 py-2 text-sm font-bold hover:bg-secondary">Cancel</button></div></form>;
}

function Progress({ store }: { store: Store }) {
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'custom'>('week'); const [customStart, setCustomStart] = useState(shiftDate(todayKey(), -13)); const [customEnd, setCustomEnd] = useState(todayKey());
  const end = todayKey(); const start = range === 'today' ? end : range === 'week' ? shiftDate(end, -6) : range === 'month' ? shiftDate(end, -29) : customStart; const keys = Array.from({ length: Math.abs(daysBetween(start, end)) + 1 }, (_, i) => shiftDate(start, i));
  const scheduled = keys.flatMap(key => store.habits.filter(h => h.active && isScheduled(h, key)).map(h => ({ h, key }))); const completed = scheduled.filter(({ h, key }) => met(h, store.records[key]?.values[h.id]));
  return <div className="fade-in"><PageIntro eyebrow="The wider view" title="Progress" description="Patterns, not pressure. See what your actual records say over time." /><div className="mb-8 flex gap-2">{(['today', 'week', 'month', 'custom'] as const).map(r => <button key={r} onClick={() => setRange(r)} className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${range === r ? 'bg-primary text-primary-foreground' : 'border hairline hover:bg-secondary'}`}>{r.charAt(0).toUpperCase() + r.slice(1)}</button>)}</div>{range === 'custom' && <div className="mb-8 flex gap-2"><input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded border border-input bg-background px-3 py-2 text-sm" /><input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded border border-input bg-background px-3 py-2 text-sm" /></div>}<Stat label="Total scheduled" value={String(scheduled.length)} detail={`${completed.length} completed (${scheduled.length ? Math.round(completed.length / scheduled.length * 100) : 0}%)`} /></div>;
}

function History({ store, setSelectedDate, onNavigate }: { store: Store; setSelectedDate: (d: string) => void; onNavigate: () => void }) {
  const keys = Array.from({ length: 30 }, (_, i) => shiftDate(todayKey(), -i)); const rowPct = (key: string) => { const hs = store.habits.filter(h => h.active && isScheduled(h, key)); return hs.length ? Math.round(hs.filter(h => met(h, store.records[key]?.values[h.id])).length / hs.length * 100) : 0; };
  return <div className="fade-in"><PageIntro eyebrow="A faithful record" title="History" description="Look back without rewriting the story. Every day keeps its actual values and notes." /><div className="rounded-xl border hairline bg-card overflow-hidden"><div className="divide-y hairline">{keys.map(key => <button key={key} onClick={() => { setSelectedDate(key); setLocation('/today'); }} className="flex items-center justify-between px-5 py-3 hover:bg-secondary transition-colors text-left w-full"><div><p className="font-medium text-sm">{fmtDate(key, { weekday: 'short', month: 'short', day: 'numeric' })}</p></div><div className="text-right"><p className="text-xs font-semibold">{rowPct(key)}%</p></div></button>)}</div></div></div>;
}

function Settings({ store, setStore }: { store: Store; setStore: (fn: (s: Store) => Store) => void }) {
  const file = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result as string); setStore(() => normalizeStore(parsed)); } catch { alert('Invalid file'); } }; reader.readAsText(f); };
  const exportData = () => { const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `habitr-${todayKey()}.json`; a.click(); };
  return <div className="fade-in"><PageIntro eyebrow="Keep it yours" title="Settings" description="Habitr stores everything in this browser. Export a copy whenever you need one." /><div className="space-y-6"><div className="rounded-xl border hairline bg-card p-6"><h3 className="mb-4 font-semibold">Data</h3><div className="space-y-3"><Button onClick={exportData}>Export data</Button><div className="border-t hairline pt-3"><label className="cursor-pointer"><span className="inline-block rounded-lg border hairline bg-background px-4 py-2.5 text-sm font-bold hover:bg-secondary transition-colors">Import data</span><input type="file" accept=".json" onChange={file} className="hidden" /></label></div></div></div><div className="rounded-xl border hairline bg-card p-6"><h3 className="mb-4 font-semibold">Theme</h3><div className="flex gap-2"><Button onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, theme: 'dark' } }))} variant={store.settings.theme === 'dark' ? 'solid' : 'outline'}>Dark</Button><Button onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, theme: 'light' } }))} variant={store.settings.theme === 'light' ? 'solid' : 'outline'}>Light</Button></div></div></div></div>;
}

function AuthLoading() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background text-sm text-muted-foreground">Loading your private workspace…</div>;
}

function PublicLanding() {
  return <div className="min-h-[100dvh] bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-10">
      <Link href="/" className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><SlidersHorizontal size={16} /></span>
        <span className="text-[15px] font-bold tracking-[-.02em]">Habitr</span>
      </Link>
      <nav className="hidden items-center gap-6 md:flex">
        <a href="#how-it-works" className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">How it works</a>
        <Link href="/sign-in" className="rounded-lg px-3.5 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">Sign in</Link>
        <Link href="/sign-up" className="rounded-lg bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground transition-all hover:brightness-110">Create account</Link>
      </nav>
      <div className="flex items-center gap-2 md:hidden"><Link href="/sign-in" className="rounded-lg px-3 py-2 text-xs font-bold text-muted-foreground">Sign in</Link><Link href="/sign-up" className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Sign up</Link></div>
    </header>
    <main className="mx-auto max-w-6xl px-5 pb-20 pt-16 md:px-10 md:pt-24">
      <section className="grid gap-12 md:grid-cols-[1.1fr_.9fr] md:items-center">
        <div>
          <p className="mono mb-5 text-[10px] uppercase tracking-[.2em] text-primary">Private habit tracking</p>
          <h1 className="max-w-2xl text-5xl font-bold leading-[1.03] tracking-[-.06em] md:text-7xl">Make your everyday habits easier to keep.</h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground">Habitr gives you one calm place to plan small practices, check in honestly, and understand your progress over time.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-all hover:brightness-110">Create your account</Link>
            <Link href="/sign-in" className="rounded-lg border hairline bg-card px-5 py-3 text-sm font-bold transition-colors hover:bg-secondary">Sign in</Link>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Start with Google or email. Your habits stay private to your account.</p>
        </div>
      </section>
    </main>
  </div>;
}

function SignInPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      setLocation('/today');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-primary/40 bg-card p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in with Google or your email.</p>
        </div>
        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <form onSubmit={handleSignIn} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none" />
          <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">{isLoading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50">Google</button>
        <p className="text-center text-sm text-muted-foreground">Don't have an account? <button onClick={() => setLocation('/sign-up')} className="font-medium text-primary hover:underline">Sign up</button></p>
      </div>
    </div>
  );
}

function SignUpPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) throw err;
      setLocation('/sign-in');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to sign up with Google');
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-primary/40 bg-card p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Create account</h1>
          <p className="mt-2 text-sm text-muted-foreground">We'll send a one-time code to verify your email.</p>
        </div>
        {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <form onSubmit={handleSignUp} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none" />
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none" />
          <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">{isLoading ? 'Creating account...' : 'Create account'}</button>
        </form>
        <button onClick={handleGoogleSignUp} disabled={isLoading} className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50">Google</button>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <button onClick={() => setLocation('/sign-in')} className="font-medium text-primary hover:underline">Sign in</button></p>
      </div>
    </div>
  );
}

function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const handleCallback = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) setLocation('/today');
      else setLocation('/sign-in');
    };
    handleCallback();
  }, [setLocation]);
  return <div className="grid min-h-[100dvh] place-items-center bg-background text-sm text-muted-foreground">Completing sign in…</div>;
}

function HomeRedirect({ isSignedIn }: { isSignedIn: boolean }) {
  if (!isSignedIn) return <PublicLanding />;
  return <Redirect to="/today" />;
}

function PortalGate({ isSignedIn }: { isSignedIn: boolean }) {
  if (!isSignedIn) return <Redirect to="/" />;
  return <RouterApp />;
}

const queryClient = new QueryClient();
function RouterApp({ user, onSignOut }: { user: any; onSignOut: () => void }) {
  const [, setLocation] = useLocation();
  const userId = user?.id || 'unknown';
  const [store, setStoreState] = useState<Store>(() => loadStore(userId));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const setStore = (fn: (s: Store) => Store) => setStoreState(s => fn(s));
  useEffect(() => { setStoreState(loadStore(userId)); }, [userId]);
  useEffect(() => { localStorage.setItem(storeKey(userId), JSON.stringify(store)); document.documentElement.classList.toggle('light', store.settings.theme === 'light'); document.title = 'Habitr — your daily practice'; }, [store, userId]);
  const saveRecord = (date: string, habitId: string, value: number, note?: string) => setStore(s => ({ ...s, records: { ...s.records, [date]: { values: { ...(s.records[date]?.values || {}), [habitId]: value }, note: note ?? s.records[date]?.note ?? '' } } }));
  return <AppShell store={store} onNavigate={() => {}} user={user} onSignOut={onSignOut}><Switch><Route path="/today"><Today store={store} selectedDate={selectedDate} setSelectedDate={setSelectedDate} saveRecord={saveRecord} /></Route><Route path="/habits"><Habits store={store} setStore={setStore} /></Route><Route path="/progress"><Progress store={store} /></Route><Route path="/history"><History store={store} setSelectedDate={setSelectedDate} onNavigate={() => setLocation('/today')} /></Route><Route path="/settings"><Settings store={store} setStore={setStore} /></Route><Route component={NotFound} /></Switch></AppShell>;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function App() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    };
    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  if (isLoading) return <AuthLoading />;

  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/" component={() => <HomeRedirect isSignedIn={!!user} />} />
            <Route path="/sign-in" component={SignInPage} />
            <Route path="/sign-up" component={SignUpPage} />
            <Route path="/auth/callback" component={AuthCallbackPage} />
            <Route path="/*" component={() => user ? <RouterApp user={user} onSignOut={handleSignOut} /> : <Redirect to="/" />} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
