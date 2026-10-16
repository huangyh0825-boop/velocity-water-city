import {existsSync} from 'node:fs';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const candidates=[process.env.BLENDER_PATH,path.join(root,'.qa/tools/blender/blender-4.5.9-windows-x64/blender.exe'),'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe','blender'].filter(Boolean);
const blender=candidates.find(p=>existsSync(p)||spawnSync(p,['--version'],{stdio:'ignore',windowsHide:true}).status===0);
if(!blender)throw Error('Blender 4.5+ is required to rebuild art. Set BLENDER_PATH. Existing checked-in GLBs were not modified.');
const result=spawnSync(blender,['--background','--factory-startup','--python-exit-code','1','--python','scripts/art/build-pwc-r7.py'],{cwd:root,stdio:'inherit',windowsHide:true});process.exitCode=result.status??1;
