import {preview} from 'vite';import {readFile,writeFile} from 'node:fs/promises';
const label=process.argv[2]??'round1',outDir=process.env.QA_BUILD_DIR??'.qa/resource-after';
const web=await preview({build:{outDir},preview:{host:'127.0.0.1',port:5325,strictPort:true}});
try{let source=await readFile('scripts/qa/quality-full-race.mjs','utf8');source=source.replace("'./qa-playwright.mjs'","'../scripts/qa/qa-playwright.mjs'").replace("folder='docs/city-quality-repair/full-race'",`folder='work/resource-quality/${label}/full-race'`).replace('http://127.0.0.1:5177/','http://127.0.0.1:5325/');await writeFile('work/resource-drive-run.mjs',source);await import('../../work/resource-drive-run.mjs?'+Date.now());}finally{await web.close();}
