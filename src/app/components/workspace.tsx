'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Attachment, Audit, Category, Data, Message, Profile, Task, TaskInput, assignableProfiles, canEdit, canManage, categories, taskSchema, validateFile } from '@/lib/domain';
import { supabase, demoAllowed } from '@/lib/client';
import { getDemoFile, putDemoFile, readDemo, saveDemo } from '@/lib/demo';
import { AddUserDialog, CreateDialog, Login, PasswordDialog, maxRequestFiles } from './forms';
import WorkflowScreen from './workflow-screen';
import {Guide,Notice,canRequestRevision,taskProgress,workflowState} from '@/lib/workflow';
import type { Session } from '@supabase/supabase-js';
const empty:Data={profiles:[],tasks:[],messages:[],attachments:[],logs:[],events:[]};
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
  const {data:p,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();
  if(sessionUser.current!==session.user.id)return;
  if(error||!p?.active){setPerson(null);setData(empty);throw new Error('Hesabınızın erişimi yok. Yöneticinizle görüşün.')}
  setPerson(p);
  const names=['profiles','tasks','messages','attachments','task_events',...(p.role==='super_admin'?['audit_logs']:[])];
  const results=await Promise.all(names.map(async n=>{
   const rows:unknown[]=[];for(let offset=0;;offset+=500){
    const {data:page,error}=await supabase!.from(n).select('*').order(n==='profiles'?'name':'created_at',{ascending:n==='profiles'}).order('id').range(offset,offset+499);
    if(error)throw error;rows.push(...page);if(page.length<500)break;
   }return {data:rows};
  }));
  const next={profiles:results[0].data,tasks:results[1].data,messages:results[2].data,attachments:results[3].data,events:results[4]?.data??[],logs:results[5]?.data??[]} as Data;
  
  if(sessionUser.current!==session.user.id)return;
  setData(next);
  const extra=await Promise.all([supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(500),supabase.from('guides').select('*').order('created_at',{ascending:false})]);
  for(const result of extra)if(result.error)throw new Error('Ekran güncellemesi için 003_workflow.sql veritabanı geçişini uygulayın. '+result.error.message);
  if(sessionUser.current!==session.user.id)return;
  setNotices(extra[0].data as Notice[]);setGuides(visibleGuides(extra[1].data as Guide[]));
 },[demo,session]);
 useEffect(()=>{
  if(!supabase){setReady(true);return;}
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
   const id=next?.user.id??null;
   if(sessionUser.current!==id){
    sessionUser.current=id;
    setPerson(null);setData(empty);setNotices([]);setGuides([]);setAddingUser(false);setPwTarget(null);
   }
   setSession(next);setReady(true);
  });
  return()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{if(session||demo)load().catch(fail)},[session,demo,load]);
 useEffect(()=>{if(!session||demo)return;const id=setInterval(()=>load().catch(fail),30000);return()=>clearInterval(id)},[load,session,demo]);
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
  if(clean.assignee_id&&!assignableProfiles(data.profiles,clean.category).some(p=>p.id===clean.assignee_id))throw new Error('Bu kişi bölümün aktif sorumluları arasında değil.');
  let task:Task;
  if(demo){const now=new Date().toISOString();task={...clean,id:uid(),number:Math.max(1000,...data.tasks.map(t=>t.number))+1,status:clean.assignee_id?'Atandı':'Yeni',creator_id:person!.id,created_at:now,updated_at:now,completed_at:null,revision_count:0};commit({...demoData.current,tasks:[task,...demoData.current.tasks],logs:[log('Talep oluşturuldu',task.id,task.title),...demoData.current.logs]})}
  else {const {data:t,error}=await supabase!.from('tasks').insert({...clean,creator_id:person!.id,status:clean.assignee_id?'Atandı':'Yeni'}).select().single();if(error)throw error;task=t}
  if(demo)demoNotice(task.assignee_id,task.id,'Sana yeni bir talep atandı.');
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
  if(demo){const next={...t,...patch,...(note?{issue_description:note.body}:{}),updated_at:new Date().toISOString(),completed_at:patch.status==='Tamamlandı'?new Date().toISOString():patch.status?null:t.completed_at,revision_count:t.revision_count+(patch.status==='Revize İstendi'?1:0)};commit({...demoData.current,tasks:demoData.current.tasks.map(x=>x.id===t.id?next:x),messages:note?[...demoData.current.messages,{...note,id:uid(),task_id:t.id,author_id:person!.id,created_at:new Date().toISOString()}]:demoData.current.messages,events:[{id:uid(),actor_id:person!.id,task_id:t.id,action:patch.status?'Durum değişti':'archived_at' in patch?(patch.archived_at?'Arşivlendi':'Arşivden çıkarıldı'):'Sorumlu değişti',details:patch.status?`${t.status} → ${patch.status}`:data.profiles.find(p=>p.id===patch.assignee_id)?.name??'Atanmadı',created_at:new Date().toISOString()},...demoData.current.events],logs:[log(patch.status?'Durum değişti':'Sorumlu değişti',t.id,`${t.title} → ${patch.status??data.profiles.find(p=>p.id===patch.assignee_id)?.name??'Atanmadı'}`),...demoData.current.logs]})}
  else {if(note){const {error}=await supabase!.rpc('request_revision',{task_id:t.id,reason:note.body,expected_updated_at:t.updated_at});if(error)throw error}else{const {error}=await supabase!.from('tasks').update(patch).eq('id',t.id).eq('updated_at',t.updated_at).select().single();if(error)throw new Error('İş güncellenemedi. Başka biri değiştirmiş olabilir; listeyi yenileyip tekrar deneyin.')}}
  if(demo){for(const id of new Set([t.creator_id,patch.assignee_id??t.assignee_id]))demoNotice(id,t.id,patch.assignee_id?'Talebin sorumlusu güncellendi.':`Talep güncellendi: ${workflowState({...t,...patch})} · %${taskProgress({...t,...patch})}`)}
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
  }else if(body.action==='delete'){if(body.id===person.id)throw new Error('Kendi hesabınızı silemezsiniz.');const target=demoData.current.profiles.find(p=>p.id===body.id);if(!target||target.role==='super_admin')throw new Error('Süper admin hesabı bu ekrandan silinemez.');const now=new Date().toISOString();commit({...demoData.current,profiles:demoData.current.profiles.map(p=>p.id===body.id?{...p,name:'Silinmiş kullanıcı',email:'',team:'',active:false,technical_assignee:false,design_assignee:false,deleted_at:now}:p),tasks:demoData.current.tasks.map(t=>t.assignee_id===body.id&&!['Tamamlandı','İptal'].includes(t.status)?{...t,assignee_id:null}:t),logs:[log('Kullanıcı kalıcı olarak silindi',String(body.id),target.name),...demoData.current.logs]});notify('Kullanıcı kalıcı olarak silindi.')}else if(body.action==='password'){notify('Deneme modunda şifre kaydedilmez.')}else if(body.action==='create'){const p:Profile={id:uid(),name:String(body.name),email:String(body.email),team:String(body.team),role:'employee',active:true};if(data.profiles.some(x=>x.email.toLowerCase()===p.email.toLowerCase()))throw new Error('Bu e-posta zaten kayıtlı.');commit({...demoData.current,profiles:[...demoData.current.profiles,p],logs:[log('Deneme kullanıcısı eklendi',p.id,p.email),...demoData.current.logs]});notify('Deneme kullanıcısı eklendi; e-posta gönderilmedi.')}else{if(body.id===person.id)throw new Error('Kendi hesabınızı kapatamazsınız.');commit({...demoData.current,profiles:demoData.current.profiles.map(p=>p.id===body.id?{...p,active:Boolean(body.active)}:p),logs:[log(body.active?'Hesap etkinleştirildi':'Hesap erişimi kapatıldı',String(body.id)),...demoData.current.logs]});notify('Kullanıcı güncellendi.')}}else{const {data:{session:s}}=await supabase!.auth.getSession();const r=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s?.access_token}`},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw new Error(result.error);notify(body.action==='create'?'Kullanıcı oluşturuldu. E-posta ve şifresiyle giriş yapabilir.':body.action==='password'?'Şifre güncellendi.':body.action==='delete'?'Kullanıcı kalıcı olarak silindi.':'Kullanıcı güncellendi.');await load()}setAddingUser(false);setPwTarget(null)}
 async function changePassword(target:Profile,password:string){if(password.length<8)throw new Error('Şifre en az 8 karakter olmalı.');if(!demo&&target.id===person?.id){const {error}=await supabase!.auth.updateUser({password});if(error)throw error;notify('Şifren güncellendi.');setPwTarget(null);return}await adminAction({action:'password',id:target.id,password})}
 if(!ready)return <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/> Çalışma alanı açılıyor</div>;
 if(!person)return <Login busy={busy} configured={!!supabase} allowDemo={demoAllowed} onDemo={startDemo} error={error} run={run} session={session} onLogout={()=>run(async()=>{await supabase?.auth.signOut();setSession(null);setError('')})}/>;
 const clearError=()=>setError('');
 return <>
  <WorkflowScreen data={data} person={person} demo={demo} busy={busy} notices={notices} guides={guides} error={creating||addingUser||pwTarget?'':error} toast={toast} onUser={p=>{setPerson(p);navigate('/')}} onLogout={()=>run(async()=>{if(!demo)await supabase!.auth.signOut();setDemo(false);setPerson(null);setData(empty)})} onCreate={c=>navigate('/yeni?kategori='+encodeURIComponent(c))} onUpdate={(t,patch,note)=>run(()=>updateTask(t,patch,note))} onArchive={ts=>run(()=>archiveTasks(ts))} onMessage={(t,body,recipient,parent,kind)=>run(()=>addMessage(t,body,kind,recipient,parent))} onFiles={(t,files,kind)=>run(async()=>{files.forEach(validateFile);for(const f of files)await upload(t.id,f,kind);await load();notify('Dosyalar eklendi.')})} onDownload={a=>run(()=>openFile(a))} onRead={ids=>run(()=>markRead(ids))} onGuide={(title,body)=>run(()=>addGuide(title,body))} onResponsibilities={(id,technical,design)=>run(()=>adminAction({action:"responsibilities",id,technical,design}))} onAddUser={()=>setAddingUser(true)} onPassword={setPwTarget} onActive={p=>run(()=>adminAction({action:'active',id:p.id,active:!p.active}))} onDelete={p=>run(()=>adminAction({action:'delete',id:p.id}))}/>
  {creating&&<CreateDialog key={createCategory} profiles={data.profiles} category={createCategory} onCategory={c=>{history.replaceState(null,'','/yeni?kategori='+encodeURIComponent(c));setCreateCategory(c)}} busy={busy} error={error} onClearError={clearError} onClose={()=>{setCreating(false);navigate('/')}} onSubmit={(input,files)=>run(()=>createTask(input,files))}/>}
  {addingUser&&<AddUserDialog busy={busy} demo={demo} error={error} onClearError={clearError} onClose={()=>setAddingUser(false)} onSubmit={b=>run(()=>adminAction(b))}/>}
  {pwTarget&&<PasswordDialog busy={busy} target={pwTarget} self={pwTarget.id===person.id} error={error} onClearError={clearError} onClose={()=>setPwTarget(null)} onSubmit={pw=>run(()=>changePassword(pwTarget,pw))}/>}
 </>;
}
