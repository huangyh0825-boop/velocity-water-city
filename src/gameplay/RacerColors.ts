import type {OnlineRace} from '../lobby/racing';
/** Stable race slots follow room entry order and survive reconnects. */
export const ONLINE_RACER_COLORS=['#126bba','#f6cc61','#ee7953','#a583ed','#55c8a2'] as const;
export function onlineRacerColor(race:OnlineRace,id:string){
 const player=race.participants.find(p=>p.id===id);
 if(!player)throw Error('这名玩家不在比赛名单中');
 return ONLINE_RACER_COLORS[player.slot];
}
