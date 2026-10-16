"""Validate the checked-in editable source, not a detached promotional render."""
import bpy,math,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
(root/'.qa/rider-ai').mkdir(parents=True,exist_ok=True)
path=root/'assets/racecraft/source/hero-rider-r4.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
rig=bpy.data.objects['RaceRig'];assert len(rig.data.bones)==46
assert rig.data.bones['Neck'].parent.name=='RiderChest'
assert rig.data.bones['UpperArm_1'].parent.name=='Clavicle_1'
parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert all(math.isfinite(x) for o in parts for v in o.data.vertices for x in v.co)
used={n.image for m in bpy.data.materials if m.use_nodes and m.users for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image}
missing=[im.name for im in used if not im.packed_file and not Path(bpy.path.abspath(im.filepath)).is_file()]
assert not missing,missing
from mathutils.kdtree import KDTree
body=bpy.data.objects['Tailored_neoprene_suit'];collar=bpy.data.objects['R4 fitted weighted neckline']
tree=KDTree(len(body.data.vertices))
for v in body.data.vertices:tree.insert(v.co,v.index)
tree.balance();maximum=0;weight_error=0
for v in list(collar.data.vertices)[:len(collar.data.vertices)//17]:
 _,index,distance=tree.find(v.co);maximum=max(maximum,distance)
 source={body.vertex_groups[g.group].name:g.weight for g in body.data.vertices[index].groups}
 target={collar.vertex_groups[g.group].name:g.weight for g in v.groups}
 weight_error=max(weight_error,max(abs(source.get(n,0)-target.get(n,0)) for n in source.keys()|target.keys()))
assert maximum<1e-6 and weight_error<1e-6,(maximum,weight_error)
assert path.stat().st_size<100*1024*1024
result={'source':str(path.relative_to(root)),'bytes':path.stat().st_size,'bones':len(rig.data.bones),'meshParts':len(parts),'usedImages':len(used),'missingImages':missing,'finiteVertices':True,'necklineDistanceMax':maximum,'necklineWeightError':weight_error}
(root/'.qa/rider-ai/source-results.json').write_text(json.dumps(result,indent=2));print('R4_SOURCE',json.dumps(result))
