'use client';
// Görünüm ayarları: gri tonu (shadcn base color) ve ana renk. Seçim yalnızca bu tarayıcıda saklanır.
import { useState } from 'react';
import { Check, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type ThemeKind, accentColors, baseColors, themeOptions, themeStorage } from '@/lib/theme';

const STORAGE = themeStorage;
type Kind = ThemeKind;
const options = themeOptions;

function readStored(kind: Kind): string {
  const fallback = options[kind][0].id;
  try {
    const value = localStorage.getItem(STORAGE[kind]);
    return value && options[kind].some(o => o.id === value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function applyTheme(kind: Kind, value: string) {
  const root = document.documentElement;
  if (value === options[kind][0].id) delete root.dataset[kind];
  else root.dataset[kind] = value;
  try {
    localStorage.setItem(STORAGE[kind], value);
  } catch {
    // Depolama kapalıysa seçim yalnızca bu oturumda geçerli olur.
  }
}

export function ThemeSettings() {
  const [base, setBase] = useState(() => (typeof window === 'undefined' ? baseColors[0].id : readStored('base')));
  const [accent, setAccent] = useState(() => (typeof window === 'undefined' ? accentColors[0].id : readStored('accent')));

  const choose = (kind: Kind, value: string) => {
    applyTheme(kind, value);
    if (kind === 'base') setBase(value as typeof base);
    else setAccent(value as typeof accent);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Görünüm ayarları"><Settings /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Gri tonu</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={base} onValueChange={v => choose('base', v)}>
          {baseColors.map(c => (
            // Seçince menü kapanmasın; kullanıcı renkleri art arda deneyebilsin.
            <DropdownMenuRadioItem key={c.id} value={c.id} onSelect={e => e.preventDefault()}>
              <span className="size-4 rounded-full border border-foreground/15" style={{ background: c.swatch }} />
              {c.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Ana renk</DropdownMenuLabel>
        <div className="grid grid-cols-6 gap-1.5 px-2 pt-1 pb-2" role="radiogroup" aria-label="Ana renk">
          {accentColors.map(c => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={accent === c.id}
              aria-label={c.label}
              title={c.label}
              onClick={() => choose('accent', c.id)}
              className="flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-popover outline-none focus-visible:ring-2 focus-visible:ring-ring aria-checked:ring-2 aria-checked:ring-foreground/40"
              style={{ background: c.swatch }}
            >
              {accent === c.id && <Check className="size-3.5" />}
            </button>
          ))}
        </div>
        <p className="px-2 pb-1.5 text-xs text-muted-foreground">Seçimin yalnızca bu tarayıcıda saklanır.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
