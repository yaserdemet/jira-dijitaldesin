import { Data } from './domain';
import { seed } from './seed';
const KEY='akis-demo-v1';
export function readDemo():Data {const raw=localStorage.getItem(KEY);if(!raw)return seed();try{return {events:[],...JSON.parse(raw)}}catch{throw new Error('Deneme verisi okunamadı. Tarayıcı depolamasını kontrol edin.')}}
export function saveDemo(data:Data){localStorage.setItem(KEY,JSON.stringify(data))}
async function db(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('akis-demo-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function putDemoFile(id:string,file:File){const d=await db();try{await new Promise<void>((resolve,reject)=>{const tx=d.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{d.close()}}
export async function getDemoFile(id:string){const d=await db();try{return await new Promise<Blob>((resolve,reject)=>{const r=d.transaction('files').objectStore('files').get(id);r.onsuccess=()=>r.result?resolve(r.result):reject(new Error('Dosya bu tarayıcıda bulunamadı.'));r.onerror=()=>reject(r.error)})}finally{d.close()}}
