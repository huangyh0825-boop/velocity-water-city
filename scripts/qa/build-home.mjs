import{build}from'vite';
await build({base:'/',publicDir:false,build:{outDir:'.qa/home-build',rollupOptions:{input:'scripts/qa/home-app.html'}}});
