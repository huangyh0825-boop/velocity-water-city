import{DEFAULT_TRAINING,trainingOptions,type TrainingOptions,type TrainingRun}from'../modes/TrainingOptions';
type Store=Pick<Storage,'getItem'|'setItem'>;
export const PROFILE_KEY='velocity-water-city:device:v1';
export interface SavedRun extends TrainingRun {id:string;at:number}
export interface DeviceProfile {
 version:1;deviceId:string;resumeKey:string;playerId:string;createdAt:number;settings:TrainingOptions;lastRoom:string;
 stats:{started:number;completed:number;completedLaps:number;seconds:number};history:SavedRun[];
}
export function newId(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
export function validatePlayerId(value:string){const id=value.trim();if(!id||[...id].length>16||/[\p{C}<>]/u.test(id))throw Error('游戏 ID 请输入 1–16 个普通字符');return id;}
function storage():Store|undefined{try{return localStorage;}catch{return undefined;}}
function restoredSettings(value:Partial<TrainingOptions>){try{return trainingOptions(value);}catch{return{...DEFAULT_TRAINING};}}
function restoredName(value:unknown){try{return typeof value==='string'?validatePlayerId(value):'';}catch{return'';}}
const count=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:0;
function fresh():DeviceProfile{return{version:1,deviceId:newId(),resumeKey:newId(),playerId:'',createdAt:Date.now(),settings:{...DEFAULT_TRAINING},lastRoom:'',stats:{started:0,completed:0,completedLaps:0,seconds:0},history:[]};}
export class ProfileStore {
 readonly data:DeviceProfile;persisted=false;
 constructor(private store=storage()){
  let data=fresh();try{const p=JSON.parse(store?.getItem(PROFILE_KEY)??'null');if(p?.version===1&&/^[a-f0-9]{32}$/.test(p.deviceId)&&/^[a-f0-9]{32}$/.test(p.resumeKey)){
   data={...data,deviceId:p.deviceId,resumeKey:p.resumeKey,playerId:restoredName(p.playerId),createdAt:count(p.createdAt)||Date.now(),settings:restoredSettings(p.settings??{}),lastRoom:/^\d{4}$/.test(p.lastRoom)?p.lastRoom:'',stats:{started:count(p.stats?.started),completed:count(p.stats?.completed),completedLaps:count(p.stats?.completedLaps),seconds:count(p.stats?.seconds)},history:Array.isArray(p.history)?p.history.filter((r:SavedRun)=>r&&typeof r.id==='string'&&Number.isFinite(r.at)&&Number.isFinite(r.elapsed)&&r.elapsed>=0&&Number.isSafeInteger(r.laps)&&r.laps>0&&Number.isInteger(r.completedLaps)&&r.completedLaps>=0&&r.completedLaps<=r.laps&&Number.isInteger(r.rank)&&r.rank>=1&&r.rank<=5&&['easy','hard'].includes(r.difficulty)&&typeof r.completed==='boolean').slice(0,30):[]};
  }}catch{/* Invalid or blocked browser storage starts a usable local profile. */}
  this.data=data;this.save();
 }
 private save(){try{if(!this.store)throw Error();this.store.setItem(PROFILE_KEY,JSON.stringify(this.data));this.persisted=true;}catch{this.persisted=false;}}
 rename(id:string){this.data.playerId=validatePlayerId(id);this.save();}
 settings(options:TrainingOptions){this.data.settings=trainingOptions(options);this.save();}
 room(code:string){if(!/^\d{4}$/.test(code))throw Error('房间号必须是四位数字');this.data.lastRoom=code;this.save();}
 start(){this.data.stats.started++;this.save();return newId();}
 record(id:string,run:TrainingRun){
  const existing=this.data.history.find(r=>r.id===id);if(existing?.completed)return;
  const opts=trainingOptions(run);if(!Number.isFinite(run.elapsed)||run.elapsed<0||!Number.isInteger(run.completedLaps)||run.completedLaps<0||run.completedLaps>opts.laps||run.completed&&run.completedLaps!==opts.laps||!Number.isInteger(run.rank)||run.rank<1||run.rank>5)throw Error('比赛记录无效');
  if(existing&&(run.elapsed<existing.elapsed||run.completedLaps<existing.completedLaps))return;
  const record:SavedRun={...run,...opts,id,at:Date.now()};
  if(run.completed)this.data.stats.completed++;this.data.stats.completedLaps+=run.completedLaps-(existing?.completedLaps??0);this.data.stats.seconds+=run.elapsed-(existing?.elapsed??0);
  if(existing)Object.assign(existing,record);else{this.data.history.unshift(record);this.data.history.length=Math.min(30,this.data.history.length);}this.save();
 }
}
