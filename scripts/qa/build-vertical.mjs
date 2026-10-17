import {build} from 'vite';
// Private production-optimised test entry; normal dist/index.html has no QA hooks.
await build({base:'/',build:{outDir:'.qa/vertical-build',rollupOptions:{input:'scripts/qa/vertical.html'}}});
