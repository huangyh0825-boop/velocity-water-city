import type {Track} from '../track/Track';
import type {DrivingModel} from '../player/DrivingModel';
/** Identical starting grid for clients and the server, behind CP0. */
export function onlineSpawn(track:Track,model:DrivingModel,slot:number){track.spawn(model,-.014-Math.floor(slot/2)*.012,slot%2?7:-7);}
