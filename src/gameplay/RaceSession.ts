import type{RaceController}from'../race/RaceController';
import type{PlayerCommand}from'./PlayerCommand';
export interface SessionStep {drove:boolean;started:boolean;finished:boolean;wallContact:boolean}
/** Rendering consumes a session; training and a future network session share this port. */
export interface RaceSession {
 readonly mode:'training'|'online';readonly race:RaceController;
 step(dt:number,input:PlayerCommand):SessionStep;
 restart():void;recover():boolean;
}
