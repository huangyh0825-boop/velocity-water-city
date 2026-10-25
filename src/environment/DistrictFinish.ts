import {districtAt} from './WorldCityLayout';
/** Subtle architectural colour families, shared by every LOD/material batch. */
const palettes:Record<string,readonly string[]>={central:['#ffffff','#ece8dd','#d4e4e9','#e0e6e5'],science:['#f3fbfc','#cddde6','#e8e9ee','#d9e9e4'],transit:['#eff4f6','#d5e2e7','#e8e0ce','#cedbdf'],industrial:['#dee4e5','#c6d2d6','#d5cdc1','#dce1db'],harbor:['#f1f7f5','#c6ddd8','#d5e3e8','#e5dcc7'],leisure:['#fff4df','#dde9dc','#e7e1d8','#d9e4e5']};
export function districtFinish(angle:number,tint:number){return palettes[districtAt(angle).id][tint%4];}
