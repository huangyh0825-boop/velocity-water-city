/** Own gestures only while a mobile race is mounted. Pointer-based controls
 * remain independent; native clicks on settings/buttons are left intact. */
export function raceTouchSurface(root:HTMLElement){
 const previous=root.getAttribute('data-touch-surface');root.dataset.touchSurface='race';
 const cancel=(event:Event)=>{if(event.cancelable)event.preventDefault();};
 const multiTouch=(event:TouchEvent)=>{if(event.touches.length>1)cancel(event);};
 const options={passive:false,capture:true};
 root.addEventListener('touchstart',multiTouch,options);root.addEventListener('touchmove',multiTouch,options);
 for(const type of ['gesturestart','gesturechange','gestureend'])root.addEventListener(type,cancel,options);
 return()=>{
  root.removeEventListener('touchstart',multiTouch,true);root.removeEventListener('touchmove',multiTouch,true);
  for(const type of ['gesturestart','gesturechange','gestureend'])root.removeEventListener(type,cancel,true);
  if(previous===null)root.removeAttribute('data-touch-surface');else root.setAttribute('data-touch-surface',previous);
 };
}
