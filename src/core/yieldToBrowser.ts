/** A real task boundary allows the loader, input and browser compositor to run. */
export function yieldToBrowser():Promise<void>{return new Promise(resolve=>setTimeout(resolve,0));}
