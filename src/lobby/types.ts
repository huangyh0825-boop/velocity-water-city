import type {OnlineRace} from './racing';
export interface LobbyMember {id:string;playerId:string;ready:boolean;host:boolean;connected?:boolean;raceCapable?:boolean}
export interface LobbySnapshot {code:string;capacity:number;members:LobbyMember[];canRace?:boolean;race?:OnlineRace}
export interface LobbyIdentity {deviceId:string;resumeKey:string;playerId:string}
export interface LobbyConnection {room:LobbySnapshot;memberId:string;status:'connected'|'reconnecting'|'disconnected'}
