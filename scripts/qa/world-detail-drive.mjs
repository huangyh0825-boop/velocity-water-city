import {preview} from 'vite';import {readFile,writeFile} from 'node:fs/promises';
// Reuse the established full three-lap real Game.frame driver. Keep evidence
// separate from historical validations and the production entry untouched.
const web=await preview({build:{outDir:'.qa/world-detail-after'},preview:{host:'127.0.0.1',port:5315,strictPort:true}});
try{
 let source=await readFile('scripts/qa/quality-full-race.mjs','utf8');
 source=source.replace("'./qa-playwright.mjs'","'../scripts/qa/qa-playwright.mjs'").replace("folder='docs/city-quality-repair/full-race'","folder='work/world-detail/full-race'").replace('http://127.0.0.1:5177/','http://127.0.0.1:5315/');
 await writeFile('work/world-detail-drive-run.mjs',source);await import('../../work/world-detail-drive-run.mjs');
}finally{await web.close();}
