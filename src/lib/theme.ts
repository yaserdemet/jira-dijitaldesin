// Görünüm ayarları. Hem sunucu (layout.tsx) hem istemci (theme-settings.tsx) kullanır; bu yüzden 'use client' içermez.
// Her grubun İLK seçeneği varsayılandır (globals.css :root); onun için <html>'e öznitelik yazılmaz.
// Seçilen değer <html data-{grup}="..."> olarak uygulanır ve tarayıcıda saklanır.

export type ThemeOption = { id: string; label: string; swatch?: string };

export const themeGroups = {
  mode: [
    { id: 'light', label: 'Açık' },
    { id: 'dark', label: 'Koyu' },
    { id: 'system', label: 'Sistem' },
  ],
  base: [
    { id: 'paper', label: 'Kâğıt', swatch: '#e7ebef' },
    { id: 'neutral', label: 'Neutral', swatch: '#d4d4d4' },
    { id: 'stone', label: 'Stone', swatch: '#d6d3d1' },
    { id: 'zinc', label: 'Zinc', swatch: '#d4d4d8' },
    { id: 'gray', label: 'Gray', swatch: '#d1d5db' },
    { id: 'slate', label: 'Slate', swatch: '#cbd5e1' },
  ],
  bg: [
    { id: 'auto', label: 'Gri tonuna göre' },
    { id: 'accent', label: 'Ana renge göre' },
    { id: 'sky', label: 'Gök', swatch: '#eef6fb' },
    { id: 'mint', label: 'Nane', swatch: '#edf7f1' },
    { id: 'lavender', label: 'Lavanta', swatch: '#f4f2fc' },
    { id: 'sand', label: 'Kum', swatch: '#f7f3ea' },
    { id: 'rose', label: 'Gül', swatch: '#fbf0f3' },
  ],
  accent: [
    { id: 'cyan', label: 'Camgöbeği', swatch: '#0b76ae' },
    { id: 'blue', label: 'Mavi', swatch: '#1d4ed8' },
    { id: 'green', label: 'Yeşil', swatch: '#15803d' },
    { id: 'violet', label: 'Mor', swatch: '#6d28d9' },
    { id: 'orange', label: 'Turuncu', swatch: '#c2410c' },
    { id: 'pink', label: 'Pembe', swatch: '#be185d' },
  ],
  radius: [
    { id: 'normal', label: 'Normal' },
    { id: 'sharp', label: 'Keskin' },
    { id: 'round', label: 'Yuvarlak' },
  ],
  density: [
    { id: 'normal', label: 'Normal' },
    { id: 'compact', label: 'Sıkı' },
    { id: 'comfortable', label: 'Ferah' },
  ],
  font: [
    { id: 'brand', label: 'Akış' },
    { id: 'plain', label: 'Sade' },
    { id: 'system', label: 'Sistem' },
  ],
} as const satisfies Record<string, readonly ThemeOption[]>;

export type ThemeKind = keyof typeof themeGroups;
export type ThemeSettings = Record<ThemeKind, string>;
export const themeKinds = Object.keys(themeGroups) as ThemeKind[];
export const themeStorageKey = (kind: ThemeKind) => `akis-theme-${kind}`;
export const defaultTheme = Object.fromEntries(themeKinds.map(k => [k, themeGroups[k][0].id])) as ThemeSettings;

/** Açık/koyu/sistem seçimini gerçek renk şemasına çevirir. */
export function resolveScheme(mode: string, prefersDark: boolean): 'light' | 'dark' {
  return mode === 'dark' || (mode === 'system' && prefersDark) ? 'dark' : 'light';
}

/**
 * Sayfa çizilmeden önce kayıtlı ayarları uygulayan satır içi betik (layout.tsx'te <head> içinde),
 * böylece açılışta varsayılan görünüm bir an görünüp değişmez. Yalnızca bilinen değerleri kabul eder;
 * depolama kapalıysa sessizce varsayılanda kalır.
 */
export const themeBootScript = `try{var d=document.documentElement,o=${JSON.stringify(
  Object.fromEntries(themeKinds.map(k => [k, themeGroups[k].slice(1).map(o => o.id)])),
)};Object.keys(o).forEach(function(k){var v=localStorage.getItem('akis-theme-'+k);if(v&&o[k].indexOf(v)>-1)d.dataset[k]=v});var m=d.dataset.mode;if(m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)){d.classList.add('dark');d.dataset.scheme='dark'}}catch(e){}`;
