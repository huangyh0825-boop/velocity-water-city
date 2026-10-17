/** Original engineered canals; all distances/heights are metres, t is lap fraction. */
export const ELEVATION_ZONES=[{id:'sky-spillway',from:.30,to:.354,peak:16},{id:'harbor-crest',from:.69,to:.738,peak:8},{id:'port-spillway',from:.785,to:.817,peak:10}] as const;
export const NATURAL_JUMPS=[{id:'drop-16',t:.354,route:null,height:16},{id:'crest-8',t:.728,route:null,height:8},{id:'port-drop-10',t:.817,route:null,height:10},{id:'sky-cut-jump',t:.45,route:'harbor-cut',height:14}] as const;
function rise(t:number,a:number,b:number,height:number,length:number){const u=(t-a)/(b-a);return{height:height*(1-Math.cos(Math.PI*u))/2,slope:height*Math.PI*Math.sin(Math.PI*u)/(2*(b-a)*length)};}
function lip(t:number,a:number,b:number,base:number,height:number,length:number){const u=(t-a)/(b-a);return{height:base+height*u*u,slope:2*height*u/((b-a)*length)};}
export function elevation(t:number,length:number,route:string|null=null){
 if(route==='harbor-cut'){
  if(t<.07)return{height:0,slope:0};
  if(t<.24)return rise(t,.07,.24,12,length);
  if(t<.40)return{height:12,slope:0};
  if(t<.45)return lip(t,.40,.45,12,2,length);
  return{height:0,slope:0};
 }
 if(route)return{height:0,slope:0};
 t=(t%1+1)%1;
 if(t>=.30&&t<.335)return rise(t,.30,.335,12,length);
 if(t>=.335&&t<.34)return{height:12,slope:0};
 if(t>=.34&&t<.354)return lip(t,.34,.354,12,4,length);
 if(t>=.69&&t<.728){const u=(t-.69)/.038;return{height:4-4*Math.cos(Math.PI*u),slope:4*Math.PI*Math.sin(Math.PI*u)/(.038*length)};}
 if(t>=.728&&t<.738){const u=(t-.728)/.010;return{height:4+4*Math.cos(Math.PI*u),slope:-4*Math.PI*Math.sin(Math.PI*u)/(.010*length)};}
 if(t>=.785&&t<.805)return rise(t,.785,.805,6,length);
 if(t>=.805&&t<.817)return lip(t,.805,.817,6,4,length);
 return{height:0,slope:0};
}
