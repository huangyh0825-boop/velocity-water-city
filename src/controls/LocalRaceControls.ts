import type{InputController}from'./InputController';
import type{RaceControls}from'../gameplay/PlayerCommand';
/** Browser input adapter. A future network adapter will use the same commands. */
export class LocalRaceControls implements RaceControls {
 constructor(private input:InputController){}
 sample(state=this.input.state){return{...state,boost:this.input.boost,trick:this.input.consumeTrickPress()};}
 clear(){this.input.clear();}
}
