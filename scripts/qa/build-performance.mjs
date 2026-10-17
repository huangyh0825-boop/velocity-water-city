import {build} from 'vite';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
// Same production minifier/chunks/assets as the game; private QA entry only.
// The normal production index never includes the testGame/profiling interface.
const revision=process.env.PERF_REV;
const files=revision?new Set(execFileSync('git',['ls-tree','-r','--name-only',revision,'src'],{encoding:'utf8'}).trim().split('\n')):new Set();
await build({base:'/',define:{__PERF_REV__:JSON.stringify(revision??'working-tree')},plugins:revision?[{name:'qa-baseline-source',enforce:'pre',load(id){const relative=path.relative(process.cwd(),id).replaceAll('\\','/');if(files.has(relative))return execFileSync('git',['show',`${revision}:${relative}`],{encoding:'utf8'});}}]:[],build:{outDir:process.env.PERF_OUT_DIR??'.qa/perf-build',emptyOutDir:true,rollupOptions:{input:'scripts/qa/performance.html'}}});
