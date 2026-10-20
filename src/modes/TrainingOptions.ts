export type Difficulty='easy'|'hard';
export interface TrainingOptions {laps:number;difficulty:Difficulty}
export const DEFAULT_TRAINING:TrainingOptions={laps:3,difficulty:'hard'};
export const DIFFICULTY_LABEL:Record<Difficulty,string>={easy:'简单',hard:'困难'};
export function parseLaps(value:unknown):number{
 const n=typeof value==='string'&&/^\d+$/.test(value.trim())?Number(value):typeof value==='number'?value:NaN;
 if(!Number.isSafeInteger(n)||n<1||!Number.isSafeInteger(n*24))throw Error('圈数请输入大于 0 的整数');
 return n;
}
export function trainingOptions(value:Partial<TrainingOptions>={}):TrainingOptions{
 return{laps:parseLaps(value.laps??3),difficulty:value.difficulty==='easy'?'easy':'hard'};
}
export interface TrainingRun extends TrainingOptions {elapsed:number;completedLaps:number;rank:number;completed:boolean}
