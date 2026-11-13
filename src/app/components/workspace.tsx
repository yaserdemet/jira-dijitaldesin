'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowUpRight, BarChart3, Bell, Check, CheckCheck, ChevronDown, CircleHelp, Clock3, FileText, FolderOpen, LayoutDashboard, ListFilter, LoaderCircle, LogOut, Menu, MessageSquare, MoreHorizontal, Paperclip, Plus, Search, Send, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Users, Wrench, X, Palette, KeyRound, ArrowRight, CalendarDays } from 'lucide-react';
import { Attachment, Audit, Category, Data, Message, Profile, Task, TaskInput, canApprove, canEdit, categories, isOverdue, reportCsv, statuses, taskSchema, validateFile } from '@/lib/domain';
import { supabase, demoAllowed } from '@/lib/client';
import { getDemoFile, putDemoFile, readDemo, saveDemo } from '@/lib/demo';
import { designSizes, requestForms } from './request-forms';
import WorkflowScreen from './workflow-screen';
import {Guide,Notice,taskProgress,workflowState} from '@/lib/workflow';
import type { Session } from '@supabase/supabase-js';
const empty:Data={profiles:[],tasks:[],messages:[],attachments:[],logs:[],events:[]};
const initials=(name:string)=>name.split(' ').map(s=>s[0]).slice(0,2).join('').toLocaleUpperCase('tr');
const formatDate=(s:string)=>s?new Date(s.length===10?s+'T12:00:00+03:00':s).toLocaleDateString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'short',...(s.length>10?{hour:'2-digit',minute:'2-digit'}:{})}):'—';
const maxRequestFiles=10;
const statusClass=(s:string)=>s==='Tamamlandı'?'green':s==='Revize İstendi'?'red':s==='Onay Bekliyor'?'purple':s==='İşlemde'?'blue':s==='Bilgi Bekliyor'?'amber':'neutral';
const uid=()=>crypto.randomUUID();
function Avatar({person,small=false}:{person?:Profile;small?:boolean}){return <span className={`avatar ${small?'small':''} tone-${person?person.name.length%5:0}`} title={person?.name??'Atanmadı'}>{person?initials(person.name):'—'}</span>}
function StatusBadge({value}:{value:string}){return <span className={`badge ${statusClass(value)}`}><i/>{value}</span>}
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
export default function Workspace(){
 const [data,setData]=useState<Data>(empty),[session,setSession]=useState<Session|null>(null),[person,setPerson]=useState<Profile|null>(null),[demo,setDemo]=useState(false),[ready,setReady]=useState(false);
 const [creating,setCreating]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState(''),[invite,setInvite]=useState(false),[pwTarget,setPwTarget]=useState<Profile|null>(null);
 const demoData=useRef<Data>(empty);
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
  
  setData(next);
  const extra=await Promise.all([supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(500),supabase.from('guides').select('*').order('created_at',{ascending:false})]);
  for(const result of extra)if(result.error)throw new Error('Ekran güncellemesi için 003_workflow.sql veritabanı geçişini uygulayın. '+result.error.message);
  setNotices(extra[0].data as Notice[]);setGuides(extra[1].data as Guide[]);
 },[demo,session]);
 useEffect(()=>{if(!supabase){setReady(true);return}supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(session||demo)load().catch(fail)},[session,demo,load]);
 useEffect(()=>{if(!session||demo)return;const id=setInterval(()=>load().catch(fail),30000);return()=>clearInterval(id)},[load,session,demo]);
 const run=async(fn:()=>Promise<void>)=>{if(busy)return false;setBusy(true);setError('');try{await fn();return true}catch(e){fail(e);return false}finally{setBusy(false)}};
 function commit(next:Data){saveDemo(next);demoData.current=next;setData(next)}
 function log(action:string,entity_id:string,details=''):Audit{return{id:uid(),actor_id:person!.id,action,entity_id,details,created_at:new Date().toISOString()}}
 function startDemo(){try{setNotices(JSON.parse(localStorage.getItem('akis-demo-notices')??'[]'));const d=readDemo();setGuides(JSON.parse(localStorage.getItem('akis-demo-guides')??JSON.stringify([{id:'guide-request',title:'İyi bir talep nasıl açılır?',body:'1. İlgili bölümü seçin.\n2. Beklentiyi, müşteri adını ve teslim tarihini yazın.\n3. Sorumluyu seçip referans dosyalarını ekleyin.\n4. Talebi oluşturun; gelişmeleri aynı işin altında paylaşın.',author_id:d.profiles[0].id,created_at:new Date().toISOString()},{id:'guide-delivery',title:'Dosya teslimi ve revize',body:'1. Talep ayrıntısını açın.\n2. Teslim dosyası ekle düğmesinden çıktıyı yükleyin.\n3. Çözüm / teslim açıklaması paylaşın.\n4. Gerekiyorsa talep sahibi gerekçesiyle revize isteyebilir; önceki dosyalar korunur.',author_id:d.profiles[0].id,created_at:new Date().toISOString()}])));demoData.current=d;setData(d);setPerson(d.profiles[0]);setDemo(true)}catch(e){fail(e)}}
 async function createTask(input:TaskInput,files:File[]){
  const clean=taskSchema.parse(input);
  if(files.length>maxRequestFiles)throw new Error('Bir talebe en fazla 10 dosya ekleyebilirsiniz.');
  files.forEach(validateFile);
  let task:Task;
  if(demo){const now=new Date().toISOString();task={...clean,id:uid(),number:Math.max(1000,...data.tasks.map(t=>t.number))+1,status:clean.assignee_id?'Atandı':'Yeni',creator_id:person!.id,created_at:now,updated_at:now,completed_at:null,revision_count:0};commit({...demoData.current,tasks:[task,...demoData.current.tasks],logs:[log('Talep oluşturuldu',task.id,task.title),...demoData.current.logs]})}
  else {const {data:t,error}=await supabase!.from('tasks').insert({...clean,creator_id:person!.id,status:clean.assignee_id?'Atandı':'Yeni'}).select().single();if(error)throw error;task=t}
  if(demo)demoNotice(task.assignee_id,task.id,'Sana yeni bir talep atandı.');
  setCreating(false);navigate('/talep/'+task.id);
  try{for(const f of files)await upload(task.id,f,'brief');notify('Talep oluşturuldu.')}catch(e){throw new Error('Talep oluşturuldu, ancak dosya yüklenemedi. İşin içinden tekrar yükleyin. '+(e instanceof Error?e.message:''))}finally{await load()}
 }
 async function updateTask(t:Task,patch:Partial<Task>,note?:{body:string;kind:Message['kind']}){
  if(!canEdit(t,person!))throw new Error('Bu işi yalnızca talep sahibi, sorumlu veya süper admin değiştirebilir.');

  if(patch.status==='Revize İstendi'&&!canApprove(t,person!))throw new Error('Revizeyi talep sahibi isteyebilir.');

  if(patch.status==='Bilgi Bekliyor'&&(patch.issue_description??t.issue_description??'').trim().length<3)throw new Error('Sorunun nedenini açıklayın.');
  if(patch.status==='Onay Bekliyor'&& !data.attachments.some(a=>a.task_id===t.id&&a.kind==='delivery')&&!data.messages.some(m=>m.task_id===t.id&&m.kind==='delivery'))throw new Error('Önce teslim dosyası veya çözüm açıklaması ekleyin.');
  if(demo){const next={...t,...patch,...(note?{issue_description:note.body}:{}),updated_at:new Date().toISOString(),completed_at:patch.status==='Tamamlandı'?new Date().toISOString():patch.status?null:t.completed_at,revision_count:t.revision_count+(patch.status==='Revize İstendi'?1:0)};commit({...demoData.current,tasks:demoData.current.tasks.map(x=>x.id===t.id?next:x),messages:note?[...demoData.current.messages,{...note,id:uid(),task_id:t.id,author_id:person!.id,created_at:new Date().toISOString()}]:demoData.current.messages,events:[{id:uid(),actor_id:person!.id,task_id:t.id,action:patch.status?'Durum değişti':'Sorumlu değişti',details:patch.status?`${t.status} → ${patch.status}`:data.profiles.find(p=>p.id===patch.assignee_id)?.name??'Atanmadı',created_at:new Date().toISOString()},...demoData.current.events],logs:[log(patch.status?'Durum değişti':'Sorumlu değişti',t.id,`${t.title} → ${patch.status??data.profiles.find(p=>p.id===patch.assignee_id)?.name??'Atanmadı'}`),...demoData.current.logs]})}
  else {if(note){const {error}=await supabase!.rpc('request_revision',{task_id:t.id,reason:note.body,expected_updated_at:t.updated_at});if(error)throw error}else{const {error}=await supabase!.from('tasks').update(patch).eq('id',t.id).eq('updated_at',t.updated_at).select().single();if(error)throw new Error('İş güncellenemedi. Başka biri değiştirmiş olabilir; listeyi yenileyip tekrar deneyin.')}}
  if(demo){for(const id of new Set([t.creator_id,patch.assignee_id??t.assignee_id]))demoNotice(id,t.id,patch.assignee_id?'Talebin sorumlusu güncellendi.':`Talep güncellendi: ${workflowState({...t,...patch})} · %${taskProgress({...t,...patch})}`)}
  await load();notify('İş güncellendi.');
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
 async function adminAction(body:Record<string,unknown>){if(person?.role!=='super_admin')throw new Error('Süper admin yetkisi gerekli.');if(demo){if(body.action==='password'){notify('Deneme modunda şifre kaydedilmez.')}else if(body.action==='create'){const p:Profile={id:uid(),name:String(body.name),email:String(body.email),team:String(body.team),role:'employee',active:true};if(data.profiles.some(x=>x.email.toLowerCase()===p.email.toLowerCase()))throw new Error('Bu e-posta zaten kayıtlı.');commit({...demoData.current,profiles:[...demoData.current.profiles,p],logs:[log('Deneme kullanıcısı eklendi',p.id,p.email),...demoData.current.logs]});notify('Deneme kullanıcısı eklendi; e-posta gönderilmedi.')}else{if(body.id===person.id)throw new Error('Kendi hesabınızı kapatamazsınız.');commit({...demoData.current,profiles:demoData.current.profiles.map(p=>p.id===body.id?{...p,active:Boolean(body.active)}:p),logs:[log(body.active?'Hesap etkinleştirildi':'Hesap erişimi kapatıldı',String(body.id)),...demoData.current.logs]});notify('Kullanıcı güncellendi.')}}else{const {data:{session:s}}=await supabase!.auth.getSession();const r=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s?.access_token}`},body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw new Error(result.error);notify(body.action==='create'?'Kullanıcı oluşturuldu. E-posta ve şifresiyle giriş yapabilir.':body.action==='password'?'Şifre güncellendi.':'Kullanıcı güncellendi.');await load()}setInvite(false);setPwTarget(null)}
 async function changePassword(target:Profile,password:string){if(password.length<8)throw new Error('Şifre en az 8 karakter olmalı.');if(!demo&&target.id===person?.id){const {error}=await supabase!.auth.updateUser({password});if(error)throw error;notify('Şifren güncellendi.');setPwTarget(null);return}await adminAction({action:'password',id:target.id,password})}
 if(!ready)return <div className="loading"><LoaderCircle className="spin"/> Çalışma alanı açılıyor…</div>;
 if(!person)return <Login busy={busy} configured={!!supabase} allowDemo={demoAllowed} onDemo={startDemo} error={error} run={run} session={session} onLogout={()=>run(async()=>{await supabase?.auth.signOut();setSession(null);setError('')})}/>;
 return <>{!creating&&<WorkflowScreen data={data} person={person} demo={demo} busy={busy} notices={notices} guides={guides} error={error} toast={toast} onUser={p=>{setPerson(p);navigate('/')}} onLogout={()=>run(async()=>{if(!demo)await supabase!.auth.signOut();setDemo(false);setPerson(null);setData(empty)})} onCreate={c=>navigate('/yeni?kategori='+encodeURIComponent(c))} onUpdate={(t,patch,note)=>run(()=>updateTask(t,patch,note))} onMessage={(t,body,recipient,parent,kind)=>run(()=>addMessage(t,body,kind,recipient,parent))} onFiles={(t,files,kind)=>run(async()=>{files.forEach(validateFile);for(const f of files)await upload(t.id,f,kind);await load();notify('Dosyalar eklendi.')})} onDownload={a=>run(()=>openFile(a))} onRead={ids=>run(()=>markRead(ids))} onGuide={(title,body)=>run(()=>addGuide(title,body))} onInvite={()=>setInvite(true)} onPassword={setPwTarget} onActive={p=>run(()=>adminAction({action:'active',id:p.id,active:!p.active}))}/>}
 {creating&&<CreateModal key={createCategory} profiles={data.profiles} category={createCategory} busy={busy} onClose={()=>{setCreating(false);navigate('/')}} onSubmit={(input,files)=>run(()=>createTask(input,files))}/>}
 {invite&&<InviteModal busy={busy} demo={demo} onClose={()=>setInvite(false)} onSubmit={b=>run(()=>adminAction(b))}/>}
 {pwTarget&&<PasswordModal busy={busy} target={pwTarget} self={pwTarget.id===person.id} onClose={()=>setPwTarget(null)} onSubmit={pw=>run(()=>changePassword(pwTarget,pw))}/>}
 {error&&(creating||invite||pwTarget)&&<div className="modal-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Hatayı kapat"><X size={16}/></button></div>}</>;
}

function Login({busy,configured,allowDemo,onDemo,error,run,session,onLogout}:{busy:boolean;configured:boolean;allowDemo:boolean;onDemo:()=>void;error:string;run:(fn:()=>Promise<void>)=>Promise<boolean>;session:Session|null;onLogout:()=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 return <div className="login"><div className="login-art"><a className="wordmark" href="/"><img src="/logo.svg" alt="Dijitaldesin" className="logo logo-login"/></a><div><div className="eyebrow">AJANSIN ORTAK NOKTASI</div><h1>İyi fikirler.<br/>Güçlü bir ekip.<br/><em>Kesintisiz akış.</em></h1><p>Tasarımdan teknik desteğe, tüm işleriniz<br/>tek bir çalışma alanında.</p></div><small>Birlikte üretiyoruz, birlikte ilerliyoruz.</small><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/></div><div className="login-content"><div className="login-form"><span className="login-icon"><ArrowUpRight size={30}/></span><h2>{session?'Hesap erişimi':'Çalışma alanına hoş geldin.'}</h2><p>{session?'Hesabının erişimi kapalı olabilir. Yöneticinle görüş.':'Yöneticinin sana verdiği e-posta ve şifreyle giriş yap.'}</p>{error&&<div className="error-banner" role="alert">{error}</div>}{session?<><div className="setup-note"><ShieldCheck size={20}/><p>Çalışma alanına erişimin henüz açılmadıysa yöneticinle görüş. Hesap yetkileri kontrol ediliyor.</p></div><button className="text-button" onClick={onLogout}>Çıkış yap</button></>:configured?<form onSubmit={e=>{e.preventDefault();run(async()=>{const {error}=await supabase!.auth.signInWithPassword({email:email.trim(),password});if(error)throw new Error(/invalid login credentials/i.test(error.message)?'E-posta veya şifre hatalı.':error.message);setPassword('')})}}><label>İş e-posta adresin<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="isim@ajansiniz.com" autoComplete="email"/></label><label>Şifre<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button className="button primary full" disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:<ArrowRight size={18}/>}Giriş yap</button><small className="muted">Şifreni unuttuysan yöneticinden yeni şifre iste.</small></form>:<div className="setup-note"><ShieldCheck size={20}/><div><b>Çalışma alanı bağlantısı bekleniyor</b><p>Canlı giriş için Supabase ayarları henüz eklenmedi.</p></div></div>}{allowDemo&&<button className="button secondary full demo-button" disabled={busy} onClick={onDemo}><Sparkles size={17}/>Örnek çalışma alanını keşfet<ArrowRight size={17}/></button>}<small className="login-foot"><ShieldCheck size={14}/> Yalnızca yöneticinin açtığı hesaplar erişebilir.</small></div></div></div>
}
function Modal({children,onClose,wide=false,page=false}:{children:React.ReactNode;onClose:()=>void;wide?:boolean;page?:boolean}){const ref=useRef<HTMLDivElement>(null);const closeRef=useRef(onClose);closeRef.current=onClose;useEffect(()=>{const previous=document.activeElement as HTMLElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.focus();function key(e:KeyboardEvent){if(e.key==='Escape')closeRef.current();if(e.key==='Tab'){const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')??[]);const first=items[0],last=items.at(-1);if(!first)return;if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus()}}}document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus()}},[]);return <div className={page?"fullpage-backdrop":"modal-backdrop"} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div ref={ref} tabIndex={-1} role={page?undefined:"dialog"} aria-modal={page?undefined:true} aria-label="Talep ve ekip işlemleri" className={`modal ${wide?'wide':''}`}>{children}</div></div>}
function CreateModal({profiles,category,busy,onClose,onSubmit}:{profiles:Profile[];category:Category;busy:boolean;onClose:()=>void;onSubmit:(input:TaskInput,files:File[])=>void}){
 const [input,setInput]=useState<TaskInput>({title:'',description:'',category,brand:'',priority:'Normal',assignee_id:null,due_date:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'})});
 const [files,setFiles]=useState<File[]>([]);
 const [localError,setLocalError]=useState('');
 const [requestTypes,setRequestTypes]=useState<string[]>([]);
 const [sizes,setSizes]=useState<string[]>([]);
 const [customSize,setCustomSize]=useState('');
 const design=category==='Grafik İşlemleri';
 const [fields,setFields]=useState<Record<string,string>>({});
 const brief=requestForms[category];
 const visibleFields=brief.fields.filter(field=>!field.when||requestTypes.includes(field.when));
 function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!requestTypes.length||visibleFields.some(field=>field.required&&!fields[field.label]?.trim())){
   setLocalError('Talep türünü ve zorunlu alanları doldurun.');
   return;
  }
  const details=visibleFields.flatMap(field=>{
   const value=fields[field.label]?.trim();
   return value?[field.label+': '+value]:[];
  });
  const dimensions=[...sizes,customSize.trim()].filter(Boolean);
  if(design&&!dimensions.length){setLocalError('Bir yayın ölçüsü seçin veya özel ölçü girin.');return;}
  if(files.length>maxRequestFiles){setLocalError('Bir talebe en fazla 10 dosya ekleyebilirsiniz.');return;}
  if(design)details.unshift('Yayın alanı ve ölçüler: '+dimensions.join(', '));
  const description=['Talep türü: '+requestTypes.join(', '),...details].join('\n\n');
  if(description.length>10000){setLocalError('Talep ayrıntıları toplamda 10.000 karakteri aşmamalı.');return;}
  const result=taskSchema.safeParse({...input,description});
  if(!result.success){setLocalError(result.error.issues[0].message);return;}
  onSubmit(result.data,files);
 }
 return <Modal page onClose={busy?()=>{}:onClose}>
  <div className="modal-heading">
   <h2>{brief.heading}</h2>
   <button className="icon-btn" disabled={busy} aria-label="Kapat" onClick={onClose}><X size={20}/></button>
  </div>
  <form onSubmit={submit}><div className="modal-body">
   {design?<fieldset className="request-options">
    <legend>Talep türleri</legend>
    <div className="request-option-grid">{brief.types.map(type=><label className="request-option" key={type}><input type="checkbox" checked={requestTypes.includes(type)} onChange={e=>{
     setRequestTypes(e.target.checked?[...requestTypes,type]:requestTypes.filter(value=>value!==type));
    }}/>{type}</label>)}</div>
   </fieldset>:<label>Talep türü<select required value={requestTypes[0]??''} onChange={e=>setRequestTypes(e.target.value?[e.target.value]:[])}>
    <option value="">Seçin</option>{brief.types.map(type=><option key={type}>{type}</option>)}
   </select></label>}
   <label>Talep başlığı<input autoFocus required minLength={3} maxLength={180} value={input.title} placeholder={brief.titleExample} onChange={e=>setInput({...input,title:e.target.value})}/></label>
   {design&&<fieldset className="request-options">
    <legend>Yayın alanı ve ölçüler</legend>
    <div className="request-option-grid">{designSizes.map(size=><label className="request-option" key={size}><input type="checkbox" checked={sizes.includes(size)} onChange={e=>{
     setSizes(e.target.checked?[...sizes,size]:sizes.filter(value=>value!==size));
    }}/>{size}</label>)}</div>
    <label className="request-custom-size">Özel ölçü<input maxLength={500} placeholder="Örn. ana sayfa masaüstü banner · 1920 × 880 px" value={customSize} onChange={e=>setCustomSize(e.target.value)}/></label>
   </fieldset>}
   {visibleFields.map(field=><label key={field.label}>{field.label}{!field.required&&' (isteğe bağlı)'}
    {field.options?<select required={field.required} value={fields[field.label]??''} onChange={e=>setFields({...fields,[field.label]:e.target.value})}>
     <option value="">Seçin</option>{field.options.map(option=><option key={option}>{option}</option>)}
    </select>:field.multiline?<textarea required={field.required} maxLength={2500} rows={3} placeholder={field.example} value={fields[field.label]??''} onChange={e=>setFields({...fields,[field.label]:e.target.value})}/>:<input required={field.required} maxLength={500} placeholder={field.example} value={fields[field.label]??''} onChange={e=>setFields({...fields,[field.label]:e.target.value})}/>}
   </label>)}
<div className="form-grid"><label>Müşteri / marka<input required maxLength={100} value={input.brand} placeholder="Marka adı veya İç Ekip" onChange={e=>setInput({...input,brand:e.target.value})}/></label><label>Sorumlu<select value={input.assignee_id??''} onChange={e=>setInput({...input,assignee_id:e.target.value||null})}><option value="">Henüz atanmadı</option>{profiles.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} · {p.team}</option>)}</select></label><label>Teslim tarihi<input required type="date" value={input.due_date} onChange={e=>setInput({...input,due_date:e.target.value})}/></label><label>Öncelik<select value={input.priority} onChange={e=>setInput({...input,priority:e.target.value as TaskInput['priority']})}>{['Normal','Yüksek','Acil'].map(s=><option key={s}>{s}</option>)}</select></label></div><fieldset className="request-files">
 <legend>{brief.attachmentLabel}</legend>
 <small>{files.length} / {maxRequestFiles} dosya · PDF, PNG, JPG, WebP · dosya başına en fazla 20 MB</small>
 {files.map((file,index)=><div className="picked-file" key={index}>
  <FileText size={15}/><span>{index+1}. dosya · {file.name}</span>
  <button type="button" className="icon-btn" disabled={busy} aria-label={`${index+1}. dosyayı kaldır`} onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}><X size={14}/></button>
 </div>)}
 {files.length<maxRequestFiles&&<label className="upload-zone" key={files.length}>
  <Paperclip size={22}/><b>{files.length+1}. {design?'görsel / dosya':'dosya'} ekle</b>
  <input type="file" disabled={busy} accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>{
   const file=e.target.files?.[0];
   if(!file)return;
   try{validateFile(file);setFiles(current=>current.length<maxRequestFiles?[...current,file]:current);setLocalError('');}
   catch(err){setLocalError((err as Error).message);}
   e.target.value='';
  }}/>
 </label>}
</fieldset>
{localError&&<p className="field-error" role="alert">{localError}</p>}</div><div className="modal-footer"><span>İş, tüm ekip tarafından görülebilir.</span><button type="submit" className="button primary" disabled={busy}><Plus size={17}/>{busy?'Oluşturuluyor…':'Talebi oluştur'}</button></div></form></Modal>
}
function InviteModal({busy,demo,onClose,onSubmit}:{busy:boolean;demo:boolean;onClose:()=>void;onSubmit:(b:Record<string,unknown>)=>void}){const [name,setName]=useState(''),[email,setEmail]=useState(''),[team,setTeam]=useState('Meta Ekibi'),[password,setPassword]=useState(newPassword);return <Modal onClose={busy?()=>{}:onClose}><div className="modal-heading"><h2>Ekibe birini ekle</h2><button className="icon-btn" disabled={busy} aria-label="Kapat" onClick={onClose}><X size={20}/></button></div><form onSubmit={e=>{e.preventDefault();onSubmit({action:'create',name,email,team,password})}}><div className="modal-body"><p className="muted">{demo?'Deneme modunda şifre kaydedilmez.':'E-posta gönderilmez. Hesap hemen açılır; e-posta ve şifreyi çalışana kendin ilet.'}</p><label>Ad soyad<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><label>İş e-posta adresi<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><PasswordField value={password} onChange={setPassword}/><label>Birim<select value={team} onChange={e=>setTeam(e.target.value)}>{['Meta Ekibi','Grafik Tasarım','Teknik Destek','Operasyon','Yönetim'].map(t=><option key={t}>{t}</option>)}</select></label><div className="setup-note"><ShieldCheck size={20}/><p>Yeni hesap çalışan yetkisiyle açılır. Süper admin yetkisi verilmez.</p></div></div><div className="modal-footer"><span>Yalnızca çalışanlara özel</span><button className="button primary" disabled={busy}><Plus size={16}/>{demo?'Örnek kullanıcı ekle':'Kullanıcıyı oluştur'}</button></div></form></Modal>}
function newPassword(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';const a=crypto.getRandomValues(new Uint32Array(12));return Array.from(a,n=>chars[n%chars.length]).join('')}
function PasswordField({value,onChange,label='Şifre'}:{value:string;onChange:(v:string)=>void;label?:string}){return <label>{label}<div className="password-row"><input required minLength={8} maxLength={72} value={value} onChange={e=>onChange(e.target.value)} autoComplete="new-password" spellCheck={false}/><button type="button" className="button secondary" onClick={()=>onChange(newPassword())}>Yeni üret</button><button type="button" className="button secondary" onClick={()=>navigator.clipboard?.writeText(value)}>Kopyala</button></div><small className="muted">En az 8 karakter.</small></label>}
function PasswordModal({busy,target,self,onClose,onSubmit}:{busy:boolean;target:Profile;self:boolean;onClose:()=>void;onSubmit:(pw:string)=>void}){const [password,setPassword]=useState(self?'':newPassword());return <Modal onClose={busy?()=>{}:onClose}><div className="modal-heading"><h2>{self?'Şifremi değiştir':'Şifre belirle'}</h2><button className="icon-btn" disabled={busy} aria-label="Kapat" onClick={onClose}><X size={20}/></button></div><form onSubmit={e=>{e.preventDefault();onSubmit(password)}}><div className="modal-body"><p className="muted">{self?'Yeni şifren hemen geçerli olur.':`${target.name} (${target.email}) için yeni şifre. Eski şifre geçersiz olur; yeni şifreyi çalışana kendin ilet.`}</p><PasswordField label="Yeni şifre" value={password} onChange={setPassword}/></div><div className="modal-footer"><span>{self?'Hesabın':'Yalnızca süper admin'}</span><button className="button primary" disabled={busy}><KeyRound size={16}/>Kaydet</button></div></form></Modal>}
