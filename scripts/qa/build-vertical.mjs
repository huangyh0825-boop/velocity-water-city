import {build} from 'vite';
import {execFileSync} from 'node:child_process';import path from 'node:path';
// Private production-optimised test entry; normal dist/index.html has no QA hooks.
const revision=process.env.QA_REV,files=revision?new Set(execFileSync('git',['ls-tree','-r','--name-only',revision,'src'],{encoding:'utf8'}).trim().split('\n')):new Set();
await build({base:'/',publicDir:revision?'public':false,plugins:revision?[{name:'baseline-source',enforce:'pre',load(id){const name=path.relative(process.cwd(),id).replaceAll('\\','/');if(files.has(name))return execFileSync('git',['show',`${revision}:${name}`],{encoding:'utf8'});}}]:[],build:{outDir:process.env.QA_OUT??'.qa/vertical-build',rollupOptions:{input:'scripts/qa/vertical.html'}}});
