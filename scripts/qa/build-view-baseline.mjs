import{build}from'vite';import{execFileSync}from'node:child_process';import{resolve}from'node:path';
const tag='view-loading-baseline',root=resolve('.').replaceAll('\\','/'),paths=execFileSync('git',['diff',tag,'--name-only','--','src'],{encoding:'utf8'}).trim().split('\n').filter(Boolean),cache=new Map();
for(const path of paths)try{cache.set(root+'/'+path,execFileSync('git',['show',`${tag}:${path}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));}catch{/* New modules are not referenced by baseline imports. */}
await build({base:'/',plugins:[{name:'view-baseline',enforce:'pre',load(id){return cache.get(id.replaceAll('\\','/').split('?')[0])??null;}}],build:{outDir:'.qa/view-before-build',rollupOptions:{input:'scripts/qa/vertical.html'}}});
