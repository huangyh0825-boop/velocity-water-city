"""Blender 4.5: original modular waterfront. No runtime primitive building stack.
Run blender --background --factory-startup --python scripts/art/build-city-sample.py
Editable curves/loft meshes, bevels and UV/PBR survive in .blend; atrium boolean is baked.
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'assets/city-sample/source'; TEX=ROOT/'assets/city-sample/textures'
OUT=ROOT/'public/models/city-sample'; OUT.mkdir(parents=True,exist_ok=True)
route=json.loads((SRC/'route.json').read_text(encoding='utf-8-sig'))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
collections={}
def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);collections[name]=c;return c
active=collection('01_Aster_Curve_Tower')
def attach(o):
    for c in list(o.users_collection):c.objects.unlink(o)
    active.objects.link(o);return o
def v(x,h,z):return (x,-z,h)
def material(name,color,metal=0,rough=.5):
    m=bpy.data.materials.new(name);m.use_nodes=True
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
    return m
def pbr(name,prefix,metal=False):
    m=material(name,(.7,.73,.76),.8 if metal else 0,.6);nt=m.node_tree;b=nt.nodes.get('Principled BSDF')
    for suffix,target in [('Color','Base Color'),('Roughness','Roughness'),('Metalness','Metallic')]:
        file=TEX/f'{prefix}_1K-JPG_{suffix}.jpg'
        if not file.exists():continue
        node=nt.nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(file),check_existing=True)
        if suffix!='Color':node.image.colorspace_settings.name='Non-Color'
        nt.links.new(node.outputs['Color'],b.inputs[target])
    normal=nt.nodes.new('ShaderNodeTexImage');normal.image=bpy.data.images.load(str(TEX/f'{prefix}_1K-JPG_NormalGL.jpg'),check_existing=True);normal.image.colorspace_settings.name='Non-Color'
    nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.38 if metal else .5;nt.links.new(normal.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],b.inputs['Normal'])
    return m
concrete=pbr('CC0_Concrete034', 'Concrete034');steel=pbr('CC0_Metal032','Metal032',True)
white=material('Pearl ceramic',(.76,.83,.85),.12,.34)
dark=material('Graphite joint seals',(.032,.066,.087),.35,.52)
glass=material('Blue laminated glazing',(.065,.23,.33),.48,.16)
glass2=material('Silver blue glazing',(.14,.34,.43),.4,.22)
glow=material('Cyan guide lights',(.1,.72,.88),.2,.25)
g=glow.node_tree.nodes.get('Principled BSDF');g.inputs['Emission Color'].default_value=(.1,.6,.9,1);g.inputs['Emission Strength'].default_value=.7
warm=material('Occupied window interiors',(.45,.39,.23),0,.5)
w=warm.node_tree.nodes.get('Principled BSDF');w.inputs['Emission Color'].default_value=(.3,.21,.09,1);w.inputs['Emission Strength'].default_value=.35

# Original window atlas includes tint variation, recessed panes and interior shades.
W,H=512,1024;image=bpy.data.images.new('Original curtain-wall atlas',width=W,height=H)
pixels=[]
for y in range(H):
    for x in range(W):
        xx=x%64; yy=y%64; window=x//64+y//64*8
        frame=xx<3 or yy<3;recess=xx<5 or yy<5;shade=yy>46
        if frame:c=(.42,.5,.53)
        elif recess:c=(.024,.067,.093)
        else:
            tint=.82+(window*17%11)*.035
            c=tuple(a*tint*(.74 if shade else 1) for a in (.055,.2,.29))
            if window%13==0 and 15<xx<47 and 15<yy<45:c=(.23,.25,.22)
        pixels.extend((*c,1))
image.pixels=pixels;image.filepath_raw=str(TEX/'original-curtain-wall.png');image.file_format='PNG';image.save()
tex=glass.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;glass.node_tree.links.new(tex.outputs['Color'],glass.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

def mesh(name,verts,faces,mat,uv=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);active.objects.link(o);data.materials.append(mat)
    for p in data.polygons:p.use_smooth=True
    layer=data.uv_layers.new(name='UVMap')
    for poly in data.polygons:
        for index in poly.loop_indices:
            pos=data.vertices[data.loops[index].vertex_index].co
            layer.data[index].uv=uv(data.loops[index].vertex_index) if uv else (pos.x/4,pos.y/4 if abs(poly.normal.z)>.5 else pos.z/4)
    return o
def bevel(o,width=.12,segments=3):
    mod=o.modifiers.new('Architectural edge bevel','BEVEL');mod.width=width;mod.segments=segments
    mod=o.modifiers.new('Weighted facade normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    return o
def extrude(name,outline,low,high,mat,edge=.1):
    n=len(outline);verts=[v(x,h,z) for h in [low,high] for x,z in outline]
    # Outlines are CCW in local X/Z; Blender Y reverses direction.
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return bevel(mesh(name,verts,faces,mat),edge)
def ellipse(rx,rz,n=48,cx=0,cz=0):return [(cx+math.cos(i*math.tau/n)*rx,cz+math.sin(i*math.tau/n)*rz) for i in range(n)]
def rounded(rx,rz,n=48,cx=0,cz=0):
    return [(cx+math.copysign(abs(math.cos(i*math.tau/n))**.45,math.cos(i*math.tau/n))*rx,cz+math.copysign(abs(math.sin(i*math.tau/n))**.45,math.sin(i*math.tau/n))*rz) for i in range(n)]
def curve(name,points,radius,mat,closed=False):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=8;data.bevel_depth=radius;data.bevel_resolution=2
    spl=data.splines.new('POLY');spl.points.add(len(points)-1)
    for dest,(x,h,z) in zip(spl.points,points):dest.co=(*v(x,h,z),1)
    spl.use_cyclic_u=closed;o=bpy.data.objects.new(name,data);active.objects.link(o);data.materials.append(mat);return o
def ring(name,outline,height,radius=.09,mat=steel):return curve(name,[(x,height,z) for x,z in outline],radius,mat,True)
def loft(name,rings,mat):
    n=len(rings[0][1]);verts=[v(x,h,z) for h,p in rings for x,z in p]
    faces=[(j*n+(i+1)%n,j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n) for j in range(len(rings)-1) for i in range(n)]
    return mesh(name,verts,faces,mat,lambda i:((i%n)/n*2, i//n/16))
def framed(name,rings,mat=glass,spacing=4):
    loft(name+' glazing',rings,mat)
    for i,(h,outline) in enumerate(rings):ring(name+' slab '+str(i),outline,h,.075)
    for j in range(0,len(rings[0][1]),spacing):curve(name+' vertical mullion',[(p[j][0],h,p[j][1]) for h,p in rings],.09,white)
    extrude(name+' roof',rings[-1][1],rings[-1][0],rings[-1][0]+.45,steel,.12)

# A continuous asymmetrically tapered tower, structural crown and deep facade ribs.
extrude('Aster elliptical podium',ellipse(20,17),.35,4,concrete,.35)
ring('Aster podium light',ellipse(20.1,17.1),3.6,.09,glow)
rings=[]
for floor in range(23):
    t=floor/22;shape=rounded(13*(1-.48*t*t),11*(1-.3*t),48,7*t*t,-2*t)
    rings.append((4+floor*3.6,shape))
framed('Aster',rings,glass,4)
for i in [-1,1]:curve('Aster swept crown',[(i*9*(1-t*.4)+7*t*t,6+t*88,-12*(1-t*.35)) for t in [j/24 for j in range(25)]],.35,white)
for i in range(5):extrude('Aster roof heat exchangers',rounded(1.3,2.2,16,i*2-2,0),85,86.5,dark,.16)

# Split oval volumes twisted along their height, joined by elevated glazed skywalks.
active=collection('02_Helix_Split_Tower')
extrude('Helix crescent plaza',rounded(27,19),.35,3.5,concrete,.5)
for side in [-1,1]:
    rings=[]
    for floor in range(26):
        t=floor/25;angle=side*.38*t;outline=[]
        for x,z in ellipse(8.6*(1-.22*t),13.5*(1-.17*t)):
            outline.append((x*math.cos(angle)-z*math.sin(angle)+side*(11+5*t),x*math.sin(angle)+z*math.cos(angle)))
        rings.append((3.5+floor*3.8,outline))
    framed('Helix wing',rings,glass2,6)
    for j in [0,12,24,36]:curve('Helix structural sweep',[(p[j][0],h,p[j][1]) for h,p in rings],.3,white)
for h in [34,64]:
    extrude('Helix connecting sky lobby',rounded(14,3.8,32),h,h+3.2,glass2,.2)
    ring('Helix sky lobby rim',rounded(14.2,4,32),h,.1,steel)

# Broad, stepped marina pavilion with a true boolean open roof atrium.
active=collection('03_Marina_Atrium')
extrude('Marina curved podium',rounded(31,22),.35,2.5,concrete,.45)
for level in range(3):
    rx=26-level*4;rz=17-level*3;z=-level*3;h=2.5+level*8.5
    outline=rounded(rx,rz,48,0,z)
    framed('Marina storey',[(h,outline),(h+7.7,outline)],glass,4)
    roof=extrude('Marina balcony roof',rounded(rx+1.3,rz+1.3,48,0,z),h+7.7,h+8.5,white,.2)
    if level==2:
        bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=6,depth=5,location=v(0,h+8,-6));cutter=bpy.context.object
        mod=roof.modifiers.new('Open elliptical roof atrium','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.context.view_layer.objects.active=roof;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        ring('Atrium skylight frame',ellipse(6.5,6.5,48,0,-6),h+8.7,.18,steel)
    for j in range(0,48,3):
        x,zp=outline[j];curve('Marina balcony baluster',[(x,h+8.5,zp),(x,h+9.6,zp)],.045,steel)
    ring('Marina balcony handrail',outline,h+9.6,.07)
for step in range(7):extrude('Marina terraced access stairs',rounded(12,1.3,32,0,20.5+step*.6),.35,.6+(6-step)*.27,concrete,.04)

# Bridge: bevelled deck, ribbed elliptical arch, hangers, piers, bearing joints and rail.
active=collection('04_Lumen_Bridge');bridge_z=20
extrude('Lumen tapered bridge deck',[(-32,bridge_z-5),(-24,bridge_z-4),(24,bridge_z-4),(32,bridge_z-5),(32,bridge_z+5),(24,bridge_z+4),(-24,bridge_z+4),(-32,bridge_z+5)],18.6,19.6,white,.28)
for side in [-1,1]:
    z=bridge_z+side*4.1
    arch=[(-31+62*i/64,19.5+15*math.sin(math.pi*i/64)**.78,z) for i in range(65)]
    curve('Lumen parabolic compression rib',arch,.58,white)
    curve('Lumen arch metal seam',[(x,h+.55,z) for x,h,z in arch],.065,steel)
    for i in range(2,15):
        x=-31+62*i/16;h=19.5+15*math.sin(math.pi*i/16)**.78
        curve('Lumen tension hanger',[(x,19.7,z),(x,h,z)],.062,steel)
    for h in [20.15,20.9]:curve('Lumen pedestrian guardrail',[(-32,h,z),(32,h,z)],.065,steel)
    for i in range(33):curve('Lumen rail stanchion',[(-32+i*2,19.5,z),(-32+i*2,21,z)],.04,steel)
    curve('Bridge navigation light',[(-31,18.5,z),(31,18.5,z)],.065,glow)
for x in [-30.5,30.5]:
    extrude('Lumen sculpted pier',ellipse(2.4,5,32,x,bridge_z),.3,18.9,concrete,.25)
    ring('Pier collar',ellipse(2.65,5.2,32,x,bridge_z),16.8,.18,steel)
    extrude('Lumen pier foundation',rounded(4,6,32,x,bridge_z),.2,1.7,concrete,.18)

# Curved quay follows exact immutable track samples, outside playable water.
active=collection('05_Curve_Quay')
points=route['points']
for side in [-1,1]:
    def edge(p,offset):return (p['x']+math.cos(p['heading'])*(p['width']+offset)*side,p['z']-math.sin(p['heading'])*(p['width']+offset)*side)
    inner=[edge(p,1.9) for p in points];outer=[edge(p,14) for p in points]
    outline=inner+list(reversed(outer))
    if side==1:outline.reverse()
    extrude('Swept waterfront promenade',outline,-.1,.68,concrete,.10)
    # Continuous land under the architecture, cut to the real curved shoreline.
    outer_land=[edge(p,145) for p in points]
    land=outer+list(reversed(outer_land))
    if side==1:land.reverse()
    extrude('Curved urban block foundation',land,-.12,.30,concrete,.07)
    for offset in [2.1,3]:
        line=[edge(p,offset) for p in points];curve('Quay granite coping',[(x,.83,z) for x,z in line],.13,white)
    for offset,h in [(3,1.95),(3,1.38)]:curve('Continuous quay rail',[(x,h,z) for x,z in [edge(p,offset) for p in points]],.065,steel)
    curve('Cyan quay navigation ribbon',[(x,.9,z) for x,z in [edge(p,2.1) for p in points]],.035,glow)
    for i in range(0,len(points),2):
        p=points[i];x,z=edge(p,3);curve('Quay rail post',[(x,.68,z),(x,2,z)],.065,steel)
        x,z=edge(p,1.95);curve('Rubber waterfront fender',[(x,-.05,z),(x,.55,z)],.22,dark)
        if i%4==0:
            x,z=edge(p,7);extrude('Bollard foot',ellipse(.32,.32,16,x,z),.68,.78,steel,.025);curve('Mooring bollard',[(x,.78,z),(x,1.28,z)],.13,steel)
    for i in [8,20,40,50]:
        p=points[i];x,z=edge(p,9);curve('Promenade light standard',[(x,.7,z),(x,4.5,z),(x-side*1.7,4.5,z)],.11,steel)
        curve('Promenade light bar',[(x,4.4,z),(x-side*1.7,4.4,z)],.06,glow)

# Waterfront landing remains outside the water corridor; no obstacles in playable width.
for side,z in [(1,-65),(-1,85)]:
    x=side*31;extrude('Marina landing apron',rounded(5.5,15,32,x,z),.05,.42,white,.12)
    for i in range(12):curve('Landing deck slat',[(x-5,.46,z-13+i*2.2),(x+5,.46,z-13+i*2.2)],.035,dark)
    for off in [-12,12]:curve('Floating dock rail',[(x-4,.4,z+off),(x-4,1.5,z+off),(x+4,1.5,z+off),(x+4,.4,z+off)],.08,steel)

# Place reusable architectural modules into a layered streetscape, no random box skyline.
stage=collection('06_Stage_Placements');active=stage
placements=[('01_Aster_Curve_Tower',-61,-51,-.25,1),('02_Helix_Split_Tower',68,72,.2,.92),('03_Marina_Atrium',-66,86,.15,1),('01_Aster_Curve_Tower',65,-95,.6,.85),('02_Helix_Split_Tower',-103,27,-.4,.74),('03_Marina_Atrium',62,-12,-.2,.85)]
for cname,x,z,rot,scale in placements:
    instance=bpy.data.objects.new(cname+' instance',None);instance.instance_type='COLLECTION';instance.instance_collection=collections[cname];instance.location=v(x,0,z);instance.rotation_euler.z=-rot;instance.scale=(scale,scale,scale);stage.objects.link(instance)
# Move archetypes to a source-only collection using excluded root layer instead of relocation.
for name in ['01_Aster_Curve_Tower','02_Helix_Split_Tower','03_Marina_Atrium']:
    scene.collection.children.unlink(collections[name])

# Original inset advertising fascia, continuous rounded frame and illuminated perimeter.
advert_positions=[]
for side,index in [(-1,21),(1,47)]:
    p=points[index];x=p['x']+math.cos(p['heading'])*(p['width']+7)*side;z=p['z']-math.sin(p['heading'])*(p['width']+7)*side
    advert_positions.append({'x':x,'z':z,'heading':p['heading']})
    outline=rounded(4.8,.35,32,x,z);extrude('Transit advert plinth',outline,.65,5.2,white,.18)
    curve('Transit advert light crown',[(x-4.8,5.15,z),(x+4.8,5.15,z)],.06,glow)

# Keep source modifiers, curves and packed legal texture maps for editing.
for image in bpy.data.images:
    if image.source=='FILE':image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'waterfront-sample.blend'))

# Realize copies only in temporary export layer, apply geometry modifiers and join by material.
export_collection=collection('EXPORT_RUNTIME');active=export_collection
sources=list(collections['04_Lumen_Bridge'].objects)+list(collections['05_Curve_Quay'].objects)+list(stage.objects)
copies=[]
def duplicate(o,matrix=None):
    if o.instance_type=='COLLECTION':
        for child in o.instance_collection.objects:duplicate(child,o.matrix_world@child.matrix_world)
        return
    copy=o.copy();copy.data=o.data.copy() if o.data else None;export_collection.objects.link(copy)
    if matrix is not None:copy.matrix_world=matrix
    copies.append(copy)
for o in sources:duplicate(o)
bpy.ops.object.select_all(action='DESELECT')
for o in copies:o.select_set(True)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.convert(target='MESH')
# Joining per material keeps draw calls bounded, unlike leaving every window as an object.
groups={}
for o in list(export_collection.objects):
    key=o.data.materials[0].name if o.type=='MESH' and len(o.data.materials) else 'none'
    groups.setdefault(key,[]).append(o)
for key,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name='Sample_'+key.replace(' ','_')
runtime=list(export_collection.objects);bpy.ops.object.select_all(action='DESELECT')
for o in runtime:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'waterfront.glb'),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT')
tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in runtime)
for o in runtime:
    bpy.context.view_layer.objects.active=o
    d=o.modifiers.new('Low LOD controlled decimation','DECIMATE');d.ratio=.4;d.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=d.name)
# Low tier textures resample to 512 or less and remove normal maps in runtime.
for image in bpy.data.images:
    if image.size[0]>512 or image.size[1]>512:image.scale(512,512)
bpy.ops.export_scene.gltf(filepath=str(OUT/'waterfront-low.glb'),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True)
lowtris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in runtime)
(OUT/'manifest.json').write_text(json.dumps({'source':'assets/city-sample/source/waterfront-sample.blend','generator':'scripts/art/build-city-sample.py','blender':bpy.app.version_string,'length':280,'center':route['center'],'heading':route['h'],'adverts':advert_positions,'standard':{'triangles':tris,'meshes':len(runtime),'bytes':(OUT/'waterfront.glb').stat().st_size},'low':{'triangles':lowtris,'meshes':len(runtime),'bytes':(OUT/'waterfront-low.glb').stat().st_size}},indent=2),encoding='utf8')
print('CITY_SAMPLE_EXPORTED',tris,lowtris,len(runtime))
