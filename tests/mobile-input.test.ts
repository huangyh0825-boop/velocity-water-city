import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InputController} from '../src/controls/InputController';

class TestButton extends EventTarget {
 disabled=false;captured:number[]=[];attributes=new Map<string,string>();
 setAttribute(key:string,value:string){this.attributes.set(key,value);}
 setPointerCapture(id:number){this.captured.push(id);}
}
function fixture(t:{after(fn:()=>void):void},mobile:boolean){
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),originalElement=Object.getOwnPropertyDescriptor(globalThis,'HTMLElement'),window=new EventTarget();
 Object.defineProperty(globalThis,'window',{configurable:true,value:window});Object.defineProperty(globalThis,'HTMLElement',{configurable:true,value:TestButton});
 const input=new InputController(mobile);
 t.after(()=>{input.dispose();if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else delete(globalThis as any).window;if(originalElement)Object.defineProperty(globalThis,'HTMLElement',originalElement);else delete(globalThis as any).HTMLElement;});
 const button=(action:string)=>{const b=new TestButton();input.bindButton(b as unknown as HTMLButtonElement,action);return b;};
 const pointer=(button:TestButton,type:string,id:number)=>{const event=new Event(type,{cancelable:true});Object.defineProperty(event,'pointerId',{value:id});button.dispatchEvent(event);};
 const key=(type:string,code:string)=>{const event=new Event(type,{cancelable:true});Object.defineProperty(event,'code',{value:code});window.dispatchEvent(event);};
 return{input,window,button,pointer,key};
}
test('mobile auto throttle supports steering plus nitro and gives braking priority without a third thumb',t=>{
 const{input,button,pointer}=fixture(t,true),left=button('left'),right=button('right'),nitro=button('nitro'),brake=button('brake');
 assert.deepEqual(input.state,{throttle:1,brake:0,steer:0});
 pointer(left,'pointerdown',11);pointer(nitro,'pointerdown',12);assert.deepEqual(input.state,{throttle:1,brake:0,steer:1});assert.equal(input.boost,true);assert.deepEqual(left.captured,[11]);
 pointer(left,'pointerup',11);pointer(right,'pointerdown',13);assert.equal(input.state.steer,-1);assert.equal(input.boost,true);
 pointer(brake,'pointerdown',14);assert.deepEqual(input.state,{throttle:0,brake:1,steer:-1});assert.equal(input.boost,false);
 pointer(brake,'pointercancel',14);assert.equal(input.state.throttle,1);assert.equal(input.boost,true);assert.equal(input.state.steer,-1);
 pointer(nitro,'lostpointercapture',12);assert.equal(input.boost,false);assert.equal(input.state.steer,-1);pointer(right,'pointerup',13);assert.equal(input.state.steer,0);
});
test('mobile settings, focus loss and recovery cannot leave held steering, nitro or tricks behind',t=>{
 const{input,window,button,pointer}=fixture(t,true),left=button('left'),nitro=button('nitro'),trick=button('trick');
 trick.disabled=true;pointer(trick,'pointerdown',1);assert.equal(input.consumeTrickPress(),false);trick.disabled=false;pointer(trick,'pointerdown',1);assert.equal(input.consumeTrickPress(),true);assert.equal(input.consumeTrickPress(),false);
 pointer(left,'pointerdown',2);pointer(nitro,'pointerdown',3);input.setTouchEnabled(false);assert.deepEqual(input.state,{throttle:0,brake:0,steer:0});assert.equal(input.boost,false);assert.equal(left.attributes.get('aria-pressed'),'false');
 input.setTouchEnabled(true);assert.deepEqual(input.state,{throttle:1,brake:0,steer:0});pointer(left,'pointerdown',4);window.dispatchEvent(new Event('blur'));assert.deepEqual(input.state,{throttle:0,brake:0,steer:0});assert.equal(input.boost,false);
 window.dispatchEvent(new Event('focus'));assert.deepEqual(input.state,{throttle:1,brake:0,steer:0});pointer(nitro,'pointerdown',5);input.releaseAction('nitro');assert.equal(input.boost,false);input.clear();assert.equal(input.state.throttle,1);
});
test('desktop keeps manual W/S, arrow keys, Shift and one-shot space input',t=>{
 const{input,key,window}=fixture(t,false);assert.deepEqual(input.state,{throttle:0,brake:0,steer:0});key('keydown','KeyW');key('keydown','KeyA');key('keydown','ShiftLeft');assert.deepEqual(input.state,{throttle:1,brake:0,steer:1});assert.equal(input.boost,true);
 key('keydown','KeyS');assert.deepEqual(input.state,{throttle:1,brake:1,steer:1});assert.equal(input.boost,true,'desktop key combinations retain existing behavior');key('keyup','KeyA');key('keydown','ArrowRight');assert.equal(input.state.steer,-1);
 key('keydown','Space');assert.equal(input.consumeTrickPress(),true);key('keydown','Space');assert.equal(input.consumeTrickPress(),false);window.dispatchEvent(new Event('blur'));assert.deepEqual(input.state,{throttle:0,brake:0,steer:0});assert.equal(input.boost,false);
});
