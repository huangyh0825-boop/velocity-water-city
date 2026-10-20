import { defineConfig } from 'vite';
import {runtimeAssets} from './scripts/runtime-assets.mjs';
export default defineConfig(({command})=>({
  base: './',
  publicDir:command==='build'?false:'public',
  plugins:[runtimeAssets()],
  // Do not watch portable DCC binaries or packed authoring sources on Windows.
  server: { proxy:{'/api/lobby':{target:'http://127.0.0.1:8787'}},watch: { ignored: ['**/.qa/**','**/assets/city-sample/source/**'] } },
  preview:{proxy:{'/api/lobby':{target:'http://127.0.0.1:8787'}}},
  build: { rollupOptions: { output: { manualChunks(id){if(id.includes('/three/examples/jsm/loaders/'))return 'model-loaders';if(id.includes('/node_modules/three/'))return 'three';} } } },
}));
