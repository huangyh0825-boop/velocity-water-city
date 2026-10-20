import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identity,isLobbySnapshot,joinMode,LobbyFault,playerName,roomCode} from '../src/lobby/protocol';
test('shared lobby validation preserves leading zeros and the existing device identity and display names',()=>{
 assert.equal(roomCode('0042'),'0042');assert.equal(playerName(' 玩家一 '),'玩家一');assert.equal(joinMode(undefined),'auto');assert.equal(joinMode('join'),'join');
 const who={deviceId:'a'.repeat(32),resumeKey:'b'.repeat(32),playerId:' 玩家一 '};assert.deepEqual(identity(who),{...who,playerId:'玩家一'});
 for(const code of[42,'42','00422','room',null])assert.throws(()=>roomCode(code),LobbyFault);
 for(const name of['','x'.repeat(17),'ab\nc','<script>','\u0000'])assert.throws(()=>playerName(name),LobbyFault);
 assert.throws(()=>identity({...who,resumeKey:'c'.repeat(31)}),LobbyFault);assert.throws(()=>joinMode('racing'),LobbyFault);
});
test('server room snapshots cannot introduce duplicate members, extra capacity or spoofed hosts',()=>{
 const room={code:'0042',capacity:5,members:[{id:'a'.repeat(24),playerId:'玩家',ready:false,host:true,connected:true}]};assert.equal(isLobbySnapshot(room),true);
 assert.equal(isLobbySnapshot(null),false);assert.equal(isLobbySnapshot({...room,code:'42'}),false);assert.equal(isLobbySnapshot({...room,capacity:99}),false);
 assert.equal(isLobbySnapshot({...room,members:[...room.members,...room.members]}),false);assert.equal(isLobbySnapshot({...room,members:[{...room.members[0],host:false}]}),false);
 assert.equal(isLobbySnapshot({...room,members:[{...room.members[0],ready:'yes'}]}),false);assert.equal(isLobbySnapshot({...room,members:[]}),true);
});
