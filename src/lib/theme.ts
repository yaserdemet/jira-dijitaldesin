// Görünüm temaları. Hem sunucu (layout.tsx) hem istemci (theme-settings.tsx) kullanır; bu yüzden 'use client' içermez.

// İlk seçenekler varsayılandır (globals.css :root); onlar için <html>'e öznitelik yazılmaz.
export const baseColors = [
  { id: 'paper', label: 'Kâğıt', swatch: '#e7ebef' },
  { id: 'neutral', label: 'Neutral', swatch: '#d4d4d4' },
  { id: 'stone', label: 'Stone', swatch: '#d6d3d1' },
  { id: 'zinc', label: 'Zinc', swatch: '#d4d4d8' },
  { id: 'gray', label: 'Gray', swatch: '#d1d5db' },
  { id: 'slate', label: 'Slate', swatch: '#cbd5e1' },
] as const;

export const accentColors = [
  { id: 'cyan', label: 'Camgöbeği', swatch: '#0b76ae' },
  { id: 'blue', label: 'Mavi', swatch: '#1d4ed8' },
  { id: 'green', label: 'Yeşil', swatch: '#15803d' },
  { id: 'violet', label: 'Mor', swatch: '#6d28d9' },
  { id: 'orange', label: 'Turuncu', swatch: '#c2410c' },
  { id: 'pink', label: 'Pembe', swatch: '#be185d' },
] as const;

export const themeStorage = { base: 'akis-theme-base', accent: 'akis-theme-accent' } as const;
export type ThemeKind = keyof typeof themeStorage;
export const themeOptions: Record<ThemeKind, readonly { id: string }[]> = { base: baseColors, accent: accentColors };

/**
 * Sayfa çizilmeden önce kayıtlı temayı uygulayan satır içi betik (layout.tsx'te <head> içinde),
 * böylece açılışta varsayılan renk bir an görünüp değişmez. Yalnızca bilinen kimlikleri kabul eder;
 * depolama kapalıysa sessizce varsayılanda kalır.
 */
export const themeBootScript = `try{var d=document.documentElement,o=${JSON.stringify({
  base: baseColors.slice(1).map(c => c.id),
  accent: accentColors.slice(1).map(c => c.id),
})};['base','accent'].forEach(function(k){var v=localStorage.getItem('akis-theme-'+k);if(v&&o[k].indexOf(v)>-1)d.dataset[k]=v})}catch(e){}`;
