'use client';
// Ayarlar sayfası: görünüm tercihleri. Yalnızca CSS değişkenleri değişir; shadcn stili (radix-nova) ve iş mantığı aynı kalır.
import { useEffect, useState } from 'react';
import { MessageSquare, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type ThemeKind, type ThemeOption, type ThemeSettings, defaultTheme, resolveScheme, themeGroups, themeKinds, themeStorageKey,
} from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/domain';
import { avatarOptions, useAvatar } from './avatar-store';
import { Avatar, PriorityBadge } from './screen-kit';

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

function readSettings(): ThemeSettings {
  const settings = { ...defaultTheme };
  for (const kind of themeKinds) {
    try {
      const value = localStorage.getItem(themeStorageKey(kind));
      if (value && themeGroups[kind].some(o => o.id === value)) settings[kind] = value;
    } catch {
      // Depolama kapalıysa varsayılanlar kullanılır.
    }
  }
  return settings;
}

function applyScheme(mode: string) {
  const root = document.documentElement;
  const dark = resolveScheme(mode, prefersDark()) === 'dark';
  root.classList.toggle('dark', dark);
  if (dark) root.dataset.scheme = 'dark';
  else delete root.dataset.scheme;
}

function applySetting(kind: ThemeKind, value: string) {
  const root = document.documentElement;
  if (value === defaultTheme[kind]) delete root.dataset[kind];
  else root.dataset[kind] = value;
  if (kind === 'mode') applyScheme(value);
  try {
    if (value === defaultTheme[kind]) localStorage.removeItem(themeStorageKey(kind));
    else localStorage.setItem(themeStorageKey(kind), value);
  } catch {
    // Depolama kapalıysa seçim yalnızca bu oturumda geçerli olur.
  }
}

/** "Sistem" teması seçiliyken bilgisayarın açık/koyu ayarı değişirse uygulamayı ona uydurur. */
export function useThemeSync() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (document.documentElement.dataset.mode === 'system') applyScheme('system'); };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
}

const sections: { kind: ThemeKind; title: string; description: string; lightOnly?: boolean }[] = [
  { kind: 'mode', title: 'Tema', description: 'Sistem seçilirse bilgisayarının açık/koyu ayarını izler.' },
  { kind: 'accent', title: 'Ana renk', description: 'Butonlar, bağlantılar ve seçili öğeler.' },
  { kind: 'bg', title: 'Zemin rengi', description: 'Sayfa zemini ve soluk yüzeyler.', lightOnly: true },
  { kind: 'base', title: 'Gri tonu', description: 'Kenarlıklar, ikincil metinler ve gri yüzeyler (shadcn base color).', lightOnly: true },
  { kind: 'radius', title: 'Köşeler', description: 'Buton, kart ve pencerelerin köşe yuvarlaklığı.' },
  { kind: 'density', title: 'Yoğunluk', description: 'Boşluklar ve satır yükseklikleri. Sıkı, ekrana daha çok iş sığdırır.' },
  { kind: 'font', title: 'Yazı tipi', description: 'Akış: başlıklarda Bricolage Grotesque. Sade: her yerde Instrument Sans. Sistem: bilgisayarının yazı tipi.' },
];

function OptionSample({ kind, option }: { kind: ThemeKind; option: ThemeOption }) {
  if (option.swatch) return <span className="size-5 shrink-0 rounded-full border border-foreground/15" style={{ background: option.swatch }} />;
  if (kind === 'bg' && option.id === 'accent') return <span className="size-5 shrink-0 rounded-full border border-foreground/15 bg-primary/15" />;
  if (kind === 'bg') return <span className="size-5 shrink-0 rounded-full border border-foreground/15 bg-[linear-gradient(135deg,#f3f5f7_50%,#e2e8f0_50%)]" />;
  if (kind === 'mode') {
    const fill = option.id === 'dark' ? 'bg-[#161c23]' : option.id === 'light' ? 'bg-white' : 'bg-[linear-gradient(135deg,#fff_50%,#161c23_50%)]';
    return <span className={cn('size-5 shrink-0 rounded-full border border-foreground/20', fill)} />;
  }
  if (kind === 'radius') {
    const r = option.id === 'sharp' ? 'rounded-[3px]' : option.id === 'round' ? 'rounded-[9px]' : 'rounded-[6px]';
    return <span className={cn('size-5 shrink-0 border-2 border-foreground/50', r)} />;
  }
  if (kind === 'density') {
    const gap = option.id === 'compact' ? 'gap-[2px]' : option.id === 'comfortable' ? 'gap-[5px]' : 'gap-[3.5px]';
    return <span className={cn('flex w-5 shrink-0 flex-col', gap)}>{[0, 1, 2].map(i => <span key={i} className="h-[2px] rounded bg-foreground/50" />)}</span>;
  }
  const face = option.id === 'system' ? 'font-[system-ui]' : option.id === 'plain' ? 'font-sans' : 'font-display';
  return <span className={cn('w-6 shrink-0 text-center text-base leading-none font-semibold', face)}>Aa</span>;
}

export function ThemeSettingsPage({ person }: { person: Profile }) {
  const { avatarId, avatarSrc, setAvatar } = useAvatar(person.id);
  const [settings, setSettings] = useState<ThemeSettings>(() => (typeof window === 'undefined' ? defaultTheme : readSettings()));
  const [systemDark, setSystemDark] = useState(prefersDark);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const dark = resolveScheme(settings.mode, systemDark) === 'dark';
  const changed = themeKinds.some(k => settings[k] !== defaultTheme[k]);

  function choose(kind: ThemeKind, value: string) {
    applySetting(kind, value);
    setSettings(s => ({ ...s, [kind]: value }));
  }
  function reset() {
    for (const kind of themeKinds) applySetting(kind, defaultTheme[kind]);
    setSettings({ ...defaultTheme });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="divide-y rounded-xl border bg-card">
        <section className="grid gap-4 p-5 md:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <h2 id="theme-avatar" className="font-sans text-base font-semibold">Avatar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Üst menüde senin yerine görünür. Seçim bu tarayıcıda saklanır.</p>
          </div>
          <div role="radiogroup" aria-labelledby="theme-avatar" className="flex flex-wrap content-start items-center gap-3">
            {[{ id: null, src: null }, ...avatarOptions].map((option, i) => {
              const active = avatarId === option.id;
              return (
                <button
                  key={option.id ?? 'initial'}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={option.id ? `Avatar ${i}` : 'Baş harf'}
                  title={option.id ? `Avatar ${i}` : 'Baş harf'}
                  onClick={() => setAvatar(option.id)}
                  className={cn(
                    'rounded-full p-0.5 ring-offset-2 ring-offset-card transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    active ? 'ring-2 ring-primary' : 'hover:ring-2 hover:ring-foreground/20',
                  )}
                >
                  {option.src
                    ? <img src={option.src} alt="" width={56} height={56} className="size-14 rounded-full bg-accent object-cover" />
                    : <span className="flex size-14 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground">{person.name.trim().slice(0, 1).toLocaleUpperCase('tr')}</span>}
                </button>
              );
            })}
          </div>
        </section>
        {sections.map(({ kind, title, description, lightOnly }) => {
          const disabled = lightOnly && dark;
          return (
            <section key={kind} className="grid gap-4 p-5 md:grid-cols-[220px_minmax(0,1fr)]" aria-disabled={disabled || undefined}>
              <div>
                <h2 id={`theme-${kind}`} className="font-sans text-base font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{disabled ? 'Koyu temada kullanılmaz; koyu temanın kendi zemini ve gri tonları vardır.' : description}</p>
              </div>
              <div role="radiogroup" aria-labelledby={`theme-${kind}`} className={cn('flex flex-wrap content-start items-start gap-2', disabled && 'pointer-events-none opacity-45')}>
                {themeGroups[kind].map(option => {
                  const active = settings[kind] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={disabled}
                      onClick={() => choose(kind, option.id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                        active ? 'border-primary bg-accent font-semibold text-accent-foreground' : 'bg-background hover:border-foreground/30',
                      )}
                    >
                      <OptionSample kind={kind} option={option} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="font-sans text-sm font-semibold text-muted-foreground">Önizleme</h2>
        <div className="mt-3 rounded-xl bg-secondary/70 p-3">
          <div className="flex items-center gap-2 px-1 pb-3">
            <span className="h-4 w-1 rounded-full bg-state-doing" />
            <span className="font-display text-[15px] font-semibold">Yapılıyor</span>
            <span className="ml-auto text-sm font-semibold text-muted-foreground">2</span>
          </div>
          <article className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Luna Coffee</span><span className="ml-auto">#1042</span></div>
            <h3 className="mt-1.5 font-sans text-sm leading-snug font-semibold">Kasım kampanyası sosyal medya tasarımları</h3>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/2 rounded-full bg-state-doing" /></div>
            <footer className="mt-3 flex items-center gap-2">
              <PriorityBadge priority="Yüksek" />
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MessageSquare className="size-3.5" /> 2</span>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">{person.name.split(' ')[0]} <Avatar name={person.name} src={avatarSrc} size="sm" /></span>
            </footer>
          </article>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button>Talebi aç</Button>
          <Button variant="outline">Vazgeç</Button>
          <Button variant="link" className="px-1">Bağlantı</Button>
        </div>
        <div className="mt-6 border-t pt-4">
          <Button variant="ghost" className="-ml-2 text-muted-foreground" disabled={!changed} onClick={reset}><RotateCcw /> Varsayılana dön</Button>
          <p className="mt-2 text-xs text-muted-foreground">Ayarların yalnızca bu tarayıcıda saklanır; başka bir cihazda varsayılan görünüm açılır.</p>
        </div>
      </aside>
    </div>
  );
}
