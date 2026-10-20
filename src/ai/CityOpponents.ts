import{AIController}from'./AIController';
import{SPEED_TUNING,kmhToMps}from'../config/speed';
import{NITRO_TUNING}from'../config/phase3';
import type{CityTrack}from'../track/CityTrack';
import type{Difficulty}from'../modes/TrainingOptions';

/** Shared by the live game and full-course pace validation. */
export function createCityOpponents(track:CityTrack,difficulty:Difficulty='hard'){
 const speeds=difficulty==='easy'?[155,138,124,110]:SPEED_TUNING.cityAI.maxKmh;
 return ['霓虹 / NEON','脉冲 / PULSE','极光 / AURORA','回声 / ECHO'].map((name,i)=>new AIController(`ai-${i+1}`,name,kmhToMps(speeds[i]),i%2?7:-7,track,i<2?-.02:-.029,SPEED_TUNING.cityAI.acceleration));
}
export const cityEntrants=(ai:readonly AIController[])=>ai.map(a=>({id:a.id,name:a.name,position:a.model,maxSpeed:a.targetSpeed*NITRO_TUNING.multiplier}));
