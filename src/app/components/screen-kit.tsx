'use client';
// Ekranların ortak görsel parçaları. İş kuralı içermez; yalnızca veriyi gösterir.
import { useState, type ReactNode } from 'react';
import type { Attachment, Category, Data, Message, Profile, Task } from '@/lib/domain';
import { type Guide, type Notice, type WorkflowState, priorityClass, stateLabel, taskProgress, workflowState } from '@/lib/workflow';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/** Tam sayfa yükleme ekranı: dijitaldesin.com'daki yükleyicinin aynısı (kayan çubuk + yanıp sönen yazı). */
export function PageLoader({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6" role="status" aria-live="polite" aria-busy="true">
      <div className="animate-loader-in flex flex-col items-center gap-7">
        <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div className="animate-loader-bar h-full w-1/3 rounded-full bg-intro-sky" />
        </div>
        <p className="animate-loader-text text-sm font-semibold tracking-wide text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export type Props = {
  data: Data; person: Profile; demo: boolean; busy: boolean; notices: Notice[]; guides: Guide[];
  onUser: (p: Profile) => void; onLogout: () => void; onCreate: (c: Category) => void;
  onUpdate: (t: Task, p: Partial<Task>, note?: { body: string; kind: Message['kind'] }) => Promise<boolean>;
  onArchive: (tasks: Task[]) => Promise<boolean>;
  onMessage: (t: Task, body: string, recipient: string | null, parent: string | null, kind: Message['kind']) => Promise<boolean>;
  onFiles: (t: Task, files: File[], kind: Attachment['kind']) => Promise<boolean>;
  onDownload: (a: Attachment) => void; onRead: (ids: string[]) => Promise<boolean>;
  onGuide: (title: string, body: string) => Promise<boolean>;
  onClearLogs: () => Promise<boolean>;
  onResponsibilities: (id: string, technical: boolean, design: boolean) => Promise<boolean>;
  onAddUser: () => void; onPassword: (p: Profile) => void; onActive: (p: Profile) => void; onDelete: (p: Profile) => void;
  error: string; toast: string;
};

export const paths: Record<string, Category> = { teknik: 'Teknik İşlemler', grafik: 'Grafik İşlemleri', diger: 'Diğer Talepler' };

export const formatDate = (s: string) =>
  new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleString('tr-TR', {
    day: 'numeric', month: 'short', ...(s.length > 10 ? { hour: '2-digit', minute: '2-digit' } : {}),
  });

// Tailwind sınıfları derleme anında tarandığı için tam sınıf adları burada sabit duruyor.
export const stateStyle: Record<WorkflowState, { dot: string; text: string; bar: string; ring: string }> = {
  'Bekliyor': { dot: 'bg-state-waiting', text: 'text-state-waiting', bar: 'bg-state-waiting', ring: 'ring-state-waiting/40' },
  'Yapılıyor': { dot: 'bg-state-doing', text: 'text-state-doing', bar: 'bg-state-doing', ring: 'ring-state-doing/40' },
  'Tamamlandı': { dot: 'bg-state-done', text: 'text-state-done', bar: 'bg-state-done', ring: 'ring-state-done/40' },
  'Sorun Var': { dot: 'bg-state-problem', text: 'text-state-problem', bar: 'bg-state-problem', ring: 'ring-state-problem/40' },
};

const priorityStyle = {
  normal: 'bg-[var(--prio-normal-bg)] text-[var(--prio-normal-ink)] border-[var(--prio-normal-line)]',
  high: 'bg-[var(--prio-high-bg)] text-[var(--prio-high-ink)] border-[var(--prio-high-line)]',
  urgent: 'bg-[var(--prio-urgent-bg)] text-[var(--prio-urgent-ink)] border-[var(--prio-urgent-line)]',
} as const;
export const priorityTone = (priority: Task['priority']) => priorityStyle[priorityClass(priority) as keyof typeof priorityStyle];

export function PriorityBadge({ priority, className }: { priority: Task['priority']; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-[11px] font-semibold leading-4', priorityTone(priority), className)}>
      {priority}
    </span>
  );
}

export function StateBadge({ task }: { task: Task }) {
  const cancelled = task.status === 'İptal';
  const style = stateStyle[workflowState(task)];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', cancelled ? 'text-muted-foreground' : style.text)}>
      <span className={cn('size-2 rounded-full', cancelled ? 'bg-muted-foreground' : style.dot)} />
      {stateLabel(task)}
    </span>
  );
}

export function ProgressBar({ task, showLabel = false, className }: { task: Task; showLabel?: boolean; className?: string }) {
  const value = taskProgress(task);
  const state = workflowState(task);
  return (
    <div className={className}>
      {showLabel && (
        <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>{state === 'Sorun Var' ? 'İlerleme duraklatıldı' : 'İlerleme'}</span>
          <span className={cn('font-semibold tabular-nums', stateStyle[state].text)}>%{value}</span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="İlerleme">
        <div className={cn('h-full rounded-full transition-[width] duration-300', stateStyle[state].bar)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Avatar({ name, src, size = 'md' }: { name?: string; src?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const box = cn(size === 'sm' && 'size-6', size === 'md' && 'size-8', size === 'lg' && 'size-11');
  if (src) {
    // Avatar görseli kişinin adının yanında kullanıldığı için tekrar okunmaz (alt boş).
    return <img src={src} alt="" title={name} width={64} height={64} className={cn('shrink-0 rounded-full bg-accent object-cover', box)} />;
  }
  return (
    <span
      title={name ?? 'Atanmadı'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        name ? 'bg-accent text-accent-foreground' : 'border border-dashed border-input text-muted-foreground',
        size === 'sm' && 'size-6 text-[11px]', size === 'md' && 'size-8 text-xs', size === 'lg' && 'size-11 text-base',
      )}
    >
      {name ? name.trim().slice(0, 1).toLocaleUpperCase('tr') : '?'}
    </span>
  );
}

// Geri alınması zor işlemler için onay penceresi (tarayıcının confirm kutusu yerine).
export function ConfirmAction({ trigger, title, description, confirmLabel, destructive, onConfirm }: {
  trigger: ReactNode; title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          {/* Renk variant ile verilir: asChild sınıfları birleştirirken çakışanları ayıklamaz. */}
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => { setOpen(false); onConfirm(); }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border bg-card p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
