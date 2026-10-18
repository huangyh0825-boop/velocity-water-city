import{test}from'node:test';import assert from'node:assert/strict';import{Vector3}from'three';import{FollowCamera}from'../src/camera/FollowCamera';import{DrivingModel}from'../src/player/DrivingModel';
test('final viewing vector follows horizontal mouse and inverted Y at multiple boat headings',()=>{
 for(const heading of[0,.8,2.5,-2])for(const[dx,dy]of[[-80,0],[80,0],[0,-55],[0,55]]){
  const c=new FollowCamera(),m=new DrivingModel();m.heading=heading;c.update(0,m,true);c.engage();for(let i=0;i<180;i++)c.update(1/60,m);
  const before=c.camera.getWorldDirection(new Vector3()),right=new Vector3().crossVectors(before,new Vector3(0,1,0)).normalize();c.orbit(dx,dy);for(let i=0;i<180;i++)c.update(1/60,m);
  const after=c.camera.getWorldDirection(new Vector3());if(dx)assert.ok(after.dot(right)*dx>0);if(dy)assert.ok((after.y-before.y)*dy>0);assert.equal(m.heading,heading);
 }
});
test('free yaw is independent of boat and restore remains smooth',()=>{
 const c=new FollowCamera(),m=new DrivingModel();c.update(0,m,true);c.orbit(200,-100);for(let i=0;i<120;i++)c.update(1/60,m);const yaw=c.state.yaw;m.heading+=2;c.update(1/60,m,false,10,true);assert.equal(c.state.yaw,yaw);const pos=c.camera.position.clone();c.restore();c.update(1/60,m,false,10,true);assert.ok(pos.distanceTo(c.camera.position)<4);assert.ok(c.camera.position.y>.35);
});
