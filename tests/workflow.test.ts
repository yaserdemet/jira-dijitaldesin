import test from 'node:test';
import assert from 'node:assert/strict';
import {groupByCompletionDay,workflowPatch,workflowState,taskProgress} from '../src/lib/workflow';
import {seed} from '../src/lib/seed';
test('eski durumlar dört görünür duruma veri kaybetmeden yansır',()=>{
 assert.equal(workflowState({status:'Onay Bekliyor'}),'Yapılıyor');
 assert.equal(workflowState({status:'Revize İstendi'}),'Sorun Var');
 assert.equal(workflowState({status:'Atandı'}),'Bekliyor');
 const task=seed().tasks[0];
 assert.equal(taskProgress({...task,status:'Tamamlandı',progress:45}),100);
 assert.equal(taskProgress({...task,status:'Bilgi Bekliyor',progress:45}),45);
});
test('ilerleme sınırları ve sorun gerekçesi kullanıcı girişinde doğrulanır',()=>{
 assert.throws(()=>workflowPatch('Sorun Var',40,'  '));
 assert.throws(()=>workflowPatch('Yapılıyor',NaN,''));
 assert.equal(workflowPatch('Tamamlandı',40,'').progress,100);
 assert.equal(workflowPatch('Bekliyor',40,'').progress,0);
 assert.equal(workflowPatch('Yapılıyor',100,'').progress,95);
 assert.deepEqual(workflowPatch('Sorun Var',40,' Erişim gerekiyor '),{status:'Bilgi Bekliyor',progress:40,issue_description:'Erişim gerekiyor'});
});
test('tamamlanan işler bitiş gününe göre gruplanır; en yeni gün ve iş üstte',()=>{
 const now=new Date(2026,10,25,15,0);
 const at=(d:number,h:number)=>new Date(2026,10,d,h,0).toISOString();
 const t=(id:string,completed_at:string|null)=>({id,completed_at,updated_at:completed_at??at(1,0)});
 const groups=groupByCompletionDay([t('a',at(24,9)),t('b',at(25,8)),t('c',at(25,12)),t('d',at(20,10)),t('e',null)],now);
 assert.deepEqual(groups.map(g=>[g.label,g.tasks.map(x=>x.id)]),[
  ['Bugün',['c','b']],['Dün',['a']],[new Date(2026,10,20).toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'long'}),['d']],['Tarihi bilinmiyor',['e']],
 ]);
 assert.match(groupByCompletionDay([t('x',new Date(2025,0,3,10).toISOString())],now)[0].label,/2025/);
});
