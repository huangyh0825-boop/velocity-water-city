export interface PlayerCommand {throttle:number;brake:number;steer:number;boost:boolean;trick:boolean}
export interface RaceControls {sample(state?:Pick<PlayerCommand,'throttle'|'brake'|'steer'>):PlayerCommand;clear():void}
