"""Third district pass: complete small assets, civic architecture and facade detailing.
All geometry is original. Coordinates are x, height, z before glTF conversion.
"""
import math

def configure(api):
    globals().update({k:api[k] for k in ['slab','shell','tube','band','annulus','roofkit','entrance','polygon','xyz','soft','oval','coat','metal','stone','dark','glass','silver','amber','light','warm','window_frames','equipment']})

def steps(width,z,height=.7):
    for i in range(3):slab('Recessed public entry stair',soft(width, .28,12,0,z-i*.5),.25,.25+(3-i)*height/3,stone,.025)
    for x in [-width,width]:tube('Stair balustrade',[(x,.6,z-1.2),(x,1.5,z+.1)],.04,metal)

def facade_vents(x,z,h,side=False):
    p=[(-.65,0),(.65,0),(.65,2.4),(-.65,2.4)]
    def v(a,b):return (x,h+b,z+a) if side else (x+a,h+b,z)
    tube('Inset service panel frame',[v(a,b) for a,b in p],.045,coat,True)
    for i in range(7):tube('Angled ventilation louvre',[v(-.54,.25+i*.29),v(.54,.25+i*.29)],.045,metal)

def curtain_grid(rx,rz,lo,hi,floors):
    """Real curtain-wall grid on all four curved sides, not a flat decal."""
    for side in [-1,1]:
        for f in [-.8,-.4,0,.4,.8]:
            x=rx*f;z=side*rz*(1-abs(f)**4)**.25
            tube('Rebated curtain wall upright',[(x,lo,z),(x,hi,z)],.055,metal)
            z=rz*f;x=side*rx*(1-abs(f)**4)**.25
            tube('Side facade curtain upright',[(x,lo,z),(x,hi,z)],.055,metal)
    for j in range(1,floors):
        h=lo+(hi-lo)*j/floors
        band('Curtain wall transom',soft(rx,rz,48),h,.045,metal)
        band('Recessed facade shadow seam',soft(rx-.03,rz-.03,48),h+.15,.04,dark)

def depot():
    p=[(-5,-4),(3,-4),(5,-2),(5,3.5),(2.5,4.5),(-5,4.5)]
    slab('Service depot chamfered foundation',soft(5.6,5.6,20),.25,.8,stone)
    shell('Service depot composite walls',[(.8,p),(6,p)],coat)
    # Full recessed maintenance bay, lintel, guide rails and side service access.
    shell('Maintenance bay glazing',[(1,soft(3.8,.15,12,0,-4.05)),(4.8,soft(3.8,.15,12,0,-4.05))],silver)
    for x in [-3.9,3.9]:tube('Maintenance bay jamb',[(x,.8,-4.25),(x,5.2,-4.25)],.12,metal)
    tube('Maintenance bay lintel',[(-3.9,5.2,-4.25),(3.9,5.2,-4.25)],.15,metal)
    for i in range(5):tube('Segmented bay shutter',[(-3.7,1.4+i*.65,-4.3),(3.7,1.4+i*.65,-4.3)],.035,coat)
    slab('Cantilevered service eave',[(x*1.08,z*1.08) for x,z in p],6,6.35,metal)
    equipment(1,1,6.35);facade_vents(5.05,.5,2,True)
    tube('Waterfront service conduit',[(-4.8,1,4.6),(-4.8,5.5,4.6),(2,5.5,4.6)],.1,amber)
    tube('Service platform inspection lamp',[(-5.2,.8,3.8),(-5.2,7.5,3.8),(-3.9,7.5,3.8)],.075,metal)
    tube('Inspection lamp luminous strip',[(-5.1,7.42,3.8),(-4,7.42,3.8)],.045,warm)
    for h in [2,4]:tube('Depot side composite reveal',[(-5.03,h,-3.8),(-5.03,h,4.3),(2.3,h,4.55)],.025,dark)
    for x in [-2.5,2.5]:tube('Boat service guide',[(x,.85,-6.2),(x,.85,-4.4)],.05,light)
    band('Service bollard flange',oval(.35,.35,8,-4.8,-5.7),.9,.06,metal)
    tube('Service bollard', [(-4.8,.7,-5.7),(-4.8,1.6,-5.7)],.14,metal)

def ferry():
    p=soft(8.4,8,32)
    slab('Ferry terminal public steps',soft(9.5,9.6,32),.25,.9,stone)
    shell('Terminal transparent waiting hall',[(.9,p),(7.2,p)],glass);window_frames(p,.9,7.2,2);curtain_grid(8.4,8,.9,7.2,3)
    # An asymmetric folded canopy and structural columns give a waterfront silhouette.
    shell('Terminal swept clerestory',[(7.2,soft(8.7,8.4,32)),(10.5,soft(6.8,6,32,1,0))],glass)
    slab('Terminal curved eave',soft(9.6,9.2,32),7.1,7.5,coat)
    slab('Terminal crown canopy',soft(7.2,6.4,32,1,0),10.5,11,metal)
    for x in [-7.5,7.5]:tube('Terminal forked pier',[(x,.9,-7),(x,6.9,-7),(x*.7,10,-5)],.16,metal)
    for x in [-5,5]:equipment(x,5.5,7.6)
    entrance(6.4,8,3.4);steps(3,-10.1)
    for x in [-9,9]:tube('Terminal perimeter balustrade',[(x,1.8,-8),(x,1.8,8)],.06,metal)

def market():
    slab('Galleria stepped shopping podium',soft(11.3,9.1,32),.25,1.3,stone)
    rings=[(1.3,soft(10.7,8.4,32)),(9,soft(10.7,8.4,32)),(11,soft(8,7,32)),(19,soft(8,7,32))]
    shell('Galleria tiered storefront glass',rings,glass)
    for h,p in rings:band('Galleria storey reveal',p,h,.14,coat)
    window_frames(soft(10.7,8.4,32),1.3,9,2);window_frames(soft(8,7,32),11,19,2)
    curtain_grid(10.7,8.4,1.3,9,3);curtain_grid(8,7,11,19,3)
    for x in [-7,7]:tube('Galleria bronze pilaster',[(x,1.3,-8.1),(x,8.8,-8.1)],.12,amber)
    annulus('Public mezzanine balcony',soft(11.5,9.2,32),soft(8,7,32),9,.35,coat)
    band('Mezzanine handrail',soft(11.2,8.9,32),10.3,.06,metal)
    slab('Commercial roof perimeter',soft(8.7,7.5,32),19,19.4,coat);roofkit(7,6,19.4)
    for x in [-6,6]:slab('Galleria rooftop skylight',oval(1.3,2.4,16,x,0),19.5,20.2,glass)
    entrance(9,8.4,4);steps(4,-10.6)

def bio_lab():
    slab('Laboratory public plinth',soft(8.6,8.8,28),.25,1.1,stone)
    rings=[(1.1,oval(7.6,7.8,32)),(11,oval(7.6,7.8,32)),(13,oval(6.3,6.6,32,1,0)),(23,oval(6.3,6.6,32,1,0))]
    shell('Laboratory divided glazing',rings,glass)
    for h,p in rings:band('Laboratory slab edge',p,h,.18,coat)
    for i in range(0,32,2):tube('Laboratory folding sunshade',[(p[i][0],h,p[i][1]) for h,p in rings],.075,metal)
    for h in [5,9,16,20]:band('Laboratory glazing seam',oval(7.65 if h<12 else 6.35,7.85 if h<12 else 6.65,32,0 if h<12 else 1),h,.04,coat)
    slab('Laboratory roof plant deck',oval(6.6,6.9,32,1),23,23.45,coat)
    for x in [-3,3]:
        tube('Laboratory external return pipe',[(x,1,8),(x,22.5,8),(x,24,5)],.13,metal)
        equipment(x,3,23.45)
    tube('Laboratory data mast',[(0,23.5,0),(0,28,0)],.1,amber);entrance(6,8,3.5)

def exchange():
    slab('Cooling exchange foundation',soft(5.8,5.8,24),.25,.85,stone)
    p=oval(4.9,4.9,16);shell('Cooling exchange thermal core',[(.85,p),(12,p)],dark)
    for i in range(16):
        a=i*math.tau/16
        tube('Cooling exchange vertical blade',[(5.1*math.cos(a),1.1,5.1*math.sin(a)),(5.1*math.cos(a),11.8,5.1*math.sin(a))],.12,metal)
    for h in [2,4,6,8,10,12]:band('Cooling core outer flange',oval(5.4,5.4,24),h,.10,coat)
    slab('Cooling fan weather ring',oval(5.45,5.45,24),12,12.6,coat)
    for i in range(8):
        a=i*math.tau/8;tube('Cooling fan curved blade',[(0,12.8,0),(2.3*math.cos(a),12.8,2.3*math.sin(a)),(4.5*math.cos(a+.2),12.8,4.5*math.sin(a+.2))],.12,metal)
    tube('Cooling plant inlet',[(4,1,0),(4,1,5),(4,5,5)],.22,metal);entrance(3.7,5.1,3)

def sail():
    slab('Sail tower elevated foyer',soft(11.8,12.2,32),.25,3,stone)
    rings=[]
    for i in range(17):
        t=i/16;rings.append((3+83*t,oval(9.5*(1-.65*t),10.5*(1-.35*t),32,5*t*t)))
    shell('Sail tower curved glass',rings,silver)
    for h,p in rings:band('Sail tower slab seam',p,h,.07,coat)
    for i in range(0,32,4):tube('Sail tower sweeping spine',[(p[i][0],h,p[i][1]) for h,p in rings],.14,metal)
    slab('Sail tower crown',rings[-1][1],86,86.5,coat)
    tube('Sail fin rising crest',[(-8,4,0),(-7,35,0),(-3,66,0),(4.8,93,0)],.28,coat)
    entrance(9,11,4.4);roofkit(3,4,86.5)

def lattice():
    slab('Exoskeleton tower public plinth',soft(10.8,11.5,32),.25,3,stone)
    rings=[(3+96*i/16,soft(8.5*(1-.2*i/16),9.5*(1-.18*i/16),24,1.8*math.sin(i/16*math.pi))) for i in range(17)]
    shell('Exoskeleton tower glazing',rings,glass)
    for h,p in rings:band('Exoskeleton setback floor',p,h,.07,coat)
    for side in [-1,1]:
        for start in [3,27,51,75]:
            tube('Exoskeleton side diamond',[(side*8.7,start,-8),(side*9,start+12,0),(side*8.1,start+24,8),(side*8.3,start+12,0)],.14,coat)
        tube('Exoskeleton continuous corner',[(side*8.5,3,-9.6),(side*7.1,99,-8)],.17,metal)
    slab('Exoskeleton crown deck',rings[-1][1],99,99.6,coat);roofkit(6,7,99.6)
    for x in [-4,4]:tube('Tower split antenna',[(x,99,0),(x,108,0)],.13,amber)
    entrance(8,10.5,4.2)

def commuter():
    slab('Commuter interchange arrival base',soft(9.3,8.5,28),.25,1,stone)
    for x in [-7,7]:tube('Commuter branching pylon',[(x,1,0),(x,13,0),(x*.75,16,0)],.28,metal)
    slab('Commuter elevated concourse',soft(8.8,8,28),14,14.6,coat)
    p=soft(8,7,28);shell('Commuter glass platform',[(14.6,p),(19,p)],glass);window_frames(p,14.6,19,2);curtain_grid(8,7,14.6,19,2)
    slab('Commuter upper roof',soft(9.2,8.5,28),19,19.35,coat)
    for x in [-6,-2,2,6]:tube('Commuter arch roof rib',[(x,19.4,-8),(x,22.5,0),(x,19.4,8)],.11,metal)
    shell('Commuter glazed lift',[(1,soft(2.3,2.7)),(14,soft(2.3,2.7))],glass)
    for z in [-2.8,2.8]:tube('Lift mechanical guide',[(2.4,1,z),(2.4,14,z)],.07,metal)
    entrance(5.5,6,3.3);steps(2.5,-8.2)

def refine(name):
    if name in ['harbor_control','service_arcade']:
        width,z=(3.4,5.2) if name=='harbor_control' else (5.4,5)
        steps(width*.6,-6.3,.4)
        for x in [-width,width]:
            tube('Recessed storefront mullion',[(x,.85,-z-.1),(x,5.8,-z-.1)],.065,metal)
            tube('Storefront door closer',[(x-.35,3,-z-.18),(x+.35,3,-z-.18)],.025,amber)
        for side in [-1,1]:facade_vents(side*(4.82 if name=='harbor_control' else 9.52),1.3,2,True)
    if name=='view_pavilion':
        for x in [-5.6,5.6]:
            for z in [-4,-1,2,4]:tube('Pavilion guardrail baluster',[(x,.7,z),(x,1.65,z)],.04,metal)
        steps(2,-6.4,.4)
    if name=='transit_station':
        for x in [-7,7]:
            for z in [-8,-4,0,4,8]:tube('Station platform safety post',[(x,17,z),(x,18.1,z)],.045,metal)
            tube('Station continuous guardrail',[(x,18.1,-8),(x,18.1,8)],.05,metal)
    if name=='control_centre':
        for x in [-6,6]:facade_vents(x,-6.8,7)
    if name=='energy_node':
        for x in [-3,3]:tube('Energy bank service conduit',[(x,.8,4),(x,7.6,4),(x*.7,9,3.2)],.09,amber)

def far_shape(name,rx,rz,h):
    if name not in ['sail_office','lattice_tower']:return False
    if name=='sail_office':rings=[(.25,oval(9.5,10.5,12)),(h*.9,oval(3.3,6.8,12,5))]
    else:rings=[(.25,soft(8.5,9.5,12)),(h*.9,soft(6.8,7.8,12))]
    shell('New district tower silhouette',rings,glass);slab('New silhouette roof',rings[-1][1],h*.9,h*.9+.4,coat,0)
    if name=='sail_office':
        tube('Distant swept crest',[(-8,3,0),(-5,h*.5,0),(5,h,0)],.28,coat)
        for side in [-1,1]:tube('Distant sail facade spine',[(side*8.8,3,-4),(side*5.6+2,h*.5,-4),(side*3.2+5,h*.9,-4)],.12,metal)
    else:
        # Keep the defining exoskeleton visible in the cheap skyline LOD.
        # A smooth capped prism alone discarded the purpose of this template.
        for side in [-1,1]:
            for i in range(3):
                lo=3+i*h*.28;hi=lo+h*.28;z=side*(9.6-i*.5)
                tube('Distant tower diamond', [(-8+i*.5,lo,z),(0,(lo+hi)*.5,z),(8-i*.5,hi,z)],.16,coat)
                tube('Distant tower crossed brace',[(8-i*.5,lo,z),(0,(lo+hi)*.5,z),(-8+i*.5,hi,z)],.16,coat)
        for x in [-4,4]:tube('Distant crown antennas',[(x,h*.9,0),(x,h,0)],.17,amber)
    return True

BUILDERS=[('service_depot',depot,6,7,9),('ferry_terminal',ferry,10,12,15),('market_galleria',market,12,12,24),('bio_lab',bio_lab,9,11,30),('cooling_exchange',exchange,6,8,17),('sail_office',sail,13,15,95),('lattice_tower',lattice,12,14,110),('commuter_hub',commuter,10,11,25)]
