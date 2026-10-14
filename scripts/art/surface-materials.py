"""Original bounded 512px PBR surfaces. AO is analytic seam occlusion, not a ray bake."""
import bpy,numpy as np
def make_surface(folder,prefix,kind='coated',size=512):
    y,x=np.mgrid[:size,:size].astype(np.float32);rng=np.random.default_rng(197 if kind=='coated' else 421)
    grain=rng.normal(0,.005,(size,size));cell=size//4;dist=np.minimum.reduce([x%cell,cell-1-x%cell,y%cell,cell-1-y%cell])
    seam=np.exp(-(dist/2.2)**2);edge=np.exp(-((dist-4)/2.5)**2)
    panel=((np.floor(x/cell)*17+np.floor(y/cell)*31)%9-4)*.009;wear=.018*np.sin(x*.017+y*.032)+.012*np.sin(x*.081-y*.046)
    if kind=='coated':
        base=np.array([.63,.66,.68])[None,None,:]*(1+panel+grain+wear-seam*.26)[...,None];rough=np.clip(.54+panel*2+grain*3+seam*.2-edge*.12,.36,.78);metal=np.clip(edge*.82-seam*.4,0,.86);height=-seam*.04+grain*.025
    else:
        base=np.array([.36,.40,.43])[None,None,:]*(1+panel+grain*3+wear-seam*.22)[...,None];rough=np.clip(.76+grain*3+panel+seam*.13,.6,.94);metal=np.zeros_like(x);height=-seam*.05+grain*.09
    ao=np.clip(1-seam*.5-edge*.05,.45,1);gy,gx=np.gradient(height);nx=-gx*9;ny=-gy*9;nz=np.ones_like(x);length=np.sqrt(nx*nx+ny*ny+1)
    normal=np.stack([nx/length*.5+.5,ny/length*.5+.5,nz/length*.5+.5],axis=-1);fields={'basecolor':base,'normal':normal,'orm':np.stack([ao,rough,metal],axis=-1)};images={}
    for name,rgb in fields.items():
        image=bpy.data.images.new(prefix+' '+name,width=size,height=size);image.colorspace_settings.name='sRGB' if name=='basecolor' else 'Non-Color'
        if name=='basecolor':rgb=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
        rgba=np.concatenate([np.clip(rgb,0,1),np.ones((size,size,1),dtype=np.float32)],axis=-1).astype(np.float32);image.pixels.foreach_set(rgba.ravel());image.filepath_raw=str(folder/(prefix+'-'+name+'.png'));image.file_format='PNG';image.save();images[name]=image
    return images
def bind_surface(material,images,strength=.4):
    tree=material.node_tree;bsdf=tree.nodes.get('Principled BSDF');color=tree.nodes.new('ShaderNodeTexImage');color.image=images['basecolor'];tree.links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
    normal=tree.nodes.new('ShaderNodeTexImage');normal.image=images['normal'];nm=tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=strength;tree.links.new(normal.outputs['Color'],nm.inputs['Color']);tree.links.new(nm.outputs['Normal'],bsdf.inputs['Normal'])
    packed=tree.nodes.new('ShaderNodeTexImage');packed.image=images['orm'];split=tree.nodes.new('ShaderNodeSeparateColor');tree.links.new(packed.outputs['Color'],split.inputs['Color']);tree.links.new(split.outputs['Green'],bsdf.inputs['Roughness']);tree.links.new(split.outputs['Blue'],bsdf.inputs['Metallic'])
    group=bpy.data.node_groups.new('glTF Material Output '+material.name,'ShaderNodeTree');group.interface.new_socket('Occlusion',in_out='INPUT',socket_type='NodeSocketFloat');group.nodes.new('NodeGroupOutput');node=tree.nodes.new('ShaderNodeGroup');node.node_tree=group;tree.links.new(split.outputs['Red'],node.inputs['Occlusion'])
