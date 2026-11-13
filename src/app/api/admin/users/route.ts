import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const password=z.string().min(8,'Şifre en az 8 karakter olmalı.').max(72,'Şifre en fazla 72 karakter olabilir.');
export async function POST(req:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({error:'Sunucu bağlantısı yapılandırılmadı.'},{status:503});
 const token=req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
 if(!token)return Response.json({error:'Oturum gerekli.'},{status:401});
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await admin.auth.getUser(token);
 if(error||!user)return Response.json({error:'Oturum geçersiz.'},{status:401});
 const {data:actor}=await admin.from('profiles').select('*').eq('id',user.id).single();
 if(!actor?.active||actor.role!=='super_admin')return Response.json({error:'Bu işlem için süper admin yetkisi gerekli.'},{status:403});
 try {
 const body=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),email:z.email('Geçerli bir e-posta adresi girin.'),name:z.string().trim().min(2,'Ad soyad en az 2 karakter olmalı.').max(100),team:z.string().trim().min(1).max(100),password}),
 z.object({action:z.literal('password'),id:z.uuid(),password}),
 z.object({action:z.literal('responsibilities'),id:z.uuid(),technical:z.boolean(),design:z.boolean()}),
 z.object({action:z.literal('active'),id:z.uuid(),active:z.boolean()})]).parse(await req.json());
 if(body.action==='create'){
 // E-posta gönderilmez; hesap doğrulanmış olarak açılır ve kullanıcı bu şifreyle giriş yapar.
 const {data,error}=await admin.auth.admin.createUser({email:body.email,password:body.password,email_confirm:true,user_metadata:{name:body.name,team:body.team}});
 if(error)throw new Error(/already|registered|exists/i.test(error.message)?'Bu e-posta adresiyle zaten bir hesap var.':error.message);
 const {error:activeError}=await admin.from('profiles').update({active:true}).eq('id',data.user.id);
 if(activeError)throw activeError;
 const {error:logError}=await admin.from('audit_logs').insert({actor_id:user.id,action:'Kullanıcı oluşturuldu',entity_id:data.user.id,details:body.email});
 if(logError)throw logError;
 } else if(body.action==='password'){
 const {data:target}=await admin.from('profiles').select('role,email').eq('id',body.id).single();
 if(!target)return Response.json({error:'Kullanıcı bulunamadı.'},{status:404});
 if(target.role==='super_admin'&&body.id!==user.id)return Response.json({error:'Başka bir süper adminin şifresi bu ekrandan değiştirilemez.'},{status:400});
 const {error}=await admin.auth.admin.updateUserById(body.id,{password:body.password});if(error)throw error;
 const {error:logError}=await admin.from('audit_logs').insert({actor_id:user.id,action:'Şifre değiştirildi',entity_id:body.id,details:target.email});
 if(logError)throw logError;
 } else if(body.action==='responsibilities'){
 const caller=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await caller.rpc('set_department_assignees',{target_id:body.id,technical:body.technical,design:body.design});
 if(error)throw new Error(error.code==='PGRST202'?'Önce 004_department_assignees.sql geçişini uygulayın.':error.message);
 } else {
 if(body.id===user.id)return Response.json({error:'Kendi hesabınızı kapatamazsınız.'},{status:400});
 const {data:target}=await admin.from('profiles').select('role').eq('id',body.id).single();
 if(!target||target.role==='super_admin')return Response.json({error:'Süper admin hesabı bu ekrandan değiştirilemez.'},{status:400});
 const caller=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await caller.rpc('set_employee_active',{target_id:body.id,enabled:body.active});if(error)throw error;
 }
 return Response.json({ok:true});
 }catch(e){return Response.json({error:e instanceof z.ZodError?(e.issues[0]?.message??'Bilgileri kontrol edin.'):e instanceof Error?e.message:'İşlem başarısız.'},{status:400})}
}
