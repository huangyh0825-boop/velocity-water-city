import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderQuality,renderPixelRatio} from '../src/core/RenderQuality';
import {cityLOD} from '../src/environment/CityDensityLayout';

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
