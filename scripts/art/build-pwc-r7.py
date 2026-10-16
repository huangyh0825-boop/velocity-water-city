"""VECTOR R7: original PWC exterior reconstruction, Blender 4.5 LTS.

Reuses the previous editable scene's project-owned PBR finishes, LCD and fixed
visual mounting sockets. No old hull/cowl/seat/pump meshes are reused. Rider,
AI, physics, camera and course assets are never written by this script.
"""
import bpy,bmesh,math,json,importlib.util,struct,hashlib,re
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('hero_helpers',Path(__file__).with_name('refine-hero-assets.py'))
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
B,G=h.B,h.G;PI=math.pi
OUT=ROOT/'public/models';SRC=ROOT/'assets/racecraft/source'
parts=[];cut_records=[]

def cage(o):
 control=o.copy();control.data=o.data.copy();control.name='CAGE '+o.name;control['role']='Uncut design surface before thickness, booleans and subdivision';control_col.objects.link(control);control.hide_render=True;control.hide_set(True)

def mark(o,category):
 o['r7Part']=category;parts.append(o);return o

def interp(rows,z):
 """Shape-preserving cubic interpolation: no negative widths or overshooting bow."""
 xs=[r[0] for r in rows];i=next((k for k in range(len(xs)-1) if z<=xs[k+1]),len(xs)-2)
 i=max(0,i);t=max(0,min(1,(z-xs[i])/(xs[i+1]-xs[i])));dx=xs[i+1]-xs[i];out=[]
 for c in range(1,len(rows[0])):
  sec=[(rows[k+1][c]-rows[k][c])/(xs[k+1]-xs[k]) for k in range(len(xs)-1)]
  def slope(k):
   if k==0:return sec[0]
   if k==len(xs)-1:return sec[-1]
   if sec[k-1]*sec[k]<=0:return 0
   a=xs[k]-xs[k-1];b=xs[k+1]-xs[k];return (3*(a+b))/((2*b+a)/sec[k-1]+(b+2*a)/sec[k])
  a,b=rows[i][c],rows[i+1][c];out.append((2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*dx*slope(i)+(-2*t**3+3*t*t)*b+(t**3-t*t)*dx*slope(i+1))
 return out

def patch(name,fn,mat,nu=32,nv=48,sub=1,thickness=.008,outward=(0,1,0),category='formed shell'):
 v=[];uv=[];f=[]
 for j in range(nv+1):
  for i in range(nu+1):v.append(fn(i/nu,j/nv));uv.append((i/nu,j/nv))
 for j in range(nv):
  for i in range(nu):a=j*(nu+1)+i;f.append((a,a+nu+1,a+nu+2,a+1))
 o=h.mesh(name,v,f,mat,uv)
 if sum((p.normal for p in o.data.polygons),Vector()).dot(B(outward))<0:
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 if category=='formed shell':cage(o)
 h.finish(o,sub=sub,thick=thickness);return mark(o,category)

def solid_profile(name,rows,cross,mat,n=72,sub=2,category='formed shell'):
 v=[];uv=[];f=[];m=len(cross)
 for j in range(n+1):
  z=rows[0][0]+(rows[-1][0]-rows[0][0])*j/n;params=interp(rows,z)
  for i,fn in enumerate(cross):v.append(fn(z,*params));uv.append((i/m,j/n))
 for j in range(n):
  for i in range(m):a=j*m+i;b=j*m+(i+1)%m;f.append((a,a+m,b+m,b))
 f+=[tuple(reversed(range(m))),tuple(n*m+i for i in range(m))]
 o=h.mesh(name,v,f,mat,uv);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 if category in ['formed shell','steering shroud','instrument mounting']:cage(o)
 return mark(h.finish(o,sub=sub),category)

def tube(name,points,r,mat,cat='seals and lines',res=3):return mark(h.tube(name,points,r,mat,res),cat)
def box(name,c,size,mat,bevel=.008,cat='machined part'):return mark(h.box(name,c,size,mat,bevel),cat)
def ring(name,c,rx,ry,mat,r=.003,axis='z',cat='machined part'):return mark(h.ring(name,c,rx,ry,mat,r,axis),cat)

def annulus(name,center,profile,material,segments=80,cat='pump'):
 # profile rows are axial offset, radius; closed around the thickness section.
 v=[];uv=[];f=[];m=len(profile)
 for j,(z,r) in enumerate(profile):
  for i in range(segments):a=i/segments*2*PI;v.append((center[0]+r*math.sin(a),center[1]+r*math.cos(a),center[2]+z));uv.append((i/segments,j/m))
 for j in range(m):
  for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;c=((j+1)%m)*segments+(i+1)%segments;d=((j+1)%m)*segments+i;f.append((a,b,c,d))
 o=h.mesh(name,v,f,material,uv);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();return mark(h.finish(o,bevel=.0015),cat)

def fastener(name,p,normal,r=.009):
 n=Vector(normal).normalized();u=n.cross(Vector((0,1,0)))
 if u.length<.1:u=n.cross(Vector((0,0,1)))
 u.normalize();v=n.cross(u);verts=[];faces=[];N=6
 for radius,depth in [(r,0),(r,.007),(r*.46,.007),(r*.46,.002)]:
  for i in range(N):a=i/N*2*PI;verts.append(Vector(p)+u*math.cos(a)*radius+v*math.sin(a)*radius+n*depth)
 for j in range(3):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
 faces.append(tuple(3*N+i for i in range(N)))
 o=h.mesh(name,verts,faces,metal);h.finish(o,bevel=.0007);return mark(o,'recessed fastener')

def roundrect(w,l,r,steps=8):
 result=[]
 for cx,cy,start in [(w/2-r,l/2-r,0),(-w/2+r,l/2-r,90),(-w/2+r,-l/2+r,180),(w/2-r,-l/2+r,270)]:
  for j in range(steps+1):a=math.radians(start+j/steps*90);result.append((cx+math.cos(a)*r,cy+math.sin(a)*r))
 return result

def extrude_outline(name,outline,center,u,v,n,depth,mat,category='formed bracket'):
 vv=[];f=[];m=len(outline)
 for d in depth:
  for x,y in outline:vv.append(Vector(center)+u*x+v*y+n*d)
 for i in range(m):j=(i+1)%m;f.append((i,j,j+m,i+m))
 f +=[tuple(reversed(range(m))),tuple(m+i for i in range(m))]
 o=h.mesh(name,vv,f,mat);bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();return mark(o,category)

def texture_sidecars(path):
 """Lossless glTF packaging: keep geometry GLB below a single-file repository limit.
 No texture resampling, mesh reduction, material fallback or loader change.
 """
 data=path.read_bytes();jl=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+jl]);binary=data[28+jl:];imageviews=set();folder=path.parent/'pwc-r7/textures';folder.mkdir(parents=True,exist_ok=True);images=[]
 for image in doc.get('images',[]):
  index=image.pop('bufferView');view=doc['bufferViews'][index];imageviews.add(index);start=view.get('byteOffset',0);payload=binary[start:start+view['byteLength']]
  name=re.sub('[^a-zA-Z0-9_-]','-',image.get('name','image'))+'-'+hashlib.sha256(payload).hexdigest()[:10]+'.png'
  (folder/name).write_bytes(payload);image['uri']='pwc-r7/textures/'+name;images.append({'uri':image['uri'],'bytes':len(payload)})
 rebuilt=bytearray();views=[];mapping={}
 for i,view in enumerate(doc['bufferViews']):
  if i in imageviews:continue
  while len(rebuilt)%4:rebuilt.append(0)
  mapping[i]=len(views);v=dict(view);start=v.get('byteOffset',0);v['byteOffset']=len(rebuilt);rebuilt.extend(binary[start:start+v['byteLength']]);views.append(v)
 def remap(value):
  if isinstance(value,dict):
   for k,x in value.items():
    if k=='bufferView':value[k]=mapping[x]
    else:remap(x)
  elif isinstance(value,list):
   for x in value:remap(x)
 remap(doc);doc['bufferViews']=views;doc['buffers'][0]['byteLength']=len(rebuilt)
 encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);rebuilt+=b'\0'*((-len(rebuilt))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(rebuilt))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(rebuilt),0x004e4942)+rebuilt)
 return images

def boolean_open(target,cutter):
 mod=target.modifiers.new('True open intake cut','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;h.apply(target,mod)
 cut_records.append({'shell':target.name,'cutter':cutter.name})

bpy.ops.wm.open_mainfile(filepath=str(SRC/'hero-craft.blend'))
for o in list(bpy.context.scene.objects):
 if o.type!='EMPTY':bpy.data.objects.remove(o,do_unlink=True)
control_col=bpy.data.collections.new('DESIGN CAGES - unhide to edit surfaces');bpy.context.scene.collection.children.link(control_col);control_col.hide_render=True
paint=bpy.data.materials['Paint'];pearl=bpy.data.materials['Pearl ceramic silver'];carbon=bpy.data.materials['Forged carbon composite'];metal=bpy.data.materials['Brushed titanium'];rubber=bpy.data.materials['Molded traction rubber'];leather=bpy.data.materials['Perforated marine saddle'];dark=bpy.data.materials['Recess cavity'];white=bpy.data.materials['Ceramic markings'];light=bpy.data.materials['Ice navigation lens'];screen=bpy.data.materials['Original LCD display']
paint.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.54
pearl.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.4
polymer=h.material('R7 satin engineering polymer',(.075,.095,.116),.02,.49)
accent=h.material('R7 cobalt anodized hardware',(.035,.19,.35),.7,.30)
seat_side=leather.copy();seat_side.name='R7 graphite seat sidewall';seat_side.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.04
lens=h.material('R7 instrument optical cover',(.42,.63,.69),0,.09,.9);lens.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.14;lens.surface_render_method='DITHERED'

# All coordinates are meters in the pre-existing visual frame. Sockets are not moved.
HULL=[(-1.80,.49,.294,-.12),(-1.63,.64,.30,-.16),(-1.2,.71,.305,-.20),(-.55,.735,.308,-.19),(.15,.725,.316,-.15),(.70,.67,.353,-.04),(1.15,.55,.39,.095),(1.50,.34,.415,.25),(1.74,.075,.43,.382),(1.80,.015,.432,.412)]
cross=[]
for xx,yt in [(0,1),(.55,1),(.90,.99),(1,.93),(.995,.84),(.94,.38),(.84,.28),(.52,.08),(0,0),(-.52,.08),(-.84,.28),(-.94,.38),(-.995,.84),(-1,.93),(-.90,.99),(-.55,1)]:
 cross.append(lambda z,w,top,bottom,xx=xx,yt=yt:(xx*w,bottom+(top-bottom)*yt,z))
hull=solid_profile('R7 stepped composite running hull',HULL,cross,carbon,n=120,sub=2)
hull_bvh=BVHTree.FromObject(hull,bpy.context.evaluated_depsgraph_get())

def hull_apron(u,t,side):
 z=-1.72+t*3.38;w,top,bottom=interp(HULL,z);height=min(.105,(top-bottom)*.65);y=top-.020-(1-u)*height
 hit=hull_bvh.ray_cast(B((side*1.2,y,z)),B((-side,0,0)),3)[0]
 return G(hit)+Vector((side*.007,0,0)) if hit else Vector((side*w,y,z))

def deck(u,z):
 w,edge,bottom=interp(HULL,z);rise=interp([(.12,.39),(.42,.455),(.76,.37),(1.10,.22),(1.44,.105),(1.76,.022)],z)[0]
 a=abs(u);crown=rise*(1-a**1.65);shoulder=.026*math.exp(-((a-.69)/.14)**2)*math.sin((z-.12)/1.64*PI)**2
 return Vector((u*w*.98,edge+crown+shoulder,z))

def deck_normal(u,z):
 du=deck(u+.001,z)-deck(u-.001,z);dz=deck(u,z+.001)-deck(u,z-.001);return dz.cross(du).normalized()

# Connected foredeck: continuous support surface and separately formed service panels.
backing=patch('R7 recessed foredeck carrier',lambda u,t:deck(-1+u*2,.14+t*1.63)-Vector((0,.025,0)),dark,64,84,1,.012)
hood=patch('R7 sculpted engine service hood',lambda u,t:deck(-.51+u*1.02,.16+t*1.16),paint,48,72,2,.010)
nose=patch('R7 rounded bow access cap',lambda u,t:deck(-.51+u*1.02,1.328+t*.432),paint,48,28,2,.010)
for side in [-1,1]:
 shoulder=patch('R7 formed pearl shoulder '+str(side),lambda u,t,s=side:deck(s*(.526+u*.46),.16+t*1.60),pearl,28,88,2,.010,outward=(side,.6,0))
 # Vent uses a real solid boolean through the outer shoulder and carrier; duct is recessed.
 center=deck(side*.77,.82);normal=deck_normal(side*.77,.82);vz=Vector((0,0,1));vz=(vz-normal*vz.dot(normal)).normalized();uu=vz.cross(normal).normalized()
 outline=roundrect(.117,.48,.035,10);cutter=extrude_outline('R7 intake machining tool',outline,center,uu,vz,normal,(-.14,.08),dark,'temporary cutter')
 boolean_open(shoulder,cutter);boolean_open(backing,cutter)
 parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)
 # Four-wall duct, back cavity and individual aerodynamic vanes.
 wall=[];ff=[];m=len(outline)
 for depth,scale in [(0,1),(-.085,.83)]:
  for x,z in outline:wall.append(center+uu*x*scale+vz*z*scale+normal*depth)
 for i in range(m):j=(i+1)%m;ff.append((i,j,j+m,i+m))
 liner=mark(h.finish(h.mesh('R7 open intake liner '+str(side),wall,ff,carbon),thick=.004),'intake duct')
 extrude_outline('R7 intake shadow plenum',outline,center,uu,vz,normal,(-.091,-.089),dark,'intake duct')
 tube('R7 intake sealing lip',[center+uu*x+vz*z+normal*.001 for x,z in outline]+[center+uu*outline[0][0]+vz*outline[0][1]+normal*.001],.0035,polymer)
 for i in range(7):
  z=-.17+i*.055
  patch('R7 swept intake louvre',lambda u,t,z=z,c=center,n=normal,uu=uu,vz=vz:c+uu*((u-.5)*.088)+vz*(z+t*.020)+n*(-.020+t*.012),metal,4,4,1,.003,outward=tuple(normal),category='intake louvre')
 # Subtle dark joints follow the manufactured panels, not arbitrary floating curves.
 tube('R7 hood perimeter gasket',[deck(side*.518,z)-Vector((0,.003,0)) for z in [.17,.35,.6,.9,1.2,1.5,1.74]],.0035,dark)
 tube('R7 restrained navigation lens',[deck(side*.90,z)+deck_normal(side*.90,z)*.003 for z in [1.16,1.27,1.38,1.48]],.005,light,'lamp')
 # Outer bonded edge follows the new shorter/broader hull from transom to bow.
 rail=[]
 for i in range(97):z=-1.78+i/96*3.57;w,top,bottom=interp(HULL,z);rail.append((side*w*.998,top-.012,z))
 tube('R7 molded perimeter bumper',rail,.015,rubber)
 # Sculpted upper hull apron gives a blue waterline band and a printable product side.
 apron=patch('R7 upper hull side apron '+str(side),lambda u,t,s=side:hull_apron(u,t,s),paint,16,100,1,.004,outward=(side,0,0))
 apron['side']=side
 # Seat-supporting center body replaces the two disconnected pontoon-like old fairings.
SPINE=[(-1.52,.065,.43,.315),(-1.40,.15,.64,.31),(-1.25,.21,.72,.31),(-.85,.218,.72,.31),(-.60,.20,.68,.31),(-.30,.175,.65,.31),(.12,.16,.68,.32),(.31,.27,.70,.33)]
pcross=[]
for x,t in [(0,1),(.60,1),(.88,.90),(1.08,.60),(1.25,.18),(1.30,0),(-1.30,0),(-1.25,.18),(-1.08,.60),(-.88,.90),(-.60,1)]:pcross.append(lambda z,w,top,bottom,x=x,t=t:(x*w,bottom+(top-bottom)*t,z))
pedestal=solid_profile('R7 sculpted saddle pedestal',SPINE,pcross,paint,88,2)
pedestal_bvh=BVHTree.FromObject(pedestal,bpy.context.evaluated_depsgraph_get())
def kneepad(u,t,side):
 y=.39+t*.21;z=-.22+(u-.5)*.55*(.85+.15*math.sin(t*PI));hit=pedestal_bvh.ray_cast(B((side*.8,y,z)),B((-side,0,0)),2)[0]
 return G(hit)+Vector((side*.006,0,0)) if hit else Vector((side*.22,y,z))
for side in [-1,1]:
 # Actual footwell tub, rim and separated traction sections at the original foot height.
 def foot(u,t,s=side):
  z=-1.37+t*1.69;inner=interp([(-1.37,.315),(-.75,.275),(-.10,.30),(.32,.38)],z)[0];outer=interp(HULL,z)[0]-.045
  x=inner+(outer-inner)*u;y=.289+.055*(math.exp(-u*17)+math.exp(-(1-u)*17));return (s*x,y,z)
 patch('R7 molded recessed footwell '+str(side),foot,polymer,32,72,2,.012,outward=(0,1,0),category='footwell tub')
 for k,(z1,z2) in enumerate([(-1.31,-.75),(-.73,.20)]):
  x0=.39 if k==0 else .375;xx=.63
  mat=patch(('R7_FootMat_L' if side<0 else 'R7_FootMat_R')+(' rear' if k==0 else ''),lambda u,t,s=side,a=z1,b=z2,x0=x0,xx=xx:(s*(x0+(xx-x0)*u),.316+.003*math.sin(u*PI),a+(b-a)*t),rubber,20,44,1,.008,category='foot traction')
  for j in range(13 if k==0 else 19):
   z=z1+.026+j*(z2-z1-.052)/(12 if k==0 else 18)
   tube('R7 molded traction chevron',[(side*x0,.320,z-.013),(side*((x0+xx)/2),.323,z+.016),(side*xx,.320,z-.013)],.0018,polymer,'foot traction',1)
 for z in [-1.26,-.79,.12]:
  ring('R7 footwell drain bezel',(side*.65,.305,z),.014,.014,metal,.002,'y','drain');box('R7 drain recess',(side*.65,.297,z),(.020,.004,.020),dark,.006,'drain')
 # Knee-lock pad is seated on the center pedestal, with an articulated shaped face.
 patch('R7 shaped knee grip '+str(side),lambda u,t,s=side:kneepad(u,t,s),rubber,24,32,2,.004,outward=(side,.1,0),category='knee grip')
 for j in range(5):tube('R7 knee grip transverse emboss',[kneepad(u,.18+j*.15,side)+Vector((side*.003,0,0)) for u in [.08,.30,.5,.70,.92]],.0015,polymer,'knee grip',2)
 # Proper external sponsons and slotted mounting shoes, no gameplay collider added.
 fin=solid_profile('R7 adjustable stern sponson '+str(side),[(-1.49,.018,.04),(-1.37,.055,.07),(-.90,.052,.035),(-.62,.015,.015)],[lambda z,w,y,s=side:(s*(interp(HULL,z)[0]+.012),y+.018,z),lambda z,w,y,s=side:(s*(interp(HULL,z)[0]+.018+w),y,z),lambda z,w,y,s=side:(s*(interp(HULL,z)[0]+.010+w*.85),y-.025,z),lambda z,w,y,s=side:(s*(interp(HULL,z)[0]-.006),y-.015,z)],carbon,40,2,'sponson')
 for z in [-1.30,-.87]:fastener('R7 sponson attachment',(side*(interp(HULL,z)[0]+.035),.08,z),(side,0,0),.011)

# The seating contact at (0,.76,-.10) remains under the unchanged rider pelvis.
driver=h.loft('R7_SeatDriver',[(-.79,0,.754,.045,.035),(-.66,0,.766,.172,.070),(-.40,0,.725,.177,.063),(-.08,0,.706,.145,.055),(.14,0,.675,.110,.045),(.24,0,.628,.025,.020)],leather,72,64,.65,2);mark(driver,'driver cushion')
rear=h.loft('R7 separate rear bolster',[(-1.39,0,.720,.025,.020),(-1.28,0,.758,.183,.049),(-1.06,0,.779,.211,.055),(-.86,0,.788,.195,.056),(-.79,0,.765,.065,.035)],seat_side,64,64,.62,2);mark(rear,'rear cushion')
mark(h.loft('R7 rear seat structural cradle',[(-1.43,0,.655,.035,.025),(-1.28,0,.707,.180,.040),(-1.06,0,.722,.208,.031),(-.87,0,.733,.19,.030),(-.77,0,.711,.064,.024)],carbon,56,48,.65,2),'seat mounting cradle')
driver_bvh=BVHTree.FromObject(driver,bpy.context.evaluated_depsgraph_get());rear_bvh=BVHTree.FromObject(rear,bpy.context.evaluated_depsgraph_get())
def seat_top(x,z,bvh):
 hit=bvh.ray_cast(B((x,1.3,z)),B((0,-1,0)),2)[0]
 return G(hit)+Vector((0,.0018,0)) if hit else Vector((x,.75,z))
def seat_seam(knots,bvh):
 result=[]
 for a,b in zip(knots,knots[1:]):
  for i in range(16):t=i/16;result.append(seat_top(a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t,bvh))
 result.append(seat_top(*knots[-1],bvh));return result
for side in [-1,1]:
 tube('R7 seat molded side seam',seat_seam([(side*x,z) for x,z in [(.02,-1.365),(.15,-1.26),(.195,-1.05),(.13,-.85)]],rear_bvh),.0018,white,'saddle seam')
 tube('R7 driver cushion stitched edge',seat_seam([(side*x,z) for x,z in [(.07,-.69),(.15,-.52),(.15,-.25),(.12,-.05),(.07,.15)]],driver_bvh),.0017,white,'saddle seam')
 for i in range(14):
  z=-.56+i*.044;w=.135 if z<-.25 else .11;tube('R7 seat traction emboss',[seat_top(-w+k/24*w*2,z,driver_bvh) for k in range(25)],.0012,polymer,'saddle seam',1)
 # Boardable transom, structural handles and compact tail-lamp lenses.
 patch('R7 rear boarding platform '+str(side),lambda u,t,s=side:(s*(.27+u*.35),.308+.015*u,-1.75+t*.34),pearl,24,24,2,.018,category='stern deck')
 pad=box('R7 rear deck traction insert',(side*.43,.334,-1.63),(.27,.015,.25),rubber,.018,'stern deck')
 for j in range(8):tube('R7 rear deck traction ribs',[(side*.32,.345,-1.73+j*.027),(side*.54,.345,-1.73+j*.027)],.0017,polymer,'stern deck',1)
 tube('R7 molded passenger grab rail',[(side*.22,.49,-1.20),(side*.32,.52,-1.30),(side*.39,.48,-1.48),(side*.34,.38,-1.55)],.019,polymer,'boarding hardware')
 box('R7 grab rail mounting pad',(side*.34,.365,-1.55),(.09,.04,.09),carbon,.015,'boarding hardware');fastener('R7 grab handle mounting bolt',(side*.34,.39,-1.55),(0,1,0),.008)
 tube('R7 stern light lens',[(side*.23,.38,-1.72),(side*.39,.37,-1.74),(side*.53,.36,-1.72)],.008,light,'lamp')

# Cast steering bridge and sculpted riser cowling cover the old exposed pole.
bridge_rows=[(.18,.03,.75,.71),(.27,.055,.84,.73),(.36,.073,.96,.79),(.44,.10,1.034,.89),(.51,.12,1.047,.974),(.56,.035,1.036,1.00)]
bridge_cross=[]
for x,t in [(0,1),(.78,1),(1,.82),(1,.2),(.65,0),(-.65,0),(-1,.2),(-1,.82),(-.78,1)]:bridge_cross.append(lambda z,w,top,bottom,x=x,t=t:(x*w,bottom+(top-bottom)*t,z))
bridge=solid_profile('R7 cast steering bridge',bridge_rows,bridge_cross,carbon,56,2,'steering shroud')
tube('R7 visible steering shaft',[(0,.75,.27),(0,1.03,.50)],.017,metal,'steering')
for side in [-1,1]:fastener('R7 tilt adjustment pivot',(side*.095,.92,.39),(side,0,0),.014)
tube('R7 swept aluminium race bar',[(-.49,.99953,.47436),(-.30,1.001,.486),(-.19,1.039,.53),(0,1.055,.545),(.19,1.039,.53),(.30,1.001,.486),(.49,.99953,.47436)],.0125,metal,'steering')
for side in [-1,1]:
 grip=tube('R7_Grip_L' if side<0 else 'R7_Grip_R',[(side*.337,.99953,.47436),(side*.489,.99953,.47436)],.0205,rubber,'handgrip')
 for j in range(23):ring('R7 diamond grip collar',(side*(.344+j*.0061),.99953,.47436),.0207,.0207,polymer,.0011,'x','handgrip')
 ring('R7 grip end weight',(side*.491,.99953,.47436),.020,.020,accent,.006,'x','handgrip');fastener('R7 grip end screw',(side*.498,.99953,.47436),(side,0,0),.007)
 box('R7 sealed multifunction control',(side*.306,1.013,.491),(.046,.059,.066),polymer,.012,'controls')
 box('R7 control switch face',(side*.306,1.043,.482),(.024,.006,.028),carbon,.005,'controls')
 tube('R7 positive feel throttle blade',[(side*.319,.976,.495),(side*.351,.953,.501),(side*.438,.951,.501)],.0045,metal,'controls')
 tube('R7 flexible steering loom',[(side*.302,.989,.524),(side*.22,.953,.56),(side*.12,.905,.51),(side*.07,.94,.44)],.004,carbon,'controls')
 box('R7 bar clamp shoe',(side*.077,1.035,.54),(.085,.058,.066),carbon,.009,'steering')
 for z in [.518,.562]:fastener('R7 recessed bar clamp bolt',(side*.077,1.067,z),(0,1,0),.006)

def dash(x,z,yoff=0):return (x,.857+(z-.54)*.37+yoff,z)
# Sculpted console, true inclined display, layered bezel and an optical cover.
dashoutline=roundrect(.35,.275,.045,12)
du=Vector((1,0,0));dv=Vector((0,.37,1)).normalized();dn=du.cross(dv).normalized()
if dn.y<0:dn=-dn
console=extrude_outline('R7 instrument clamshell',dashoutline,Vector(dash(0,.675,-.035)),du,dv,dn,(-.065,.020),polymer,'instrument console');h.finish(console,bevel=.006)
bezel=extrude_outline('R7 raised display bezel',roundrect(.313,.23,.024,10),Vector(dash(0,.675)),du,dv,dn,(-.006,.005),carbon,'instrument console');h.finish(bezel,bevel=.003)
points=[dash(-.134,.58,.009),dash(.134,.58,.009),dash(.134,.77,.009),dash(-.134,.77,.009)]
panel=mark(h.mesh('R7 LCD bonded screen',points,[(0,3,2,1)],screen,[(1,0),(0,0),(0,1),(1,1)]),'display')
mark(h.mesh('R7 optical display lens',[dash(-.14,.576,.012),dash(.14,.576,.012),dash(.14,.774,.012),dash(-.14,.774,.012)],[(0,3,2,1)],lens,[(1,0),(0,0),(0,1),(1,1)]),'display lens')
for side in [-1,1]:
 for j in range(3):
  pos=dash(side*.157,.605+j*.052,.012);box('R7 tactile console key',pos,(.014,.009,.023),rubber,.003,'controls')
 # Aerodynamic mirror has a real support arm and a framed reflective surface.
 tube('R7 mirror structural neck',[deck(side*.73,.63),(side*.49,.636,.61),(side*.50,.645,.65)],.012,carbon,'mirror')
 mirror=mark(h.loft('R7 swept mirror housing',[ (.36,side*.50,.755,.045,.016),(.40,side*.50,.760,.078,.032),(.51,side*.50,.758,.067,.032),(.56,side*.50,.752,.035,.014)],carbon,32,40,.65,2),'mirror')
 for q in mirror.data.vertices:q.co+=B((0,-.11,.18))
 patch('R7 mirror glass',lambda u,t,s=side:(s*(.445+u*.108),.649+t*.032,.554+t*.055),metal,16,12,1,.001,outward=(0,.4,-1),category='mirror')

# Move the complete instrument assembly forward on a fitted plinth so the bar cannot hide it.
for o in parts:
 if o['r7Part'] in ['instrument console','display','display lens'] or o.name.startswith('R7 tactile console key'):
  o.data.transform(o.matrix_basis);o.matrix_basis=Matrix.Identity(4)
  for q in o.data.vertices:q.co.x*=.82;q.co+=B((0,-.045,.235))
plinth_rows=[(.73,.045,.765,.72),(.82,.137,.818,.715),(1.02,.132,.892,.64),(1.085,.035,.85,.61)]
solid_profile('R7 dashboard mounting plinth',plinth_rows,bridge_cross,carbon,48,2,'instrument mounting')

# Bow service cap and an actual recessed latch, aligned to the sculpted hood surface.
capcenter=deck(0,1.02);normal=deck_normal(0,1.02);u=Vector((1,0,0));v=normal.cross(u).normalized()
for radius,depth,mat in [(.041,.004,dark),(.031,.008,metal)]:tube('R7 bow fuel cap rim',[capcenter+u*math.cos(a)*radius+v*math.sin(a)*radius+normal*depth for a in [i/64*2*PI for i in range(65)]],.003,mat,'service cap')
tube('R7 flush fuel cap latch',[capcenter+u*x+normal*.011 for x in [-.017,.017]],.004,carbon,'service cap')
for side in [-1,1]:
 for z in [.31,1.46]:p=deck(side*.45,z);fastener('R7 captive hood screw',p+deck_normal(side*.45,z)*.003,deck_normal(side*.45,z),.007)

# Pump: solid cast housings with real bores, guide vanes and a stowed reverse bucket.
annulus('R7 pump stator housing',(0,.04,-1.91),[(.20,.165),(.12,.165),(-.02,.147),(-.05,.145),(-.05,.122),(.02,.125),(.18,.139),(.20,.139)],metal)
nozzle=annulus('R7_Nozzle',(0,.04,-2.06),[(.075,.150),(.02,.153),(-.08,.130),(-.143,.125),(-.143,.108),(-.08,.111),(.02,.131),(.075,.131)],metal)
annulus('R7 nozzle outlet wear ring',(0,.04,-2.204),[(.009,.128),(-.002,.128),(-.002,.106),(.009,.106)],accent)
for j in range(8):
 a=j/8*2*PI
 tube('R7 stator casting rib',[(.166*math.sin(a),.04+.166*math.cos(a),-1.73),(.159*math.sin(a),.04+.159*math.cos(a),-1.89)],.007,polymer,'pump casting')
 fastener('R7 stator flange bolt',(.161*math.sin(a),.04+.161*math.cos(a),-1.935),(0,0,-1),.008)
 # Cambered solid blade, not radial wire spokes.
 patch('R7 fixed stator guide blade',lambda u,t,a=a:(math.sin(a+.16*t)*(.026+u*.088),.04+math.cos(a+.16*t)*(.026+u*.088),-2.112+t*.033),metal,12,12,1,.003,outward=(0,0,-1),category='stator vane')
mark(h.ellipsoid('R7 machined stator hub',(0,.04,-2.102),(.027,.027,.041),metal),'pump')
for side in [-1,1]:
 # Cast pivot fork and the polished actuator rod are legible from the rear quarter.
 fork=extrude_outline('R7 reverse pivot fork',roundrect(.085,.18,.015,8),Vector((side*.183,.14,-1.92)),Vector((0,1,0)),Vector((0,0,1)),Vector((side,0,0)),(-.018,.018),polymer,'pump linkage');h.finish(fork,bevel=.003)
 fastener('R7 steering pivot cap',(side*.204,.15,-1.945),(side,0,0),.017)
 tube('R7 steering actuator cylinder',[(side*.23,.16,-1.70),(side*.23,.16,-1.85)],.018,polymer,'pump linkage')
 tube('R7 polished actuator ram',[(side*.23,.16,-1.84),(side*.19,.16,-2.04)],.007,metal,'pump linkage')
 tube('R7 sealed control cable',[(side*.24,.15,-1.69),(side*.30,.23,-1.63),(side*.30,.28,-1.51)],.004,rubber,'pump linkage')
 fastener('R7 transom mount bolt',(side*.28,.21,-1.79),(0,0,-1),.010)
 ring('R7 transom drain cap',(side*.36,.17,-1.80),.021,.021,polymer,.006,'z','drain')
bucket=patch('R7_ReverseBucket',lambda u,t:(.192*math.sin(-1.28+u*2.56),.128+.166*math.cos(-1.28+u*2.56),-1.96-t*.235-.018*math.cos(-1.28+u*2.56)),polymer,64,28,2,.009,outward=(0,1,0),category='reverse bucket')
for j in [-1,0,1]:tube('R7 reverse bucket cast rib',[(j*.10,.25,-1.99),(j*.105,.285,-2.08),(j*.10,.26,-2.19)],.005,metal,'pump linkage')
 # Folded boarding step remains below the clear jet passage.
tube('R7 folding reboarding step',[(-.35,.10,-1.78),(-.34,-.075,-1.87),(-.28,-.095,-2.18),(.28,-.095,-2.18),(.34,-.075,-1.87),(.35,.10,-1.78)],.014,metal,'boarding hardware')
box('R7 step rubber tread',(0,-.095,-2.17),(.42,.035,.07),rubber,.012,'boarding hardware')

# Original product livery is conformed to the surfaces, with correct outward text orientation.
def surface_text(name,word,size,center,project,mat=white,shear=.1):
 cu=bpy.data.curves.new(name,'FONT');cu.body=word;cu.align_x='CENTER';cu.size=size;cu.shear=shear;cu.resolution_u=12;cu.extrude=0
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);cu.materials.append(mat);h.select([o]);bpy.ops.object.convert(target='MESH');o=bpy.context.object
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=3,use_grid_fill=True);bm.to_mesh(o.data);bm.free()
 for q in o.data.vertices:q.co=B(project(q.co.x,q.co.y))
 return mark(o,'original product graphics')
for side in [-1,1]:
 apron=next(o for o in parts if o.name=='R7 upper hull side apron '+str(side));bvh=BVHTree.FromObject(apron,bpy.context.evaluated_depsgraph_get())
 def labelpos(x,y,s=side,bvh=bvh):
  z=-.64-s*x;yy=.220+y;hit=bvh.ray_cast(B((s*1.1,yy,z)),B((-s,0,0)),2)[0]
  return G(hit)+Vector((s*.002,0,0)) if hit else Vector((s*(interp(HULL,z)[0]+.001),yy,z))
 surface_text('R7 VECTOR side marque '+str(side),'VECTOR',.079,None,labelpos)
 surface_text('R7 side racing designation '+str(side),'R7 // RACE',.032,None,lambda x,y,s=side,bvh=bvh:G(bvh.ray_cast(B((s*1.1,.201+y,-.64-s*x)),B((-s,0,0)),2)[0])+Vector((s*.003,0,0)))
 # Angled engineered livery stripe is another fitted surface, not a floating cube.
 patch('R7 pearl flank livery '+str(side),lambda u,t,s=side:hull_apron(.85-u*.25,(.02+t*.51+u*.07+1.72)/3.38,s)+Vector((s*.006,0,0)),pearl,8,32,1,.001,outward=(side,0,0),category='original product graphics')
surface_text('R7 bow racing number','07',.12,None,lambda x,y:deck(x/.54,1.34-y)+deck_normal(x/.54,1.34-y)*.004)
surface_text('R7 bow marque','VECTOR / R7',.035,None,lambda x,y:deck(x/.54,1.55-y)+deck_normal(x/.54,1.55-y)*.004)
box('R7 stern manufacturer plate',(0,.221,-1.808),(.31,.080,.009),polymer,.008,'original product graphics')
surface_text('R7 stern identity','VECTOR',.047,None,lambda x,y:(-x,.203+y,-1.817))

# Preserve all original visual mounts, including the old jet effect location.
sockets=[o for o in bpy.context.scene.objects if o.type=='EMPTY']
for o in sockets:o['r7Mount']=True
features={}
for o in parts:features[o['r7Part']]=features.get(o['r7Part'],0)+1
bpy.context.scene['r7Design']='Original VECTOR R7 PWC; continuous broad bow, connected saddle body, open ducts, cast jet system'
bpy.context.scene['r7Features']=json.dumps(features)
for o in parts:
 name='ASSEMBLY - '+o['r7Part'];collection=bpy.data.collections.get(name)
 if not collection:collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
 for old_collection in list(o.users_collection):old_collection.objects.unlink(o)
 collection.objects.link(o)
# The editable file references the already tracked original-resolution maps relatively.
# This is source packaging, not a change in pixel data or material quality.
for image in bpy.data.images:
 absolute=Path(bpy.path.abspath(image.filepath)) if image.filepath else None
 if image.packed_file and absolute and absolute.is_file() and 'assets/racecraft/textures' in absolute.as_posix():
  image.unpack(method='REMOVE');image.filepath=bpy.path.relpath(str(absolute),start=str(SRC))
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'pwc-r7.blend'),compress=True)
# Keep selected interface parts named for inspection, without introducing a new LOD system.
named=[o for o in parts if o.name in ['R7_Nozzle','R7_ReverseBucket','R7_FootMat_L','R7_FootMat_R','R7_Grip_L','R7_Grip_R','R7_SeatDriver']]
rest=[o for o in parts if o not in named]
batch=h.merge_materials(rest,'R7_');row=h.export('watercraft.glb',batch+named+sockets)
textures=texture_sidecars(OUT/'watercraft.glb');row['bytes']=(OUT/'watercraft.glb').stat().st_size;row['textureBytes']=sum(t['bytes'] for t in textures)
manifest=json.loads((OUT/'manifest.json').read_text())
manifest['method']='Original VECTOR R7 PWC rebuild with retained CC0-derived anatomical rider'
for i,r in enumerate(manifest['assets']):
 if r['file']==row['file']:manifest['assets'][i]=row
manifest['pwcRebuild']={'design':'VECTOR R7','method':'Original Blender surface and industrial assembly reconstruction','source':'assets/racecraft/source/pwc-r7.blend','partCounts':features,'openIntakeCuts':len(cut_records),'mountsUnchanged':True,'textures':textures}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));print('PWC_R7',json.dumps(row));print('PARTS',json.dumps(features))
