import type { Task } from './domain';

export const workflowStates = ['Bekliyor', 'Yapılıyor', 'Tamamlandı', 'Sorun Var'] as const;
export type WorkflowState = typeof workflowStates[number];
export const categoryLabels: Record<string, string> = {'Teknik İşlemleri':'Teknik Destek','Teknik İşlemler':'Teknik Destek','Grafik İşlemleri':'Grafik Tasarım','Diğer Talepler':'Diğer Talepler'};
export function workflowState(task: Pick<Task,'status'>): WorkflowState {
  if(task.status==='Tamamlandı') return 'Tamamlandı';
  if(['Bilgi Bekliyor','Revize İstendi','İptal'].includes(task.status)) return 'Sorun Var';
  if(['İşlemde','Onay Bekliyor'].includes(task.status)) return 'Yapılıyor';
  return 'Bekliyor';
}
// Kartta görünen ad: iptal edilen iş "Sorun Var" değil, "İptal" olarak gösterilir.
export function stateLabel(task: Pick<Task,'status'>): string {return task.status==='İptal'?'İptal':workflowState(task)}
// Revize yalnızca üzerinde çalışılan veya tamamlanan işe istenir.
export function canRequestRevision(task: Pick<Task,'status'>) {return ['İşlemde','Onay Bekliyor','Tamamlandı'].includes(task.status)}
// Öncelik etiketlerinin pastel renk sınıfı.
export function priorityClass(priority: Task['priority']) {return priority==='Acil'?'urgent':priority==='Yüksek'?'high':'normal'}
export function taskProgress(task: Task) {return task.status==='Tamamlandı'?100:task.progress??(workflowState(task)==='Yapılıyor'?50:0)}
export function workflowPatch(state: WorkflowState, progress: number, problem: string): Partial<Task> {
  if(!workflowStates.includes(state)||!Number.isInteger(progress)||progress<0||progress>100) throw new Error('Geçerli bir durum ve ilerleme seçin.');
  if(state==='Sorun Var'&&problem.trim().length<3) throw new Error('Sorunun nedenini en az 3 karakterle açıklayın.');
  return {status:state==='Bekliyor'?'Atandı':state==='Yapılıyor'?'İşlemde':state==='Sorun Var'?'Bilgi Bekliyor':'Tamamlandı',progress:state==='Tamamlandı'?100:state==='Bekliyor'?0:state==='Yapılıyor'?Math.max(5,Math.min(95,progress)):progress,issue_description:state==='Sorun Var'?problem.trim():''};
}
export type Notice={id:string;recipient_id:string;task_id:string;message_id:string|null;body:string;created_at:string;read_at:string|null};
export type Guide={id:string;title:string;body:string;author_id:string;created_at:string};

export type DayGroup<T> = {key: string; label: string; tasks: T[]};

// Tamamlanan işleri bitiş gününe (tarayıcının yerel saati) göre gruplar; en yeni gün ve en yeni iş üstte.
// Bitiş zamanı olmayan eski kayıtlar en sonda "Tarihi bilinmiyor" altında toplanır.
export function groupByCompletionDay<T extends Pick<Task, 'completed_at' | 'updated_at'>>(tasks: T[], now = new Date()): DayGroup<T>[] {
  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  const sorted = [...tasks].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '') || b.updated_at.localeCompare(a.updated_at));
  const groups: DayGroup<T>[] = [];
  for (const task of sorted) {
    const date = task.completed_at ? new Date(task.completed_at) : null;
    const key = date ? dayKey(date) : 'bilinmiyor';
    let group = groups.find(g => g.key === key);
    if (!group) {
      const label = !date ? 'Tarihi bilinmiyor'
        : key === today ? 'Bugün'
        : key === yesterday ? 'Dün'
        : date.toLocaleDateString('tr-TR', {
          day: 'numeric', month: 'long', weekday: 'long',
          ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
        });
      group = { key, label, tasks: [] };
      groups.push(group);
    }
    group.tasks.push(task);
  }
  return groups;
}
