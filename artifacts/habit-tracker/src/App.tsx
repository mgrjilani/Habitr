import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Download, Edit3, Flame, History as HistoryIcon, LayoutGrid, Menu, Moon, MoreHorizontal, Plus, RotateCcw, Settings as SettingsIcon, SlidersHorizontal, Sun, Target, Trash2, Upload, X } from 'lucide-react';
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

function AppShell({ children, store, onNavigate }: { children: ReactNode; store: Store; onNavigate: () => void }) {
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const today = todayKey();
  const todayPct = completion(store.habits.filter(h => h.active), store.records[today]);
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const accountName = user?.firstName || email.split('@')[0] || 'Your account';
  const requestSignOut = () => {
    if (window.confirm('Are you sure you want to log out of Habitr? Your saved data will remain on this device.')) {
      void signOut({ redirectUrl: basePath || '/' });
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
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => { setMobileNav(false); onNavigate(); }} data-testid={`link-nav-${label.toLowerCase()}`} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors ${location === href ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'}`}>
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
            <button type="button" onClick={requestSignOut} className="rounded-lg border hairline bg-card px-3 py-2 text-left transition-colors hover:bg-secondary" title="Sign out" data-testid="button-sign-out">
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
  return <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p><h1 className="text-3xl font-bold tracking-[-.045em] md:text-[38px]">{title}</h1>{description && <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action}</div>;
}
function Button({ children, onClick, variant = 'solid', type = 'button', className = '', disabled = false, testId }: { children: ReactNode; onClick?: () => void; variant?: 'solid' | 'outline' | 'ghost' | 'danger'; type?: 'button' | 'submit'; className?: string; disabled?: boolean; testId?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 ${variant === 'solid' ? 'bg-primary text-primary-foreground hover:brightness-110' : variant === 'danger' ? 'border border-destructive/40 text-destructive hover:bg-destructive/10' : variant === 'outline' ? 'border hairline bg-card text-foreground hover:bg-secondary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'} ${className}`}>{children}</button>;
}
function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="border-l-2 border-primary/40 pl-4"><p className="mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-[-.04em]">{value}</p>{detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}</div>; }
function Section({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) { return <section className={className}><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold">{title}</h2>{action}</div>{children}</section>; }

function Today({ store, selectedDate, setSelectedDate, saveRecord }: { store: Store; selectedDate: string; setSelectedDate: (v: string) => void; saveRecord: (date: string, habitId: string, value: number, note?: string) => void }) {
  const active = store.habits.filter(h => h.active && isScheduled(h, selectedDate));
  const record = store.records[selectedDate];
  const pct = active.length ? Math.round(active.filter(h => met(h, record?.values[h.id])).length / active.length * 100) : 0;
  const isToday = selectedDate === todayKey();
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDate(selectedDate, i - 6));
  const dayPct = (key: string) => { const hs = store.habits.filter(h => h.active && isScheduled(h, key)); return hs.length ? Math.round(hs.filter(h => met(h, store.records[key]?.values[h.id])).length / hs.length * 100) : 0; };
  return <div className="fade-in">
    <PageIntro eyebrow={isToday ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()) : 'Daily record'} title={isToday ? 'Make today count.' : fmtDate(selectedDate)} description={isToday ? 'A clear place to check in. Partial progress stays honest; completed means the target was met.' : 'Reviewing a previous day. Your changes are saved locally.'} action={<div className="flex items-center gap-2"><Button variant="outline" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} testId="button-previous-day"><ChevronLeft size={16} /></Button><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="h-10 rounded-lg border hairline bg-card px-3 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring" data-testid="input-today-date" /><Button variant="outline" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} testId="button-next-day"><ChevronRight size={16} /></Button></div>} />
    <div className="mb-9 grid gap-5 md:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-xl border hairline bg-card p-6 md:p-8"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">{isToday ? 'Your check-in' : 'Day summary'}</p><p className="mt-1 text-xs text-muted-foreground">{active.length} scheduled {active.length === 1 ? 'practice' : 'practices'}</p></div><div className="text-right"><span className="mono text-4xl font-medium tracking-[-.08em] text-primary">{pct}%</span><p className="mt-1 text-[10px] uppercase tracking-[.15em] text-muted-foreground">complete</p></div></div><div className="mt-7 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} /></div><p className="mt-4 text-xs text-muted-foreground">{pct === 100 ? 'Everything scheduled is complete.' : pct > 0 ? 'Keep going, or leave the rest for another day.' : 'Start with one small check-in.'}</p></div>
      <div className="rounded-xl border hairline bg-card p-6 md:p-8"><div className="flex items-center gap-2"><Flame size={15} className="text-accent" /><p className="text-sm font-semibold">Streak context</p></div><p className="mt-5 text-3xl font-bold tracking-[-.05em]">{currentStreak(store, selectedDate)} <span className="text-sm font-medium text-muted-foreground">day current streak</span></p><p className="mt-2 text-xs leading-5 text-muted-foreground">A streak is counted by completed scheduled days, not by opening the app.</p></div>
    </div>
    <Section title="Daily practices" action={<span className="mono text-[10px] text-muted-foreground">{active.filter(h => met(h, record?.values[h.id])).length} / {active.length}</span>}>
      {active.length === 0 ? <Empty title="Nothing scheduled" text="Add an active habit or enjoy the space." action={<Link href="/habits" className="text-xs font-bold text-primary">Manage habits</Link>} /> : <div className="overflow-hidden rounded-xl border hairline bg-card">{active.map((habit, index) => <HabitCheck key={habit.id} habit={habit} value={record?.values[habit.id] || 0} onSave={v => saveRecord(selectedDate, habit.id, v)} last={index === active.length - 1} />)}</div>}
    </Section>
    <Section title="This week" className="mt-10"><div className="grid grid-cols-7 gap-1.5 md:gap-3">{weekDays.map(key => <button key={key} onClick={() => setSelectedDate(key)} data-testid={`button-week-${key}`} className={`group rounded-lg border p-2 text-center transition-colors ${key === selectedDate ? 'border-primary bg-primary/10' : 'hairline bg-card hover:bg-secondary'}`}><span className="block text-[10px] uppercase text-muted-foreground">{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${key}T12:00:00`))}</span><span className="mono my-2 block text-sm">{new Date(`${key}T12:00:00`).getDate()}</span><span className={`mx-auto block size-2 rounded-full ${dayPct(key) === 100 ? 'bg-primary' : dayPct(key) > 0 ? 'bg-accent' : 'bg-secondary'}`} /></button>)}</div></Section>
  </div>;
}
function HabitCheck({ habit, value, onSave, last }: { habit: Habit; value: number; onSave: (v: number) => void; last: boolean }) {
  const [draft, setDraft] = useState(String(value || ''));
  useEffect(() => setDraft(value ? String(value) : ''), [value]);
  const done = met(habit, value);
  const submit = () => onSave(habit.tracking === 'yes-no' ? done ? 0 : 1 : Math.max(0, Number(draft) || 0));
  return <div className={`flex items-center gap-4 px-5 py-4 ${!last ? 'border-b hairline' : ''}`}><button onClick={submit} aria-label={`Mark ${habit.name}`} data-testid={`button-complete-${habit.id}`} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-all ${done ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent hover:border-primary'}`}><Check size={17} strokeWidth={2.5} /></button><div className="min-w-0 flex-1"><p className={`text-sm font-semibold ${done ? 'text-muted-foreground line-through' : ''}`}>{habit.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{categoryLabel(habit)} · target {habit.tracking === 'yes-no' ? 'done' : `${habit.target} ${unit(habit)}`}</p></div>{habit.tracking === 'yes-no' ? <span className={`text-xs font-bold ${done ? 'text-primary' : 'text-muted-foreground'}`}>{done ? 'Done' : 'Open'}</span> : <div className="flex items-center gap-2"><input value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => onSave(Math.max(0, Number(draft) || 0))} type="number" min="0" aria-label={`${habit.name} actual`} data-testid={`input-value-${habit.id}`} className="w-16 rounded-md border hairline bg-secondary px-2 py-2 text-right text-xs outline-none focus:border-primary" /><span className="mono text-[10px] text-muted-foreground">/ {habit.target} {unit(habit)}</span></div>}</div>;
}
function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) { return <div className="rounded-xl border border-dashed hairline bg-card/40 px-6 py-12 text-center"><Circle size={20} className="mx-auto text-muted-foreground" /><p className="mt-4 text-sm font-semibold">{title}</p><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{text}</p>{action && <div className="mt-5">{action}</div>}</div>; }

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
  const renderGroups = (habits: Habit[]) => <div className="space-y-8">{grouped(habits).map(group => <section key={group.category} data-testid={`section-category-${group.category.toLowerCase().replaceAll(' ', '-')}`}><div className="mb-3 flex items-center gap-3"><h3 className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">{group.category === 'Other' ? 'Other (manual)' : group.category}</h3><span className="mono text-[10px] text-primary">{group.habits.length}</span><div className="h-px flex-1 bg-border/60" /></div><div className="grid gap-3 md:grid-cols-2">{group.habits.map(h => <HabitCard key={h.id} habit={h} store={store} onEdit={() => { setEditing(h); setShowForm(true); }} onDelete={() => remove(h.id)} onToggle={() => setStore(s => ({ ...s, habits: s.habits.map(x => x.id === h.id ? { ...x, active: !x.active } : x) }))} />)}</div></section>)}</div>;
  return <div className="fade-in"><PageIntro eyebrow="Your system" title="Habits" description="Keep the list honest. A habit only shows up on the days and schedule you give it." action={<Button onClick={() => { setEditing(null); setShowForm(true); }} testId="button-add-habit"><Plus size={16} /> Add habit</Button>} />
    {showForm && <HabitForm initial={editing} onSave={save} onCancel={() => { setShowForm(false); setEditing(null); }} />}
     <div className="mb-10"><Section title={`Active · ${active.length}`}>{active.length ? renderGroups(active) : <Empty title="Your active list is clear" text="Add one practice you can return to." />}</Section></div>
      {inactive.length > 0 && <Section title={`Inactive · ${inactive.length}`}>{renderGroups(inactive)}</Section>}
  </div>;
}
function HabitCard({ habit, store, onEdit, onDelete, onToggle }: { habit: Habit; store: Store; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const values = Object.values(store.records).map(r => r.values[habit.id]).filter(v => v !== undefined); const done = values.filter(v => met(habit, v)).length; const rate = values.length ? Math.round(done / values.length * 100) : 0;
  return <article className="rounded-xl border hairline bg-card p-5 transition-colors hover:border-primary/40"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-sm font-bold">{habit.name}</h3><span className="rounded bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{categoryLabel(habit)}</span></div><p className="mt-2 text-xs text-muted-foreground">{habit.frequency === 'daily' ? 'Every day' : habit.frequency === 'weekdays' ? 'Weekdays' : 'Selected days'} · {habit.tracking === 'yes-no' ? 'Yes / no' : `${habit.target} ${unit(habit)}`}</p></div><button onClick={onEdit} className="text-muted-foreground hover:text-foreground" aria-label={`Edit ${habit.name}`} data-testid={`button-edit-${habit.id}`}><MoreHorizontal size={18} /></button></div><div className="mt-6 grid grid-cols-3 gap-3"><Stat label="Current" value={`${currentHabitStreak(store, habit, todayKey())}d`} /><Stat label="Longest" value={`${longestStreak(store, habit)}d`} /><Stat label="Rate" value={`${rate}%`} /></div><div className="mt-5 flex gap-2 border-t hairline pt-4"><Button variant="ghost" onClick={onToggle} className="px-2.5">{habit.active ? 'Pause habit' : 'Reactivate'}</Button><Button variant="ghost" onClick={onDelete} className="ml-auto px-2.5 text-destructive hover:bg-destructive/10"><Trash2 size={14} /> Delete</Button></div></article>;
}
function HabitForm({ initial, onSave, onCancel }: { initial: Habit | null; onSave: (h: Habit) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || ''); const [category, setCategory] = useState(initial?.category || 'Personal Development'); const [customCategory, setCustomCategory] = useState(initial?.customCategory || ''); const [frequency, setFrequency] = useState<Habit['frequency']>(initial?.frequency || 'daily'); const [tracking, setTracking] = useState<Tracking>(initial?.tracking || 'yes-no'); const [target, setTarget] = useState(String(initial?.target || 1)); const [note, setNote] = useState(initial?.note || '');
  const submit = (e: FormEvent) => { e.preventDefault(); if (!name.trim() || (category === 'Other' && !customCategory.trim())) return; onSave({ id: initial?.id || uid(), name: name.trim(), category, customCategory: category === 'Other' ? customCategory.trim() : undefined, frequency, days: frequency === 'custom' ? [1,2,3,4,5] : [0,1,2,3,4,5,6], tracking, target: tracking === 'yes-no' ? 1 : Math.max(.1, Number(target) || 1), note, active: initial?.active ?? true }); };
  return <form onSubmit={submit} className="mb-8 rounded-xl border border-primary/40 bg-card p-6 md:p-8"><div className="mb-6 flex items-center justify-between"><h2 className="text-sm font-bold">{initial ? 'Edit habit' : 'New habit'}</h2><button type="button" onClick={onCancel} className="text-muted-foreground" aria-label="Close form" data-testid="button-close-habit-form"><X size={18} /></button></div><div className="grid gap-5 md:grid-cols-2"><label className="text-xs font-semibold">Name<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Write in journal" className="mt-2 w-full rounded-lg border hairline bg-secondary px-3 py-3 text-sm outline-none focus:border-primary" data-testid="input-habit-name" /></label><label className="text-xs font-semibold">Category<select value={category} onChange={e => setCategory(e.target.value)} className="mt-2 w-full rounded-lg border hairline bg-secondary px-3 py-3 text-sm outline-none" data-testid="select-habit-category">{habitCategories.map(option => <option key={option} value={option}>{option === 'Other' ? 'Other (manual)' : option}</option>)}</select></label>{category === 'Other' && <label className="text-xs font-semibold">Manual category<input required value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="e.g. Family" className="mt-2 w-full rounded-lg border hairline bg-secondary px-3 py-3 text-sm outline-none focus:border-primary" data-testid="input-habit-custom-category" /></label>}<label className="text-xs font-semibold">Schedule<select value={frequency} onChange={e => setFrequency(e.target.value as Habit['frequency'])} className="mt-2 w-full rounded-lg border hairline bg-secondary px-3 py-3 text-sm outline-none" data-testid="select-habit-frequency"><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="custom">Custom weekdays</option></select></label><label className="text-xs font-semibold">Tracking<select value={tracking} onChange={e => setTracking(e.target.value as Tracking)} className="mt-2 w-full rounded-lg border hairline bg-secondary px-3 py-3 text-sm outline-none" data-testid="select-habit-tracking"><option value="yes-no">Yes / no</option><option value="count">Count</option><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="quantity">Quantity</option></select></label>{tracking !== 'yes-no' && <label className="text-xs font-semibold">Target<input type="number" min=".1" step=".1" value={target} onChange={e => setTarget(e.target.value)} className="mt-2 w-full rounded-lg border hairline bg-secondary px-3 py-3 text-sm outline-none focus:border-primary" data-testid="input-habit-target" /></label>}<label className={`text-xs font-semibold ${tracking === 'yes-no' ? 'md:col-span-2' : ''}`}>Note <span className="font-normal text-muted-foreground">optional</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="What does good enough look like?" className="mt-2 w-full rounded-lg border hairline bg-secondary px-3 py-3 text-sm outline-none focus:border-primary" data-testid="input-habit-note" /></label></div><div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit" testId="button-save-habit">{initial ? 'Save changes' : 'Create habit'}</Button></div></form>;
}

function Progress({ store }: { store: Store }) {
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'custom'>('week'); const [customStart, setCustomStart] = useState(shiftDate(todayKey(), -13)); const [customEnd, setCustomEnd] = useState(todayKey());
  const end = todayKey(); const start = range === 'today' ? end : range === 'week' ? shiftDate(end, -6) : range === 'month' ? shiftDate(end, -29) : customStart; const keys = Array.from({ length: Math.max(1, daysBetween(start, customEnd || end) + 1) }, (_, i) => shiftDate(start, i)).filter(k => k <= (range === 'custom' ? customEnd : end));
  const scheduled = keys.flatMap(key => store.habits.filter(h => h.active && isScheduled(h, key)).map(h => ({ h, key }))); const completed = scheduled.filter(({ h, key }) => met(h, store.records[key]?.values[h.id])).length; const pct = scheduled.length ? Math.round(completed / scheduled.length * 100) : 0; const completedDays = keys.filter(k => { const hs = store.habits.filter(h => h.active && isScheduled(h, k)); return hs.length && hs.every(h => met(h, store.records[k]?.values[h.id])); }).length;
  return <div className="fade-in"><PageIntro eyebrow="The wider view" title="Progress" description="Patterns, not pressure. See what your actual records say over time." /><div className="mb-8 flex flex-wrap gap-1 rounded-lg border hairline bg-card p-1">{(['today','week','month','custom'] as const).map(r => <button key={r} onClick={() => setRange(r)} data-testid={`button-range-${r}`} className={`rounded-md px-4 py-2 text-xs font-bold capitalize ${range === r ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{r === 'today' ? 'Today' : r === 'week' ? 'Last 7 days' : r === 'month' ? 'Last 30 days' : 'Custom'}</button>)}</div>{range === 'custom' && <div className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border hairline bg-card p-4"><label className="text-[10px] uppercase tracking-widest text-muted-foreground">From<input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="mt-2 block rounded border hairline bg-secondary px-2 py-2 text-xs" /></label><label className="text-[10px] uppercase tracking-widest text-muted-foreground">To<input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="mt-2 block rounded border hairline bg-secondary px-2 py-2 text-xs" /></label></div>}<div className="grid gap-5 md:grid-cols-4"><Stat label="Completion" value={`${pct}%`} detail={`${completed} of ${scheduled.length} targets`} /><Stat label="Consistency" value={`${keys.length ? Math.round(completedDays / keys.length * 100) : 0}%`} detail={`${completedDays} fully completed days`} /><Stat label="Current streak" value={`${currentStreak(store, end)}d`} detail="Across all scheduled habits" /><Stat label="Days tracked" value={`${keys.filter(k => store.records[k]).length}`} detail={`of ${keys.length} in range`} /></div><div className="mt-10 grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><Section title="Completion by day" className="rounded-xl border hairline bg-card p-6"><div className="flex h-48 items-end gap-2 pt-6">{keys.map(key => { const hs = store.habits.filter(h => h.active && isScheduled(h, key)); const value = hs.length ? Math.round(hs.filter(h => met(h, store.records[key]?.values[h.id])).length / hs.length * 100) : 0; return <div key={key} className="group flex min-w-0 flex-1 flex-col items-center gap-2"><div className="relative flex h-36 w-full items-end"><div className={`w-full rounded-t-sm transition-all ${value === 100 ? 'bg-primary' : value > 0 ? 'bg-accent/70' : 'bg-secondary'}`} style={{ height: `${Math.max(value ? 8 : 3, value)}%` }} title={`${fmtDate(key, { month: 'short', day: 'numeric' })}: ${value}%`} /></div><span className="mono text-[9px] text-muted-foreground">{new Date(`${key}T12:00:00`).getDate()}</span></div> })}</div></Section><Section title="Target vs actual" className="rounded-xl border hairline bg-card p-6"><div className="space-y-5">{store.habits.filter(h => h.active).slice(0, 5).map(h => { const actual = scheduled.filter(x => x.h.id === h.id).reduce((sum, x) => sum + (store.records[x.key]?.values[h.id] || 0), 0); const target = h.tracking === 'yes-no' ? scheduled.filter(x => x.h.id === h.id).length : h.target * scheduled.filter(x => x.h.id === h.id).length; return <div key={h.id}><div className="mb-2 flex justify-between text-xs"><span>{h.name}</span><span className="mono text-muted-foreground">{Math.round(actual * 10) / 10} / {Math.round(target * 10) / 10}</span></div><div className="h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, target ? actual / target * 100 : 0)}%` }} /></div></div> })}</div></Section></div></div>;
}

function History({ store, setSelectedDate, onNavigate }: { store: Store; setSelectedDate: (d: string) => void; onNavigate: () => void }) {
  const keys = Array.from({ length: 30 }, (_, i) => shiftDate(todayKey(), -i)); const rowPct = (key: string) => { const hs = store.habits.filter(h => h.active && isScheduled(h, key)); return hs.length ? Math.round(hs.filter(h => met(h, store.records[key]?.values[h.id])).length / hs.length * 100) : 0; };
  return <div className="fade-in"><PageIntro eyebrow="A faithful record" title="History" description="Look back without rewriting the story. Every day keeps its actual values and notes." /><div className="overflow-hidden rounded-xl border hairline bg-card"><div className="grid grid-cols-[1fr_110px_80px] border-b hairline px-5 py-3 text-[10px] uppercase tracking-[.14em] text-muted-foreground"><span>Date</span><span>Completion</span><span /></div>{keys.map(key => { const pct = rowPct(key); const has = !!store.records[key]; return <div key={key} className="grid grid-cols-[1fr_110px_80px] items-center border-b hairline px-5 py-4 last:border-0"><div><p className="text-xs font-semibold">{key === todayKey() ? 'Today' : fmtDate(key, { weekday: 'short', month: 'short', day: 'numeric' })}</p><p className="mt-1 text-[10px] text-muted-foreground">{has ? `${Object.keys(store.records[key].values).length} values recorded` : 'No check-in'}</p></div><div className="flex items-center gap-3"><span className={`mono text-xs ${pct === 100 ? 'text-primary' : 'text-foreground'}`}>{has ? `${pct}%` : '—'}</span><div className="hidden h-1 w-12 rounded-full bg-secondary sm:block"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div></div><Button variant="ghost" onClick={() => { setSelectedDate(key); onNavigate(); }} className="justify-self-end px-2" testId={`button-edit-history-${key}`}><Edit3 size={14} /><span className="sr-only">Edit</span></Button></div>})}</div></div>;
}

function Settings({ store, setStore }: { store: Store; setStore: (fn: (s: Store) => Store) => void }) {
  const file = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); if (parsed.habits && parsed.records) setStore(() => normalizeStore({ ...initialStore, ...parsed })); } catch { window.alert('That file could not be read.'); } }; reader.readAsText(f); };
  const exportData = () => { const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `habitr-${todayKey()}.json`; a.click(); URL.revokeObjectURL(a.href); };
  return <div className="fade-in"><PageIntro eyebrow="Keep it yours" title="Settings" description="Habitr stores everything in this browser. Export a copy whenever you need one." /><div className="max-w-2xl space-y-5"><div className="rounded-xl border hairline bg-card p-6"><h2 className="text-sm font-bold">Appearance</h2><p className="mt-1 text-xs text-muted-foreground">Choose the atmosphere that makes checking in feel natural.</p><div className="mt-5 flex gap-2"><Button variant={store.settings.theme === 'dark' ? 'solid' : 'outline'} onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, theme: 'dark' } }))} testId="button-theme-dark"><Moon size={15} /> Dark</Button><Button variant={store.settings.theme === 'light' ? 'solid' : 'outline'} onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, theme: 'light' } }))} testId="button-theme-light"><Sun size={15} /> Light</Button></div></div><div className="rounded-xl border hairline bg-card p-6"><h2 className="text-sm font-bold">Week starts on</h2><div className="mt-4 flex gap-2"><Button variant={store.settings.weekStarts === 1 ? 'solid' : 'outline'} onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, weekStarts: 1 } }))}>Monday</Button><Button variant={store.settings.weekStarts === 0 ? 'solid' : 'outline'} onClick={() => setStore(s => ({ ...s, settings: { ...s.settings, weekStarts: 0 } }))}>Sunday</Button></div></div><div className="rounded-xl border hairline bg-card p-6"><h2 className="text-sm font-bold">Your data</h2><p className="mt-1 text-xs text-muted-foreground">A portable JSON file containing habits, records, and preferences.</p><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" onClick={exportData} testId="button-export"><Download size={15} /> Export data</Button><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border hairline px-3.5 py-2.5 text-xs font-bold hover:bg-secondary"><Upload size={15} /> Import data<input type="file" accept=".json,application/json" onChange={file} className="hidden" data-testid="input-import" /></label></div></div><div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6"><h2 className="text-sm font-bold">Reset workspace</h2><p className="mt-1 text-xs text-muted-foreground">Remove every habit and daily record from this browser. This cannot be undone.</p><Button variant="danger" onClick={() => { if (window.confirm('Reset all habits and records? This cannot be undone.')) setStore(() => ({ ...initialStore, habits: [], records: {} })); }} className="mt-5" testId="button-reset"><RotateCcw size={14} /> Reset all data</Button></div></div></div>;
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
      <div className="flex items-center gap-2 md:hidden"><Link href="/sign-in" className="rounded-lg px-3 py-2 text-xs font-bold text-muted-foreground">Sign in</Link><Link href="/sign-up" className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Join Habitr</Link></div>
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
        <div className="rounded-2xl border hairline bg-card p-6 md:p-8">
          <p className="mono text-[10px] uppercase tracking-[.18em] text-primary">A simple daily rhythm</p>
          <h2 className="mt-4 text-2xl font-bold tracking-[-.04em]">Less planning. More returning.</h2>
          <div className="mt-8 space-y-5">
            {[['01', 'Choose a few habits', 'Keep your list focused on what matters now.'], ['02', 'Check in as you go', 'Mark a habit complete or record partial progress.'], ['03', 'See the pattern', 'Use streaks, history, and progress views to learn what works.']].map(([number, title, text]) => <div key={number} className="flex gap-4"><span className="mono grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[10px] text-primary">{number}</span><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div>)}
          </div>
        </div>
      </section>
    </main>
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-8 px-5 pb-20 md:px-10">
      <div className="mb-8 max-w-xl"><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">Everything in one place</p><h2 className="text-3xl font-bold tracking-[-.05em]">A home for the habits you want to keep.</h2></div>
      <div className="grid gap-4 md:grid-cols-3">
      {[
        ['Your data, your account', 'Different people can use Habitr while keeping completely separate habits and records.'],
        ['Honest progress', 'Track partial effort like 45 of 120 minutes without turning it into a false completion.'],
        ['Useful, not noisy', 'Simple streaks, history, and trend views that help you understand your behavior.'],
      ].map(([title, text]) => <div key={title} className="border-t border-primary/40 pt-5"><h2 className="text-sm font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>)}
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 pb-20 md:px-10">
      <div className="flex flex-col gap-5 rounded-2xl border hairline bg-card p-7 md:flex-row md:items-center md:justify-between md:p-9"><div><p className="text-lg font-bold">Ready to build a better routine?</p><p className="mt-2 text-sm text-muted-foreground">Create your private Habitr account and start with one small habit.</p></div><Link href="/sign-up" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-all hover:brightness-110">Get started</Link></div>
    </section>
  </div>;
}

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Redirect to="/today" /> : <PublicLanding />;
}

function PortalGate() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <RouterApp /> : <Redirect to="/" />;
}

const queryClient = new QueryClient();
function RouterApp() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const userId = user?.id || 'unknown';
  const [store, setStoreState] = useState<Store>(() => loadStore(userId)); const [selectedDate, setSelectedDate] = useState(todayKey);
  const setStore = (fn: (s: Store) => Store) => setStoreState(s => fn(s));
  useEffect(() => { setStoreState(loadStore(userId)); }, [userId]);
  useEffect(() => { localStorage.setItem(storeKey(userId), JSON.stringify(store)); document.documentElement.classList.toggle('light', store.settings.theme === 'light'); document.title = 'Habitr — your daily practice'; }, [store, userId]);
  const saveRecord = (date: string, habitId: string, value: number, note?: string) => setStore(s => ({ ...s, records: { ...s.records, [date]: { values: { ...(s.records[date]?.values || {}), [habitId]: value }, note: note ?? s.records[date]?.note ?? '' } } }));
  const goToday = () => setLocation('/today');
  return <AppShell store={store} onNavigate={() => {}}><Switch><Route path="/today"><Today store={store} selectedDate={selectedDate} setSelectedDate={setSelectedDate} saveRecord={saveRecord} /></Route><Route path="/habits"><Habits store={store} setStore={setStore} /></Route><Route path="/progress"><Progress store={store} /></Route><Route path="/history"><History store={store} setSelectedDate={setSelectedDate} onNavigate={goToday} /></Route><Route path="/settings"><Settings store={store} setStore={setStore} /></Route><Route component={NotFound} /></Switch></AppShell>;
}
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg`, socialButtonsPlacement: 'top' as const, socialButtonsVariant: 'blockButton' as const },
  variables: { colorPrimary: '#4f9f79', colorForeground: '#eeeadd', colorMutedForeground: '#8e9d94', colorDanger: '#df8c82', colorBackground: '#18211d', colorInput: '#141b18', colorInputForeground: '#eeeadd', colorNeutral: '#34413b', fontFamily: 'Manrope, sans-serif', borderRadius: '0.75rem' },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#18211d] rounded-2xl w-[440px] max-w-full overflow-hidden', card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#eeeadd]', headerSubtitle: 'text-[#8e9d94]', socialButtonsBlockButtonText: 'text-[#eeeadd]', formFieldLabel: 'text-[#eeeadd]', footerActionLink: 'text-[#6fb994]', footerActionText: 'text-[#8e9d94]', dividerText: 'text-[#8e9d94]', alertText: 'text-[#eeeadd]', logoBox: 'mb-5', logoImage: 'max-h-8', socialButtonsBlockButton: '!border-[#34413b] !bg-[#141b18] hover:!bg-[#202d26]', formButtonPrimary: '!bg-[#4f9f79] !text-[#102018] hover:!bg-[#65b78d]', formFieldInput: '!border-[#34413b] !bg-[#141b18] !text-[#eeeadd] placeholder:!text-[#71847a]', footerAction: 'border-[#34413b]', dividerLine: 'bg-[#34413b]', alert: 'border-[#76524e] bg-[#30201e]', otpCodeFieldInput: '!border-[#34413b] !bg-[#141b18] !text-[#eeeadd]', formFieldRow: 'text-[#eeeadd]', main: 'bg-transparent',
  },
};

function ClerkApp() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in with Google or your email.' } }, signUp: { start: { title: 'Create your private account', subtitle: 'We’ll send a one-time code to verify your email.' } } }} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/*" component={PortalGate} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() { return <WouterRouter base={basePath}><ClerkApp /></WouterRouter>; }
export default App;
