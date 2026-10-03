import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Download, Edit3, Flame, History as HistoryIcon, LayoutGrid, Menu, Moon, MoreHorizontal, Plus, RotateCcw, Settings as SettingsIcon, SlidersHorizontal, Star, Target, Trash2, Undo2, X } from 'lucide-react';
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
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => { setMobileNav(false); onNavigate(); }} data-testid={`link-nav-${label.toLowerCase()}`} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${location === href ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
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
  return <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p><h1 className="text-3xl font-bold tracking-[-.05em] text-foreground md:text-4xl">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action}</div>;
}
function Button({ children, onClick, variant = 'solid', type = 'button', className = '', disabled = false, testId }: { children: ReactNode; onClick?: () => void; variant?: 'solid' | 'outline'; type?: 'button' | 'submit' | 'reset'; className?: string; disabled?: boolean; testId?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-colors ${variant === 'outline' ? 'border hairline bg-background text-foreground hover:bg-secondary' : 'bg-primary text-primary-foreground hover:brightness-110'} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}>{children}</button>;
}
function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="border-l-2 border-primary/40 pl-4"><p className="mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-[-.04em] text-foreground">{value}</p>{detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}</div>; }
function Section({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) { return <section className={className}><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">{title}</h2>{action}</div>{children}</section>; }

function Today({ store, selectedDate, setSelectedDate, saveRecord }: { store: Store; selectedDate: string; setSelectedDate: (v: string) => void; saveRecord: (date: string, habitId: string, value: number, note?: string) => void }) {
  const active = store.habits.filter(h => h.active && isScheduled(h, selectedDate));
  const record = store.records[selectedDate];
  const pct = active.length ? Math.round(active.filter(h => met(h, record?.values[h.id])).length / active.length * 100) : 0;
  const isToday = selectedDate === todayKey();
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDate(selectedDate, i - 6));
  const dayPct = (key: string) => { const hs = store.habits.filter(h => h.active && isScheduled(h, key)); return hs.length ? Math.round(hs.filter(h => met(h, store.records[key]?.values[h.id])).length / hs.length * 100) : 0; };
  return <div className="fade-in">
    <PageIntro eyebrow={isToday ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()) : 'Daily record'} title={isToday ? 'Make today count.' : fmtDate(selectedDate)} description="Your habits, your pace, and the record you actually keep." />
    <div className="mb-9 grid gap-5 md:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-xl border hairline bg-card p-6 md:p-8"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">{isToday ? 'Your check-in' : 'Day overview'}</p><p className="mt-2 text-3xl font-bold tracking-[-.05em] text-foreground">{pct}%</p></div><div className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">{active.filter(h => met(h, record?.values[h.id])).length} / {active.length}</div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div></div>
      <div className="rounded-xl border hairline bg-card p-6 md:p-8"><div className="flex items-center gap-2"><Flame size={15} className="text-accent" /><p className="text-sm font-semibold">Streak</p></div><p className="mt-4 text-3xl font-bold tracking-[-.05em] text-foreground">{currentStreak(store, todayKey())}</p><p className="mt-2 text-sm text-muted-foreground">Current run</p></div>
    </div>
    <Section title="Daily practices" action={<span className="mono text-[10px] text-muted-foreground">{active.filter(h => met(h, record?.values[h.id])).length} / {active.length}</span>}>
      {active.length === 0 ? <Empty title="Nothing scheduled" text="Add an active habit or enjoy the space." action={<Link href="/habits" className="text-xs font-bold text-primary">Manage habits</Link>} /> : <div className="space-y-0 rounded-xl border hairline bg-card overflow-hidden">{active.map((habit, index) => <HabitCheck key={habit.id} habit={habit} value={record?.values[habit.id] ?? 0} onSave={value => saveRecord(selectedDate, habit.id, value)} last={index === active.length - 1} />)}</div>}
    </Section>
    <Section title="This week" className="mt-10"><div className="grid grid-cols-7 gap-1.5 md:gap-3">{weekDays.map(key => <button key={key} onClick={() => setSelectedDate(key)} data-testid={`button-day-${key}`} className="rounded-xl border hairline bg-card px-2 py-4 text-center transition-colors hover:border-primary/40"><span className="block text-[10px] uppercase tracking-[.2em] text-muted-foreground">{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${key}T12:00:00`)).slice(0, 3)}</span><span className="mt-2 block text-lg font-bold text-foreground">{new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(new Date(`${key}T12:00:00`))}</span><span className="mt-2 block text-[10px] text-muted-foreground">{dayPct(key)}%</span></button>)}</div></Section>
  </div>;
}
function HabitCheck({ habit, value, onSave, last }: { habit: Habit; value: number; onSave: (v: number) => void; last: boolean }) {
  const [draft, setDraft] = useState(String(value || ''));
  useEffect(() => setDraft(value ? String(value) : ''), [value]);
  const done = met(habit, value);
  const submit = () => onSave(habit.tracking === 'yes-no' ? done ? 0 : 1 : Math.max(0, Number(draft) || 0));
  return <div className={`flex items-center gap-4 px-5 py-4 ${!last ? 'border-b hairline' : ''}`}><button onClick={submit} aria-label={`Mark ${habit.name}`} data-testid={`button-complete-${habit.id}`} className={`grid size-10 place-items-center rounded-lg border ${done ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-muted-foreground'}`}><Check size={16} /></button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{habit.name}</p>{habit.note && <p className="mt-1 truncate text-xs text-muted-foreground">{habit.note}</p>}</div>{habit.tracking === 'yes-no' ? <span className="text-xs font-semibold text-muted-foreground">{done ? 'Done' : 'Open'}</span> : <div className="flex items-center gap-2"><input value={draft} onChange={e => setDraft(e.target.value)} className="w-20 rounded-lg border border-input bg-background px-2 py-1.5 text-right text-sm text-foreground" type="number" min="0" step="1" /><span className="text-[11px] text-muted-foreground">{unit(habit)}</span></div>}</div>;
}
function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) { return <div className="rounded-xl border border-dashed hairline bg-card/40 px-6 py-12 text-center"><p className="text-base font-semibold text-foreground">{title}</p><p className="mt-2 text-sm text-muted-foreground">{text}</p>{action && <div className="mt-5">{action}</div>}</div>; }

function currentStreak(store: Store, from: string) {
  let count = 0; let key = from;
  while (true) {
    const hs = store.habits.filter(h => h.active && isScheduled(h, key));
    if (!hs.length || hs.some(h => !met(h, store.records[key]?.values[h.id]))) break;
    count++; key = shiftDate(key, -1);
  }
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
  const renderGroups = (habits: Habit[]) => <div className="space-y-8">{grouped(habits).map(group => <section key={group.category} data-testid={`section-category-${group.category.toLowerCase().replace(/\s+/g, '-')}`} className="space-y-4"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">{group.category}</h3><span className="text-[10px] text-muted-foreground">{group.habits.length}</span></div><div className="space-y-3">{group.habits.map(habit => <HabitCard key={habit.id} habit={habit} store={store} onEdit={() => { setEditing(habit); setShowForm(true); }} onDelete={() => remove(habit.id)} onToggle={() => setStore(s => ({ ...s, habits: s.habits.map(h => h.id === habit.id ? { ...h, active: !h.active } : h) }))} />)}</div></section>)}</div>;
  return <div className="fade-in"><PageIntro eyebrow="Your system" title="Habits" description="Keep the list honest. A habit only shows up on the days and schedule you give it." action={<Button onClick={() => { setEditing(null); setShowForm(true); }} testId="button-add-habit">Add habit</Button>} /><div className="mb-10">{showForm && <HabitForm initial={editing} onSave={save} onCancel={() => { setShowForm(false); setEditing(null); }} />}<Section title={`Active · ${active.length}`}>{active.length ? renderGroups(active) : <Empty title="Your active list is clear" text="Add one practice you can return to." action={<Button onClick={() => { setEditing(null); setShowForm(true); }}>Add habit</Button>} />}</Section>{inactive.length > 0 && <div className="mt-10"><Section title={`Inactive · ${inactive.length}`}>{renderGroups(inactive)}</Section></div>}</div></div>;
}
function HabitCard({ habit, store, onEdit, onDelete, onToggle }: { habit: Habit; store: Store; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const values = Object.values(store.records).map(r => r.values[habit.id]).filter(v => v !== undefined);
  const done = values.filter(v => met(habit, v)).length;
  const rate = values.length ? Math.round(done / values.length * 100) : 0;
  return <article className="rounded-xl border hairline bg-card p-5 transition-colors hover:border-primary/40"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="text-sm font-semibold text-foreground">{habit.name}</h4>{habit.active ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.2em] text-primary">Active</span> : <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Inactive</span>}</div>{habit.note && <p className="mt-2 text-xs text-muted-foreground">{habit.note}</p>}</div><div className="flex items-center gap-1"><button onClick={onToggle} className="rounded-lg border hairline bg-background p-2 text-muted-foreground hover:text-foreground" aria-label={habit.active ? 'Deactivate habit' : 'Activate habit'}><RotateCcw size={14} /></button><button onClick={onEdit} className="rounded-lg border hairline bg-background p-2 text-muted-foreground hover:text-foreground" aria-label="Edit habit"><Edit3 size={14} /></button><button onClick={onDelete} className="rounded-lg border hairline bg-background p-2 text-muted-foreground hover:text-foreground" aria-label="Delete habit"><Trash2 size={14} /></button></div></div><div className="mt-4 flex items-center justify-between gap-4 text-xs text-muted-foreground"><span>{habit.tracking} · {habit.target}{habit.tracking === 'yes-no' ? '' : ` ${unit(habit)}`}</span><span>{rate}% complete</span></div></article>;
}
function HabitForm({ initial, onSave, onCancel }: { initial: Habit | null; onSave: (h: Habit) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || 'Personal Development');
  const [customCategory, setCustomCategory] = useState(initial?.customCategory || '');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'custom'>(initial?.frequency || 'daily');
  const [days, setDays] = useState<number[]>(initial?.days || [1, 2, 3, 4, 5, 6, 0]);
  const [tracking, setTracking] = useState<Tracking>(initial?.tracking || 'yes-no');
  const [target, setTarget] = useState(initial?.target || 1);
  const [note, setNote] = useState(initial?.note || '');
  const [active, setActive] = useState(initial?.active ?? true);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!name.trim() || (category === 'Other' && !customCategory.trim())) return; onSave({ id: initial?.id || uid(), name: name.trim(), category, customCategory: category === 'Other' ? customCategory.trim() : undefined, frequency, days, tracking, target, note: note.trim(), active }); };
  const toggleDay = (day: number) => setDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day]);
  return <form onSubmit={submit} className="mb-8 rounded-xl border border-primary/40 bg-card p-6 md:p-8"><div className="mb-6 flex items-center justify-between"><h2 className="text-sm font-bold">{initial ? 'Edit habit' : 'Create habit'}</h2><button type="button" onClick={onCancel} className="text-sm text-muted-foreground">Cancel</button></div><div className="grid gap-5 md:grid-cols-2"> <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Habit name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground" placeholder="Study" /></div><div><label className="mb-2 block text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Category</label><select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground"><option>{habitCategories.join('</option><option>')}</option></select></div><div>{category === 'Other' && <><label className="mb-2 block text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Custom category</label><input value={customCategory} onChange={e => setCustomCategory(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground" placeholder="Personal" /></>}</div><div><label className="mb-2 block text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Frequency</label><select value={frequency} onChange={e => setFrequency(e.target.value as 'daily' | 'weekdays' | 'custom')} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground"><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="custom">Custom</option></select></div><div><label className="mb-2 block text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Tracking</label><select value={tracking} onChange={e => setTracking(e.target.value as Tracking)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground"><option value="yes-no">Yes / No</option><option value="count">Count</option><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="quantity">Quantity</option></select></div><div><label className="mb-2 block text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Target</label><input value={target} onChange={e => setTarget(Number(e.target.value) || 1)} type="number" min="1" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground" /></div><div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Note</label><input value={note} onChange={e => setNote(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground" placeholder="Optional context" /></div>{frequency === 'custom' && <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Selected days</label><div className="flex flex-wrap gap-2">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, index) => <button key={label} type="button" onClick={() => toggleDay(index === 0 ? 0 : index)} className={`rounded-lg border px-2.5 py-2 text-xs font-semibold ${days.includes(index === 0 ? 0 : index) ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-muted-foreground'}`}>{label}</button>)}</div></div>}<div className="md:col-span-2 flex items-center justify-between"><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Active habit</label><div className="flex gap-2"><button type="button" onClick={onCancel} className="rounded-lg border hairline bg-background px-3 py-2 text-sm font-semibold text-muted-foreground">Cancel</button><button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Save</button></div></div></div></form>;
}

function Progress({ store }: { store: Store }) {
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState(shiftDate(todayKey(), -13));
  const [customEnd, setCustomEnd] = useState(todayKey());
  const end = todayKey();
  const start = range === 'today' ? end : range === 'week' ? shiftDate(end, -6) : range === 'month' ? shiftDate(end, -29) : customStart;
  const keys = Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => shiftDate(start, i));
  const scheduled = keys.flatMap(key => store.habits.filter(h => h.active && isScheduled(h, key)).map(h => ({ h, key })));
  const completed = scheduled.filter(({ h, key }) => met(h, store.records[key]?.values[h.id])).length;
  return <div className="fade-in"><PageIntro eyebrow="The wider view" title="Progress" description="Patterns, not pressure. See what your actual records say over time." /><div className="mb-8 flex flex-wrap gap-2">{(['today','week','month','custom'] as const).map(option => <button key={option} onClick={() => setRange(option)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${range === option ? 'bg-primary text-primary-foreground' : 'border hairline bg-card text-muted-foreground hover:bg-secondary'}`}>{option === 'today' ? 'Today' : option === 'week' ? 'This week' : option === 'month' ? 'This month' : 'Custom'}</button>)}</div>{range === 'custom' && <div className="mb-8 grid gap-3 md:grid-cols-2"><label className="space-y-2 text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">Start<input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground" /></label><label className="space-y-2 text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">End<input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground" /></label></div>}<div className="grid gap-5 md:grid-cols-4"> <Stat label="Completed" value={String(completed)} detail={`${scheduled.length ? Math.round(completed / scheduled.length * 100) : 0}% of scheduled`} /><Stat label="Active" value={String(store.habits.filter(h => h.active).length)} detail="Habits in use" /><Stat label="Current streak" value={String(currentStreak(store, todayKey()))} detail="Days in a row" /><Stat label="Longest" value={String(Math.max(...store.habits.map(h => longestStreak(store, h))))} detail="Best run" /></div></div>;
}

function History({ store, setSelectedDate, onNavigate }: { store: Store; setSelectedDate: (d: string) => void; onNavigate: () => void }) {
  const keys = Array.from({ length: 30 }, (_, i) => shiftDate(todayKey(), -i));
  const rowPct = (key: string) => { const hs = store.habits.filter(h => h.active && isScheduled(h, key)); return hs.length ? Math.round(hs.filter(h => met(h, store.records[key]?.values[h.id])).length / hs.length * 100) : 0; };
  return <div className="fade-in"><PageIntro eyebrow="A faithful record" title="History" description="Look back without rewriting the story. Every day keeps its actual values and notes." /><div className="rounded-xl border hairline bg-card p-4"><div className="grid gap-2">{keys.map(key => <button key={key} onClick={() => { setSelectedDate(key); onNavigate(); }} className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-secondary"><div><p className="text-sm font-semibold text-foreground">{fmtDate(key)}</p><p className="text-xs text-muted-foreground">{rowPct(key)}% complete</p></div><div className="flex items-center gap-3"><span className="mono text-xs text-muted-foreground">{rowPct(key)}%</span><div className="h-2 w-20 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${rowPct(key)}%` }} /></div></div></button>)}</div></div></div>;
}

function Settings({ store, setStore }: { store: Store; setStore: (fn: (s: Store) => Store) => void }) {
  const file = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); setStore(() => normalizeStore(parsed)); } catch { window.alert('Invalid data file'); } }; reader.readAsText(f); };
  const exportData = () => { const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'habitr-data.json'; a.click(); URL.revokeObjectURL(a.href); };
  return <div className="fade-in"><PageIntro eyebrow="Keep it yours" title="Settings" description="Habitr stores everything in this browser. Export a copy whenever you need one." /><div className="grid gap-5 md:grid-cols-2"><div className="rounded-xl border hairline bg-card p-5"><p className="text-sm font-semibold">Theme</p><div className="mt-4 flex gap-2"><button onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, theme: 'dark' } }))} className={`rounded-lg px-3 py-2 text-xs font-semibold ${store.settings.theme === 'dark' ? 'bg-primary text-primary-foreground' : 'border hairline bg-background text-muted-foreground'}`}>Dark</button><button onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, theme: 'light' } }))} className={`rounded-lg px-3 py-2 text-xs font-semibold ${store.settings.theme === 'light' ? 'bg-primary text-primary-foreground' : 'border hairline bg-background text-muted-foreground'}`}>Light</button></div></div><div className="rounded-xl border hairline bg-card p-5"><p className="text-sm font-semibold">Week starts</p><div className="mt-4 flex gap-2"><button onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, weekStarts: 0 } }))} className={`rounded-lg px-3 py-2 text-xs font-semibold ${store.settings.weekStarts === 0 ? 'bg-primary text-primary-foreground' : 'border hairline bg-background text-muted-foreground'}`}>Sun</button><button onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, weekStarts: 1 } }))} className={`rounded-lg px-3 py-2 text-xs font-semibold ${store.settings.weekStarts === 1 ? 'bg-primary text-primary-foreground' : 'border hairline bg-background text-muted-foreground'}`}>Mon</button></div></div><div className="rounded-xl border hairline bg-card p-5"><p className="text-sm font-semibold">Data management</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={exportData} className="rounded-lg border hairline bg-background px-3 py-2 text-xs font-semibold text-foreground">Export</button><label className="rounded-lg border hairline bg-background px-3 py-2 text-xs font-semibold text-foreground cursor-pointer">Import<input type="file" accept="application/json" onChange={file} className="hidden" /></label><button onClick={() => { if (window.confirm('Reset all stored Habitr data?')) setStore(() => initialStore); }} className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">Reset</button></div></div></div></div>;
}

function AuthLoading() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background text-sm text-muted-foreground">Loading your private workspace…</div>;
}

function PublicLanding() {
  return <div className="min-h-[100dvh] bg-background text-foreground"><header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-10"><Link href="/" className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><SlidersHorizontal size={16} /></span><span className="text-[15px] font-bold tracking-[-.02em]">Habitr</span></Link><nav className="hidden items-center gap-6 md:flex"><a href="#how-it-works" className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">How it works</a><Link href="/sign-in" className="rounded-lg px-3.5 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">Sign in</Link><Link href="/sign-up" className="rounded-lg bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground transition-all hover:brightness-110">Create account</Link></nav><div className="flex items-center gap-2 md:hidden"><Link href="/sign-in" className="rounded-lg px-3 py-2 text-xs font-bold text-muted-foreground">Sign in</Link><Link href="/sign-up" className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Create account</Link></div></header><main className="mx-auto max-w-6xl px-5 pb-20 pt-16 md:px-10 md:pt-24"><section className="grid gap-12 md:grid-cols-[1.1fr_.9fr] md:items-center"><div><p className="mono mb-5 text-[10px] uppercase tracking-[.2em] text-primary">Private habit tracking</p><h1 className="max-w-2xl text-5xl font-bold leading-[1.03] tracking-[-.06em] md:text-7xl">Make your everyday habits easier to keep.</h1><p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground">Habitr gives you one calm place to plan small practices, check in honestly, and understand your progress over time.</p><div className="mt-9 flex flex-wrap items-center gap-3"><Link href="/sign-up" className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-all hover:brightness-110">Create your account</Link><Link href="/sign-in" className="rounded-lg border hairline bg-card px-5 py-3 text-sm font-bold transition-colors hover:bg-secondary">Sign in</Link></div><p className="mt-5 text-xs text-muted-foreground">Start with Google or email. Your habits stay private to your account.</p></div></section></main></div>;
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
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground outline-none ring-0" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground outline-none ring-0" />
          <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">{isLoading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50">Continue with Google</button>
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
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground outline-none ring-0" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground outline-none ring-0" />
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground outline-none ring-0" />
          <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">{isLoading ? 'Creating account...' : 'Create account'}</button>
        </form>
        <button onClick={handleGoogleSignUp} disabled={isLoading} className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50">Continue with Google</button>
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
  return <RouterApp user={undefined as any} onSignOut={() => {}} />;
}

const queryClient = new QueryClient();
function RouterApp({ user, onSignOut }: { user: any; onSignOut: () => void }) {
  const [, setLocation] = useLocation();
  const userId = user?.id || 'unknown';
  const [store, setStoreState] = useState<Store>(() => loadStore(userId));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const setStore = (fn: (s: Store) => Store) => setStoreState(s => fn(s));
  useEffect(() => { setStoreState(loadStore(userId)); }, [userId]);
  useEffect(() => { localStorage.setItem(storeKey(userId), JSON.stringify(store)); document.documentElement.classList.toggle('light', store.settings.theme === 'light'); document.title = 'Habitr'; }, [store, userId]);
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
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Supabase session error:', error);
        }
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
      } catch (error) {
        console.error('Failed to load Supabase session:', error);
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
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
