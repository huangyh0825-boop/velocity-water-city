import{spawn}from'node:child_process';
const children=[['node_modules/tsx/dist/cli.mjs','server/lobby.ts'],['node_modules/vite/bin/vite.js','--host','0.0.0.0','--port',process.env.GAME_PORT??'5185','--strictPort']].map(args=>spawn(process.execPath,args,{stdio:'inherit',windowsHide:true}));
let stopped=false;function stop(code=0){if(stopped)return;stopped=true;children.forEach(child=>child.kill());process.exitCode=code;}
children.forEach(child=>{child.on('error',e=>{console.error(e.message);stop(1);});child.on('exit',code=>stop(code??0));});process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
