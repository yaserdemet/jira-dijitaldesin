'use client';
import { useState } from 'react';
import { Archive, CornerDownRight, Download, FileText, Paperclip, RotateCcw, XCircle } from 'lucide-react';
import { type Message, type Task, assignableProfiles, assigneeNames, assigneesOf, canEdit, canManage } from '@/lib/domain';
import { type WorkflowState, canRequestRevision, categoryLabels, taskProgress, workflowPatch, workflowState, workflowStates } from '@/lib/workflow';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { AssigneePicker, Avatar, ConfirmAction, Panel, PriorityBadge, ProgressBar, type Props, StateBadge, formatDate, stateStyle } from './screen-kit';

const NONE = '__none';

export function TaskDetail({ task: selected, p, go }: { task: Task; p: Props; go: (path: string) => void }) {
  const profile = (id: string | null) => p.data.profiles.find(u => u.id === id);
  const files = p.data.attachments.filter(a => a.task_id === selected.id);
  const history = p.data.events.filter(e => e.task_id === selected.id);
  const assignees = assigneesOf(selected);
  // Bölüm sorumlusu olmaktan çıkmış biri hâlâ atanmışsa listede görünür ki çıkarılabilsin.
  const assignable = [
    ...p.data.profiles.filter(u => assignees.includes(u.id) && !assignableProfiles(p.data.profiles, selected.category).includes(u)),
    ...assignableProfiles(p.data.profiles, selected.category),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        {selected.archived_at && (
          <p className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
            <Archive className="size-4" /> Bu iş arşivde{selected.status === 'İptal' ? ' (iptal edildi)' : ''}.
          </p>
        )}

        <Panel>
          <div className="flex flex-wrap items-center gap-3">
            <StateBadge task={selected} />
            <PriorityBadge priority={selected.priority} />
          </div>
          {selected.notes && (
            <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed whitespace-pre-wrap">{selected.notes}</p>
          )}
          <p className={cn('mt-4 max-w-[70ch] whitespace-pre-wrap', selected.notes ? 'rounded-lg bg-secondary px-3 py-2.5 text-sm leading-relaxed' : 'text-[15px] leading-relaxed')}>{selected.description}</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Açan</dt><dd className="mt-0.5 font-medium">{profile(selected.creator_id)?.name}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{assignees.length > 1 ? 'Sorumlular' : 'Sorumlu'}</dt><dd className="mt-0.5 font-medium">{assigneeNames(selected, p.data.profiles).join(', ') || 'Atanmadı'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Bölüm</dt><dd className="mt-0.5 font-medium">{categoryLabels[selected.category]}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Açıldı</dt><dd className="mt-0.5 font-medium">{formatDate(selected.created_at)}</dd></div>
          </dl>
        </Panel>

        <Panel title="Dosyalar ve teslimler">
          {files.length > 0 && (
            <ul className="mb-4 divide-y rounded-lg border">
              {files.map(a => (
                <li key={a.id}>
                  <button type="button" onClick={() => p.onDownload(a)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                    <span className={cn('rounded px-1.5 py-px text-[11px] font-semibold', a.kind === 'delivery' ? 'bg-state-done/12 text-state-done' : 'bg-secondary text-muted-foreground')}>
                      {a.kind === 'delivery' ? 'Teslim' : 'Referans'}
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{formatDate(a.created_at)}</span>
                    <Download className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {(['brief', 'delivery'] as const).map(kind => {
              const disabled = p.busy || (kind === 'delivery' && !canEdit(selected, p.person));
              return (
                <label key={kind} className={cn(buttonVariants({ variant: kind === 'delivery' ? 'default' : 'outline' }), 'relative', disabled && 'pointer-events-none opacity-50')}>
                  <Paperclip /> {kind === 'delivery' ? 'Teslim dosyası ekle' : 'Referans ekle'}
                  <input
                    className="sr-only" disabled={disabled} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={async e => { const el = e.currentTarget; const list = Array.from(el.files ?? []); await p.onFiles(selected, list, kind); el.value = ''; }}
                  />
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">PDF, PNG, JPG veya WebP; dosya başına en fazla 20 MB.</p>
        </Panel>

        <Panel title="Görüşme">
          <Conversation key={selected.id} task={selected} p={p} />
        </Panel>

        <Panel title="Geçmiş">
          <ol className="relative ml-1 border-l border-foreground/15 pl-5">
            <li className="relative pb-4">
              <span className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-foreground/40" />
              <p className="text-sm font-medium">Talep oluşturuldu</p>
              <p className="text-xs text-muted-foreground">{formatDate(selected.created_at)}</p>
            </li>
            {history.map(e => (
              <li key={e.id} className="relative pb-4 last:pb-0">
                <span className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-foreground/40" />
                <p className="text-sm"><span className="font-medium">{e.action}</span> <span className="text-muted-foreground">{e.details}</span></p>
                <p className="text-xs text-muted-foreground">{formatDate(e.created_at)}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Panel title="Durum">
          <ProgressBar task={selected} showLabel />
          {selected.status !== 'İptal' && <StatusForm key={selected.id + '-' + selected.updated_at} task={selected} p={p} />}
          {canEdit(selected, p.person) && (
            <div className="mt-4 grid gap-2">
              <Label htmlFor="detail-assignees">Sorumlular</Label>
              <AssigneePicker
                id="detail-assignees" emptyLabel="Atanmadı" disabled={p.busy}
                profiles={assignable}
                value={assignees}
                onChange={assignee_ids => p.onUpdate(selected, { assignee_ids })}
              />
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">{selected.revision_count} revize. Önceki dosyalar silinmez.</p>
          {canManage(selected, p.person) && canRequestRevision(selected) && <Revision task={selected} p={p} />}

          <div className="mt-5 flex flex-col gap-2 border-t pt-4 empty:hidden">
            {selected.archived_at ? canEdit(selected, p.person) && (
              <Button
                variant="outline" disabled={p.busy}
                onClick={() => p.onUpdate(selected, selected.status === 'İptal' ? { status: assignees.length ? 'Atandı' : 'Yeni', archived_at: null } : { archived_at: null })}
              >
                <RotateCcw /> Arşivden çıkar
              </Button>
            ) : (
              <>
                {selected.status === 'Tamamlandı' && canEdit(selected, p.person) && (
                  <Button variant="outline" disabled={p.busy} onClick={() => p.onUpdate(selected, { archived_at: new Date().toISOString() })}>
                    <Archive /> Arşivle
                  </Button>
                )}
                {canManage(selected, p.person) && (
                  <ConfirmAction
                    destructive
                    title="Talep iptal edilsin mi?"
                    description="Talep panodan kalkıp arşive taşınır. Gerekirse Arşiv sayfasından geri açabilirsin."
                    confirmLabel="Talebi iptal et"
                    onConfirm={() => p.onUpdate(selected, { status: 'İptal', archived_at: new Date().toISOString() })}
                    trigger={<Button variant="ghost" className="text-destructive hover:bg-destructive/8 hover:text-destructive" disabled={p.busy}><XCircle /> Talebi iptal et</Button>}
                  />
                )}
              </>
            )}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function StatusForm({ task, p }: { task: Task; p: Props }) {
  const [state, setState] = useState<WorkflowState>(workflowState(task));
  const [progress, setProgress] = useState(taskProgress(task));
  const [problem, setProblem] = useState(task.issue_description ?? '');
  const [error, setError] = useState('');
  if (!canEdit(task, p.person)) return null;
  const shown = state === 'Tamamlandı' ? 100 : state === 'Bekliyor' ? 0 : progress;
  return (
    <form
      className="mt-5 grid gap-4"
      onSubmit={async e => {
        e.preventDefault();
        try { setError(''); await p.onUpdate(task, workflowPatch(state, progress, problem)); } catch (err) { setError((err as Error).message); }
      }}
    >
      <div className="grid gap-2">
        <Label>Durum</Label>
        <Select value={state} onValueChange={v => setState(v as WorkflowState)}>
          <SelectTrigger aria-label="Durum" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {workflowStates.map(s => (
              <SelectItem key={s} value={s}><span className={cn('size-2 rounded-full', stateStyle[s].dot)} />{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="progress-range">İlerleme</Label>
          <span className="text-sm font-semibold tabular-nums">%{shown}</span>
        </div>
        <input
          id="progress-range" type="range" min="0" max={state === 'Yapılıyor' ? 95 : 100} step="5"
          disabled={state === 'Bekliyor' || state === 'Tamamlandı'}
          value={Math.min(state === 'Yapılıyor' ? 95 : 100, progress)}
          onChange={e => setProgress(Number(e.target.value))}
          className="w-full accent-primary disabled:opacity-40"
        />
      </div>
      {state === 'Sorun Var' && (
        <div className="grid gap-2">
          <Label htmlFor="status-problem">Sorunun nedeni</Label>
          <Textarea id="status-problem" required minLength={3} maxLength={10000} value={problem} onChange={e => setProblem(e.target.value)} />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="secondary" disabled={p.busy}>Durumu kaydet</Button>
    </form>
  );
}

function Conversation({ task, p }: { task: Task; p: Props }) {
  const [body, setBody] = useState('');
  const [recipient, setRecipient] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [kind, setKind] = useState<Message['kind']>('comment');
  const messages = p.data.messages.filter(m => m.task_id === task.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const name = (id?: string | null) => p.data.profiles.find(u => u.id === id)?.name;

  return (
    <div className="grid gap-4">
      {messages.length > 0 && (
        <ul className="grid gap-4">
          {messages.map(m => (
            <li id={'yorum-' + m.id} key={m.id} className={cn('flex gap-3 rounded-lg', m.parent_id && 'ml-8')}>
              <Avatar name={name(m.author_id)} />
              <div className="min-w-0 flex-1">
                {m.parent_id && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CornerDownRight className="size-3" /> {name(messages.find(x => x.id === m.parent_id)?.author_id)} adlı kişiye yanıt
                  </p>
                )}
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold">{name(m.author_id)}</span>
                  {m.recipient_id && <span className="text-xs text-muted-foreground">{name(m.recipient_id)} kişisine</span>}
                  {m.kind !== 'comment' && (
                    <span className={cn('rounded px-1.5 text-[11px] font-semibold', m.kind === 'delivery' ? 'bg-state-done/12 text-state-done' : 'bg-destructive/10 text-destructive')}>
                      {m.kind === 'delivery' ? 'Teslim' : 'Revize'}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                </p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>
                <button type="button" className="mt-1 text-xs font-medium text-primary hover:underline" onClick={() => { setParent(m.id); setRecipient(m.author_id); }}>
                  Yanıtla
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-3 rounded-lg border bg-background/60 p-3"
        onSubmit={async e => {
          e.preventDefault();
          if (await p.onMessage(task, body, recipient || null, parent, kind)) { setBody(''); setRecipient(''); setParent(null); }
        }}
      >
        {parent && (
          <div className="flex items-center justify-between rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground">
            Bir yoruma yanıt yazıyorsun.
            <Button type="button" variant="ghost" size="xs" onClick={() => { setParent(null); setRecipient(''); }}>Vazgeç</Button>
          </div>
        )}
        <Textarea aria-label="Yorum yaz" placeholder="Bir güncelleme yaz" required maxLength={10000} value={body} onChange={e => setBody(e.target.value)} className="bg-card" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={recipient || NONE} disabled={!!parent} onValueChange={v => setRecipient(v === NONE ? '' : v)}>
            <SelectTrigger aria-label="Bildirim alıcısı" className="w-52 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Kimseye bildirme</SelectItem>
              {p.data.profiles.filter(u => u.active || u.id === recipient).map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}{!u.active ? ' (erişimi kapalı)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit(task, p.person) && (
            <Select value={kind} onValueChange={v => setKind(v as Message['kind'])}>
              <SelectTrigger aria-label="Mesaj türü" className="w-48 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comment">Yorum</SelectItem>
                <SelectItem value="delivery">Teslim açıklaması</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button type="submit" className="ml-auto" disabled={p.busy || !body.trim()}>Gönder</Button>
        </div>
      </form>
    </div>
  );
}

function Revision({ task, p }: { task: Task; p: Props }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) {
    return <Button variant="outline" className="mt-3 w-full" onClick={() => setOpen(true)}>Revize iste</Button>;
  }
  return (
    <form
      className="mt-3 grid gap-2 rounded-lg border p-3"
      onSubmit={async e => {
        e.preventDefault();
        if (await p.onUpdate(task, { status: 'Revize İstendi' }, { body: reason, kind: 'revision' })) { setReason(''); setOpen(false); }
      }}
    >
      <Label htmlFor="revision-reason">Neyin değişmesini istiyorsun?</Label>
      <Textarea id="revision-reason" autoFocus required minLength={3} maxLength={10000} value={reason} onChange={e => setReason(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Vazgeç</Button>
        <Button type="submit" disabled={p.busy}>Revizeyi gönder</Button>
      </div>
    </form>
  );
}
