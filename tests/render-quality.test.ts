import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderQuality,renderPixelRatio} from '../src/core/RenderQuality';
import {cityLOD} from '../src/environment/CityDensityLayout';
import {RenderPacer,type FrameRate} from '../src/core/RenderPacer';

test('render caps follow the display cadence, including 144 Hz and rAF rounding',()=>{
 for(const display of[60,120,144])for(const rate of[0,60,120] as FrameRate[]){const p=new RenderPacer(rate);let accepted=0;
  for(let i=0;i<display*10;i++)if(p.accepts(i*1000/display))accepted++;
  assert.ok(Math.abs(accepted-10*Math.min(rate||display,display))<=1,`${display}Hz/${rate}: ${accepted}`);
 }
 const p=new RenderPacer(60);assert.ok(p.accepts(100));assert.equal(p.accepts(105),false);assert.ok(p.accepts(600));assert.equal(p.accepts(601),false);assert.ok(p.delta<=.1);p.reset();assert.ok(p.accepts(0));assert.equal(p.delta,0);
});
test('PC high retains the full standard model and water precision and increases reflection/shadow precision',()=>{
 const standard=renderQuality(false,false),high=renderQuality(false,false,true);
 assert.equal(high.low,false);assert.equal(high.waterSegments,standard.waterSegments);assert.equal(high.racerShadowSize,standard.racerShadowSize);assert.ok(high.reflectionSize>standard.reflectionSize);assert.ok(high.cityShadowSize>standard.cityShadowSize);
});

test('desktop standard keeps original resolution, water, reflections and shadows',()=>{
 const q=renderQuality(false,false);
 assert.equal(renderPixelRatio(q,2,1920,1080),1.75);
 assert.equal(q.waterSegments,320);assert.equal(q.reflectionSize,1024);
 assert.equal(q.cityShadowSize,2048);assert.equal(q.racerShadowSize,2048);
});
test('phone standard has an intermediate water mesh and bounded pixel / shadow cost',()=>{
 const low=renderQuality(true,true),phone=renderQuality(true,false),desktop=renderQuality(false,false);
 assert.ok(low.waterSegments<phone.waterSegments&&phone.waterSegments<desktop.waterSegments);
 assert.equal(phone.low,false);assert.equal(phone.reflectionSize,512);
 assert.equal(phone.cityShadowSize,1024);assert.equal(phone.racerShadowSize,1024);
 assert.equal(renderPixelRatio(phone,3,844,390),1);
 assert.equal(renderPixelRatio(phone,3,1366,1024)*1366,1024);
 assert.equal(renderPixelRatio(phone,.8,844,390),.8);
 assert.equal(renderPixelRatio(low,3,844,390),1);
 assert.equal(cityLOD('blocks',125,-1,false,true),0);
 assert.equal(cityLOD('blocks',250,-1,false,true),1);
 assert.equal(cityLOD('blocks',250,-1,false),0);
 assert.equal(cityLOD('blocks',500,-1,false,true),2);
 assert.equal(cityLOD('blocks',500,-1,false),1);
});
