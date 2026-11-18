import {stateLabel,taskProgress} from './workflow';
import { z } from 'zod';
export const categories = ['Grafik İşlemleri','Teknik İşlemler','Diğer Talepler'] as const;
export const statuses = ['Yeni','Atandı','İşlemde','Bilgi Bekliyor','Onay Bekliyor','Revize İstendi','Tamamlandı','İptal'] as const;
export type Category = typeof categories[number];
export type Status = typeof statuses[number];
export type Profile = {id:string;name:string;email:string;role:'super_admin'|'employee';active:boolean;team:string;technical_assignee?:boolean;design_assignee?:boolean;deleted_at?:string|null};
export type Task = {id:string;number:number;title:string;description:string;category:Category;brand:string;priority:'Normal'|'Yüksek'|'Acil';status:Status;creator_id:string;assignee_id:string|null;created_at:string;updated_at:string;completed_at:string|null;revision_count:number;progress?:number;issue_description?:string;archived_at?:string|null};
export type Message = {id:string;task_id:string;author_id:string;body:string;kind:'comment'|'revision'|'delivery';created_at:string;recipient_id?:string|null;parent_id?:string|null};
export type Attachment = {id:string;task_id:string;uploader_id:string;name:string;size:number;mime:string;path:string;kind:'brief'|'delivery';created_at:string};
export type Audit = {id:string;actor_id:string|null;action:string;entity_id:string;details:string;created_at:string};
export type TaskEvent = {id:string;actor_id:string|null;task_id:string;action:string;details:string;created_at:string};
export type Data = {profiles:Profile[];tasks:Task[];messages:Message[];attachments:Attachment[];logs:Audit[];events:TaskEvent[]};
export const priorities=['Normal','Yüksek','Acil'] as const;
export const taskSchema=z.object({title:z.string().trim().min(3,'Başlık en az 3 karakter olmalı.').max(180),description:z.string().trim().min(5,'Talebi biraz daha açıklayın.').max(10000),category:z.enum(categories),brand:z.string().trim().min(1,'Müşteri veya iç ekip adı gerekli.').max(100),priority:z.enum(priorities),assignee_id:z.string().nullable()});
export type TaskInput = z.infer<typeof taskSchema>;
export function canEdit(t:Task,p:Profile){return p.role==='super_admin'||t.creator_id===p.id||t.assignee_id===p.id}
// Talep sahibi veya süper admin: revize isteme ve iptal etme.
export function canManage(t:Task,p:Profile){return p.role==='super_admin'||t.creator_id===p.id}
export function validateFile(file:Pick<File,'size'|'type'|'name'>){
  if(file.size===0)throw new Error('Boş dosya yüklenemez.');
  if(file.size>20*1024*1024)throw new Error('Dosya en fazla 20 MB olabilir.');
  if(!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Yalnızca PDF, PNG, JPG ve WebP yüklenebilir.');
  if(!/\.(pdf|png|jpe?g|webp)$/i.test(file.name))throw new Error('Dosya uzantısı desteklenmiyor.');
}
export function csvCell(value:unknown){let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
export function reportCsv(tasks:Task[],profiles:Profile[]){return '\uFEFF'+[['İş No','Başlık','Bölüm','Müşteri','Durum','Öncelik','İlerleme (%)','Sorumlu','Revize'],...tasks.map(t=>[t.number,t.title,t.category,t.brand,stateLabel(t),t.priority,taskProgress(t),profiles.find(p=>p.id===t.assignee_id)?.name??'Atanmadı',t.revision_count])].map(r=>r.map(csvCell).join(';')).join('\r\n')}

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

// Bölümde işaretli sorumlu varsa yalnızca onlar, yoksa tüm aktif çalışanlar atanabilir.
export function assignableProfiles(profiles: Profile[], category: Category): Profile[] {
  const active = profiles.filter(p => p.active);
  const flagged = active.filter(p => canAssignCategory(p, category));
  return flagged.length ? flagged : active;
}
