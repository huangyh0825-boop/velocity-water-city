import{test}from'node:test';import assert from'node:assert/strict';import{driveShortcut}from'./helpers/shortcut-drive';
test('S1 exit accepts real player driving at 120/140/160kmh without wall assistance',()=>{
 for(const speed of [120,140,160]){const r=driveShortcut(speed);assert.ok(r.finished);assert.equal(r.walls,0);assert.ok(r.minKmh>speed-1);}
});
test('nitro approach can brake normally before the S1 exit without stopping or hitting walls',()=>{const r=driveShortcut(216,true);assert.ok(r.finished);assert.equal(r.walls,0);assert.ok(r.brakeSteps>0&&r.brakeSteps<120);assert.ok(r.minKmh>150);});
