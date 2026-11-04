import { Data, Task } from './domain';
const date=(offset:number)=>{const d=new Date();d.setDate(d.getDate()+offset);return d.toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'})};
export function seed():Data {
 const profiles:Data['profiles']=[
 {id:'demo-admin',name:'Harun',email:'harun@example.test',role:'super_admin',active:true,team:'Yönetim'},
 {id:'demo-1',name:'Elif Yılmaz',email:'elif@example.test',role:'employee',active:true,team:'Grafik Tasarım'},
 {id:'demo-2',name:'Mert Kaya',email:'mert@example.test',role:'employee',active:true,team:'Teknik Destek'},
 {id:'demo-3',name:'Zeynep Demir',email:'zeynep@example.test',role:'employee',active:true,team:'Meta Ekibi'},
 {id:'demo-4',name:'Can Arslan',email:'can@example.test',role:'employee',active:true,team:'Grafik Tasarım'},
 {id:'demo-5',name:'Ece Aydın',email:'ece@example.test',role:'employee',active:true,team:'Operasyon'}];
 const rows=[
 ['Kasım kampanyası sosyal medya tasarımları','Grafik İşlemleri','Luna Coffee','Yüksek','İşlemde','demo-1',2],
 ['Web sitesi iletişim formu kontrolü','Teknik İşlemler','Nova Studio','Acil','Yeni','demo-2',-1],
 ['Black Friday reklam seti revizesi','Grafik İşlemleri','Urban Wear','Yüksek','Revize İstendi','demo-4',1],
 ['Aylık müşteri toplantısı hazırlığı','Diğer Talepler','İç Ekip','Normal','Atandı','demo-5',4],
 ['Yeni ürün kataloğu PDF tasarımı','Grafik İşlemleri','Maison Living','Normal','Onay Bekliyor','demo-1',0],
 ['Meta piksel ve dönüşüm kontrolü','Teknik İşlemler','Urban Wear','Yüksek','İşlemde','demo-2',1],
 ['Haftalık performans raporu','Diğer Talepler','Luna Coffee','Normal','Tamamlandı','demo-3',-2],
 ['Instagram hikâye şablonları','Grafik İşlemleri','Nova Studio','Normal','Bilgi Bekliyor','demo-4',3],
 ['Yeni çalışan erişimlerinin hazırlanması','Teknik İşlemler','İç Ekip','Normal','Tamamlandı','demo-2',-3]
 ];
 const tasks=rows.map((r,i)=>({id:`sample-${i}`,number:1042-i,title:r[0],category:r[1],brand:r[2],priority:r[3],status:r[4],assignee_id:r[5],due_date:date(Number(r[6])),creator_id:i%2?'demo-admin':'demo-3',description:'İlgili marka için talep edilen çalışmanın hazırlanması gerekiyor. Çalışmayı tamamladıktan sonra teslim dosyalarını buraya ekleyip onaya gönderebilirsiniz. Tüm görüşmeleri bu iş üzerinden sürdürelim.',created_at:new Date(Date.now()-(i+1)*86400000).toISOString(),updated_at:new Date().toISOString(),completed_at:r[4]==='Tamamlandı'?new Date().toISOString():null,revision_count:r[4]==='Revize İstendi'?1:0})) as Task[];
 return {profiles,tasks,events:[],messages:[{id:'sample-comment',task_id:'sample-0',author_id:'demo-3',body:'Ana görselde ürünün öne çıkmasını istiyoruz. Kare ve hikâye boyutlarını birlikte hazırlayabilir miyiz?',kind:'comment',created_at:new Date().toISOString()}],attachments:[],logs:[{id:'seed-log',actor_id:'demo-admin',action:'Örnek çalışma alanı oluşturuldu',entity_id:'demo',details:'Bu alandaki kişi ve işler örnektir.',created_at:new Date().toISOString()}]};
}
