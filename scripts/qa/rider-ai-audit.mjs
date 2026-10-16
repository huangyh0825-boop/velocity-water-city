import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import assert from'node:assert/strict';
mkdirSync('.qa/rider-ai',{recursive:true});
const baseline='rider-ai-baseline',allowed=new Set(['src/core/Game.ts','src/player/Watercraft.ts','src/player/Rider.ts','src/player/AnatomicalRider.ts','src/player/HeroLighting.ts']);
const files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'src'],{encoding:'utf8'}).trim().split('\n').filter(f=>!allowed.has(f));
files.push(...execFileSync('git',['ls-tree','-r','--name-only',baseline,'public/models/pwc-r8'],{encoding:'utf8'}).trim().split('\n'),'public/models/watercraft.glb','public/models/watercraft-low.glb','public/models/rider-low.glb');
const binary=f=>/\.(glb|png)$/.test(f),sha=(b,f)=>createHash('sha256').update(binary(f)?b:b.toString('utf8').replace(/\r\n/g,'\n')).digest('hex');
const protectedFiles=files.map(path=>{const old=execFileSync('git',['show',`${baseline}:${path}`],{maxBuffer:160*1024*1024}),current=readFileSync(path);return{path,unchanged:sha(old,path)===sha(current,path),sha256:sha(current,path)};});
assert.ok(protectedFiles.every(f=>f.unchanged),JSON.stringify(protectedFiles.filter(f=>!f.unchanged)));
const result={baseline,protectedCount:files.length,protectedFiles};writeFileSync('.qa/rider-ai/protected-files.json',JSON.stringify(result,null,2));console.log(JSON.stringify({baseline,protectedCount:files.length,allUnchanged:true}));
