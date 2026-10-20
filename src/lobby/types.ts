export interface LobbyMember {id:string;playerId:string;ready:boolean;host:boolean;connected?:boolean}
export interface LobbySnapshot {code:string;capacity:number;members:LobbyMember[]}
export interface LobbyIdentity {deviceId:string;resumeKey:string;playerId:string}
export interface LobbyConnection {room:LobbySnapshot;memberId:string;status:'connected'|'reconnecting'|'disconnected'}
