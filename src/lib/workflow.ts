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
export function taskProgress(task: Task) {return task.status==='Tamamlandı'?100:task.progress??(workflowState(task)==='Yapılıyor'?50:0)}
export function workflowPatch(state: WorkflowState, progress: number, problem: string): Partial<Task> {
  if(!workflowStates.includes(state)||!Number.isInteger(progress)||progress<0||progress>100) throw new Error('Geçerli bir durum ve ilerleme seçin.');
  if(state==='Sorun Var'&&problem.trim().length<3) throw new Error('Sorunun nedenini en az 3 karakterle açıklayın.');
  return {status:state==='Bekliyor'?'Atandı':state==='Yapılıyor'?'İşlemde':state==='Sorun Var'?'Bilgi Bekliyor':'Tamamlandı',progress:state==='Tamamlandı'?100:state==='Bekliyor'?0:state==='Yapılıyor'?Math.max(5,Math.min(95,progress)):progress,issue_description:state==='Sorun Var'?problem.trim():''};
}
export type Notice={id:string;recipient_id:string;task_id:string;message_id:string|null;body:string;created_at:string;read_at:string|null};
export type Guide={id:string;title:string;body:string;author_id:string;created_at:string};
