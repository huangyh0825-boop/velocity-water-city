import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist-lobby/public',{recursive:true});
await build({entryPoints:['server/lobby.ts'],outfile:'dist-lobby/lobby.mjs',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external'});
await build({entryPoints:['server/test-page.ts'],outfile:'dist-lobby/public/test.js',bundle:true,platform:'browser',target:'es2022',format:'esm'});
await copyFile('server/public/index.html','dist-lobby/public/index.html');
console.log('Lobby: dist-lobby/lobby.mjs (Node.js 22+, ws runtime dependency); diagnostic page included, no game assets.');
