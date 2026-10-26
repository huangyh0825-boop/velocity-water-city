import {execFileSync} from 'node:child_process';import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
const root='work/resource-quality/final';await mkdir(root,{recursive:true});
function run(script,args=[],env={}){console.log('RUN',script,...args);execFileSync(process.execPath,[script,...args],{stdio:'inherit',env:{...process.env,QA_BUILD_DIR:'.qa/resource-final',...env}});}
run('scripts/qa/build-finish.mjs',[],{QA_OUT:'.qa/resource-final'});
run('scripts/qa/resource-fallback.mjs');run('scripts/qa/resource-detail-views.mjs');run('scripts/qa/finish-captures.mjs',['resource-final']);
run('scripts/qa/resource-frame-physics.mjs');run('scripts/qa/resource-lifecycle.mjs',['final']);run('scripts/qa/resource-skin-compare.mjs');
run('scripts/qa/resource-online-build.mjs');run('scripts/qa/online-race.mjs',[],{QA_BUILD_DIR:'.qa/resource-online',QA_OUTPUT:root+'/online'});
run('scripts/qa/resource-network.mjs');
run('scripts/qa/resource-baseline.mjs',['before-final'],{QA_BUILD_DIR:'.qa/resource-before',QA_SHORT:'1'});
run('scripts/qa/resource-baseline.mjs',['final']);
await writeFile(root+'/checks-complete.json',JSON.stringify({completed:true,allSequential:true,finishedAt:new Date().toISOString()},null,2));console.log('Final functional checks and actual real-time long run complete.');
