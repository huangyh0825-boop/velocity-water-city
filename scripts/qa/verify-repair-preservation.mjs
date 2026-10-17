import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const baseline='track-repair-implementation-baseline';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const unchanged=paths=>git('diff',baseline,'--name-only','--',...paths)==='';
const normalize=s=>s.replace(/\r/g,'');
const update=s=>normalize(s).slice(normalize(s).indexOf('  update('),normalize(s).indexOf('  reset()'));
const before=git('show',`${baseline}:src/player/DrivingModel.ts`),after=readFileSync('src/player/DrivingModel.ts','utf8');
const result={baseline:git('rev-parse',baseline),publicModelsAndTexturesUnchanged:unchanged(['public']),speedAndNitroConfigurationUnchanged:unchanged(['src/config']),horizontalDrivingUpdateIdentical:update(before)===update(after),hullColliderAndSolverUnchanged:unchanged(['src/physics/BoatCollisions.ts']),performanceLightingAndPackedSamplingUnchanged:unchanged(['src/player/HeroLighting.ts','src/player/PackedMaterialSampling.ts']),waterAndEffectsUnchanged:unchanged(["src/effects"]),cameraUnchanged:unchanged(["src/camera"]),aiControllerUnchanged:unchanged(["src/ai"]),controlsAndAudioUnchanged:unchanged(['src/controls','src/audio'])};
for(const [name,value] of Object.entries(result))if(name!=='baseline')assert.equal(value,true,name);
writeFileSync('docs/track-repair-validation/preservation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));


