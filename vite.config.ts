import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { rollupOptions: { output: { manualChunks(id){if(id.includes('/three/examples/jsm/loaders/'))return 'model-loaders';if(id.includes('/node_modules/three/'))return 'three';} } } },
});
