import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowPatch,workflowState,taskProgress} from '../src/lib/workflow';
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
