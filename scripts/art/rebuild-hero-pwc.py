"""R8 hero exterior: new deck/hull/saddle/control surfaces over retained R7 jet hardware.
Original authored mesh sections, subdivided quad surfaces, real shell thickness,
cut-through ventilation, projected graphics and manufactured panel boundaries.
All coordinates remain in the existing boat's visual frame; no physics is read.
"""
import bpy,bmesh,math,json,importlib.util,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'assets/racecraft/source';OUT=ROOT/'public/models'
sys.path.insert(0,str(Path(__file__).parent))
from asset_packaging import external_images
spec=importlib.util.spec_from_file_location('art',Path(__file__).with_name('refine-hero-assets.py'));h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
B,G=h.B,h.G;PI=math.pi
bpy.ops.wm.open_mainfile(filepath=str(SRC/'pwc-r7.blend'))
# Preserve proven grip/mat geometry and the detailed physical jet assembly, not the old shells.
keep={'pump','pump casting','pump linkage','stator vane','reverse bucket','boarding hardware','handgrip','controls','foot traction','footwell tub','drain','sponson','recessed fastener'}
for o in list(bpy.context.scene.objects):
 clamp=o.name.startswith('R7 bar clamp shoe')
 straybolt=o.get('r7Part')=='recessed fastener' and not any(k in o.name for k in ['stator','steering pivot','bar clamp','grip end'])
 if o.type!='EMPTY' and ((o.get('r7Part') not in keep and not clamp) or straybolt or o.name.startswith('CAGE ') or any(q in o.name for q in ['mirror','console','transom','hood','sponson attachment'])):bpy.data.objects.remove(o,do_unlink=True)
paint=bpy.data.materials['Paint'];pearl=bpy.data.materials['Pearl ceramic silver'];carbon=bpy.data.materials['Forged carbon composite'];metal=bpy.data.materials['Brushed titanium'];rubber=bpy.data.materials['Molded traction rubber'];leather=bpy.data.materials['Perforated marine saddle'];dark=bpy.data.materials['Recess cavity'];white=bpy.data.materials['Ceramic markings'];lamp=bpy.data.materials['Ice navigation lens'];screen=bpy.data.materials['Original LCD display']
polymer=bpy.data.materials['R7 satin engineering polymer'];accent=bpy.data.materials['R7 cobalt anodized hardware']
paint.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.28
paint.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.85
pearl.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.35
graphite=h.material('R8 graphite ceramic coating',(.055,.073,.09),.30,.34,.2)
seatwall=leather.copy();seatwall.name='R8 stitched saddle side leather'
glass=h.material('R8 optical instrument shield',(.34,.49,.52),.05,.07,.9);glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.16;glass.surface_render_method='DITHERED'
parts=[o for o in bpy.context.scene.objects if o.type=='MESH'];cages=[]
def add(o,role):o['r8Part']=role;parts.append(o);return o
def cage(o):
 c=o.copy();c.data=o.data.copy();c.name='DESIGN '+o.name;bpy.context.collection.objects.link(c);c.hide_render=True;c.hide_set(True);cages.append(c)
def orient(o,outward=None):
 bm=bmesh.new();bm.from_mesh(o.data)
 if outward:
  if sum((p.normal for p in o.data.polygons),Vector()).dot(B(outward))<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
 else:bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 bm.to_mesh(o.data);bm.free();return o
def surface(name,fn,mat,nu=48,nv=96,thick=.007,out=(0,1,0),sub=1,role='formed shell'):
 v=[];uv=[];faces=[]
 for j in range(nv+1):
  for i in range(nu+1):v.append(fn(i/nu,j/nv));uv.append((i/nu,j/nv))
 for j in range(nv):
  for i in range(nu):a=j*(nu+1)+i;faces.append((a,a+1,a+nu+2,a+nu+1))
 o=orient(h.mesh(name,v,faces,mat,uv),out);cage(o);h.finish(o,sub=sub,thick=thick);return add(o,role)
def tube(name,pts,r,mat,role='fitted seal'):return add(h.tube(name,pts,r,mat,3),role)
def box(name,c,size,mat,bevel=.008,role='hardware'):return add(h.box(name,c,size,mat,bevel),role)
def val(rows,z):
 # Cubic B-spline sampling with evenly spaced longitudinal design stations.
 return h.sample(rows,z)
def loft(name,rows,mat,n=100,m=64,power=.85,role='formed shell'):
 o=h.loft(name,rows,mat,n,m,power,2);cage(o);orient(o);return add(o,role)
def outline(name,points,mat,depth=.008):
 # A closed beveled solid, used for engineered flanges rather than primitive blocks.
 vv=[(x,y,z) for x,y,z in points]+[(x,y-depth,z) for x,y,z in points];N=len(points)
 f=[tuple(range(N)),tuple(reversed(range(N,N*2)))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
 return add(h.finish(orient(h.mesh(name,vv,f,mat)),bevel=.0025),'formed bracket')

# Rebuilt cross sections: continuous V bottom, two real chines and a turned-in deck flange.
rows=[(-1.82,.47,.30,-.11),(-1.64,.65,.315,-.18),(-1.15,.72,.32,-.22),(-.48,.74,.325,-.215),(.22,.72,.335,-.14),(.83,.63,.38,.012),(1.30,.46,.425,.20),(1.64,.215,.455,.357),(1.83,.018,.458,.442)]
def hullrow(t):
 z,w,top,bottom=val(rows,t)
 top-=.032*max(0,min(1,(.65-z)/.4))
 return z,w,top,bottom
def hullpoint(a,t):
 z,w,top,bottom=hullrow(t);pts=[(0,top),(.72*w,top),(.96*w,top-.01),(w,top-.033),(.98*w,top-.065),(.925*w,bottom+.085),(.80*w,bottom+.058),(.78*w,bottom+.030),(.53*w,bottom+.02),(0,bottom),(-.53*w,bottom+.02),(-.78*w,bottom+.030),(-.80*w,bottom+.058),(-.925*w,bottom+.085),(-.98*w,top-.065),(-w,top-.033),(-.96*w,top-.01),(-.72*w,top),(0,top)]
 q=h.sample(pts,a);return(q[0],q[1],z)
lower=surface('R8 continuous double-chine hull',hullpoint,pearl,144,128,.012,(0,-1,0),1)
bvh=BVHTree.FromObject(lower,bpy.context.evaluated_depsgraph_get())
# Side chine strip is integrated with the new hull, not a second complete pontoon.
for s in [-1,1]:
 def sideband(u,t,s=s):
  z,w,top,bottom=hullrow(.02+t*.95);y=top-.018-u*min(.073,(top-bottom)*.50)
  hit=bvh.ray_cast(B((s*1.2,y,z)),B((-s,0,0)),3)[0]
  return G(hit)+Vector((s*.003,0,0)) if hit else Vector((s*w,y,z))
 surface('R8 cobalt hull belt '+str(s),sideband,paint,20,120,.004,(s,0,0))
 tube('R8 continuous bonded rub rail',[(s*w,top-.014,z) for z,w,top,bottom in [hullrow(i/160) for i in range(161)]],.014,rubber)

# New high-shouldered PWC nose. The upper deck now cradles the controls rather than
# carrying a separate pole/dash. Profile stations use coherent product surface flow.
deckrows=[(.10,.41,.66,.34),(.32,.55,.81,.35),(.57,.61,.88,.36),(.82,.60,.84,.38),(1.08,.53,.72,.40),(1.34,.42,.59,.43),(1.59,.25,.49,.445),(1.81,.018,.46,.451)]
def deck(u,t):
 z,w,crown,edge=val(deckrows,t);a=abs(u)
 y=edge+(crown-edge)*(1-a*a)**.74
 y+=.018*math.exp(-((a-.60)/.14)**2)*math.sin(t*PI)**2
 return Vector((u*w,y,z))
def dn(u,t):return (deck(u+.0001,t)-deck(u-.0001,t)).cross(deck(u,t+.0001)-deck(u,t-.0001)).normalized()*-1
carrier=surface('R8 connected front deck carrier',lambda u,t:deck(-1+u*2,t)-Vector((0,.018,0)),polymer,80,128,.012)
hood=surface('R8 compound curvature service hood',lambda u,t:deck(-.49+u*.98,.018+t*.963),paint,72,128,.009)
for s in [-1,1]:
 shoulder=surface('R8 sculpted silver upper shoulder '+str(s),lambda u,t,s=s:deck(s*(.503+u*.49),.015+t*.965),pearl,40,128,.009,(s,.7,0))
 # Deep diagonal air scoop: Boolean through the formed shoulder, then a real duct.
 c=deck(s*.76,.40);n=dn(s*.76,.40);vz=Vector((0,0,1));vz=(vz-n*vz.dot(n)).normalized();uu=vz.cross(n).normalized()
 pts=[(-.058,-.235),(.058,-.195),(.058,.185),(.02,.236),(-.058,.197)]
 cutterverts=[c+uu*x+vz*z+n*d for d in [-.18,.06] for x,z in pts];N=len(pts)
 cf=[tuple(reversed(range(N))),tuple(range(N,N*2))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
 cutter=orient(h.mesh('Temporary open scoop cut',cutterverts,cf,dark))
 for target in [shoulder,carrier]:
  mod=target.modifiers.new('Through-cut air scoop','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter;h.apply(target,mod)
 bpy.data.objects.remove(cutter,do_unlink=True)
 vv=[c+uu*x+vz*z+n*d for d in [0,-.11] for x,z in pts];ff=[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]+[tuple(range(N,N*2))]
 add(h.finish(orient(h.mesh('R8 deep recessed intake duct '+str(s),vv,ff,graphite)),thick=.003),'ventilation')
 tube('R8 intake edge gasket',[c+uu*x+vz*z+n*.002 for x,z in pts+[pts[0]]],.0035,rubber)
 for j in range(8):
  z=-.17+j*.049
  surface('R8 cambered intake blade',lambda u,t,c=c,n=n,uu=uu,vz=vz,z=z:c+uu*((u-.5)*.092)+vz*(z+t*.018)+n*(-.025+.009*math.sin(u*PI)+t*.009),metal,8,8,.003,tuple(n),1,'ventilation')
 # Shoulder striping and recessed line: coherent curved panels, not floating tubes.
 surface('R8 carbon foredeck insert '+str(s),lambda u,t,s=s:deck(s*(.50+u*.105),.045+t*.70)+dn(s*(.50+u*.105),.045+t*.70)*.003,carbon,16,88,.001,(s,1,0),1,'livery')
 tube('R8 service panel shut line',[deck(s*.496,i/100)+dn(s*.496,i/100)*.001 for i in range(2,99)],.0025,dark)
 tube('R8 short inset bow lamp',[deck(s*.88,t)+dn(s*.88,t)*.006 for t in [.69,.73,.77,.81,.85]],.006,lamp,'lighting')

# New saddle/body relationship. The center body is waisted at the thighs and fans
# into the rear deck with strong diagonal side cuts instead of the old tall blue box.
spine=[(-1.52,0,.42,.035,.025),(-1.32,0,.48,.19,.115),(-1.08,0,.535,.24,.17),(-.79,0,.53,.24,.19),(-.48,0,.515,.20,.19),(-.18,0,.50,.155,.18),(.12,0,.535,.16,.20),(.34,0,.60,.25,.205),(.46,0,.63,.31,.17)]
body=loft('R8 organic waist and stern body',spine,paint,128,96,.78)
bodybvh=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
for s in [-1,1]:
 def flank(u,t,s=s):
  z=-1.34+t*1.67;yy=.34+u*(.23+.026*math.cos(t*PI));hit=bodybvh.ray_cast(B((s*.9,yy,z)),B((-s,0,0)),2)[0]
  return G(hit)+Vector((s*.004,0,0)) if hit else Vector((s*.10,yy,z))
 surface('R8 formed graphite side fairing '+str(s),flank,graphite,28,100,.004,(s,0,0),1,'side body')
 surface('R8 diagonal pearl race panel '+str(s),lambda u,t,s=s:flank(.42+u*.25,.10+t*.70,s)+Vector((s*.006,0,0)),pearl,16,72,.002,(s,0,0),1,'livery')
 # Knee contact region conforms to the upper side with a patterned flexible pad.
 surface('R8 shaped rider knee lock '+str(s),lambda u,t,s=s:flank(.58+u*.35,.49+t*.38,s)+Vector((s*.009,0,0)),rubber,24,44,.004,(s,0,0),1,'knee grip')
 for k in range(7):tube('R8 knee grip molded ribs',[flank(.62+u*.26,.53+k*.043,s)+Vector((s*.013,0,0)) for u in [0,.2,.4,.6,.8,1]],.0017,polymer)
 # Multi-layered rear shoulder extensions connect the tail to the existing footwell.
 loft('R8 rear deck shoulder '+str(s),[(-1.78,s*.42,.31,.10,.020),(-1.61,s*.40,.342,.19,.046),(-1.36,s*.34,.381,.17,.07),(-1.13,s*.29,.42,.075,.04),(-.98,s*.26,.45,.018,.018)],pearl,56,48,.73)
 tube('R8 cast passenger handhold',[(s*.25,.51,-1.06),(s*.35,.53,-1.26),(s*.40,.43,-1.51),(s*.32,.35,-1.62)],.018,graphite)
 tube('R8 integrated rear lens',[(s*.18,.38,-1.73),(s*.35,.375,-1.75),(s*.53,.35,-1.71)],.007,lamp,'lighting')
 # Recessed tail service panels and proper bolted pump access cover.
 outline('R8 transom service panel '+str(s),[(s*.12,.245,-1.806),(s*.13,.115,-1.806),(s*.51,.12,-1.79),(s*.58,.25,-1.78)],graphite)

# Ergonomic stepped race saddle: different top/side upholstery with a narrow nose,
# lower rider pocket and a pronounced rear bolster, all smoothly lofted surfaces.
seat=loft('R7_SeatDriver',[(-.91,0,.790,.15,.055),(-.77,0,.784,.191,.072),(-.54,0,.724,.18,.062),(-.30,0,.712,.164,.056),(-.07,0,.710,.137,.05),(.13,0,.679,.095,.041),(.25,0,.618,.025,.015)],leather,100,80,.81,'saddle')
rear=loft('R8 sculpted raised passenger saddle',[(-1.43,0,.673,.025,.020),(-1.31,0,.758,.169,.054),(-1.12,0,.818,.213,.065),(-.94,0,.830,.200,.060),(-.86,0,.796,.14,.035)],seatwall,88,80,.79,'saddle')
for obj in [seat,rear]:
 bv=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
 for s in [-1,1]:
  points=[]
  lo,hi=(-.79,.19) if obj==seat else (-1.31,-.90)
  for i in range(100):
   z=lo+(hi-lo)*i/99;x=s*(.11 if obj==seat else .17)*math.sin(PI*(.12+.76*i/99))
   hit=bv.ray_cast(B((x,1.2,z)),B((0,-1,0)),2)[0]
   if hit:points.append(G(hit)+Vector((0,.0015,0)))
  tube('R8 saddle recessed double stitched seam',points,.0013,white,'saddle stitching')
 # Subtle center upholstery stripes sit on the actual upper surface.
 for i in range(14):
  z=(-.71+i*.054) if obj==seat else (-1.27+i*.024);points=[]
  for x in [-.09,-.06,-.03,0,.03,.06,.09]:
   hit=bv.ray_cast(B((x,1.2,z)),B((0,-1,0)),2)[0]
   if hit:points.append(G(hit)+Vector((0,.0014,0)))
  if len(points)>1:tube('R8 saddle subtle grip emboss',points,.0011,rubber,'saddle stitching')

# New compact cockpit fascia. The steering base is buried in a fairing and the
# readable inclined LCD faces the rider. Mirrors now grow from the deck shoulders.
loft('R8 steering column integrated cowl',[(.17,0,.704,.05,.035),(.28,0,.79,.105,.095),(.39,0,.875,.137,.105),(.49,0,.935,.125,.08),(.57,0,.929,.07,.06)],graphite,64,64,.8,'cockpit')
loft('R8 blue cockpit side covers',[(.28,0,.72,.025,.025),(.40,0,.835,.135,.07),(.53,0,.861,.182,.055),(.67,0,.825,.22,.042)],paint,64,64,.8,'cockpit')
tube('R8 forged swept handlebar',[(-.49,.99953,.47436),(-.29,1.001,.486),(-.17,1.039,.53),(0,1.055,.545),(.17,1.039,.53),(.29,1.001,.486),(.49,.99953,.47436)],.0125,metal,'steering')
def display(x,z,dy=0):return(x,.967+(z-.65)*.25+dy,z)
loft('R8 integrated display binnacle',[(.56,0,.86,.12,.025),(.65,0,.901,.176,.048),(.83,0,.952,.16,.05),(.95,0,.956,.11,.03)],graphite,56,64,.67,'cockpit')
lcd=surface('R8 inclined readable LCD',lambda u,t:display((u-.5)*.267,.638+t*.195,.006),screen,4,4,.0005,(0,1,-.2),0,'display')
for uv in lcd.data.uv_layers.active.data:uv.uv=(1-uv.uv.x,1-uv.uv.y)
surface('R8 instrument anti glare lens',lambda u,t:display((u-.5)*.277,.632+t*.207,.011),glass,12,12,.001,(0,1,-.2),0,'display lens')
for s in [-1,1]:
 tube('R8 instrument protective eyebrow',[display(s*.155,.62,.012),display(s*.159,.73,.013),display(s*.135,.86,.012)],.008,polymer,'cockpit')
 for j in range(3):box('R8 sealed instrument key',display(s*.153,.65+j*.05,.015),(.014,.009,.021),rubber,.003,'controls')
 # Compact teardrop mirrors, without stems sticking above the bow.
 c=deck(s*.76,.22);tube('R8 mirror cast pedestal',[c,(s*.52,.705,.46),(s*.52,.727,.40)],.014,graphite,'mirror')
 loft('R8 mirror tapered shell '+str(s),[(.29,s*.52,.747,.025,.012),(.34,s*.52,.75,.081,.031),(.44,s*.52,.736,.075,.033),(.52,s*.51,.713,.019,.012)],graphite,48,48,.80,'mirror')
 surface('R8 rearward mirror lens '+str(s),lambda u,t,s=s:(s*(.451+u*.133),.728+t*.031,.305+t*.028),metal,24,16,.001,(0,.3,-1),1,'mirror lens')

# Projected original product markings. No licensed brand logos are copied.
def textfit(name,word,size,project,mat=white):
 cu=bpy.data.curves.new(name,'FONT');cu.body=word;cu.align_x='CENTER';cu.size=size;cu.shear=.12;cu.resolution_u=16
 o=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(o);cu.materials.append(mat);h.select([o]);bpy.ops.object.convert(target='MESH');o=bpy.context.object
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=4,use_grid_fill=True);bm.to_mesh(o.data);bm.free()
 for v in o.data.vertices:v.co=B(project(v.co.x,v.co.y))
 return add(o,'original graphics')
for s in [-1,1]:
 def product(x,y,s=s):
  z=-.67-s*x;yy=.46+y;hit=bodybvh.ray_cast(B((s*.9,yy,z)),B((-s,0,0)),2)[0]
  return G(hit)+Vector((s*.016,0,0)) if hit else Vector((s*.23,yy,z))
 textfit('R8 flank marque '+str(s),'VECTOR',.064,product)
textfit('R8 bow competition number','07',.11,lambda x,y:deck(x/.4,.75-y*.6)+dn(x/.4,.75-y*.6)*.004)
textfit('R8 bow product signature','R8 // FACTORY',.032,lambda x,y:deck(x/.35,.87-y*.6)+dn(x/.35,.87-y*.6)*.004)
# Mechanical decals, service latch and bow towing eye.
c=deck(0,.43);tube('R8 flush hood latch',[c+Vector((-.018,.006,0)),c+Vector((.018,.006,0))],.004,metal)
tube('R8 bow stainless tow eye',[(-.024,.37,1.76),(-.026,.33,1.80),(0,.32,1.82),(.026,.33,1.80),(.024,.37,1.76)],.006,metal,'hardware')
for s in [-1,1]:
 for t in [.10,.62,.92]:
  c=deck(s*.46,t);add(h.ring('R8 captive service fastener',c,.008,.008,metal,.002,'y'),'hardware')
# Existing pump geometry is now supported by a cast transom mounting yoke.
for s in [-1,1]:outline('R8 pump mounting yoke '+str(s),[(s*.16,.20,-1.80),(s*.27,.23,-1.77),(s*.26,.02,-1.88),(s*.17,.00,-1.91)],metal,.025)

sockets=[o for o in bpy.context.scene.objects if o.type=='EMPTY']
for o in parts:
 role=o.get('r8Part',o.get('r7Part','retained mechanical component'));o['r8Part']=role
 collection=bpy.data.collections.get('R8 - '+role)
 if not collection:collection=bpy.data.collections.new('R8 - '+role);bpy.context.scene.collection.children.link(collection)
 for col in list(o.users_collection):col.objects.unlink(o)
 collection.objects.link(o)
for im in bpy.data.images:
 if im.filepath:im.filepath=bpy.path.relpath(bpy.path.abspath(im.filepath),start=str(SRC))
bpy.context.scene['design']='VECTOR R8 - compound PWC deck, waisted rider body and integrated cockpit'
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'hero-pwc-r8.blend'),compress=True)
named=[o for o in parts if o.name in ['R7_Nozzle','R7_ReverseBucket','R7_FootMat_L','R7_FootMat_R','R7_Grip_L','R7_Grip_R','R7_SeatDriver']]
row=h.export('watercraft.glb',h.merge_materials([o for o in parts if o not in named],'R8_')+named+sockets)
textures=external_images(OUT/'watercraft.glb','pwc-r8/textures');row['bytes']=(OUT/'watercraft.glb').stat().st_size;row['textureBytes']=sum(i['bytes'] for i in textures)
manifest=json.loads((OUT/'manifest.json').read_text());manifest['assets']=[row if a['file']==row['file'] else a for a in manifest['assets']]
manifest['pwcRebuild']={'design':'VECTOR R8','method':'Deep exterior reconstruction; retained R7 jet, grips and footwell hardware','source':'assets/racecraft/source/hero-pwc-r8.blend','parts':len(parts),'designSurfaces':len(cages),'textures':textures,'mountsUnchanged':True}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));print('HERO_PWC_R8',json.dumps(row))
