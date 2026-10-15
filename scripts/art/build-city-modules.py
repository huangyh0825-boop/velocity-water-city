"""Original Blender district module library, separate from the existing waterfront assets.
Run Blender --background --factory-startup --python scripts/art/build-city-modules.py.
Curved/editable meshes, extruded annuli, bevels and shared licensed PBR materials.
"""
import bpy, math, json, runpy
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'assets/city-sample/source';OUT=ROOT/'public/models/city-sample'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
with bpy.data.libraries.load(str(SOURCE/'waterfront-sample.blend'),link=False) as (available,target):
    target.materials=[n for n in available.materials if n in ['Coated architectural alloy','CC0_Metal032','CC0_Concrete034','Blue laminated glazing','Silver blue glazing','Graphite joint seals','Amber anodized alloy','Cyan guide lights','Occupied window interiors']]
coat=bpy.data.materials['Coated architectural alloy'];metal=bpy.data.materials['CC0_Metal032'];glass=bpy.data.materials['Blue laminated glazing'];silver=bpy.data.materials['Silver blue glazing'];stone=bpy.data.materials['CC0_Concrete034'];dark=bpy.data.materials['Graphite joint seals'];amber=bpy.data.materials['Amber anodized alloy'];light=bpy.data.materials['Cyan guide lights']
warm=bpy.data.materials['Occupied window interiors']
active=None;groups=[];metadata={}

def xyz(x,h,z):return (x,-z,h)
def oval(rx,rz,n=24,x=0,z=0):return [(x+rx*math.cos(i*math.tau/n),z+rz*math.sin(i*math.tau/n)) for i in range(n)]
def soft(rx,rz,n=24,x=0,z=0):return [(x+rx*math.copysign(abs(math.cos(i*math.tau/n))**.5,math.cos(i*math.tau/n)),z+rz*math.copysign(abs(math.sin(i*math.tau/n))**.5,math.sin(i*math.tau/n))) for i in range(n)]
def polygon(name,verts,faces,mat,uv=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();o=bpy.data.objects.new(name,data);active.objects.link(o);data.materials.append(mat)
    layer=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        p.use_smooth=True;coords=[uv(data.loops[i].vertex_index) for i in p.loop_indices] if uv else [];wrap=uv is not None and max(c[0] for c in coords)-min(c[0] for c in coords)>1
        for i in p.loop_indices:
            q=data.vertices[data.loops[i].vertex_index].co
            if uv:
                u,v=uv(data.loops[i].vertex_index);layer.data[i].uv=(u+2 if wrap and u<1 else u,v)
            elif abs(p.normal.z)>.5:layer.data[i].uv=(q.x/4,q.y/4)
            elif abs(p.normal.x)>abs(p.normal.y):layer.data[i].uv=(q.y/4,q.z/4)
            else:layer.data[i].uv=(q.x/4,q.z/4)
    return o
def edge(o,width=.07):
    if width:
        m=o.modifiers.new('Edge machining','BEVEL');m.width=width;m.segments=1;m.harden_normals=True
        m=o.modifiers.new('Architectural normals','WEIGHTED_NORMAL');m.keep_sharp=True
    return o
def slab(name,outline,lo,hi,mat=coat,bevel=.07):
    n=len(outline);o=polygon(name,[xyz(x,h,z) for h in [lo,hi] for x,z in outline],[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)
    for p in o.data.polygons[:2]:p.use_smooth=False
    return edge(o,bevel)
def shell(name,rings,mat=glass):
    n=len(rings[0][1]);return polygon(name,[xyz(x,h,z) for h,p in rings for x,z in p],[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(rings)-1) for i in range(n)],mat,lambda i:((i%n)/n*2,(rings[i//n][0])*.035))
def tube(name,points,r=.08,mat=metal,closed=False):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=r;d.bevel_resolution=0;s=d.splines.new('POLY');s.points.add(len(points)-1)
    for p,(x,h,z) in zip(s.points,points):p.co=(*xyz(x,h,z),1)
    s.use_cyclic_u=closed;o=bpy.data.objects.new(name,d);active.objects.link(o);d.materials.append(mat);return o
def band(name,p,h,r=.09,mat=coat):return tube(name,[(x,h,z) for x,z in p],r,mat,True)
def annulus(name,outer,inner,h,thick,mat=coat):
    n=len(outer);verts=[xyz(x,hh,z) for hh in [h,h+thick] for shape in [outer,inner] for x,z in shape];faces=[]
    for i in range(n):
        j=(i+1)%n;faces.extend([(i,j,j+n,i+n),(i+2*n,i+3*n,j+3*n,j+2*n),(i,j,j+2*n,i+2*n),(i+n,i+3*n,j+3*n,j+n)])
    return edge(polygon(name,verts,faces,mat),.06)
def roofkit(rx,rz,h):
    for x in [-rx*.45,rx*.45]:
        slab('Sealed rooftop exchanger',soft(1.2,2.1,12,x,0),h,h+1.35,dark)
        for z in [-1.2,0,1.2]:tube('Roof fins',[(x-1.1,h+1.4,z),(x+1.1,h+1.4,z)],.07,metal)
    tube('Roof communication mast',[(0,h,rz*.5),(0,h+4,rz*.5)],.10,metal)
def entrance(rx,rz,h=3):
    slab('Layered entry granite sill',soft(rx*.66,2,16,0,-rz-.35),.25,.48,stone)
    slab('Recessed vestibule',soft(rx*.55,1.1,12,0,-rz-.45),.3,h,dark)
    shell('Set-back lobby glazing',[(.55,soft(rx*.48,.9,16,0,-rz-.6)),(h-.25,soft(rx*.48,.9,16,0,-rz-.6))],silver)
    for x in [-rx*.48,-rx*.17,rx*.17,rx*.48]:tube('Entry door frame',[(x,.48,-rz-1.53),(x,h-.22,-rz-1.53)],.045,metal)
    tube('Lobby warm soffit',[(-rx*.44,h-.3,-rz-1.55),(rx*.44,h-.3,-rz-1.55)],.035,warm)
    for x in [-rx*.55,rx*.55]:tube('Entry handrail',[(x,.5,-rz-2.2),(x,1.05,-rz-2.2),(x,1.05,-rz-.8)],.035,metal)
    slab('Entry cantilever',soft(rx*.65,2,16,0,-rz-.45),h,h+.22,coat)
    tube('Entry light',[(rx*-.55,h-.15,-rz-1.3),(rx*.55,h-.15,-rz-1.3)],.055,light)

def spindle():
    shape=lambda t:oval(9*(1-.4*t),11*(1-.22*t),24,3*t*t,0)
    rings=[(2+58*i/12,shape(i/12)) for i in range(13)];slab('Office podium',soft(11,13),.25,2,stone);shell('Tapered office glazing',rings)
    for h,p in rings:band('Office storey bands',p,h)
    for i in range(0,24,4):tube('Curved facade fin',[(p[i][0],h,p[i][1]) for h,p in rings],.11,metal)
    slab('Spindle roof',rings[-1][1],60,61,coat);roofkit(7,9,61);entrance(9,12)
def residence():
    slab('Residential entry podium',soft(12,10),.25,2,stone)
    rings=[]
    for level in range(10):
        t=level/9;p=soft(10*(1-.3*t),8*(1-.15*t),24,2*t,0);rings.append((2+level*5,p));band('Balcony nosing',p,2+level*5,.17,coat)
        if level>0:annulus('Cantilever balcony',soft(11*(1-.3*t),9*(1-.15*t),24,2*t),p,2+level*5,.18,coat)
    shell('Apartment facade',rings,silver);slab('Residential roof',rings[-1][1],47,48,dark);roofkit(7,7,48);entrance(10,10)
def split():
    slab('Twin office shared base',soft(13,12),.25,2,stone)
    for side,height in [(-1,74),(1,60)]:
        rings=[(2+height*i/12,oval(5.5*(1-.25*i/12),10*(1-.25*i/12),24,side*(6+2*i/12),0)) for i in range(13)]
        shell('Offset twin office glass',rings,silver if side<0 else glass)
        for h,p in rings:band('Twin tower band',p,h)
        for i in [0,6,12,18]:tube('Twin vertical blade',[(p[i][0],h,p[i][1]) for h,p in rings],.12,coat)
        slab('Twin tapered crown',rings[-1][1],height+2,height+3,coat)
    slab('Elevated twin link',soft(7,2,16),32,33,metal);roofkit(6,8,76);entrance(13,12)
def research():
    outer=oval(13,12,32);inner=oval(6,5,32)
    annulus('Open research courtyard plinth',outer,inner,.25,1.3,stone)
    for h in [1.5,6,10.5,15]:annulus('Research courtyard terraces',outer,inner,h,.35,coat)
    shell('Research outer glazing',[(1.5,outer),(15,oval(11.5,10.5,32))],glass);shell('Research inner court',[(1.5,inner),(15,inner)],silver)
    for i in range(0,32,4):tube('Campus structural blade',[(outer[i][0],1.5,outer[i][1]),(outer[i][0]*.89,15,outer[i][1]*.89)],.14,metal)
    roofkit(8,9,15.4);entrance(10,12)
def data():
    p=soft(10,12,16);slab('Data foundation',soft(11,13,16),.25,1.4,stone);slab('Data sealed angled shell',p,1.4,12,dark)
    shell('Data sloped rooftop',[(12,p),(15,soft(7.5,10,16))],coat)
    for side in [-1,1]:
        for z in range(-9,10,3):tube('Data ventilation louvres',[(side*10,2,z),(side*10,10,z)],.14,metal)
    for x in [-4,0,4]:
        band('Cooling exhaust lip',oval(1.5,1.5,16,x),15.2,.18,metal);slab('Cooling intake recess',oval(1.3,1.3,16,x),14.9,15.1,dark,0)
    entrance(8,12,4);tube('Data power spine',[(-8,1,-12.05),(-8,10,-12.05)],.09,amber)
def retail():
    p=[(math.cos(i*math.tau/32)*(12+2*math.sin(i*math.tau/32)),math.sin(i*math.tau/32)*8) for i in range(32)]
    slab('Retail sill',p,.25,1,stone);shell('Curved retail arcade',[(1,p),(7,p)],glass);slab('Retail crescent canopy',[(x*1.13,z*1.2) for x,z in p],7,7.55,coat)
    band('Retail amber canopy trim',[(x*1.13,z*1.2) for x,z in p],7.1,.07,amber)
    for i in range(0,32,4):tube('Retail portal jamb',[(p[i][0],1,p[i][1]),(p[i][0],7,p[i][1])],.12,metal)
    slab('Retail upper pavilion',soft(6,5),7.55,11,silver);slab('Retail upper terrace roof',soft(6.5,5.5),11,11.45,coat);entrance(10,8)
def transit():
    slab('Station foundation',soft(11,13),.25,1,stone)
    for x in [-8,8]:
        tube('Station sculpted support',[(x,1,-9),(x,19,-9),(x*.8,22,-9)],.5,metal);tube('Station rear support',[(x,1,9),(x,19,9),(x*.8,22,9)],.5,metal)
    slab('Elevated station platform',soft(11,13),21,21.7,coat);shell('Station glazed concourse',[(21.7,soft(9.5,12)),(26,soft(9.5,12))],silver)
    # Swept arched canopy shell, open at both ends.
    profile=[(-12+24*i/16,26+4*math.sin(math.pi*i/16)) for i in range(17)]
    verts=[xyz(x,h,z) for z in [-14,14] for x,h in profile];faces=[(i,i+1,i+18,i+17) for i in range(16)];o=polygon('Transit vaulted canopy',verts,faces,coat);m=o.modifiers.new('Canopy thickness','SOLIDIFY');m.thickness=.22
    for z in [-14,0,14]:tube('Transit roof rib',[(x,h+.1,z) for x,h in profile],.12,metal)
    shell('Station lift core',[(1,soft(2,3)),(21,soft(2,3))],glass);entrance(6,13)
def dock():
    slab('Dock repair deck',soft(7,11,20),.25,.8,metal)
    # U-shaped workshop leaves an actual open maintenance bay.
    annulus('Dock workshop wall',soft(6.5,7,20,0,3),soft(4.5,5.5,20,0,3),.8,4.5,dark)
    slab('Dock shelter canopy',soft(7,8,20,0,3),4.5,5.1,coat)
    for x in [-5,5]:tube('Service gantry',[(x,.8,-7),(x,7,-7),(0,7,-7)],.2,metal)
    tube('Gantry suspended hoist',[(0,7,-7),(0,5,-7)],.14,amber)
    for z in [-8,-5,-2]:tube('Dock embedded guide', [(-5,.82,z),(5,.82,z)],.045,light)
    for x in [-5.5,5.5]:band('Dock bollard flange',oval(.35,.35,8,x,-9),.85,.07,metal);tube('Dock mooring pin',[(x,.8,-9),(x,1.5,-9)],.13,metal)

extension=runpy.run_path(str(Path(__file__).with_name('city-module-details.py')));extension['configure'](globals())
infill=runpy.run_path(str(Path(__file__).with_name('city-module-infill.py')));infill['configure']({**globals(),**extension})
builders=[('spindle_office',spindle,12,15,65),('terrace_residence',residence,13,13,52),('split_office',split,14,15,80),('research_campus',research,14,15,20),('data_centre',data,12,15,16),('retail_hub',retail,16,11,12),('transit_station',transit,13,16,31),('drydock_service',dock,8,12,8)]+extension['BUILDERS']+infill['BUILDERS']
for name,build,rx,rz,height in builders:
    active=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(active);build();extension['refine'](name);infill['refine'](name);metadata[name]={'rx':rx,'rz':rz,'height':height}
    root=bpy.data.objects.new(name+'__near',None);active.objects.link(root)
    for o in list(active.objects):
        if o!=root:o.parent=root
    groups.append(root)
    # Source far silhouettes retain the distinctive edited outline and crown.
    near=active;active=bpy.data.collections.new(name+'_silhouette');bpy.context.scene.collection.children.link(active);far=bpy.data.objects.new(name+'__far',None);active.objects.link(far)
    if infill['far_shape'](name,rx,rz,height) or extension['far_shape'](name,rx,rz,height):pass
    elif name=='split_office':
        for side,h in [(-1,height),(1,height*.78)]:shell('Twin skyline silhouette',[(.25,oval(rx*.42,rz*.78,12,side*rx*.46)),(h,oval(rx*.3,rz*.6,12,side*rx*.54))],glass);slab('Silhouette crown',oval(rx*.3,rz*.6,12,side*rx*.54),h,h+.4,coat,0)
    else:
        rings=[]
        for i in range(4):
            t=i/3;shape=oval(rx*.82*(1-.34*t),rz*.82*(1-.2*t),12,rx*.2*t*t) if name=='spindle_office' else soft(rx*.8*(1-.25*t),rz*.8,12,rx*.1*t)
            rings.append((.25+height*t,shape))
        shell('District silhouette facade',rings,glass);slab('Silhouette roof',rings[-1][1],height+.25,height+.65,coat,0)
    for o in list(active.objects):
        if o!=far:o.parent=far
    groups.append(far)
for image in bpy.data.images:
    if image.source=='FILE' and not image.packed_file:image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'city-modules.blend'))

def bounded_decimate(obj,ratio,label):
    # Blender collapse may extrapolate boundary vertices. Keep simplified geometry
    # inside its authored footprint instead of silently expanding into neighbours.
    bounds=[(min(v.co[k] for v in obj.data.vertices),max(v.co[k] for v in obj.data.vertices)) for k in range(3)]
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new(label,'DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for v in obj.data.vertices:
        for k,(lo,hi) in enumerate(bounds):v.co[k]=max(lo,min(hi,v.co[k]))
    obj.data.validate()

# Realize runtime copies and merge each prototype by material. Sources stay editable.
runtime=bpy.data.collections.new('EXPORT_LIBRARY');bpy.context.scene.collection.children.link(runtime);runtime_roots=[];counts={}
for original in groups:
    original_name=original.name;original.name=original_name+'__source'
    name=original_name.replace('__near','').replace('__far','');tier='far' if original_name.endswith('__far') else 'near'
    root=bpy.data.objects.new(original_name+'_export',None);runtime.objects.link(root);parts=[]
    for o in original.children:
        q=o.copy();q.data=o.data.copy();q.parent=None;runtime.objects.link(q);parts.append(q)
    bpy.ops.object.select_all(action='DESELECT')
    for q in parts:q.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.convert(target='MESH')
    bymat={}
    for q in parts:q.data.validate();bymat.setdefault(q.data.materials[0],[]).append(q)
    for mat,objects in bymat.items():
        bpy.ops.object.select_all(action='DESELECT')
        for q in objects:q.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=name+'_'+tier+'_'+mat.name;objects[0].parent=root
    root.name=name+'__'+tier;runtime_roots.append(root)
    counts[root.name]=sum(len(p.vertices)-2 for o in root.children for p in o.data.polygons)
    if tier=='near':
        mid=bpy.data.objects.new(name+'__mid',None);runtime.objects.link(mid);runtime_roots.append(mid)
        for o in root.children:
            q=o.copy();q.data=o.data.copy();q.parent=mid;runtime.objects.link(q);bpy.context.view_layer.objects.active=q
            bounded_decimate(q,.45,'Middle LOD')
        counts[mid.name]=sum(len(p.vertices)-2 for o in mid.children for p in o.data.polygons)
def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for root in runtime_roots:
        root.select_set(True)
        for o in root.children:o.select_set(True)
    # A running preview must never read a partially written binary or image.
    # Stage on the same volume, then replace the public asset after export closes.
    staging=ROOT/'.qa'/'art-export';staging.mkdir(parents=True,exist_ok=True)
    staged=staging/path.name
    bpy.ops.export_scene.gltf(filepath=str(staged),export_format='GLB',use_selection=True,export_yup=True,export_normals=True)
    staged.replace(path)
export(OUT/'city-modules.glb')
# The low download keeps mid as near and actual silhouette geometry at distance.
for root in runtime_roots:
    if root.name.endswith('__near'):
        for o in root.children:
            bounded_decimate(o,.35,'Low near LOD')
for image in bpy.data.images:
    if image.size[0]>512 or image.size[1]>512:image.scale(512,512)
export(OUT/'city-modules-low.glb')
(OUT/'modules-manifest.json').write_text(json.dumps({'source':'assets/city-sample/source/city-modules.blend','modules':metadata,'triangles':counts,'standardBytes':(OUT/'city-modules.glb').stat().st_size,'lowBytes':(OUT/'city-modules-low.glb').stat().st_size},indent=2),encoding='utf-8')
print('CITY_MODULES_EXPORTED',counts)
