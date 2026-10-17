import type {Track,Point} from './Track';
import type {DrivingModel} from '../player/DrivingModel';
import type {FlightController} from '../player/FlightController';
/** Shared player/AI support solver; called after horizontal collision separation. */
export class SurfaceContact {
 constructor(private track:Track){}
 prepare(model:DrivingModel,flight:FlightController){
  if(!this.track.vertical)return;
  flight.managedSurface=true;
  const floor=this.track.surface(model).height;
  if(!flight.airborne&&floor>=flight.height&&floor-flight.height<1)flight.surface(floor);
  model.y=flight.height;
 }
 update(before:Point,model:DrivingModel,flight:FlightController){
  const floor=this.track.surface(model),prior=this.track.surface(before),dt=flight.step;
  if(flight.airborne){flight.contactSurface(floor.height);model.y=flight.height;return;}
  if(flight.landed){model.y=flight.height;return;}
  const forward=model.vx*Math.sin(prior.heading)+model.vz*Math.cos(prior.heading);
  const oldY=flight.previousHeight,velocity=flight.verticalSpeed;
  const predicted=oldY+velocity*dt-flight.gravity*dt*dt/2;
  const onSurface=Math.abs(oldY-prior.height)<.7;
  // Projection of a wide curved canal has small longitudinal discretisation
  // error. It must never turn an ascending surface into a false departure.
  const leavingDownhill=floor.height<prior.height-1||floor.slope<-.005;
  const separationTolerance=.002*(dt*60)**2;
  if(onSurface&&leavingDownhill&&floor.height<predicted-separationTolerance){
   const legal=forward>12&&Math.cos(model.heading-prior.heading)>.65;
   flight.depart(oldY,velocity,dt,legal);flight.contactSurface(floor.height);
  }else if(floor.height-flight.height>1){
   // A lateral collision cannot teleport a boat onto an elevated deck.
   model.x=before.x;model.z=before.z;model.speed*=.8;model.vx*=.8;model.vz*=.8;
  }else{
   flight.surface(floor.height);flight.verticalSpeed=floor.slope*(model.vx*Math.sin(floor.heading)+model.vz*Math.cos(floor.heading));
  }
  model.y=flight.height;
 }
}
