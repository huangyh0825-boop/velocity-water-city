"""Additional authored architecture and close-range refinements for the city library."""
import math

def configure(api):
    globals().update({k:api[k] for k in ['slab','shell','tube','band','annulus','roofkit','entrance','polygon','xyz','soft','oval','coat','metal','stone','dark','glass','silver','amber','light','warm']})

def window_frames(outline,lo,hi,stride=3):
    for i in range(0,len(outline),stride):
        x,z=outline[i];tube('Inset facade mullion',[(x,lo,z),(x,hi,z)],.055,metal)
    for h in [lo+.14,hi-.14]:band('Rebated glazing sill',outline,h,.055,coat)

def equipment(x,z,h):
    slab('Chamfered access housing',soft(.8,1.2,12,x,z),h,h+1.25,dark)
    for j in range(4):tube('Equipment heat exchanger fin',[(x-.8,h+.3+j*.23,z-1.22),(x+.8,h+.3+j*.23,z-1.22)],.035,metal)
    tube('Equipment service status',[(x-.65,h+1.1,z-1.25),(x-.2,h+1.1,z-1.25)],.025,light)

def harbor():
    slab('Harbor stepped footing',soft(5,5.8,20),.25,.75,stone)
    p=[(-4.5,-4.8),(2.8,-4.8),(4.8,-2),(4.8,4.3),(-4.5,4.3)]
    shell('Harbor wraparound control glazing',[(.75,p),(6.6,p)],glass);window_frames(p,.75,6.6,1)
    slab('Harbor swept roof eave',[(x*1.1,z*1.1) for x,z in p],6.6,7.05,coat)
    slab('Harbor raised roof core',soft(2.2,2),7.05,8.2,dark);equipment(2,2,7.05)
    tube('Harbor antenna',[(0,7,1),(0,9.5,1)],.07,metal);entrance(4.4,5.2,3)

def arcade():
    slab('Arcade terraced foundation',soft(10.5,5.5),.25,.65,stone)
    p=soft(9.5,5,28);shell('Arcade double-height glazing',[(.65,p),(6.6,p)],glass);window_frames(p,.65,6.6,2)
    slab('Arcade broad folded canopy',soft(11,5.8,28),6.6,7.15,coat)
    band('Arcade perimeter lighting',soft(10.9,5.7,28),6.75,.055,amber)
    shell('Arcade upper clerestory',[(7.15,soft(6.5,3)),(9.2,soft(6,2.8))],silver)
    slab('Arcade upper roof',soft(6.3,3.1),9.2,9.5,metal);equipment(5,2.7,7.15);entrance(7,5,3.5)

def energy():
    slab('Energy ribbed plinth',oval(6,6,16),.25,.8,stone)
    shell('Reactor tapered casing',[(.8,oval(5.4,5.4,16)),(9.5,oval(3.6,3.6,16))],dark)
    for i in range(0,16,2):
        a=i*math.tau/16;tube('Reactor external heat blade',[(5.5*math.cos(a),1,5.5*math.sin(a)),(3.8*math.cos(a),9.5,3.8*math.sin(a))],.15,metal)
    for h,r in [(3,5),(6,4.4),(9.5,3.8)]:band('Energy isolation collar',oval(r,r,24),h,.16,coat)
    slab('Reactor sealed crown',oval(3.8,3.8,24),9.5,10.1,coat);tube('Energy luminous core',[(0,10.1,0),(0,13,0)],.32,light)
    band('Energy crown induction ring',oval(2.4,2.4,24),12,.12,amber);entrance(4,6,3)

def pavilion():
    slab('Observation terrace foundation',soft(7,6),.25,.7,stone)
    shell('Observation pavilion glazing',[(.7,oval(5.5,4.5,24)),(4.8,oval(5.5,4.5,24))],silver);window_frames(oval(5.5,4.5,24),.7,4.8,3)
    slab('Pavilion floating canopy',oval(7.2,6.2,32),4.8,5.25,coat)
    for x in [-5,5]:tube('Pavilion V support',[(x,.7,0),(x*.8,4.8,0)],.12,metal)
    band('Terrace guardrail',soft(6.6,5.7),1.65,.055,metal);entrance(5,6,2.8)
    for x in [-4,4]:slab('Terrace integrated bench',soft(.55,1.6,12,x,3),.7,1.2,coat)

def expo():
    slab('Exhibition stepped plaza',soft(18,12.5,32),.25,1.2,stone)
    shell('Exhibition wraparound foyer',[(1.2,soft(16.5,11.5,32)),(13.2,soft(16.5,11.5,32))],glass);window_frames(soft(16.5,11.5,32),1.2,13.2,2)
    profile=[(-18+36*i/24,14+8*math.sin(math.pi*i/24)) for i in range(25)]
    verts=[xyz(x,h,z) for z in [-12.5,12.5] for x,h in profile];faces=[(i,i+25,i+26,i+1) for i in range(24)];polygon('Exhibition flowing roof',verts,faces,coat)
    for z in [-12.4,12.4]:
        # Close the gables: a swept roof must read as a complete hall, not a
        # detached curved sheet floating above a smaller glass cylinder.
        gable=[xyz(-18,13,z),xyz(18,13,z)]+[xyz(x,h,z) for x,h in reversed(profile)]
        polygon('Exhibition arched clerestory',gable,[tuple(range(len(gable)))],silver)
        tube('Exhibition gable sill',[(-18,13,z),(18,13,z)],.12,metal)
        for x in [-15,-9,-3,3,9,15]:tube('Exhibition arch glazing frame',[(x,13,z),(x,14+8*math.sin(math.pi*(x+18)/36),z)],.07,metal)
    for z in [-12.5,-6,0,6,12.5]:tube('Exhibition roof seam',[(x,h+.07,z) for x,h in profile],.06,metal)
    for x in [-13,13]:tube('Exhibition roof load rib',[(x,1.2,-10),(x,13,-10),(x*.7,14+8*math.sin(math.pi*(x*.7+18)/36),-10)],.18,metal)
    entrance(13,11.5,4.6)

def control():
    slab('Control stepped base',soft(10,9),.25,2,stone)
    shell('Control buttressed stem',[(2,soft(7,7)),(21,soft(5.5,5.5))],dark)
    for x in [-6.5,6.5]:tube('Control core service rib',[(x,2,-6.5),(x*.82,21,-5.5)],.17,metal)
    shell('Overhanging command room',[(21,oval(11.5,9.5,24)),(29,oval(10.8,9,24))],glass);window_frames(oval(11.3,9.3,24),21.3,28.7,2)
    for h in [21,25,29]:band('Command ring spandrel',oval(11.5,9.5,24),h,.2,coat)
    slab('Control roof shield',oval(11.6,9.6,24),29,29.7,coat);roofkit(8,8,29.7);entrance(7,8,3.8)

def hotel():
    slab('Hotel public podium',soft(12,12),.25,3,stone)
    rings=[]
    for i in range(13):
        t=i/12;p=soft(10.5*(1-.25*t),10*(1-.18*t),24,2*math.sin(t*math.pi),0);rings.append((3+5*i,p))
        annulus('Hotel projecting balcony',[(x*1.09,z*1.1) for x,z in p],p,3+5*i,.22,coat)
        band('Hotel bronze balcony cap',[(x*1.085,z*1.09) for x,z in p],4+5*i,.045,amber)
    shell('Hotel continuous divided glazing',rings,silver)
    for i in range(0,24,3):tube('Hotel continuous vertical frame',[(p[i][0],h,p[i][1]) for h,p in rings],.06,metal)
    slab('Hotel crown terrace',rings[-1][1],63,64,coat);roofkit(6,7,64)
    for x in [-5,0,5]:tube('Hotel crest fin',[(x,64,2),(x+1.5,71,2)],.13,amber)
    entrance(10,12,4)

def ring_spire():
    slab('Oculus tower foundation',soft(11,10),.25,3,stone)
    rings=[(3+82*i/12,oval(9*(1-.25*i/12),8*(1-.3*i/12),24,2*math.sin(i/12*math.pi))) for i in range(13)]
    shell('Oculus tower glass zones',rings,glass)
    for h,p in rings:band('Oculus office slab',p,h,.10,coat)
    for i in range(0,24,4):tube('Oculus curved structural spine',[(p[i][0],h,p[i][1]) for h,p in rings],.15,metal)
    slab('Oculus crown shoulder',rings[-1][1],85,86,coat)
    tube('Vertical oculus crown',[(8*math.cos(i*math.tau/40),94+9*math.sin(i*math.tau/40),0) for i in range(40)],.55,coat,True)
    tube('Oculus inner illuminated rim',[(7.3*math.cos(i*math.tau/40),94+8.3*math.sin(i*math.tau/40),-.1) for i in range(40)],.065,light,True)
    entrance(9,10,4)

def blade():
    outline=[(-11,-8),(4,-10),(12,0),(6,10),(-10,8),(-6,0)]
    slab('Blade sculpted base',soft(12.3,11),.25,3,stone)
    rings=[(3+78*i/12,[(x*(1-.22*i/12)+2*i/12,z*(1-.15*i/12)) for x,z in outline]) for i in range(13)]
    shell('Blade folded glass facade',rings,silver)
    for h,p in rings:band('Blade horizontal reveals',p,h,.07,coat)
    for i in range(6):tube('Blade facade fold fin',[(p[i][0],h,p[i][1]) for h,p in rings],.12,metal)
    slab('Blade split crown left',soft(2.7,6,12,-3,0),81,90,coat);slab('Blade split crown right',soft(2,5,12,3,0),81,86,dark)
    roofkit(5,6,81);entrance(8,10,3.5)

def gallery():
    slab('Transport node footing',soft(12,8),.25,1,stone)
    for x in [-9,9]:
        tube('Sky gallery branching support',[(x,1,0),(x,17,0),(x*.7,19,0)],.4,metal)
        slab('Gallery support anchor',soft(1.2,2.2,12,x,0),.5,1.2,coat)
    slab('Sky gallery platform',soft(12,8),18,18.7,coat)
    shell('Gallery glazed concourse',[(18.7,soft(10.5,7)),(23,soft(10.5,7))],glass);window_frames(soft(10.5,7),18.7,23,3)
    slab('Gallery swept roof',oval(13,9,32),23,23.55,coat)
    for x in [-5,5]:tube('Gallery roof guide',[(x,23.6,-7),(x,26,-2),(x,23.6,7)],.1,amber)
    shell('Gallery lift core',[(1,soft(2,2.5)),(18,soft(2,2.5))],silver);entrance(5,8,3)

def refine(name):
    if name=='data_centre':
        for side in [-1,1]:
            for z in [-6,0,6]:
                tube('Data inspection panel seam',[(side*10.05,3,z-1.8),(side*10.05,6,z-1.8),(side*10.05,6,z+1.8),(side*10.05,3,z+1.8)],.025,coat,True)
                for j in range(5):tube('Horizontal data intake grille',[(side*10.07,3.4+j*.45,z-1.5),(side*10.07,3.4+j*.45,z+1.5)],.035,metal)
    if name=='retail_hub':window_frames(soft(8.5,4.8),7.6,10.8,2)
    if name=='research_campus':
        for p in [oval(12.9,11.9,32),oval(6,5,32)]:window_frames(p,1.8,14.8,2)
    if name=='drydock_service':
        for x in [-5.8,5.8]:equipment(x,6,.8)
        for z in [-8,-5,-2]:tube('Dock platform safety edge',[(-6.8,1.4,z),( -6.8,.8,z)],.045,metal)

def far_shape(name,rx,rz,h):
    if name not in ['ring_spire','blade_tower','terraced_hotel']:return False
    if name=='blade_tower':
        p=[(-10,-7),(4,-9),(11,0),(5,9),(-9,7),(-5,0)]
        rings=[(.25,p),(h*.9,[(x*.8+1.5,z*.85) for x,z in p])]
    else:rings=[(.25,oval(rx*.8,rz*.75,12)),(h*.82,oval(rx*.6,rz*.6,12,1.5))]
    shell('Distinct landmark silhouette',rings,glass);slab('Landmark crown cap',rings[-1][1],h*.82,h*.82+.4,coat,0)
    if name=='ring_spire':tube('Distant oculus crown',[(7*math.cos(i*math.tau/20),h*.9+7*math.sin(i*math.tau/20),0) for i in range(20)],.55,coat,True)
    elif name=='blade_tower':slab('Distant blade crest',soft(2.2,4,8,-2,0),h*.9,h,coat,0)
    else:
        for height in [.2,.4,.6,.8]:band('Distant hotel terrace',oval(rx*.76,rz*.72,12),h*height,.15,coat)
    return True

BUILDERS=[('harbor_control',harbor,5.5,8,10),('service_arcade',arcade,11.5,8,11),('energy_node',energy,7,9,14),('view_pavilion',pavilion,7.5,9,8),('expo_hall',expo,19,15,24),('control_centre',control,12.5,11,35),('terraced_hotel',hotel,14,15,72),('ring_spire',ring_spire,12,13,105),('blade_tower',blade,13,13,92),('sky_gallery',gallery,14,11,28)]
