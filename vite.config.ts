import { defineConfig } from 'vite';
import {runtimeAssets} from './scripts/runtime-assets.mjs';
export default defineConfig(({command})=>({
  base: './',
  publicDir:command==='build'?false:'public',
  plugins:[runtimeAssets()],
  // Do not watch portable DCC binaries or packed authoring sources on Windows.
  server: { watch: { ignored: ['**/.qa/**','**/assets/city-sample/source/**'] } },
  build: { rollupOptions: { output: { manualChunks(id){if(id.includes('/three/examples/jsm/loaders/'))return 'model-loaders';if(id.includes('/node_modules/three/'))return 'three';} } } },
}));
