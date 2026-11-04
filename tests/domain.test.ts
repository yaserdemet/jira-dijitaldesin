import test from 'node:test';
import assert from 'node:assert/strict';
import { canApprove,canEdit,isOverdue,validateFile,csvCell,taskSchema } from '../src/lib/domain';
import {seed} from '../src/lib/seed';
test('çalışan başkasının işini değiştiremez veya onaylayamaz',()=>{const d=seed();const t=d.tasks[0];assert.equal(canEdit(t,d.profiles[2]),false);assert.equal(canApprove(t,d.profiles[1]),false);assert.equal(canEdit(t,d.profiles[1]),true);assert.equal(canApprove(t,d.profiles[3]),true);assert.equal(canApprove(t,d.profiles[0]),true)});
test('tamamlanan ve iptal edilen işler gecikmiş sayılmaz',()=>{const t=seed().tasks[0];assert.equal(isOverdue({...t,due_date:'2020-01-01',status:'İşlemde'},'2026-11-03'),true);for(const status of ['Tamamlandı','İptal'] as const)assert.equal(isOverdue({...t,due_date:'2020-01-01',status},'2026-11-03'),false)});
test('dosya türü ve boyutu sınırlandırılır',()=>{assert.throws(()=>validateFile({name:'test.html',type:'text/html',size:200}));assert.throws(()=>validateFile({name:'test.png',type:'image/png',size:21*1024*1024}));assert.throws(()=>validateFile({name:'test.exe',type:'image/png',size:200}));assert.doesNotThrow(()=>validateFile({name:'test.pdf',type:'application/pdf',size:200}))});
test('rapor dışa aktarımı elektronik tablo formüllerini etkisizleştirir',()=>{assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(csvCell('normal'),'"normal"')});
test('boş brief ve bilinmeyen bölüm reddedilir',()=>{const t=seed().tasks[0];assert.equal(taskSchema.safeParse({...t,description:''}).success,false);assert.equal(taskSchema.safeParse({...t,category:'Yanlış'}).success,false)});
