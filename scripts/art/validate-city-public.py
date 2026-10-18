"""Measure the retained high mesh against each exported public-citizen LOD.
Read-only, bidirectional vertex-to-surface distances; no hero assets modified.
"""
import bpy,json,math
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/city-public/public-citizens.blend'))
deps=bpy.context.evaluated_depsgraph_get();report=[]
for i in range(4):
 root=bpy.data.objects[f'spectator-{i}'];near=max(root.children,key=lambda o:len(o.data.vertices));high=BVHTree.FromObject(near,deps)
 for tier in['mid','far']:
  target=max(bpy.data.objects[f'spectator-{i}__{tier}'].children,key=lambda o:len(o.data.vertices));low=BVHTree.FromObject(target,deps)
  distances=[low.find_nearest(v.co)[3] for v in near.data.vertices]+[high.find_nearest(v.co)[3] for v in target.data.vertices]
  report.append({'pose':i,'tier':tier,'triangles':sum(len(p.vertices)-2 for p in target.data.polygons),'maximumMetres':max(distances),'rmsMetres':math.sqrt(sum(v*v for v in distances)/len(distances))})
(ROOT/'assets/city-public/lod-error.json').write_text(json.dumps(report,indent=2));print(report)
