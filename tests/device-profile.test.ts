import{test}from'node:test';import assert from'node:assert/strict';
import{ProfileStore,PROFILE_KEY}from'../src/profile/DeviceProfile';import{parseLaps}from'../src/modes/TrainingOptions';
function store(){const map=new Map<string,string>();return{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};}
test('device profile survives reopening and renaming without losing preferences or race records',()=>{
 const s=store(),a=new ProfileStore(s);a.rename('水城玩家');a.settings({laps:7,difficulty:'easy'});a.room('0042');const run=a.start();a.record(run,{laps:7,difficulty:'easy',elapsed:840,completedLaps:7,rank:1,completed:true});a.record(run,{laps:7,difficulty:'easy',elapsed:840,completedLaps:7,rank:1,completed:true});a.rename('新代号');
 const b=new ProfileStore(s);assert.equal(b.data.deviceId,a.data.deviceId);assert.equal(b.data.resumeKey,a.data.resumeKey);assert.equal(b.data.playerId,'新代号');assert.deepEqual(b.data.settings,{laps:7,difficulty:'easy'});assert.equal(b.data.lastRoom,'0042');assert.deepEqual(b.data.stats,{started:1,completed:1,completedLaps:7,seconds:840});assert.equal(b.data.history.length,1);assert.equal(b.persisted,true);
});
test('corrupt or blocked browser storage still allows training and records in page memory',()=>{
 const s=store();s.setItem(PROFILE_KEY,'broken');const p=new ProfileStore(s);assert.equal(p.data.playerId,'');p.rename('A');
 const blocked=new ProfileStore({getItem(){throw Error();},setItem(){throw Error();}});blocked.rename('B');const id=blocked.start();blocked.record(id,{laps:5,difficulty:'hard',elapsed:150,completedLaps:1,rank:3,completed:false});assert.equal(blocked.persisted,false);assert.equal(blocked.data.stats.completed,0);assert.equal(blocked.data.stats.completedLaps,1);assert.equal(blocked.data.history.length,1);
});
test('custom lap counts accept arbitrary positive integers and reject malformed or unsafe values',()=>{
 for(const n of[1,2,37,9999])assert.equal(parseLaps(String(n)),n);
 for(const n of['','0','-2','1.5','NaN','Infinity','1e3',Number.MAX_SAFE_INTEGER])assert.throws(()=>parseLaps(n));
 const p=new ProfileStore(store());assert.throws(()=>p.rename(''));assert.throws(()=>p.rename('<script>'));assert.throws(()=>p.room('42'));assert.equal(p.data.lastRoom,'');
});
test('background saves can later finish the same run without duplicating play time or laps',()=>{
 const s=store(),p=new ProfileStore(s),id=p.start();p.record(id,{laps:2,difficulty:'hard',elapsed:100,completedLaps:1,rank:2,completed:false});p.record(id,{laps:2,difficulty:'hard',elapsed:100,completedLaps:1,rank:2,completed:false});p.record(id,{laps:2,difficulty:'hard',elapsed:190,completedLaps:2,rank:1,completed:true});
 assert.deepEqual(p.data.stats,{started:1,completed:1,completedLaps:2,seconds:190});assert.equal(new ProfileStore(s).data.history.length,1);
 const broken=JSON.parse(s.getItem(PROFILE_KEY)!);broken.settings.laps=0;s.setItem(PROFILE_KEY,JSON.stringify(broken));assert.equal(new ProfileStore(s).data.deviceId,p.data.deviceId);
});
