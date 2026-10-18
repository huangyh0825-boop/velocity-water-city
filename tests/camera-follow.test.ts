import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FollowCamera} from '../src/camera/FollowCamera';
import {DrivingModel} from '../src/player/DrivingModel';

test('camera stays in classic third-person follow through mouse movement and steering',()=>{
 const camera=new FollowCamera(),boat=new DrivingModel();camera.update(0,boat,true);
 const start=camera.camera.position.clone();
 boat.heading=.8;
 for(let i=0;i<180;i++)camera.update(1/60,boat);
 assert.ok(camera.camera.position.distanceTo(start)>.1);
 assert.equal('orbit' in camera,false);
 assert.equal('engage' in camera,false);
 assert.equal('wheel' in camera,false);
});

test('runtime entry has no mouse look, pointer lock, or camera controls UI',()=>{
 const game=readFileSync('src/core/Game.ts','utf8');
 const camera=readFileSync('src/camera/FollowCamera.ts','utf8');
 const loading=readFileSync('src/ui/LoadingScreen.ts','utf8');
 assert.doesNotMatch(game,/CameraControls|requestPointerLock|pointerlockchange|mouseLook/i);
 assert.doesNotMatch(camera,/orbit\(|engage\(|wheel\(|free\s*=|yaw\s*=|pitch\s*=/i);
 assert.doesNotMatch(loading,/鼠标观察|鼠标视角|自由视角/);
});
