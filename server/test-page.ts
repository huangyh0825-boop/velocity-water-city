import {WebSocketLobbyClient} from '../src/lobby/WebSocketLobbyClient';
import type {LobbyConnection,LobbyIdentity} from '../src/lobby/types';

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>$<HTMLInputElement>(id);
const status=(message:string)=>{$('status').textContent=message;};
const rows:{at:string;message:string}[]=[];
const log=(message:string)=>{rows.push({at:new Date().toISOString(),message});if(rows.length>200)rows.shift();$('log').textContent=rows.map(r=>`${r.at.slice(11,19)} ${r.message}`).join('\n');};
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
let who:LobbyIdentity;
try{const saved=JSON.parse(localStorage.getItem('render-lobby-test-profile')??'null');who=saved&&/^[a-f0-9]{32}$/.test(saved.deviceId)&&/^[a-f0-9]{32}$/.test(saved.resumeKey)?saved:{deviceId:random(),resumeKey:random(),playerId:'测试玩家'};}
catch{who={deviceId:random(),resumeKey:random(),playerId:'测试玩家'};}
input('player').value=who.playerId;
const save=()=>{try{localStorage.setItem('render-lobby-test-profile',JSON.stringify(who));}catch{log('浏览器未允许保存测试档案，本次关闭后会更换测试身份');}};
let client:WebSocketLobbyClient|undefined,connection:LobbyConnection|undefined,active=false,connected=false,generation=0,previousId='';
let controller:AbortController|undefined,started=0,handshakeStarted=0;
let stability:{startedAt:string;requiredSeconds:number;elapsedSeconds:number;disconnects:number;observationInterrupted:boolean;completed:boolean;passed:boolean}|null=null;
let lastObservation=performance.now();
const metrics:{http:string;wss:string;httpMs:number|null;wssMs:number|null;firstConnectionMs:number|null;instance:string|null;revision:string|null;rejoins:number;disconnects:number;pageResponseMs:number|null}={
 http:'未测试',wss:'未测试',httpMs:null,wssMs:null,firstConnectionMs:null,instance:null,revision:null,rejoins:0,disconnects:0,
 pageResponseMs:(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.responseStart??null,
};
const buttons=()=>{
 $<HTMLButtonElement>('connect').disabled=active;$<HTMLButtonElement>('leave').disabled=!active;
 for(const id of ['ready','rename','stability'])$<HTMLButtonElement>(id).disabled=!connected;
 if(stability&&!stability.completed)$<HTMLButtonElement>('stability').disabled=true;
};
function dropped(message:string){
 if(connected){metrics.disconnects++;if(stability&&!stability.completed)stability.disconnects++;}
 connected=false;buttons();status(message);log(message);
}
function update(value:LobbyConnection){
 const wasConnected=connected;connected=true;connection=value;
 if(!wasConnected){
  if(metrics.firstConnectionMs===null){metrics.wss='成功';metrics.wssMs=Math.round(performance.now()-handshakeStarted);metrics.firstConnectionMs=Math.round(performance.now()-started);}
  else metrics.rejoins++;
  log(`WSS 已连接；房间 ${value.room.code}，${value.room.members.length} 人`);
 }
 if(previousId&&previousId!==value.memberId)log('原房间席位已失效（可能服务器重启或离线超过保留时间），已重新加入。请重新准备并确认房主。');
 previousId=value.memberId;
 $('members').replaceChildren(...value.room.members.map(m=>{
  const li=document.createElement('li');li.textContent=`${m.playerId}${m.host?' · 房主':''}${m.id===value.memberId?' · 我':''} · ${m.connected===false?'已掉线（短暂保留）':m.ready?'已准备':'未准备'}`;return li;
 }));
 status(`已进入 ${value.room.code}，${value.room.members.length} / ${value.room.capacity} 人。请和另一位玩家核对列表。`);buttons();
}
const pause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(Error('已取消'));return;}
 const abort=()=>{clearTimeout(timer);reject(Error('已取消'));};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});
});
const retryable=(message:string)=>!/房间已满|设备验证失败|房间号|普通字符|较频繁|未被.*授权|协议|编号/.test(message);
async function connect(){
 if(!/^\d{4}$/.test(input('code').value)){status('请输入四位数字房间号');return;}
 const name=input('player').value.trim();if(!name||[...name].length>16||/[\p{C}<>]/u.test(name)){status('玩家 ID 请输入 1–16 个普通字符');return;}
 if(!input('region').value.trim()||!input('network').value.trim()){status('请先填写测试地区和网络类型，方便区分真实测试结果');return;}
 who.playerId=name;save();active=true;connected=false;connection=undefined;previousId='';stability=null;
 metrics.http='等待';metrics.wss='等待';metrics.httpMs=null;metrics.wssMs=null;metrics.firstConnectionMs=null;metrics.disconnects=0;metrics.rejoins=0;
 const gen=++generation;controller=new AbortController();const signal=controller.signal;
 started=performance.now();const deadline=started+180_000;let attempt=0;buttons();
 try{
  while(active&&gen===generation&&performance.now()<deadline){
   try{
    const elapsed=Math.round((performance.now()-started)/1000);status(`正在唤醒服务器…已等待 ${elapsed} 秒。首次连接可能约一分钟，请勿反复刷新。`);
    const timeout=AbortSignal.timeout(Math.min(20_000,Math.max(1,deadline-performance.now())));
    const response=await fetch('/api/lobby/health',{cache:'no-store',signal:AbortSignal.any([signal,timeout])});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const health=await response.json();if(health.ok!==true||health.transport!=='websocket'||health.protocol!==1)throw Error('HTTP 返回内容不是兼容大厅，可能仍在唤醒');
    if(signal.aborted||gen!==generation)return;
    metrics.http='成功';metrics.httpMs=Math.round(performance.now()-started);metrics.instance=health.instance??null;metrics.revision=health.revision??null;
    log(`HTTP 健康检查成功，累计 ${metrics.httpMs} ms`);handshakeStarted=performance.now();
    client=new WebSocketLobbyClient(update,(message,retrying=true)=>{
     dropped(message);
     if(!retrying){active=false;buttons();log('自动重连已停止，请手动重新进入');}
    },`${location.origin}/api/lobby`);
    await client.join(input('code').value,who);return;
   }catch(e){
    if(signal.aborted||gen!==generation)return;
    const message=e instanceof Error?e.message:String(e);log(`第 ${++attempt} 次连接未完成：${message}`);
    await client?.leave();client=undefined;
    if(!retryable(message))throw e;
    await pause(Math.min(10_000,1000*2**Math.min(attempt,3)),signal);
   }
  }
  throw Error('连接超过三分钟。请记录当前日志，检查该网络是否能访问 onrender.com，再点击重新尝试');
 }catch(e){if(gen!==generation)return;metrics.wss='失败';if(metrics.http!=='成功')metrics.http='失败';status(e instanceof Error?e.message:String(e));log($('status').textContent??'连接失败');active=false;connected=false;buttons();}
}
async function leave(){
 active=false;generation++;controller?.abort();await client?.leave();client=undefined;connected=false;connection=undefined;$('members').replaceChildren();
 if(stability&&!stability.completed){stability.completed=true;stability.passed=false;}
 status('已退出。停止自动重试和心跳；没有后台探活。');log('主动退出 / 取消连接');buttons();
}
$('connect').onclick=()=>void connect();$('leave').onclick=()=>void leave();
$('ready').onclick=()=>{const own=connection?.room.members.find(m=>m.id===connection?.memberId);void client?.ready(!own?.ready).catch(e=>{status(e.message);log(e.message);});};
$('rename').onclick=()=>{void client?.rename(input('player').value.trim()).then(()=>{who.playerId=input('player').value.trim();save();}).catch(e=>{status(e.message);log(e.message);});};
$('stability').onclick=()=>{
 if(!connected)return;lastObservation=performance.now();stability={startedAt:new Date().toISOString(),requiredSeconds:Number(input('duration').value),elapsedSeconds:0,disconnects:0,observationInterrupted:false,completed:false,passed:false};
 log(`开始 ${stability.requiredSeconds/60} 分钟连续连接测试`);buttons();
};
setInterval(()=>{
 if(!stability||stability.completed)return;
 const current=performance.now();
 if(document.visibilityState!=='visible'||current-lastObservation>10_000)stability.observationInterrupted=true;
 lastObservation=current;stability.elapsedSeconds=Math.floor((Date.now()-Date.parse(stability.startedAt))/1000);
 $('stabilityStatus').textContent=`已观察 ${stability.elapsedSeconds} / ${stability.requiredSeconds} 秒，断线 ${stability.disconnects} 次。${document.visibilityState==='hidden'?'页面在后台，设备可能限制计时；请回到前台。':''}`;
 if(stability.elapsedSeconds>=stability.requiredSeconds){stability.completed=true;stability.passed=connected&&stability.disconnects===0&&!stability.observationInterrupted;$('stabilityStatus').textContent+=stability.passed?' 本次连续连接通过。':' 连接或前台观察发生中断，不能记为连续稳定通过。';log($('stabilityStatus').textContent);buttons();}
},1000);
const report=()=>JSON.stringify({test:'Render Singapore lobby connectivity',createdAt:new Date().toISOString(),url:location.origin,region:input('region').value,network:input('network').value,
 vpnOffSelfConfirmed:input('noVpn').checked,mainlandVerification:'待测试者及开发者核实，页面不会自动判定地区或 VPN',room:input('code').value,memberCount:connection?.room.members.length??0,
 metrics,stability,log:rows},null,2);
$('download').onclick=()=>{const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([report()],{type:'application/json'}));link.download='极速水城-网络测试.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
$('copy').onclick=()=>{void navigator.clipboard.writeText(report()).then(()=>log('测试报告已复制（不含设备密钥）')).catch(()=>status('复制失败，请改用下载测试报告'));};
window.addEventListener('pagehide',()=>{void leave();});
buttons();
