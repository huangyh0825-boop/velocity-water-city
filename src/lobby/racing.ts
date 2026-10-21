export const RACE_FEATURE='race-v1';
export type OnlinePhase='loading'|'countdown'|'racing'|'finished'|'aborted';
export interface OnlineParticipant {id:string;name:string;slot:number;loaded:boolean;connected:boolean;dnf:boolean}
export interface OnlineRace {
 id:string;phase:OnlinePhase;laps:number;participants:OnlineParticipant[];
 countdownAt:number|null;startAt:number|null;message:string;
}
export interface OnlinePose {
 seq:number;t:number;x:number;z:number;y:number;heading:number;speed:number;vx:number;vz:number;
 airborne:boolean;nitro:boolean;pitch:number;spin:number;correction:number;
}
export interface OnlineRacerState extends OnlinePose {id:string;passed:number;progress:number;finishTime:number|null;dnf:boolean}
export interface OnlineFrame {raceId:string;serverNow:number;phase:OnlinePhase;states:OnlineRacerState[]}
const phases=['loading','countdown','racing','finished','aborted'];
export function isOnlineRace(value:unknown):value is OnlineRace {
 const r=value as OnlineRace;return !!r&&typeof r.id==='string'&&/^[a-f0-9]{24}$/.test(r.id)&&phases.includes(r.phase)&&Number.isSafeInteger(r.laps)&&r.laps>0&&r.laps<=99
  &&[r.countdownAt,r.startAt].every(x=>x===null||Number.isFinite(x))&&typeof r.message==='string'&&r.message.length<200&&Array.isArray(r.participants)&&r.participants.length>=2&&r.participants.length<=5
  &&r.participants.every((p,i)=>p&&/^[a-f0-9]{24}$/.test(p.id)&&typeof p.name==='string'&&[...p.name].length<=16&&p.slot===i&&typeof p.loaded==='boolean'&&typeof p.connected==='boolean'&&typeof p.dnf==='boolean')
  &&new Set(r.participants.map(p=>p.id)).size===r.participants.length;
}
export function isOnlinePose(value:unknown):value is OnlinePose {
 const p=value as OnlinePose;return !!p&&['seq','t','x','z','y','heading','speed','vx','vz','pitch','spin','correction'].every(k=>typeof p[k as keyof OnlinePose]==='number'&&Number.isFinite(p[k as keyof OnlinePose]))
  &&Number.isSafeInteger(p.seq)&&p.seq>=0&&Number.isSafeInteger(p.correction)&&p.correction>=0&&p.t>=0&&p.t<86400&&Math.abs(p.x)<6000&&Math.abs(p.z)<6000&&p.y>=-5&&p.y<150
  &&Math.abs(p.heading)<100000&&p.speed>=0&&p.speed<120&&Math.abs(p.vx)<120&&Math.abs(p.vz)<120&&Math.abs(p.pitch)<10&&Math.abs(p.spin)<10&&typeof p.airborne==='boolean'&&typeof p.nitro==='boolean';
}
export function isOnlineFrame(value:unknown):value is OnlineFrame {
 const f=value as OnlineFrame;return !!f&&typeof f.raceId==='string'&&/^[a-f0-9]{24}$/.test(f.raceId)&&Number.isFinite(f.serverNow)&&phases.includes(f.phase)&&Array.isArray(f.states)&&f.states.length>=2&&f.states.length<=5
  &&f.states.every(s=>isOnlinePose(s)&&/^[a-f0-9]{24}$/.test(s.id)&&Number.isSafeInteger(s.passed)&&s.passed>=0&&Number.isFinite(s.progress)&&(s.finishTime===null||(Number.isFinite(s.finishTime)&&s.finishTime>=0))&&typeof s.dnf==='boolean');
}
