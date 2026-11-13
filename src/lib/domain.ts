import {taskProgress,workflowState} from './workflow';
import { z } from 'zod';
export const categories = ['Grafik İşlemleri','Teknik İşlemler','Diğer Talepler'] as const;
export const statuses = ['Yeni','Atandı','İşlemde','Bilgi Bekliyor','Onay Bekliyor','Revize İstendi','Tamamlandı','İptal'] as const;
export type Category = typeof categories[number];
export type Status = typeof statuses[number];
export type Profile = {id:string;name:string;email:string;role:'super_admin'|'employee';active:boolean;team:string;technical_assignee?:boolean;design_assignee?:boolean};
export type Task = {id:string;number:number;title:string;description:string;category:Category;brand:string;priority:'Normal'|'Yüksek'|'Acil';status:Status;creator_id:string;assignee_id:string|null;due_date:string;created_at:string;updated_at:string;completed_at:string|null;revision_count:number;progress?:number;issue_description?:string};
export type Message = {id:string;task_id:string;author_id:string;body:string;kind:'comment'|'revision'|'delivery';created_at:string;recipient_id?:string|null;parent_id?:string|null};
export type Attachment = {id:string;task_id:string;uploader_id:string;name:string;size:number;mime:string;path:string;kind:'brief'|'delivery';created_at:string};
export type Audit = {id:string;actor_id:string|null;action:string;entity_id:string;details:string;created_at:string};
export type TaskEvent = {id:string;actor_id:string|null;task_id:string;action:string;details:string;created_at:string};
export type Data = {profiles:Profile[];tasks:Task[];messages:Message[];attachments:Attachment[];logs:Audit[];events:TaskEvent[]};
export const taskSchema=z.object({title:z.string().trim().min(3,'Başlık en az 3 karakter olmalı.').max(180),description:z.string().trim().min(5,'Talebi biraz daha açıklayın.').max(10000),category:z.enum(categories),brand:z.string().trim().min(1,'Müşteri veya iç ekip adı gerekli.').max(100),priority:z.enum(['Normal','Yüksek','Acil']),assignee_id:z.string().nullable(),due_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
export type TaskInput = z.infer<typeof taskSchema>;
export function canEdit(t:Task,p:Profile){return p.role==='super_admin'||t.creator_id===p.id||t.assignee_id===p.id}
export function canApprove(t:Task,p:Profile){return p.role==='super_admin'||t.creator_id===p.id}
export function isOverdue(t:Task,today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'})){return !!t.due_date&&t.due_date<today&&!['Tamamlandı','İptal'].includes(t.status)}
export function validateFile(file:Pick<File,'size'|'type'|'name'>){
  if(file.size===0)throw new Error('Boş dosya yüklenemez.');
  if(file.size>20*1024*1024)throw new Error('Dosya en fazla 20 MB olabilir.');
  if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Yalnızca PDF, PNG, JPG ve WebP yüklenebilir.');
  if(!/\.(pdf|png|jpe?g|webp)$/i.test(file.name))throw new Error('Dosya uzantısı desteklenmiyor.');
}
export function csvCell(value:unknown){let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
export function reportCsv(tasks:Task[],profiles:Profile[]){return '\uFEFF'+[['İş No','Başlık','Bölüm','Müşteri','Durum','İlerleme (%)','Sorumlu','Teslim Tarihi','Revize'],...tasks.map(t=>[t.number,t.title,t.category,t.brand,workflowState(t),taskProgress(t),profiles.find(p=>p.id===t.assignee_id)?.name??'Atanmadı',t.due_date,t.revision_count])].map(r=>r.map(csvCell).join(';')).join('\r\n')}

export function canAssignCategory(profile: Profile, category: Category): boolean {
  if (!profile.active) return false;
  if (category === 'Teknik İşlemler') {
    return profile.technical_assignee ?? /^(harun|yaser)(\s|$)/i.test(profile.name.trim());
  }
  if (category === 'Grafik İşlemleri') {
    return profile.design_assignee ?? profile.team === 'Grafik Tasarım';
  }
  return true;
}
