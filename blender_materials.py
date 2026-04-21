"""
RealScape — Blender Cycles Material Applier
========================================
Usage:
  1. Import your .glb in Blender (File > Import > glTF 2.0)
  2. Open the Scripting workspace
  3. Open this file and click Run Script

Requires Blender 3.3+  (tested on 3.6 LTS and 4.x)
"""

import bpy
import math


# ── Helpers ────────────────────────────────────────────────────────────────

def _srgb(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hex_to_linear(h):
    h = h.lstrip('#')
    r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
    return (_srgb(r), _srgb(g), _srgb(b), 1.0)

def avg_colors(hex_list):
    if not hex_list:
        return (0.5, 0.5, 0.5, 1.0)
    cols = [hex_to_linear(h) for h in hex_list]
    return tuple(sum(c[i] for c in cols) / len(cols) for i in range(4))

def scale_color(col, factor):
    return tuple(max(0.0, min(1.0, col[i] * factor)) for i in range(3)) + (1.0,)

def N(tree, t, loc=(0, 0)):
    n = tree.nodes.new(t)
    n.location = loc
    return n

def L(tree, a, ao, b, bi):
    tree.links.new(a.outputs[ao], b.inputs[bi])

def pbsdf(node, **kw):
    for k, v in kw.items():
        if k in node.inputs:
            node.inputs[k].default_value = v

def new_mat(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    return mat


# ── Wall materials ─────────────────────────────────────────────────────────

def mat_pierre_taille(name, wall_colors, roughness=0.65, normal_strength=8.0):
    """Pierre de taille : haussmannien, classique, art_deco, medieval."""
    mat = new_mat(name)
    t = mat.node_tree
    out  = N(t, 'ShaderNodeOutputMaterial',  (700,   0))
    bsdf = N(t, 'ShaderNodeBsdfPrincipled',  (400,   0))
    cramp= N(t, 'ShaderNodeValToRGB',        (100, 150))
    nois = N(t, 'ShaderNodeTexNoise',        (-250, 150))
    nbmp = N(t, 'ShaderNodeTexNoise',        (-250, -150))
    bump = N(t, 'ShaderNodeBump',            (100, -150))

    nois.inputs['Scale'].default_value    = 14.0
    nois.inputs['Detail'].default_value   = 6.0
    nois.inputs['Roughness'].default_value= 0.55
    nbmp.inputs['Scale'].default_value    = 35.0
    nbmp.inputs['Detail'].default_value   = 4.0
    bump.inputs['Strength'].default_value = min(1.0, normal_strength / 14.0)
    bump.inputs['Distance'].default_value = 0.02

    base = avg_colors(wall_colors)
    cramp.color_ramp.elements[0].color = scale_color(base, 0.82)
    cramp.color_ramp.elements[1].color = scale_color(base, 1.07)

    L(t, nois, 'Fac',    cramp, 'Fac')
    L(t, cramp, 'Color', bsdf,  'Base Color')
    L(t, nbmp,  'Fac',   bump,  'Height')
    L(t, bump,  'Normal',bsdf,  'Normal')
    L(t, bsdf,  'BSDF',  out,   'Surface')
    pbsdf(bsdf, Roughness=roughness)
    return mat


def mat_enduit(name, wall_colors, roughness=0.80):
    """Enduit/crépi : provencal, moderne, annees80."""
    mat = new_mat(name)
    t = mat.node_tree
    out  = N(t, 'ShaderNodeOutputMaterial', (700,   0))
    bsdf = N(t, 'ShaderNodeBsdfPrincipled', (400,   0))
    cramp= N(t, 'ShaderNodeValToRGB',       (100, 150))
    nois = N(t, 'ShaderNodeTexNoise',       (-250, 150))
    nbmp = N(t, 'ShaderNodeTexNoise',       (-250, -150))
    bump = N(t, 'ShaderNodeBump',           (100, -150))

    nois.inputs['Scale'].default_value     = 90.0
    nois.inputs['Detail'].default_value    = 8.0
    nois.inputs['Roughness'].default_value = 0.78
    nbmp.inputs['Scale'].default_value     = 180.0
    bump.inputs['Strength'].default_value  = 0.35
    bump.inputs['Distance'].default_value  = 0.004

    base = avg_colors(wall_colors)
    cramp.color_ramp.elements[0].color = scale_color(base, 0.88)
    cramp.color_ramp.elements[1].color = scale_color(base, 1.04)
    cramp.color_ramp.elements[0].position = 0.3

    L(t, nois,  'Fac',    cramp, 'Fac')
    L(t, cramp, 'Color',  bsdf,  'Base Color')
    L(t, nbmp,  'Fac',    bump,  'Height')
    L(t, bump,  'Normal', bsdf,  'Normal')
    L(t, bsdf,  'BSDF',   out,   'Surface')
    pbsdf(bsdf, Roughness=roughness)
    return mat


def mat_beton(name, wall_colors, roughness=0.88):
    """Béton brut : annees60."""
    mat = new_mat(name)
    t = mat.node_tree
    out  = N(t, 'ShaderNodeOutputMaterial', (700,   0))
    bsdf = N(t, 'ShaderNodeBsdfPrincipled', (400,   0))
    cramp= N(t, 'ShaderNodeValToRGB',       (100, 200))
    wave = N(t, 'ShaderNodeTexWave',        (-250, 200))
    nois = N(t, 'ShaderNodeTexNoise',       (-250, -150))
    bump = N(t, 'ShaderNodeBump',           (100, -150))

    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Y'
    wave.inputs['Scale'].default_value      = 28.0
    wave.inputs['Distortion'].default_value = 1.2
    wave.inputs['Detail'].default_value     = 3.0
    nois.inputs['Scale'].default_value      = 22.0
    bump.inputs['Strength'].default_value   = 0.18
    bump.inputs['Distance'].default_value   = 0.006

    base = avg_colors(wall_colors)
    cramp.color_ramp.elements[0].color = scale_color(base, 0.88)
    cramp.color_ramp.elements[1].color = scale_color(base, 1.04)

    L(t, wave,  'Color',  cramp, 'Fac')
    L(t, cramp, 'Color',  bsdf,  'Base Color')
    L(t, nois,  'Fac',    bump,  'Height')
    L(t, bump,  'Normal', bsdf,  'Normal')
    L(t, bsdf,  'BSDF',   out,   'Surface')
    pbsdf(bsdf, Roughness=roughness)
    return mat


def mat_granit(name, wall_colors, roughness=0.85):
    """Granit breton : grain serré, teinte sombre."""
    mat = new_mat(name)
    t = mat.node_tree
    out     = N(t, 'ShaderNodeOutputMaterial', (700,   0))
    bsdf    = N(t, 'ShaderNodeBsdfPrincipled', (400,   0))
    mix_col = N(t, 'ShaderNodeMixRGB',         (100, 150))
    voronoi = N(t, 'ShaderNodeTexVoronoi',     (-250, 150))
    nois    = N(t, 'ShaderNodeTexNoise',       (-250, -150))
    bump    = N(t, 'ShaderNodeBump',           (100, -150))

    voronoi.inputs['Scale'].default_value  = 60.0
    nois.inputs['Scale'].default_value     = 18.0
    nois.inputs['Detail'].default_value    = 8.0
    bump.inputs['Strength'].default_value  = 0.75
    bump.inputs['Distance'].default_value  = 0.012
    mix_col.blend_type = 'MIX'
    mix_col.inputs['Fac'].default_value = 0.35

    base = avg_colors(wall_colors)
    mix_col.inputs[1].default_value = base
    mix_col.inputs[2].default_value = scale_color(base, 0.65)

    L(t, voronoi, 'Distance', mix_col, 'Fac')
    L(t, mix_col, 'Color',    bsdf,    'Base Color')
    L(t, nois,    'Fac',      bump,    'Height')
    L(t, bump,    'Normal',   bsdf,    'Normal')
    L(t, bsdf,    'BSDF',     out,     'Surface')
    pbsdf(bsdf, Roughness=roughness)
    return mat


def mat_colombage(name, wall_colors):
    """Colombages normands/alsaciens : enduit clair entre poutres."""
    mat = new_mat(name)
    t = mat.node_tree
    out  = N(t, 'ShaderNodeOutputMaterial', (700,   0))
    bsdf = N(t, 'ShaderNodeBsdfPrincipled', (400,   0))
    cramp= N(t, 'ShaderNodeValToRGB',       (100, 150))
    nois = N(t, 'ShaderNodeTexNoise',       (-250, 150))
    bump = N(t, 'ShaderNodeBump',           (100, -150))

    nois.inputs['Scale'].default_value     = 70.0
    nois.inputs['Detail'].default_value    = 5.0
    bump.inputs['Strength'].default_value  = 0.28
    bump.inputs['Distance'].default_value  = 0.003

    base = avg_colors(wall_colors)
    cramp.color_ramp.elements[0].color = scale_color(base, 0.92)
    cramp.color_ramp.elements[1].color = scale_color(base, 1.04)

    L(t, nois,  'Fac',    cramp, 'Fac')
    L(t, cramp, 'Color',  bsdf,  'Base Color')
    L(t, nois,  'Fac',    bump,  'Height')
    L(t, bump,  'Normal', bsdf,  'Normal')
    L(t, bsdf,  'BSDF',   out,   'Surface')
    pbsdf(bsdf, Roughness=0.75)
    return mat


def mat_verre(name):
    """Façade rideau verre/aluminium : contemporain."""
    mat = new_mat(name)
    mat.blend_method = 'BLEND'
    t = mat.node_tree
    out  = N(t, 'ShaderNodeOutputMaterial', (600, 0))
    bsdf = N(t, 'ShaderNodeBsdfPrincipled', (300, 0))

    bsdf.inputs['Base Color'].default_value = (0.02, 0.05, 0.09, 1.0)
    pbsdf(bsdf, Roughness=0.04, Metallic=0.08)

    # Blender 3.x uses 'Transmission', 4.x uses 'Transmission Weight'
    for key in ('Transmission', 'Transmission Weight'):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = 0.82
            break

    L(t, bsdf, 'BSDF', out, 'Surface')
    return mat


# ── Roof materials ─────────────────────────────────────────────────────────

def mat_zinc(name):
    """Zinc parisien : toits mansard, ardoise haussmannienne."""
    mat = new_mat(name)
    t = mat.node_tree
    out  = N(t, 'ShaderNodeOutputMaterial', (600, 0))
    bsdf = N(t, 'ShaderNodeBsdfPrincipled', (300, 0))
    cramp= N(t, 'ShaderNodeValToRGB',       (0,  100))
    nois = N(t, 'ShaderNodeTexNoise',       (-300, 100))
    bump = N(t, 'ShaderNodeBump',           (0,  -100))

    nois.inputs['Scale'].default_value     = 45.0
    nois.inputs['Detail'].default_value    = 6.0
    bump.inputs['Strength'].default_value  = 0.25

    cramp.color_ramp.elements[0].color = (0.030, 0.038, 0.048, 1.0)
    cramp.color_ramp.elements[1].color = (0.095, 0.110, 0.130, 1.0)

    L(t, nois, 'Fac',    cramp, 'Fac')
    L(t, cramp,'Color',  bsdf,  'Base Color')
    L(t, nois, 'Fac',    bump,  'Height')
    L(t, bump, 'Normal', bsdf,  'Normal')
    L(t, bsdf, 'BSDF',   out,   'Surface')
    pbsdf(bsdf, Roughness=0.42, Metallic=0.65)
    return mat


def mat_ardoise(name, dark=(0.030, 0.038, 0.052), light=(0.080, 0.090, 0.110)):
    """Ardoise : bretagne, normandie."""
    mat = new_mat(name)
    t = mat.node_tree
    out  = N(t, 'ShaderNodeOutputMaterial', (600, 0))
    bsdf = N(t, 'ShaderNodeBsdfPrincipled', (300, 0))
    cramp= N(t, 'ShaderNodeValToRGB',       (0,  100))
    nois = N(t, 'ShaderNodeTexNoise',       (-300, 100))
    bump = N(t, 'ShaderNodeBump',           (0,  -100))

    nois.inputs['Scale'].default_value     = 28.0
    nois.inputs['Detail'].default_value    = 8.0
    bump.inputs['Strength'].default_value  = 0.50

    cramp.color_ramp.elements[0].color = dark  + (1.0,)
    cramp.color_ramp.elements[1].color = light + (1.0,)

    L(t, nois, 'Fac',    cramp, 'Fac')
    L(t, cramp,'Color',  bsdf,  'Base Color')
    L(t, nois, 'Fac',    bump,  'Height')
    L(t, bump, 'Normal', bsdf,  'Normal')
    L(t, bsdf, 'BSDF',   out,   'Surface')
    pbsdf(bsdf, Roughness=0.80)
    return mat


def mat_tuiles(name, base=(0.45, 0.14, 0.06)):
    """Tuiles canal / romanes : provencal, alsacien, medieval."""
    mat = new_mat(name)
    t = mat.node_tree
    out  = N(t, 'ShaderNodeOutputMaterial', (700,   0))
    bsdf = N(t, 'ShaderNodeBsdfPrincipled', (400,   0))
    cramp= N(t, 'ShaderNodeValToRGB',       (100, 200))
    wave = N(t, 'ShaderNodeTexWave',        (-250, 200))
    nois = N(t, 'ShaderNodeTexNoise',       (-250, -150))
    bump = N(t, 'ShaderNodeBump',           (100, -150))

    wave.wave_type  = 'BANDS'
    wave.inputs['Scale'].default_value      = 9.0
    wave.inputs['Distortion'].default_value = 0.4
    nois.inputs['Scale'].default_value      = 35.0
    bump.inputs['Strength'].default_value   = 0.60
    bump.inputs['Distance'].default_value   = 0.015

    cramp.color_ramp.elements[0].color = scale_color(base, 0.72)
    cramp.color_ramp.elements[1].color = scale_color(base, 1.18)

    L(t, wave,  'Color',  cramp, 'Fac')
    L(t, cramp, 'Color',  bsdf,  'Base Color')
    L(t, nois,  'Fac',    bump,  'Height')
    L(t, bump,  'Normal', bsdf,  'Normal')
    L(t, bsdf,  'BSDF',   out,   'Surface')
    pbsdf(bsdf, Roughness=0.75)
    return mat


def mat_toit_plat(name):
    """Terrasse bitumée / gravier."""
    mat = new_mat(name)
    t = mat.node_tree
    out  = N(t, 'ShaderNodeOutputMaterial', (500, 0))
    bsdf = N(t, 'ShaderNodeBsdfPrincipled', (250, 0))
    cramp= N(t, 'ShaderNodeValToRGB',       (0,  100))
    nois = N(t, 'ShaderNodeTexNoise',       (-300, 100))

    nois.inputs['Scale'].default_value  = 120.0
    nois.inputs['Detail'].default_value = 6.0

    cramp.color_ramp.elements[0].color = (0.020, 0.020, 0.020, 1.0)
    cramp.color_ramp.elements[1].color = (0.085, 0.085, 0.085, 1.0)

    L(t, nois, 'Fac',   cramp, 'Fac')
    L(t, cramp,'Color', bsdf,  'Base Color')
    L(t, bsdf, 'BSDF',  out,   'Surface')
    pbsdf(bsdf, Roughness=0.92)
    return mat


# ── Dispatch tables ────────────────────────────────────────────────────────

WALL_BUILDERS = {
    'haussmannien': lambda d: mat_pierre_taille(f"mat_{d['styleId']}", d['wallColors'], d.get('roughness', 0.65), d.get('normalStrength', 8.0)),
    'classique':    lambda d: mat_pierre_taille(f"mat_{d['styleId']}", d['wallColors'], d.get('roughness', 0.68), d.get('normalStrength', 5.0)),
    'art_deco':     lambda d: mat_pierre_taille(f"mat_{d['styleId']}", d['wallColors'], d.get('roughness', 0.58), d.get('normalStrength', 7.0)),
    'medieval':     lambda d: mat_pierre_taille(f"mat_{d['styleId']}", d['wallColors'], d.get('roughness', 0.92), d.get('normalStrength', 10.0)),
    'normand':      lambda d: mat_colombage(f"mat_{d['styleId']}", d['wallColors']),
    'alsacien':     lambda d: mat_colombage(f"mat_{d['styleId']}", d['wallColors']),
    'breton':       lambda d: mat_granit(f"mat_{d['styleId']}", d['wallColors']),
    'provencal':    lambda d: mat_enduit(f"mat_{d['styleId']}", d['wallColors'], 0.82),
    'annees60':     lambda d: mat_beton(f"mat_{d['styleId']}", d['wallColors']),
    'annees80':     lambda d: mat_enduit(f"mat_{d['styleId']}", d['wallColors'], 0.72),
    'moderne':      lambda d: mat_enduit(f"mat_{d['styleId']}", d['wallColors'], 0.50),
    'contemporain': lambda d: mat_verre(f"mat_{d['styleId']}"),
    'house':        lambda d: mat_enduit('mat_house',       ['#c8b898'], 0.78),
    'industrial':   lambda d: mat_beton('mat_industrial',   ['#9a9590']),
    'church':       lambda d: mat_pierre_taille('mat_church', d['wallColors'], 0.95, 10.0),
}


def build_roof_mat(style_id, roof_shape):
    name = f'mat_roof_{style_id}'
    if roof_shape == 'mansard':
        return mat_zinc(name)
    if style_id in ('breton',):
        return mat_ardoise(name, (0.025, 0.032, 0.045), (0.065, 0.075, 0.095))
    if style_id in ('normand',):
        return mat_ardoise(name, (0.030, 0.028, 0.025), (0.090, 0.082, 0.072))
    if style_id in ('provencal', 'alsacien', 'medieval'):
        return mat_tuiles(name, (0.45, 0.14, 0.06))
    if roof_shape == 'flat':
        return mat_toit_plat(name)
    # hip fallback : tuiles grises
    return mat_ardoise(name)


# ── Render setup ───────────────────────────────────────────────────────────

def setup_render():
    """Configure Cycles for photorealistic output."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'

    cycles = scene.cycles
    cycles.use_denoising      = True
    cycles.samples            = 128
    cycles.preview_samples    = 32
    cycles.caustics_reflective= False
    cycles.caustics_refractive= False

    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.film_transparent = False

    # World : sky texture (soleil à 15h)
    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    wt = world.node_tree
    wt.nodes.clear()

    bg   = wt.nodes.new('ShaderNodeBackground')
    sky  = wt.nodes.new('ShaderNodeTexSky')
    wout = wt.nodes.new('ShaderNodeOutputWorld')

    for sky_type in ('NISHITA', 'HOSEK_WILKIE', 'PREETHAM'):
        try:
            sky.sky_type = sky_type
            break
        except TypeError:
            continue
    try:
        sky.sun_elevation = math.radians(38)
        sky.sun_rotation  = math.radians(210)
    except AttributeError:
        pass
    try:
        sky.air_density  = 1.0
        sky.dust_density = 0.5
    except AttributeError:
        pass
    bg.inputs['Strength'].default_value = 3.0  # bright midday sun

    wt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    wt.links.new(bg.outputs['Background'], wout.inputs['Surface'])

    # Sun lamp — key light from south-west, same angle as sky
    sun_name = 'RealScape_Sun'
    sun_obj  = bpy.data.objects.get(sun_name)
    if not sun_obj:
        bpy.ops.object.light_add(type='SUN')
        sun_obj = bpy.context.object
        sun_obj.name = sun_name
    sun_obj.rotation_euler = (math.radians(52), 0, math.radians(210))
    sun_obj.data.energy    = 5.0
    sun_obj.data.angle     = math.radians(3.0) # Ombres adoucies pour plus de réalisme

    # ── Positionne la caméra au-dessus de la scène ──────────────────────────
    cam_obj = bpy.data.objects.get('Camera')
    if not cam_obj:
        bpy.ops.object.camera_add()
        cam_obj = bpy.context.object

    # Calcule le centre et la taille de tous les objets mesh
    xs, ys, zs = [], [], []
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for corner in obj.bound_box:
                w = obj.matrix_world @ __import__('mathutils').Vector(corner)
                xs.append(w.x); ys.append(w.y); zs.append(w.z)

    if xs:
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2
        cz = (min(zs) + max(zs)) / 2
        span = max(max(xs) - min(xs), max(ys) - min(ys))

        # Vue en perspective isométrique (45° incliné, angle NW)
        dist = span * 0.85
        cam_obj.location = (cx - dist * 0.6, cy - dist * 0.6, cz + dist * 0.75)
        cam_obj.rotation_euler = (math.radians(52), 0, math.radians(-45))
        cam_obj.data.clip_start = 0.1
        cam_obj.data.clip_end   = span * 10

    scene.camera = cam_obj
    print("Render: Cycles 128smp, 720p, caméra positionnée automatiquement.")


# ── Wall roughness per style ───────────────────────────────────────────────

_WALL_ROUGHNESS = {
    'haussmannien': 0.65, 'classique': 0.68, 'art_deco': 0.58,
    'medieval': 0.92,     'normand':   0.85,  'breton':   0.88,
    'provencal': 0.78,    'alsacien':  0.82,  'annees60': 0.75,
    'annees80':  0.70,    'moderne':   0.45,  'contemporain': 0.15,
    'house':     0.78,    'industrial':0.82,
    'church':    0.95,
}


def _enhance_wall(obj, style_id):
    """Keep the original canvas texture (preserves windows) and fix two things:
    1. Set physically correct roughness on the Principled BSDF.
    2. Force REPEAT extension on Image Texture nodes so UV tiling works
       (Three.js exports RepeatWrapping but Blender defaults to CLIP)."""
    found = False
    for mat in obj.data.materials:
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Roughness'].default_value = _WALL_ROUGHNESS.get(style_id, 0.70)
                found = True
            elif node.type == 'TEX_IMAGE':
                node.extension = 'REPEAT'  # fix UV tiling lost in glTF round-trip
    return found


# ── Main ───────────────────────────────────────────────────────────────────

def apply_mapng_materials():
    roof_cache = {}
    walls_done = roofs_done = skipped = 0

    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue

        # Gestion du sol (terrain)
        if obj.name.startswith("center_terrain") or obj.name.startswith("terrain_"):
            for mat in obj.data.materials:
                if not mat or not mat.use_nodes: continue
                for node in mat.node_tree.nodes:
                    if node.type == 'BSDF_PRINCIPLED':
                        node.inputs['Roughness'].default_value = 0.95
                        if 'Specular' in node.inputs:
                            node.inputs['Specular'].default_value = 0.05
                        elif 'Specular IOR Level' in node.inputs:
                            node.inputs['Specular IOR Level'].default_value = 0.05

                        if 'Base Color' in node.inputs and not node.inputs['Base Color'].is_linked:
                            node.inputs['Base Color'].default_value = hex_to_linear('4d4d4d')
            continue

        # Gestion des routes 3D vectorielles
        if obj.name.startswith("osm_roads"):
            for mat in obj.data.materials:
                if not mat or not mat.use_nodes: continue
                for node in mat.node_tree.nodes:
                    if node.type == 'BSDF_PRINCIPLED':
                        node.inputs['Roughness'].default_value = 0.85
            continue

        style_id  = obj.get('styleId')
        mesh_type = obj.get('type')

        if not style_id or not mesh_type:
            skipped += 1
            continue

        # Custom props may be IDPropertyArray — convert to plain list
        def prop_list(key, default):
            v = obj.get(key, default)
            return list(v) if hasattr(v, '__iter__') and not isinstance(v, str) else default

        if mesh_type == 'wall':
            # Preserve the embedded canvas texture so windows stay visible.
            # Fix UV REPEAT and roughness only.
            if _enhance_wall(obj, style_id):
                walls_done += 1
            else:
                skipped += 1

        elif mesh_type == 'relief':
            # Balconies, cornices, pilasters: vertex-color geometry → apply
            # the same procedural stone/brick material as the matching wall style.
            cache_key = f"relief_{style_id}"
            if cache_key not in roof_cache:
                builder = WALL_BUILDERS.get(style_id)
                data = {
                    'styleId':        style_id,
                    'wallColors':     prop_list('wallColors', ['#d0ccca']),
                    'roughness':      float(obj.get('roughness',      0.70)),
                    'normalStrength': float(obj.get('normalStrength',  5.00)),
                }
                roof_cache[cache_key] = builder(data) if builder else None
            mat = roof_cache.get(cache_key)
            if mat:
                obj.data.materials.clear()
                obj.data.materials.append(mat)
                roofs_done += 1
            else:
                skipped += 1

        elif mesh_type == 'roof':
            roof_shape = obj.get('roofShape', 'flat')
            cache_key  = f"{style_id}_{roof_shape}"
            if cache_key not in roof_cache:
                roof_cache[cache_key] = build_roof_mat(style_id, roof_shape)
            mat = roof_cache[cache_key]
            if mat:
                obj.data.materials.clear()
                obj.data.materials.append(mat)
                roofs_done += 1
            else:
                skipped += 1
        else:
            skipped += 1

    setup_render()
    print(f"\nRealScape: walls={walls_done} (texture preserved)  roofs={roofs_done} (procedural)  skipped={skipped}")
    print("Scene ready — F12 to render.")


apply_mapng_materials()
