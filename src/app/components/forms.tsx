'use client';
// Giriş ekranı ve formlar. Doğrulama ve gönderim mantığı önceki sürümle aynıdır; yalnızca görünüm değişti.
import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Copy, FileText, KeyRound, LoaderCircle, Paperclip, Plus, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { type Category, type Profile, type TaskInput, assignableProfiles, categories, priorities, taskSchema, validateFile } from '@/lib/domain';
import { supabase } from '@/lib/client';
import { categoryLabels } from '@/lib/workflow';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { designSizes, requestForms } from './request-forms';
import { priorityTone } from './screen-kit';

export const maxRequestFiles = 10;
const NONE = '__none';

function FormError({ message, onClear }: { message: string; onClear?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
      <span className="flex-1">{message}</span>
      {onClear && <button type="button" onClick={onClear} aria-label="Hatayı kapat" className="shrink-0 rounded p-0.5 hover:bg-destructive/10"><X className="size-4" /></button>}
    </div>
  );
}

/** Baskı ajansının kayıt işareti: üst üste binen camgöbeği, macenta ve sarı. */
function RegistrationMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <g className="mix-blend-multiply dark:mix-blend-screen">
        <circle cx="96" cy="100" r="62" fill="#00a3df" opacity="0.85" />
        <circle cx="144" cy="100" r="62" fill="#e5007e" opacity="0.75" />
        <circle cx="120" cy="142" r="62" fill="#ffe600" opacity="0.85" />
      </g>
      <g stroke="currentColor" strokeWidth="1.5" fill="none" className="text-foreground">
        <circle cx="120" cy="120" r="104" />
        <line x1="120" y1="4" x2="120" y2="236" />
        <line x1="4" y1="120" x2="236" y2="120" />
      </g>
    </svg>
  );
}

export function Login({ busy, configured, allowDemo, onDemo, error, run, session, onLogout }: {
  busy: boolean; configured: boolean; allowDemo: boolean; onDemo: () => void; error: string;
  run: (fn: () => Promise<void>) => Promise<boolean>; session: Session | null; onLogout: () => void;
}) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r bg-background p-10 lg:flex">
        <img src="/logo.svg" alt="dijitaldesin" className="h-16 w-auto self-start dark:invert" />
        <RegistrationMark className="pointer-events-none absolute top-1/2 -right-24 size-[460px] -translate-y-1/2 opacity-90" />
        <div className="relative max-w-md">
          <h1 className="text-5xl leading-[1.02] font-semibold tracking-tight">Ajansın bütün talepleri tek panoda.</h1>
          <p className="mt-5 max-w-[42ch] text-lg text-muted-foreground">Teknik destek, grafik tasarım ve ekip içi işler. Kim neyle uğraşıyor, hangi iş takıldı; hepsi aynı yerde.</p>
        </div>
        <p className="relative text-sm text-muted-foreground">Yalnızca yöneticinin açtığı hesaplar giriş yapabilir.</p>
      </section>

      <section className="flex items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-sm">
          <img src="/logo.svg" alt="dijitaldesin" className="mb-10 h-14 w-auto lg:hidden dark:invert" />
          <h2 className="text-3xl font-semibold tracking-tight">{session ? 'Hesabına erişim yok' : 'Giriş yap'}</h2>
          <p className="mt-2 text-muted-foreground">
            {session ? 'Hesabının erişimi kapalı ya da henüz açılmamış. Yöneticinle görüş.' : 'Yöneticinin sana verdiği e-posta ve şifreyi kullan.'}
          </p>
          <div className="mt-6 grid gap-4">
            <FormError message={error} />
            {session ? (
              <Button variant="outline" onClick={onLogout}>Çıkış yap</Button>
            ) : configured ? (
              <form
                className="grid gap-4"
                onSubmit={e => {
                  e.preventDefault();
                  run(async () => {
                    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
                    if (error) throw new Error(/invalid login credentials/i.test(error.message) ? 'E-posta veya şifre hatalı.' : error.message);
                    setPassword('');
                  });
                }}
              >
                <div className="grid gap-2">
                  <Label htmlFor="login-email">İş e-posta adresin</Label>
                  <Input id="login-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="isim@dijitaldesin.com" autoComplete="email" className="h-10" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password">Şifre</Label>
                  <Input id="login-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="h-10" />
                </div>
                <Button type="submit" size="lg" className="h-10" disabled={busy}>
                  {busy && <LoaderCircle className="animate-spin" />} Giriş yap
                </Button>
                <p className="text-sm text-muted-foreground">Şifreni unuttuysan yöneticinden yeni şifre iste.</p>
              </form>
            ) : (
              <div className="flex gap-3 rounded-lg border bg-background p-4 text-sm">
                <ShieldCheck className="size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Supabase bağlantısı eksik</p>
                  <p className="text-muted-foreground">Giriş için .env.local dosyasına Supabase ayarlarını ekle.</p>
                </div>
              </div>
            )}
            {allowDemo && (
              <Button variant="outline" disabled={busy} onClick={onDemo}><Sparkles /> Örnek çalışma alanını aç</Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export function CreateDialog({ profiles, category, onCategory, busy, error, onClearError, onClose, onSubmit }: {
  profiles: Profile[]; category: Category; onCategory: (c: Category) => void; busy: boolean; error: string; onClearError: () => void;
  onClose: () => void; onSubmit: (input: TaskInput, files: File[]) => void;
}) {
  const [input, setInput] = useState<TaskInput>({ title: '', description: '', category, brand: '', priority: 'Normal', assignee_id: null });
  const [files, setFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState('');
  const [requestTypes, setRequestTypes] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [customSize, setCustomSize] = useState('');
  const design = category === 'Grafik İşlemleri';
  const technical = category === 'Teknik İşlemler';
  const [fields, setFields] = useState<Record<string, string>>({});
  const brief = requestForms[category];
  const visibleFields = brief.fields.filter(field => !field.when || requestTypes.includes(field.when));

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if ((!technical && !requestTypes.length) || visibleFields.some(field => field.required && !fields[field.label]?.trim())) {
      setLocalError(technical ? 'Zorunlu alanları doldurun.' : 'Talep türünü ve zorunlu alanları doldurun.');
      return;
    }
    const details = visibleFields.flatMap(field => {
      const value = fields[field.label]?.trim();
      return value ? [field.label + ': ' + value] : [];
    });
    const dimensions = [...sizes, customSize.trim()].filter(Boolean);
    if (design && !dimensions.length) { setLocalError('Bir yayın ölçüsü seçin veya özel ölçü girin.'); return; }
    if (files.length > maxRequestFiles) { setLocalError('Bir talebe en fazla 10 dosya ekleyebilirsiniz.'); return; }
    if (design) details.unshift('Yayın alanı ve ölçüler: ' + dimensions.join(', '));
    const description = (technical ? details : ['Talep türü: ' + requestTypes.join(', '), ...details]).join('\n\n');
    if (description.length > 10000) { setLocalError('Talep ayrıntıları toplamda 10.000 karakteri aşmamalı.'); return; }
    const result = taskSchema.safeParse({ ...input, description });
    if (!result.success) { setLocalError(result.error.issues[0].message); return; }
    onSubmit(result.data, files);
  }

  const toggle = (list: string[], value: string, on: boolean) => on ? [...list, value] : list.filter(v => v !== value);

  return (
    <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle className="text-xl">Yeni talep</DialogTitle>
            <DialogDescription>Talebi açtığında bütün ekip görebilir.</DialogDescription>
            <div className="mt-3 inline-flex rounded-lg bg-secondary p-0.5" role="radiogroup" aria-label="Talep bölümü">
              {categories.map(c => (
                <button
                  key={c} type="button" role="radio" aria-checked={c === category} disabled={busy}
                  onClick={() => c !== category && onCategory(c)}
                  className={cn('flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50', c === category ? 'bg-card shadow-[0_0_0_1px_var(--border)]' : 'text-muted-foreground hover:text-foreground')}
                >
                  {categoryLabels[c]}
                </button>
              ))}
            </div>
          </DialogHeader>

          <div className="grid gap-5 px-6 py-5">
            {design ? (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">Ne tasarlanacak?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {brief.types.map(type => (
                    <label key={type} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
                      <Checkbox checked={requestTypes.includes(type)} onCheckedChange={c => setRequestTypes(toggle(requestTypes, type, c === true))} />
                      {type}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : technical ? null : (
              <div className="grid gap-2">
                <Label>Talep türü</Label>
                <Select value={requestTypes[0] ?? ''} onValueChange={v => setRequestTypes(v ? [v] : [])}>
                  <SelectTrigger aria-label="Talep türü" className="w-full"><SelectValue placeholder="Seç" /></SelectTrigger>
                  <SelectContent>{brief.types.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="task-title">Başlık</Label>
              <Input id="task-title" autoFocus required minLength={3} maxLength={180} value={input.title} placeholder={brief.titleExample} onChange={e => setInput({ ...input, title: e.target.value })} />
            </div>

            {design && (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">Yayın alanı ve ölçüler</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {designSizes.map(size => (
                    <label key={size} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
                      <Checkbox checked={sizes.includes(size)} onCheckedChange={c => setSizes(toggle(sizes, size, c === true))} />
                      {size}
                    </label>
                  ))}
                </div>
                <div className="mt-1 grid gap-2">
                  <Label htmlFor="custom-size" className="text-muted-foreground">Listede yoksa özel ölçü</Label>
                  <Input id="custom-size" maxLength={500} placeholder="Örn. ana sayfa banner, 1920 × 880 px" value={customSize} onChange={e => setCustomSize(e.target.value)} />
                </div>
              </fieldset>
            )}

            {visibleFields.map(field => (
              <div key={field.label} className="grid gap-2">
                <Label htmlFor={'field-' + field.label}>{field.label}{!field.required && <span className="font-normal text-muted-foreground"> (isteğe bağlı)</span>}</Label>
                {field.options ? (
                  <Select value={fields[field.label] ?? ''} onValueChange={v => setFields({ ...fields, [field.label]: v })}>
                    <SelectTrigger id={'field-' + field.label} className="w-full"><SelectValue placeholder="Seç" /></SelectTrigger>
                    <SelectContent>{field.options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                ) : field.multiline ? (
                  <Textarea id={'field-' + field.label} required={field.required} maxLength={2500} rows={3} placeholder={field.example} value={fields[field.label] ?? ''} onChange={e => setFields({ ...fields, [field.label]: e.target.value })} />
                ) : (
                  <Input id={'field-' + field.label} required={field.required} maxLength={500} placeholder={field.example} value={fields[field.label] ?? ''} onChange={e => setFields({ ...fields, [field.label]: e.target.value })} />
                )}
              </div>
            ))}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="task-brand">Müşteri veya marka</Label>
                <Input id="task-brand" required maxLength={100} value={input.brand} placeholder="Marka adı ya da İç Ekip" onChange={e => setInput({ ...input, brand: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Sorumlu</Label>
                <Select value={input.assignee_id ?? NONE} onValueChange={v => setInput({ ...input, assignee_id: v === NONE ? null : v })}>
                  <SelectTrigger aria-label="Sorumlu" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Şimdilik atama</SelectItem>
                    {assignableProfiles(profiles, category).map(p => <SelectItem key={p.id} value={p.id}>{p.name}, {p.team}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Öncelik</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Öncelik">
                {priorities.map(s => (
                  <button
                    key={s} type="button" role="radio" aria-checked={input.priority === s} onClick={() => setInput({ ...input, priority: s })}
                    className={cn(
                      'rounded-lg border-[1.5px] px-3 py-2 text-sm font-semibold transition-[opacity,box-shadow] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      priorityTone(s),
                      input.priority === s ? 'border-current shadow-[0_0_0_3px_color-mix(in_oklch,currentColor_15%,transparent)]' : 'opacity-55 hover:opacity-90',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">{brief.attachmentLabel}</legend>
              <p className="mb-2 text-xs text-muted-foreground">{files.length}/{maxRequestFiles} dosya. PDF, PNG, JPG veya WebP; dosya başına en fazla 20 MB.</p>
              {files.length > 0 && (
                <ul className="mb-2 divide-y rounded-lg border">
                  {files.map((file, index) => (
                    <li key={index} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <Button type="button" variant="ghost" size="icon-xs" disabled={busy} aria-label={`${file.name} dosyasını kaldır`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X /></Button>
                    </li>
                  ))}
                </ul>
              )}
              {files.length < maxRequestFiles && (
                <label key={files.length} className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
                  <Paperclip className="size-4" /> {design ? 'Görsel veya dosya ekle' : 'Dosya ekle'}
                  <input
                    type="file" className="sr-only" disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try { validateFile(file); setFiles(current => current.length < maxRequestFiles ? [...current, file] : current); setLocalError(''); }
                      catch (err) { setLocalError((err as Error).message); }
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </fieldset>

            <FormError message={localError} />
            <FormError message={error} onClear={onClearError} />
          </div>

          <DialogFooter className="sticky bottom-0 mx-0 mb-0 rounded-b-xl border-t bg-card px-6 py-4">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Plus />} Talebi aç</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function newPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const a = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(a, n => chars[n % chars.length]).join('');
}

function PasswordField({ value, onChange, label = 'Şifre' }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="password-field">{label}</Label>
      <div className="flex gap-2">
        <Input id="password-field" required minLength={8} maxLength={72} value={value} onChange={e => onChange(e.target.value)} autoComplete="new-password" spellCheck={false} className="font-mono" />
        <Button type="button" variant="outline" size="icon" aria-label="Yeni şifre üret" title="Yeni şifre üret" onClick={() => onChange(newPassword())}><RefreshCw /></Button>
        <Button type="button" variant="outline" size="icon" aria-label="Şifreyi kopyala" title="Şifreyi kopyala" onClick={() => navigator.clipboard?.writeText(value)}><Copy /></Button>
      </div>
      <p className="text-xs text-muted-foreground">En az 8 karakter.</p>
    </div>
  );
}

const teams = ['Meta Ekibi', 'Grafik Tasarım', 'Teknik Destek', 'Operasyon', 'Yönetim'];

export function AddUserDialog({ busy, demo, error, onClearError, onClose, onSubmit }: {
  busy: boolean; demo: boolean; error: string; onClearError: () => void; onClose: () => void; onSubmit: (b: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [team, setTeam] = useState('Meta Ekibi'), [password, setPassword] = useState(newPassword);
  return (
    <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <form className="grid gap-4" onSubmit={e => { e.preventDefault(); onSubmit({ action: 'create', name, email, team, password }); }}>
          <DialogHeader>
            <DialogTitle>Kullanıcı ekle</DialogTitle>
            <DialogDescription>
              {demo ? 'Örnek çalışma alanında şifre kaydedilmez.' : 'Hesap hemen açılır, e-posta gönderilmez. E-posta adresini ve şifreyi çalışana sen ilet.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2"><Label htmlFor="user-name">Ad soyad</Label><Input id="user-name" required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="user-email">İş e-posta adresi</Label><Input id="user-email" required type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <PasswordField value={password} onChange={setPassword} />
          <div className="grid gap-2">
            <Label>Birim</Label>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger aria-label="Birim" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Hesap çalışan yetkisiyle açılır; süper admin yetkisi buradan verilmez.</p>
          <FormError message={error} onClear={onClearError} />
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={busy}><Plus /> {demo ? 'Örnek kullanıcı ekle' : 'Kullanıcıyı ekle'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PasswordDialog({ busy, target, self, error, onClearError, onClose, onSubmit }: {
  busy: boolean; target: Profile; self: boolean; error: string; onClearError: () => void; onClose: () => void; onSubmit: (pw: string) => void;
}) {
  const [password, setPassword] = useState(self ? '' : newPassword());
  return (
    <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <form className="grid gap-4" onSubmit={e => { e.preventDefault(); onSubmit(password); }}>
          <DialogHeader>
            <DialogTitle>{self ? 'Şifreni değiştir' : 'Şifre belirle'}</DialogTitle>
            <DialogDescription>
              {self ? 'Yeni şifren hemen geçerli olur.' : `${target.name} (${target.email}) için yeni şifre. Eski şifre geçersiz olur; yenisini çalışana sen ilet.`}
            </DialogDescription>
          </DialogHeader>
          <PasswordField label="Yeni şifre" value={password} onChange={setPassword} />
          <FormError message={error} onClear={onClearError} />
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={busy}><KeyRound /> Şifreyi kaydet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
