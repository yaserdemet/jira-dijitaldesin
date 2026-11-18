'use client';
import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Archive, MessageSquare, Trash2 } from 'lucide-react';
import { type Profile, type Task, canEdit, canManage } from '@/lib/domain';
import { type WorkflowState, categoryLabels, taskProgress, workflowPatch, workflowState, workflowStates } from '@/lib/workflow';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Avatar, ConfirmAction, PriorityBadge, ProgressBar, type Props, StateBadge, stateStyle } from './screen-kit';

/**
 * Baskı renk barı: işlerin durumlara dağılımı tek bir şeritte. Her bölüm aynı zamanda filtre düğmesi.
 */
export function StateRail({ counts, filter, onFilter }: { counts: Record<WorkflowState, number>; filter: string; onFilter: (s: string) => void }) {
  const total = workflowStates.reduce((n, s) => n + counts[s], 0);
  return (
    <div className="mb-6">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {total > 0 && workflowStates.map(s => counts[s] > 0 && (
          <span
            key={s}
            className={cn('h-full transition-[flex-grow,opacity] duration-300', stateStyle[s].bar, filter !== 'Tümü' && filter !== s && 'opacity-25')}
            style={{ flexGrow: counts[s] }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1" role="group" aria-label="Duruma göre filtrele">
        {workflowStates.map(s => {
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => onFilter(active ? 'Tümü' : s)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                active && 'bg-card shadow-[inset_0_0_0_1px_var(--border)]',
              )}
            >
              <span className={cn('size-2.5 rounded-sm', stateStyle[s].dot)} />
              <span className={cn(active ? 'font-semibold' : 'text-muted-foreground')}>{s}</span>
              <span className="font-semibold tabular-nums">{counts[s]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Board({ tasks, p, open }: { tasks: Task[]; p: Props; open: (t: Task) => void }) {
  // Küçük hareketler tıklama sayılır; dokunmatikte kısa basılı tutunca sürükleme başlar.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const [dragging, setDragging] = useState<Task | null>(null);
  const [problem, setProblem] = useState<Task | null>(null);

  function end(e: DragEndEvent) {
    setDragging(null);
    const task = tasks.find(t => t.id === e.active.id), state = e.over?.id as WorkflowState | undefined;
    if (!task || !state || workflowState(task) === state) return;
    if (state === 'Sorun Var') { setProblem(task); return; }
    p.onUpdate(task, workflowPatch(state, taskProgress(task), ''));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={e => setDragging(tasks.find(t => t.id === e.active.id) ?? null)}
      onDragEnd={end}
      onDragCancel={() => setDragging(null)}
    >
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {workflowStates.map(s => <Column key={s} state={s} tasks={tasks.filter(t => workflowState(t) === s)} p={p} open={open} />)}
      </div>
      <DragOverlay>
        {dragging && (
          <article className="rotate-2 cursor-grabbing rounded-lg border bg-card p-3 shadow-xl shadow-foreground/10">
            <CardBody task={dragging} p={p} />
          </article>
        )}
      </DragOverlay>
      {problem && <ProblemDialog task={problem} p={p} onClose={() => setProblem(null)} />}
    </DndContext>
  );
}

function Column({ state, tasks, p, open }: { state: WorkflowState; tasks: Task[]; p: Props; open: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: state });
  const archivable = state === 'Tamamlandı' ? tasks.filter(t => canEdit(t, p.person)) : [];
  return (
    <section
      ref={setNodeRef}
      aria-label={`${state}, ${tasks.length} iş`}
      className={cn(
        'min-h-48 rounded-xl bg-secondary/70 p-2 transition-colors',
        isOver && cn('bg-accent ring-2 ring-inset', stateStyle[state].ring),
      )}
    >
      <header className="flex items-center gap-2 px-2 pt-1 pb-3">
        <span className={cn('h-4 w-1 rounded-full', stateStyle[state].bar)} />
        <h2 className="text-[15px] font-semibold">{state}</h2>
        <span className="ml-auto text-sm font-semibold text-muted-foreground tabular-nums">{tasks.length}</span>
      </header>
      <div className="flex flex-col gap-2">
        {tasks.map(t => <TaskCard key={t.id} task={t} p={p} open={() => open(t)} />)}
      </div>
      {!tasks.length && <p className="px-2 py-8 text-center text-sm text-muted-foreground">Bir kartı buraya sürükle</p>}
      {archivable.length > 0 && (
        <ConfirmAction
          title="Tamamlananlar arşive taşınsın mı?"
          description={`${archivable.length} tamamlanan iş panodan kalkıp Arşiv sayfasına taşınacak. İstediğin zaman geri alabilirsin.`}
          confirmLabel="Arşive taşı"
          onConfirm={() => p.onArchive(archivable)}
          trigger={
            <Button variant="ghost" size="sm" className="mt-2 w-full text-muted-foreground" disabled={p.busy}>
              <Archive /> Tamamlananları arşivle
            </Button>
          }
        />
      )}
    </section>
  );
}

function TaskCard({ task, p, open }: { task: Task; p: Props; open: () => void }) {
  const can = canEdit(task, p.person);
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: task.id, disabled: !can || p.busy });
  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={task.title}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter') open(); }}
      className={cn(
        'group rounded-lg border bg-card p-3 text-left outline-none transition-[border-color,opacity] hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50',
        can ? 'cursor-grab' : 'cursor-pointer',
        isDragging && 'opacity-30',
      )}
    >
      <CardBody task={task} p={p} />
      {canManage(task, p.person) && (
        // Kart sürüklenebilir ve tıklanınca açılır; düğme ve onay penceresi bu olaylara karışmasın.
        <div
          className="mt-2 flex justify-end border-t pt-2"
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          <ConfirmAction
            destructive
            title="Talep kalıcı olarak silinsin mi?"
            description={`#${task.number} ${task.title} talebi; yorumları, geçmişi, bildirimleri ve dosyalarıyla birlikte kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
            confirmLabel="Kalıcı olarak sil"
            onConfirm={() => p.onDeleteTask(task)}
            trigger={
              <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive" disabled={p.busy}>
                <Trash2 /> Sil
              </Button>
            }
          />
        </div>
      )}
    </article>
  );
}

function CardBody({ task: t, p }: { task: Task; p: Props }) {
  const who = p.data.profiles.find(u => u.id === t.assignee_id);
  const comments = p.data.messages.filter(m => m.task_id === t.id).length;
  const state = workflowState(t);
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{t.brand}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">#{t.number}</span>
      </div>
      <h3 className="mt-1.5 font-sans text-sm leading-snug font-semibold [overflow-wrap:anywhere]">{t.title}</h3>
      {state === 'Sorun Var' && t.issue_description && (
        <p className="mt-2 line-clamp-2 rounded-md bg-destructive/8 px-2 py-1.5 text-xs leading-relaxed text-destructive">{t.issue_description}</p>
      )}
      {state === 'Yapılıyor' && <ProgressBar task={t} className="mt-3" />}
      <footer className="mt-3 flex items-center gap-2">
        <PriorityBadge priority={t.priority} />
        {comments > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${comments} yorum`}>
            <MessageSquare className="size-3.5" /> {comments}
          </span>
        )}
        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs text-muted-foreground">{who?.name.split(' ')[0] ?? 'Atanmadı'}</span>
          <Avatar name={who?.name} size="sm" />
        </span>
      </footer>
    </>
  );
}

function ProblemDialog({ task, p, onClose }: { task: Task; p: Props; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={async e => {
            e.preventDefault();
            try {
              setError('');
              if (await p.onUpdate(task, workflowPatch('Sorun Var', taskProgress(task), reason))) onClose();
            } catch (err) { setError((err as Error).message); }
          }}
        >
          <DialogHeader>
            <DialogTitle>Bu işte sorun ne?</DialogTitle>
            <DialogDescription>“{task.title}” işini durduran şeyi kısaca yaz. Talep sahibi ve sorumlu bunu kartta görür.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="problem-reason">Sorunun nedeni</Label>
            <Textarea id="problem-reason" autoFocus required minLength={3} maxLength={10000} rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Örn. Hosting paneline erişim bekleniyor" />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={p.busy}>Sorun var olarak işaretle</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TaskList({ tasks, profiles, open }: { tasks: Task[]; profiles: Profile[]; open: (task: Task) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table aria-label="Talep listesi">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-64">Talep</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="w-40">İlerleme</TableHead>
            <TableHead>Sorumlu</TableHead>
            <TableHead>Öncelik</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...tasks].sort((a, b) => b.number - a.number).map(task => (
            <TableRow key={task.id} className="cursor-pointer" onClick={() => open(task)}>
              <TableCell className="whitespace-normal">
                <button type="button" className="text-left font-semibold hover:underline focus-visible:underline focus-visible:outline-none" onClick={e => { e.stopPropagation(); open(task); }}>
                  {task.title}
                </button>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  #{task.number}, {task.brand}, {categoryLabels[task.category]}
                </div>
              </TableCell>
              <TableCell><StateBadge task={task} /></TableCell>
              <TableCell><ProgressBar task={task} /></TableCell>
              <TableCell>{profiles.find(profile => profile.id === task.assignee_id)?.name ?? 'Atanmadı'}</TableCell>
              <TableCell><PriorityBadge priority={task.priority} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
