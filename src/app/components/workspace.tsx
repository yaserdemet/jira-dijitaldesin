'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Attachment, Audit, Category, Data, Message, Profile, Task, TaskInput, assignableProfiles, assigneeNames, assigneesOf, canEdit, canManage, categories, taskSchema, validateFile } from '@/lib/domain';
import { supabase, demoAllowed } from '@/lib/client';
import { getDemoFile, putDemoFile, readDemo, saveDemo } from '@/lib/demo';
import { AddUserDialog, CreateDialog, Login, PasswordDialog, maxRequestFiles } from './forms';
import WorkflowScreen from './workflow-screen';
import { PageLoader } from './screen-kit';
import {Guide,Notice,canRequestRevision,taskProgress,workflowState} from '@/lib/workflow';
import type { Session } from '@supabase/supabase-js';
const empty:Data={profiles:[],tasks:[],messages:[],attachments:[],logs:[],events:[]};
// 008_realtime.sql ile Realtime'a açılan tablolar; biri değişince ekran yenilenir.
const realtimeTables=['profiles','tasks','messages','attachments','task_events','notifications','guides'] as const;
function visibleGuides(guides:Guide[]){
 return guides.filter(guide=>!['guide-request','guide-delivery'].includes(guide.id)
  && !['iyi bir talep nasıl açılır','dosya teslimi ve revize'].includes(guide.title.trim().replace(/[?.!]+$/,'').toLocaleLowerCase('tr-TR')));
}
const uid=()=>crypto.randomUUID();
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
export default function Workspace(){
 const [data,setData]=useState<Data>(empty),[session,setSession]=useState<Session|null>(null),[person,setPerson]=useState<Profile|null>(null),[demo,setDemo]=useState(false),[ready,setReady]=useState(false);
 const [creating,setCreating]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState(''),[addingUser,setAddingUser]=useState(false),[pwTarget,setPwTarget]=useState<Profile|null>(null);
 const demoData=useRef<Data>(empty);
 const sessionUser=useRef<string|null>(null);
 // Yalnızca gerçek girişten sonra bir kez "Hoş geldin" denir; sayfa yenilemede (INITIAL_SESSION) denmez.
 const welcomePending=useRef(false);
 // Üst üste başlayan yüklemelerde yalnızca en yenisinin sonucu yazılır; yavaş kalan eski yükleme yeni veriyi ezmez.
 const loadSeq=useRef(0);
 const [notices,setNotices]=useState<Notice[]>([]),[guides,setGuides]=useState<Guide[]>([]);
 const [createCategory,setCreateCategory]=useState<Category>('Teknik İşlemler');
 useEffect(()=>{const sync=()=>{
  const category=categories.find(value=>value===new URLSearchParams(location.search).get('kategori'));
  setCreateCategory(category??'Teknik İşlemler');
  setCreating(location.pathname==='/yeni');
 };window.addEventListener('popstate',sync);sync();return()=>window.removeEventListener('popstate',sync)},[]);
 function navigate(path:string){history.pushState(null,'',path);window.dispatchEvent(new PopStateEvent('popstate'))}
 function demoNotice(recipient:string|null,taskId:string,body:string,messageId:string|null=null){if(!recipient||recipient===person?.id)return;setNotices(old=>{const next=[{id:uid(),recipient_id:recipient,task_id:taskId,message_id:messageId,body,created_at:new Date().toISOString(),read_at:null},...old];localStorage.setItem('akis-demo-notices',JSON.stringify(next));return next})}
 const notify=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),4500)};
 const fail=(e:unknown)=>setError(e instanceof Error?e.message:typeof e==='object'&&e!==null&&'message' in e?String(e.message):'İşlem tamamlanamadı. Yeniden deneyin.');
 const load=useCallback(async()=>{
  if(demo){setData({...demoData.current});return}
  if(!supabase||!session)return;
  const seq=++loadSeq.current;
  const outdated=()=>sessionUser.current!==session.user.id||seq!==loadSeq.current;
  const {data:p,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();
  if(outdated())return;
  if(error||!p?.active){setPerson(null);setData(empty);throw new Error('Hesabınızın erişimi yok. Yöneticinizle görüşün.')}
  setPerson(p);
  if(welcomePending.current){welcomePending.current=false;notify(`Hoş geldin, ${p.name.split(' ')[0]}!`)}
  const names=['profiles','tasks','messages','attachments','task_events',...(p.role==='super_admin'?['audit_logs']:[])];
  const results=await Promise.all(names.map(async n=>{
   const rows:unknown[]=[];for(let offset=0;;offset+=500){
    const {data:page,error}=await supabase!.from(n).select('*').order(n==='profiles'?'name':'created_at',{ascending:n==='profiles'}).order('id').range(offset,offset+499);
    if(error)throw error;rows.push(...page);if(page.length<500)break;
   }return {data:rows};
  }));
  const next={profiles:results[0].data,tasks:results[1].data,messages:results[2].data,attachments:results[3].data,events:results[4]?.data??[],logs:results[5]?.data??[]} as Data;
  if(outdated())return;
  setData(next);
  const extra=await Promise.all([supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(500),supabase.from('guides').select('*').order('created_at',{ascending:false})]);
  for(const result of extra)if(result.error)throw new Error('Ekran güncellemesi için 003_workflow.sql veritabanı geçişini uygulayın. '+result.error.message);
  if(outdated())return;
  setNotices(extra[0].data as Notice[]);setGuides(visibleGuides(extra[1].data as Guide[]));
 },[demo,session]);
 useEffect(()=>{
  if(!supabase){setReady(true);return;}
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
   const id=next?.user.id??null;
   if(sessionUser.current!==id){
    welcomePending.current=event==='SIGNED_IN'&&id!==null;
    sessionUser.current=id;
    setPerson(null);setData(empty);setNotices([]);setGuides([]);setAddingUser(false);setPwTarget(null);
   }
   setSession(next);setReady(true);
  });
  return()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{if(session||demo)load().catch(fail)},[session,demo,load]);
 // Anlık güncelleme: Realtime yalnızca "bir şey değişti" sinyali verir, veri yine load() ile RLS'li okunur.
 // Sekme arka plandayken yenilenmez; geri dönülünce kaçan değişiklik varsa bir kez yenilenir.
 useEffect(()=>{
  const db=supabase;
  if(!db||!session||demo)return;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let firstEventAt=0;
  let stale=false;
  let live=false;
  let lastLoad=Date.now();

  const refresh=()=>{
   timer=undefined;
   firstEventAt=0;
   if(document.visibilityState!=='visible'){
    stale=true;
    return;
   }
   stale=false;
   lastLoad=Date.now();
   load().catch(fail);
  };

  // Art arda gelen değişiklikler (iş + olay kaydı + bildirim) tek yenilemede toplanır,
  // ama sürekli akan değişiklikler yenilemeyi 2 saniyeden fazla geciktiremez.
  const schedule=()=>{
   const now=Date.now();
   if(!firstEventAt)firstEventAt=now;
   clearTimeout(timer);
   timer=setTimeout(refresh,Math.max(0,Math.min(500,firstEventAt+2000-now)));
  };

  // Kanal adı her çalıştırmada benzersiz: kapanmakta olan eski kanal yeniden kullanılırsa
  // abonelik sessizce düşer (supabase-js aynı adlı kanalı geri verir).
  const channel=db.channel('akis-degisiklikler-'+uid());
  for(const table of realtimeTables){
   // DELETE dinlenmez: Supabase silme olaylarında RLS uygulamaz. Uygulama zaten silmez,
   // arşivler; toplu silmeler (npm run temizle) yedek yenilemeyle yakalanır.
   channel.on('postgres_changes',{event:'INSERT',schema:'public',table},schedule);
   channel.on('postgres_changes',{event:'UPDATE',schema:'public',table},schedule);
  }
  // Silinen talep diğer ekranlardan da hemen kalksın. Olayda yalnızca talebin kimliği gelir;
  // talepleri zaten bütün üyeler görebildiği için bu bir şey açığa çıkarmaz.
  channel.on('postgres_changes',{event:'DELETE',schema:'public',table:'tasks'},schedule);
  channel.subscribe(status=>{
   live=status==='SUBSCRIBED';
   // İlk bağlantıda ve kopup yeniden bağlanınca, abonelik kurulana kadar kaçan değişiklikler için bir kez yenile.
   if(live)schedule();
  });

  const onVisible=()=>{
   if(document.visibilityState==='visible'&&stale)refresh();
  };
  document.addEventListener('visibilitychange',onVisible);

  // Yedek: Realtime bağlı değilse eskisi gibi 30 saniyede bir, bağlıysa 5 dakikada bir yenile.
  const fallback=setInterval(()=>{
   const due=live?300000:30000;
   if(Date.now()-lastLoad<due)return;
   if(document.visibilityState!=='visible'){
    stale=true;
    return;
   }
   lastLoad=Date.now();
   load().catch(fail);
  },30000);

  return()=>{
   clearTimeout(timer);
   clearInterval(fallback);
   document.removeEventListener('visibilitychange',onVisible);
   void db.removeChannel(channel);
  };
 },[load,session,demo]);
 const run=async(fn:()=>Promise<void>)=>{if(busy)return false;setBusy(true);setError('');try{await fn();return true}catch(e){fail(e);return false}finally{setBusy(false)}};
 function commit(next:Data){saveDemo(next);demoData.current=next;setData(next)}
 function log(action:string,entity_id:string,details=''):Audit{return{id:uid(),actor_id:person!.id,action,entity_id,details,created_at:new Date().toISOString()}}
 function startDemo(){
  try {
   const d=readDemo();
   if(!d.profiles.some(p=>/^yaser(?:\s|$)/i.test(p.name.trim()))){
    d.profiles=[...d.profiles,{id:'demo-yaser',name:'Yaser Bey',email:'yaser@example.test',role:'employee',active:true,team:'Teknik Destek'}];
   }
   setNotices(JSON.parse(localStorage.getItem('akis-demo-notices')??'[]'));
   const savedGuides=JSON.parse(localStorage.getItem('akis-demo-guides')??'[]') as Guide[];
   setGuides(visibleGuides(savedGuides));
   demoData.current=d;setData(d);setPerson(d.profiles[0]);setDemo(true);
  }catch(e){fail(e)}
 }
 async function createTask(input:TaskInput,files:File[]){
  const clean=taskSchema.parse(input);
  if(files.length>maxRequestFiles)throw new Error('Bir talebe en fazla 10 dosya ekleyebilirsiniz.');
  files.forEach(validateFile);
  const assignable=assignableProfiles(data.profiles,clean.category);
  const outside=clean.assignee_ids.flatMap(id=>assignable.some(p=>p.id===id)?[]:data.profiles.find(p=>p.id===id)?.name??'Seçilen kişi');
  if(outside.length)throw new Error(outside.join(', ')+' bölümün aktif sorumluları arasında değil.');
  const status=clean.assignee_ids.length?'Atandı':'Yeni';
  let task:Task;
  if(demo){const now=new Date().toISOString();task={...clean,assignee_id:clean.assignee_ids[0]??null,id:uid(),number:Math.max(1000,...data.tasks.map(t=>t.number))+1,status,creator_id:person!.id,created_at:now,updated_at:now,completed_at:null,revision_count:0};commit({...demoData.current,tasks:[task,...demoData.current.tasks],logs:[log('Talep oluşturuldu',task.id,task.title),...demoData.current.logs]})}
  else {const {data:t,error}=await supabase!.from('tasks').insert({...clean,creator_id:person!.id,status}).select().single();if(error)throw error;task=t}
  if(demo)for(const id of task.assignee_ids)demoNotice(id,task.id,'Sana yeni bir talep atandı.');
  setCreating(false);navigate('/talep/'+task.id);
  try{for(const f of files)await upload(task.id,f,'brief');notify('Talep oluşturuldu.')}catch(e){throw new Error('Talep oluşturuldu, ancak dosya yüklenemedi. İşin içinden tekrar yükleyin. '+(e instanceof Error?e.message:''))}finally{await load()}
 }
 async function updateTask(t:Task,patch:Partial<Task>,note?:{body:string;kind:Message['kind']}){
  if(!canEdit(t,person!))throw new Error('Bu işi yalnızca talep sahibi, sorumlu veya süper admin değiştirebilir.');

  if(patch.status==='Revize İstendi'&&!canManage(t,person!))throw new Error('Revizeyi talep sahibi isteyebilir.');
  if(patch.status==='Revize İstendi'&&!canRequestRevision(t))throw new Error('Revize yalnızca üzerinde çalışılan veya tamamlanan işler için istenebilir.');
  if(patch.status==='İptal'&&t.status!=='İptal'&&!canManage(t,person!))throw new Error('Talebi yalnızca açan kişi veya süper admin iptal edebilir.');
  if(patch.status==='Bilgi Bekliyor'&&(patch.issue_description??t.issue_description??'').trim().length<3)throw new Error('Sorunun nedenini açıklayın.');
  if(demo){
   // Veritabanındaki arşiv ve revize kurallarının deneme modundaki karşılığı.
   const status=patch.status??t.status;
   if(!['Tamamlandı','İptal'].includes(status)){if(patch.archived_at&&!t.archived_at)throw new Error('Yalnızca tamamlanan veya iptal edilen işler arşivlenebilir.');patch={...patch,archived_at:null}}
   if(patch.status==='Revize İstendi')patch={...patch,progress:Math.min(taskProgress(t),90)};
  }
  // Sorumlu değişikliğinin geçmişte ve bildirimde görünen adları.
  const assigneeText=patch.assignee_ids?assigneeNames({assignee_ids:patch.assignee_ids},data.profiles).join(', ')||'Atanmadı':'';
  if(demo&&patch.assignee_ids)patch={...patch,assignee_id:patch.assignee_ids[0]??null};
  if(demo){const next={...t,...patch,...(note?{issue_description:note.body}:{}),updated_at:new Date().toISOString(),completed_at:patch.status==='Tamamlandı'?new Date().toISOString():patch.status?null:t.completed_at,revision_count:t.revision_count+(patch.status==='Revize İstendi'?1:0)};commit({...demoData.current,tasks:demoData.current.tasks.map(x=>x.id===t.id?next:x),messages:note?[...demoData.current.messages,{...note,id:uid(),task_id:t.id,author_id:person!.id,created_at:new Date().toISOString()}]:demoData.current.messages,events:[{id:uid(),actor_id:person!.id,task_id:t.id,action:patch.status?'Durum değişti':'archived_at' in patch?(patch.archived_at?'Arşivlendi':'Arşivden çıkarıldı'):'Sorumlu değişti',details:patch.status?`${t.status} → ${patch.status}`:assigneeText,created_at:new Date().toISOString()},...demoData.current.events],logs:[log(patch.status?'Durum değişti':'Sorumlu değişti',t.id,`${t.title} → ${patch.status??assigneeText}`),...demoData.current.logs]})}
  else {if(note){const {error}=await supabase!.rpc('request_revision',{task_id:t.id,reason:note.body,expected_updated_at:t.updated_at});if(error)throw error}else{const {error}=await supabase!.from('tasks').update(patch).eq('id',t.id).eq('updated_at',t.updated_at).select().single();if(error)throw new Error('İş güncellenemedi. Başka biri değiştirmiş olabilir; listeyi yenileyip tekrar deneyin.')}}
  if(demo){
   const before=assigneesOf(t);
   for(const id of new Set([t.creator_id,...assigneesOf({...t,...patch})])){
    const added=Boolean(patch.assignee_ids)&&!before.includes(id)&&id!==t.creator_id;
    demoNotice(id,t.id,added?'Sana yeni bir talep atandı.':patch.assignee_ids?'Talebin sorumluları güncellendi.':`Talep güncellendi: ${workflowState({...t,...patch})} · %${taskProgress({...t,...patch})}`);
   }
  }
  await load();notify(patch.status==='İptal'?'Talep iptal edildi ve arşive taşındı.':'archived_at' in patch&&!patch.status?(patch.archived_at?'Arşivlendi.':'Arşivden çıkarıldı.'):'İş güncellendi.');
 }
 async function archiveTasks(tasks:Task[]){
  const now=new Date().toISOString();
  for(const t of tasks){
   if(demo){commit({...demoData.current,tasks:demoData.current.tasks.map(x=>x.id===t.id?{...x,archived_at:now}:x)})}
   else{const {error}=await supabase!.from('tasks').update({archived_at:now}).eq('id',t.id).eq('updated_at',t.updated_at);if(error)throw error}
  }
  await load();notify(tasks.length+' iş arşivlendi.');
 }
 async function addMessage(t:Task,body:string,kind:Message['kind'],recipient:string|null=null,parent:string|null=null){
  if(!body.trim())return;if(body.length>10000)throw new Error('Açıklama en fazla 10.000 karakter olabilir.');
  if(parent){const original=data.messages.find(m=>m.id===parent&&m.task_id===t.id);if(!original)throw new Error('Yanıtlanan yorum bulunamadı.');recipient=original.author_id}
  const id=uid();
  if(demo){const entry={id,task_id:t.id,author_id:person!.id,body:body.trim(),kind,recipient_id:recipient,parent_id:parent,created_at:new Date().toISOString()};commit({...demoData.current,messages:[...demoData.current.messages,entry],events:[{id:uid(),task_id:t.id,actor_id:person!.id,action:'Yorum eklendi',details:body.trim().slice(0,180),created_at:entry.created_at},...demoData.current.events],logs:[log(kind==='delivery'?'Çözüm açıklaması eklendi':'Yorum eklendi',t.id,t.title),...demoData.current.logs]});demoNotice(recipient,t.id,person!.name+' sana bir yorum yazdı.',id)}
  else {const {error}=await supabase!.from('messages').insert({id,task_id:t.id,author_id:person!.id,body:body.trim(),kind,recipient_id:recipient,parent_id:parent});if(error)throw error}
  await load();notify('Mesaj eklendi.');
 }
 async function markRead(ids:string[]){const now=new Date().toISOString();if(demo){const next=notices.map(n=>ids.includes(n.id)&&n.recipient_id===person!.id?{...n,read_at:now}:n);setNotices(next);localStorage.setItem('akis-demo-notices',JSON.stringify(next))}else{const {error}=await supabase!.from('notifications').update({read_at:now}).in('id',ids).eq('recipient_id',person!.id);if(error)throw error;await load()}}
 // Denetim kayıtlarını kalıcı siler; veritabanı yalnızca süper admin'e izin verir ve silme işlemini tek kayıtla iz olarak bırakır.
 // Sunucu uçlarına oturum anahtarıyla istek. Anahtarın süresi dolmak üzereyse önce yenilenir;
 // sunucu yine de oturumu reddederse (ör. başka sekme yenileme anahtarını kullandı) bir kez yenileyip tekrar dener.
 async function postWithSession(path:string,body:unknown){
  const expired='Oturumun sona ermiş. Çıkış yapıp yeniden giriş yap.';
  const token=async(force:boolean)=>{
   const {data:{session:s}}=await supabase!.auth.getSession();
   if(!force&&s&&(s.expires_at??0)*1000>Date.now()+60000)return s.access_token;
   const {data,error}=await supabase!.auth.refreshSession();
   if(error||!data.session)throw new Error(expired);
   return data.session.access_token;
  };
  const send=async(force:boolean)=>fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await token(force)}`},body:JSON.stringify(body)});
  let r=await send(false);
  if(r.status===401)r=await send(true);
  const result=await r.json().catch(()=>({error:'Sunucudan yanıt alınamadı. Yeniden deneyin.'}));
  if(r.status===401)throw new Error(expired);
  if(!r.ok)throw new Error(result.error??'İşlem tamamlanamadı. Yeniden deneyin.');
  return result;
 }
 // Talebi kalıcı siler (yorumlar, geçmiş, bildirimler ve dosyalarıyla). Yalnızca açan kişi veya süper admin;
 // asıl kontrol veritabanında (010_delete_task.sql), dosyalar sunucu ucunda depodan silinir.
 async function deleteTask(t:Task){
  if(!person||!canManage(t,person))throw new Error('Talebi yalnızca açan kişi veya süper admin silebilir.');
  if(demo){
   const d=demoData.current;
   const files=d.attachments.filter(a=>a.task_id===t.id).length;
   commit({
    ...d,
    tasks:d.tasks.filter(x=>x.id!==t.id),
    messages:d.messages.filter(m=>m.task_id!==t.id),
    attachments:d.attachments.filter(a=>a.task_id!==t.id),
    events:d.events.filter(e=>e.task_id!==t.id),
    logs:[log('Talep kalıcı olarak silindi',t.id,'#'+t.number+' '+t.title+' ('+files+' dosya)'),...d.logs],
   });
   setNotices(old=>old.filter(n=>n.task_id!==t.id));
   notify('Talep kalıcı olarak silindi.');
   return;
  }
  const result=await postWithSession('/api/tasks/delete',{id:t.id});
  if(location.pathname==='/talep/'+t.id)navigate('/');
  await load();
  notify(result.fileError?'Talep silindi, ancak bazı dosyalar depodan silinemedi.':'Talep kalıcı olarak silindi.');
 }
 async function clearLogs(){
  if(person?.role!=='super_admin')throw new Error('Denetim kayıtlarını yalnızca süper admin silebilir.');
  if(demo){
   const removed=demoData.current.logs.length;
   commit({...demoData.current,logs:[log('Denetim kayıtları silindi',person.id,removed+' kayıt kalıcı olarak silindi')]});
   notify(removed+' denetim kaydı silindi.');
   return;
  }
  const {data:removed,error}=await supabase!.rpc('clear_audit_logs');
  if(error)throw new Error(error.code==='PGRST202'?'Önce 009_clear_audit_logs.sql geçişini uygulayın.':'Denetim kayıtları silinemedi: '+error.message);
  await load();
  notify(removed+' denetim kaydı silindi.');
 }
 async function addGuide(title:string,body:string){if(title.trim().length<3||body.trim().length<10)throw new Error('Başlık ve rehber adımlarını doldurun.');const guide={id:uid(),title:title.trim(),body:body.trim(),author_id:person!.id,created_at:new Date().toISOString()};if(demo){const next=[guide,...guides];setGuides(next);localStorage.setItem('akis-demo-guides',JSON.stringify(next));commit({...demoData.current,logs:[log('Rehber yayımlandı',guide.id,title),...demoData.current.logs]})}else{const {error}=await supabase!.from('guides').insert(guide);if(error)throw error;await load()}notify('Rehber yayımlandı.')}
 async function upload(taskId:string,file:File,kind:Attachment['kind']){
  validateFile(file);const id=uid();const path=`${person!.id}/${taskId}/${id}.${file.name.split('.').pop()!.toLowerCase()}`;
  const record:Attachment={id,task_id:taskId,uploader_id:person!.id,name:file.name,size:file.size,mime:file.type,path,kind,created_at:new Date().toISOString()};
  if(demo){await putDemoFile(id,file);commit({...demoData.current,attachments:[...demoData.current.attachments,record],logs:[log('Dosya eklendi',taskId,file.name),...demoData.current.logs]})}
  else {const {error}=await supabase!.storage.from('task-files').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;const {error:e}=await supabase!.from('attachments').insert(record);if(e){await supabase!.storage.from('task-files').remove([path]);throw e}}
 }
 async function openFile(a:Attachment){if(demo){download(await getDemoFile(a.id),a.name)}else{const {data,error}=await supabase!.storage.from('task-files').createSignedUrl(a.path,60,{download:a.name});if(error)throw error;const link=document.createElement('a');link.href=data.signedUrl;link.rel='noopener';link.target='_blank';link.click()}}
 async function adminAction(body:Record<string,unknown>){if(person?.role!=='super_admin')throw new Error('Süper admin yetkisi gerekli.');if(demo){if(body.action==='responsibilities'){
   commit({...demoData.current,profiles:data.profiles.map(p=>p.id===body.id?{...p,technical_assignee:Boolean(body.technical),design_assignee:Boolean(body.design)}:p),logs:[log('Bölüm sorumluları güncellendi',String(body.id)),...data.logs]});
   notify('Bölüm sorumluları güncellendi.');
  }else if(body.action==='delete'){if(body.id===person.id)throw new Error('Kendi hesabınızı silemezsiniz.');const target=demoData.current.profiles.find(p=>p.id===body.id);if(!target||target.role==='super_admin')throw new Error('Süper admin hesabı bu ekrandan silinemez.');const now=new Date().toISOString();commit({...demoData.current,profiles:demoData.current.profiles.map(p=>p.id===body.id?{...p,name:'Silinmiş kullanıcı',email:'',team:'',active:false,technical_assignee:false,design_assignee:false,deleted_at:now}:p),tasks:demoData.current.tasks.map(t=>{if(['Tamamlandı','İptal'].includes(t.status)||!assigneesOf(t).includes(String(body.id)))return t;const rest=assigneesOf(t).filter(id=>id!==body.id);return {...t,assignee_ids:rest,assignee_id:rest[0]??null}}),logs:[log('Kullanıcı kalıcı olarak silindi',String(body.id),target.name),...demoData.current.logs]});notify('Kullanıcı kalıcı olarak silindi.')}else if(body.action==='password'){notify('Deneme modunda şifre kaydedilmez.')}else if(body.action==='create'){const p:Profile={id:uid(),name:String(body.name),email:String(body.email),team:String(body.team),role:'employee',active:true};if(data.profiles.some(x=>x.email.toLowerCase()===p.email.toLowerCase()))throw new Error('Bu e-posta zaten kayıtlı.');commit({...demoData.current,profiles:[...demoData.current.profiles,p],logs:[log('Deneme kullanıcısı eklendi',p.id,p.email),...demoData.current.logs]});notify('Deneme kullanıcısı eklendi; e-posta gönderilmedi.')}else{if(body.id===person.id)throw new Error('Kendi hesabınızı kapatamazsınız.');commit({...demoData.current,profiles:demoData.current.profiles.map(p=>p.id===body.id?{...p,active:Boolean(body.active)}:p),logs:[log(body.active?'Hesap etkinleştirildi':'Hesap erişimi kapatıldı',String(body.id)),...demoData.current.logs]});notify('Kullanıcı güncellendi.')}}else{await postWithSession('/api/admin/users',body);notify(body.action==='create'?'Kullanıcı oluşturuldu. E-posta ve şifresiyle giriş yapabilir.':body.action==='password'?'Şifre güncellendi.':body.action==='delete'?'Kullanıcı kalıcı olarak silindi.':'Kullanıcı güncellendi.');await load()}setAddingUser(false);setPwTarget(null)}
 async function changePassword(target:Profile,password:string){if(password.length<8)throw new Error('Şifre en az 8 karakter olmalı.');if(!demo&&target.id===person?.id){const {error}=await supabase!.auth.updateUser({password});if(error)throw error;notify('Şifren güncellendi.');setPwTarget(null);return}await adminAction({action:'password',id:target.id,password})}
 // Oturum var ama profil henüz gelmediyse giriş ekranı değil yükleyici gösterilir; aksi hâlde yenilemede giriş ekranı kısa süre görünür.
 if(!ready||(session&&!person&&!error))return <PageLoader />;
 if(!person)return <Login busy={busy} configured={!!supabase} allowDemo={demoAllowed} onDemo={startDemo} error={error} run={run} session={session} onLogout={()=>run(async()=>{await supabase?.auth.signOut();setSession(null);setError('')})}/>;
 const clearError=()=>setError('');
 return <>
  <WorkflowScreen data={data} person={person} demo={demo} busy={busy} notices={notices} guides={guides} error={creating||addingUser||pwTarget?'':error} toast={toast} onUser={p=>{setPerson(p);navigate('/')}} onLogout={()=>run(async()=>{if(!demo)await supabase!.auth.signOut();setDemo(false);setPerson(null);setData(empty)})} onCreate={c=>navigate('/yeni?kategori='+encodeURIComponent(c))} onUpdate={(t,patch,note)=>run(()=>updateTask(t,patch,note))} onArchive={ts=>run(()=>archiveTasks(ts))} onMessage={(t,body,recipient,parent,kind)=>run(()=>addMessage(t,body,kind,recipient,parent))} onFiles={(t,files,kind)=>run(async()=>{files.forEach(validateFile);for(const f of files)await upload(t.id,f,kind);await load();notify('Dosyalar eklendi.')})} onDownload={a=>run(()=>openFile(a))} onRead={ids=>run(()=>markRead(ids))} onGuide={(title,body)=>run(()=>addGuide(title,body))} onClearLogs={()=>run(clearLogs)} onDeleteTask={t=>run(()=>deleteTask(t))} onResponsibilities={(id,technical,design)=>run(()=>adminAction({action:"responsibilities",id,technical,design}))} onAddUser={()=>setAddingUser(true)} onPassword={setPwTarget} onActive={p=>run(()=>adminAction({action:'active',id:p.id,active:!p.active}))} onDelete={p=>run(()=>adminAction({action:'delete',id:p.id}))}/>
  {creating&&<CreateDialog key={createCategory} tourUser={demo?'demo':person.id} profiles={data.profiles} category={createCategory} onCategory={c=>{history.replaceState(null,'','/yeni?kategori='+encodeURIComponent(c));setCreateCategory(c)}} busy={busy} error={error} onClearError={clearError} onClose={()=>{setCreating(false);navigate('/')}} onSubmit={(input,files)=>run(()=>createTask(input,files))}/>}
  {addingUser&&<AddUserDialog busy={busy} demo={demo} error={error} onClearError={clearError} onClose={()=>setAddingUser(false)} onSubmit={b=>run(()=>adminAction(b))}/>}
  {pwTarget&&<PasswordDialog busy={busy} target={pwTarget} self={pwTarget.id===person.id} error={error} onClearError={clearError} onClose={()=>setPwTarget(null)} onSubmit={pw=>run(()=>changePassword(pwTarget,pw))}/>}
 </>;
}
