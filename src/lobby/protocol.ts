import type {LobbyIdentity, LobbySnapshot} from './types';
import {isOnlineRace,type OnlineFrame,type OnlinePose} from './racing';

export const LOBBY_PROTOCOL = 1;
export const ROOM_CAPACITY = 5;
export const MAX_MESSAGE_BYTES = 2048;
export const RECONNECT_GRACE_MS = 30_000;
export type JoinMode = 'auto' | 'join' | 'create';
export class LobbyFault extends Error {
 constructor(readonly status:number, message:string) { super(message); }
}
export function record(value:unknown):Record<string,unknown> {
 if(!value || typeof value!=='object' || Array.isArray(value)) throw new LobbyFault(400,'请求格式无效');
 return value as Record<string,unknown>;
}
export function roomCode(value:unknown):string {
 if(typeof value!=='string' || !/^\d{4}$/.test(value)) throw new LobbyFault(400,'房间号必须是四位数字');
 return value;
}
export function playerName(value:unknown):string {
 if(typeof value!=='string' || !value.trim() || [...value.trim()].length>16 || /[\p{C}<>]/u.test(value)) throw new LobbyFault(400,'游戏 ID 请输入 1–16 个普通字符');
 return value.trim();
}
export function identity(value:unknown):LobbyIdentity {
 const b=record(value);
 if(typeof b.deviceId!=='string' || !/^[a-f0-9]{32}$/.test(b.deviceId) || typeof b.resumeKey!=='string' || !/^[a-f0-9]{32}$/.test(b.resumeKey)) throw new LobbyFault(400,'设备档案无效，请刷新后重试');
 return {deviceId:b.deviceId,resumeKey:b.resumeKey,playerId:playerName(b.playerId)};
}
export function joinMode(value:unknown):JoinMode {
 if(value===undefined) return 'auto';
 if(value!=='auto' && value!=='join' && value!=='create') throw new LobbyFault(400,'房间操作无效');
 return value;
}
export type LobbyCommand =
 | {v:1;type:'join';id:string;identity:LobbyIdentity;mode?:JoinMode;features?:string[]}
 | {v:1;type:'ready';id:string;ready:boolean}
 | {v:1;type:'rename';id:string;playerId:string}
 | {v:1;type:'state'|'leave'|'start'|'clock';id:string}
 | {v:1;type:'race.loaded'|'race.failed'|'race.recover';id:string;raceId:string}
 | {v:1;type:'race.state';raceId:string;state:OnlinePose};
export type LobbyEvent =
 | {v:1;type:'welcome';id:string;memberId:string;room:LobbySnapshot}
 | {v:1;type:'room';room:LobbySnapshot}
 | {v:1;type:'ack';id:string;serverNow?:number}
 | {v:1;type:'race.frame';frame:OnlineFrame}
 | {v:1;type:'error';id?:string;code:number;message:string};

export function isLobbySnapshot(value:unknown):value is LobbySnapshot {
 if(!value||typeof value!=='object')return false;
 const room=value as LobbySnapshot;
 return typeof room.code==='string'&&/^\d{4}$/.test(room.code)&&room.capacity===ROOM_CAPACITY&&Array.isArray(room.members)&&room.members.length<=ROOM_CAPACITY
  &&room.members.every(m=>m&&typeof m.id==='string'&&/^[a-f0-9]{24}$/.test(m.id)&&typeof m.playerId==='string'&&[...m.playerId].length<=16&&typeof m.ready==='boolean'&&typeof m.host==='boolean'&&(m.connected===undefined||typeof m.connected==='boolean'))
  &&new Set(room.members.map(m=>m.id)).size===room.members.length&&room.members.filter(m=>m.host).length===(room.members.length?1:0)
  &&(room.race===undefined||isOnlineRace(room.race));
}

/** Versioned extension points only. No racing state is accepted or broadcast yet. */
export interface FutureRaceState {
 sequence:number;tick:number;x:number;z:number;heading:number;speed:number;
 height:number;airborne:boolean;trick:number;nitro:boolean;
}
export interface FutureRaceBatch {
 v:1;type:'race.batch';sequence:number;updates:Partial<FutureRaceState>[];
}
