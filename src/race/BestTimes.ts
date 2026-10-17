type Store=Pick<Storage,'getItem'|'setItem'>;
function browserStore():Store|undefined{try{return typeof localStorage==='undefined'?undefined:localStorage;}catch{return undefined;}}
const key=(layout:string)=>`velocity-water-city:best:${layout}`;
export function readBest(layout:string,store=browserStore()):number|null{try{const value=Number(store?.getItem(key(layout)));return Number.isFinite(value)&&value>0?value:null;}catch{return null;}}
export function saveBest(layout:string,time:number,store=browserStore()):number|null{
 const old=readBest(layout,store);if(!Number.isFinite(time)||time<=0)return old;const best=old===null?time:Math.min(old,time);try{store?.setItem(key(layout),String(best));}catch{/* Storage denial must not interrupt race settlement. */}return best;
}
