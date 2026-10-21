/** Visual budgets only. Desktop standard retains all approved rendering settings. */
export function renderQuality(mobile:boolean,low:boolean){
 return {
  mobile,low,
  pixelRatio:low?1:mobile?1:1.75,
  maxEdge:!low&&mobile?1024:Infinity,
  waterSegments:low?64:mobile?160:320,
  reflectionSize:mobile?512:1024,
  racerShadowSize:mobile?1024:2048,
  cityShadowSize:mobile?1024:2048,
 } as const;
}
export function renderPixelRatio(profile:ReturnType<typeof renderQuality>,dpr:number,width:number,height:number){
 return Math.min(dpr,profile.pixelRatio,profile.maxEdge/Math.max(1,width,height));
}
