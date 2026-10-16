# Rider / racer visual assets · current 2026-10-16

The current standard-quality game uses **the identical VECTOR R8 PWC and R4 rider for all five racers**. AI no longer selects the old low-tier meshes by default. Only a user-selected low-quality setting switches all racers together to the retained fallback tier.

- Rider anatomy: retained official Blender **Human Base Meshes v1.4.1**, realistic adult male, CC0. Provenance and the bundle's original license/readme are retained below and in source/. No new third-party rider, texture, motion-capture or paid model was imported. Official listing: https://www.blender.org/download/demo-files/#assets . CC0 permits sharing the base and adaptations in a public repository.
- Original R4 work: fitted curved flotation vest with scooped neckline/armholes, flat adjustment webbing, zipper and channels; implicit-curve clipped deltoid/forearm/knee/thigh reinforcement and interpolated skinned seams; tightened anatomical garment allowance; adult-scaled full-face shell, neutral semi-transparent optical visor; flexible neck gaiter. Helmet width scaled to 91%, height to 90%, depth to 94% of R3. Shoulder shaping adds up to 13mm per side locally without moving grip or foot sockets. It is an anatomical adaptation, not a scanned or hand-sculpted commercial racing character.
- Rig: 43 → **46 bones**. New thoracic and two clavicle bones, reparented neck/shoulders, height-blended torso weights and blended gaiter weights. Retains the 28 closed-glove digit bones and original pelvis/leg anchors. Runtime lumbar/thoracic flexion, head counter-rotation and two-bone grip IK are visual only. No physics bone/collider is substituted.
- Editable source: **source/hero-rider-r4.blend**; generator **scripts/art/rebuild-rider-r4.py**. Export: **public/models/rider.glb**, 1,508,630 triangles / 15 material groups / 71,141,176 bytes, with 18 relative 2048² PNGs in **public/models/rider-r4/textures/** (62,768,741 bytes). Existing original project-authored BaseColor/Normal/ORM finishes are reused; no new photographed fabric/skin or high-poly AO bake is claimed.
- Boat **source/hero-pwc-r8.blend**, watercraft.glb and its PNGs are byte-identical to the checkpoint. AI uses those same geometry and textures. Per-racer material copies allow blue/orange/violet/gold/mint boat, PFD, leather and helmet accents; they do not alter source textures. Each has independent bones and a 2048² local self-shadow pass.
- Default asset rebuild: scripts/build-racecraft.mjs runs rebuild-hero-pwc.py then rebuild-rider-r4.py. Directly run only the latter when editing the character. Blender 4.5.9 LTS was used. Game development/build does not require Blender.
- R3 sources/textures and low-tier files are retained for history/fallback; they are not the standard AI visuals. Character quality still needs user acceptance: facial skin is unscanned and uses a simple material; clothing is authored geometric/procedural detail, with no cloth simulation or facial animation.

Actual browser captures and verification: **docs/rider-ai-review/index.html**, **docs/rider-ai-validation.md**.

## Previous R8 / R3 implementation record


## Current hero assets · 2026-10-16

The default `assets:build` now runs **`rebuild-hero-pwc.py` followed by `rebuild-hero-rider.py`**. It replaces only the high-tier player visuals. The lower sections document earlier generations, not the current default build.

- `source/hero-pwc-r8.blend`: a deep exterior reconstruction of the original project PWC. New compound foredeck, double-chine lower shell, turned shoulder panels with cut-through ducts, waisted center body, stepped fitted saddle, integrated steering/display and revised mirror mounts. The original R7 jet pump, grips and footwell hardware are reused deliberately. 330 runtime/source parts plus 45 hidden design surfaces. No manufacturer's mesh, texture or branding is used.
- `source/hero-rider-r3.blend`: the retained CC0-derived anatomical seated skin is reshaped into a continuous race suit. Smooth interpolated colour panels and sewn boundaries replace separate tube sleeves and spherical joint covers. New full-face shell/eye port, visor, vents, aerofoil, boots and woven buoyancy vest. The existing 43-bone seated rig, heat weights and closed glove digits remain; garment skin follows that binding rather than a second animation system.
- `public/models/watercraft.glb` plus `pwc-r8/textures/`, and `rider.glb` plus `rider-r3/textures/`, are the current runtime assets. Each image URI is relative. Source `.blend` files retain packed or relative original-resolution PBR images; retain `textures/hero/` with them.
- No new external bitmap was acquired. Original 2K BaseColor/Normal/ORM finishes are reused/reassigned; suit colours additionally use interpolated vertex attributes. Procedural microstructure and analytic AO are not scanned clothing or a new high-poly AO bake.
- New water displacement, directional ripple spectrum, Fresnel/GGX shading, current-frame planar reflections and wake-normal/foam integration are original code built on Three.js's maintained `Water` mirror-camera helper (Three.js MIT, already in project dependencies).

Free model research: the [XOIAL Kawasaki candidate](https://sketchfab.com/3d-models/kawasaki-310xultra-jet-ski-37a2348f02da472d98310fd5621307c6) and [appsnation Jetski candidate](https://sketchfab.com/3d-models/jetski-15e79c65f67a468592cdc2ac1f5b389b) were not downloaded or used. Both official download API requests returned401 without authentication on2026-10-16. Listing claims do not establish a verified source package/license; no unknown files were imported. The already retained Blender CC0 human base remains the only external anatomical base. See `docs/hero-water-rebuild-validation.md` for evidence and current limitations.

The new project-authored geometry/material/shader work does not introduce a paid asset or extra attribution requirement. CC0 base files retain their provenance below; this document does not relicense the whole project.

No purchases or commercial-game extractions. Both downloads were obtained and opened in Blender.

| Asset | Author / publisher | License | Download / retained source |
|---|---|---|---|
| [Personal watercraft](https://www.innerscene.com/tools/library/3d-parts/personal-watercraft-1956f692) | Innerscene, original unbranded model | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | [GLB](https://www.innerscene.com/api/library/personal-watercraft-1956f692/download), 5,310,264 bytes; `source/pwc-cc0.glb` |
| [Human Base Meshes](https://www.blender.org/download/demo-files/#assets) | Blender Studio / Blender community | CC0 per official asset listing and bundle README | [v1.4.1 ZIP](https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip), 50,643,039 bytes; selected `GEO-body_male_realistic` retained in `source/human-base-cc0.blend` |

Innerscene's [library terms](https://www.innerscene.com/tools/library/terms) explicitly permit modification and redistribution, including commercially. CC0 allows redistribution of source files and derivatives in public GitHub projects, without attribution as a condition. No manufacturer marks were added.

The human bundle README explicitly states all supplied assets are CC0. No Rain Rig or Ellie asset is used. A generic text named `License` in the bundle separately mentions **Rain Rig, CC BY 4.0**; both original text blocks are preserved as `source/human-bundle-readme.txt` and `source/human-bundle-license-text.txt`. For completeness retain the supplied credit **© Blender Foundation | cloud.blender.org**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This record does not relicense unrelated Rain/Ellie assets as CC0.

SHA256 of actual downloads:

```text
pwc-cc0.glb: 8BBE782C1DAE5FF9E400709493E6C8F76F25724EDD09217A7E180A9858AD3998
human-base-meshes-bundle-v1.4.1.zip: 811F43ACCBB31A88266D932F8F5563B2D13586FCA0BA2693AAD1F5FE582B3515
```

The full 50 MB human bundle is not shipped. The selected base and its source records are retained.

## Adaptation and editing

- `source/racecraft.blend`: editable PWC parts before batching/LOD. Rotate forward to game +Z, scale 1.18× and shift the visual waterline down 0.22 m without moving physics; blue/pearl finish, neutralized paint texture for AI palette tint, revised metal/rubber/glass, original inset lights/digital instrument, seat/grip/foot/pump sockets. Retains the supplied closed hull, curved saddle, foot wells, grab rail, steering and pump.
- `source/racer.blend`: anatomical body, original 15-bone seated rig and bone-heat skinning, racing suit, original weave normal/roughness, original full-face helmet/visor/seals, gloves/boots, seam tape and protection. Unneeded head/feet beneath equipment removed. No third-party rig or animation used.
- `scripts/art/build-racecraft.py`: Blender adaptation and export. Inputs are the original GLB and selected human `.blend`; derived scenes above remain editable. Manual changes to derived scenes require direct export or corresponding changes to the generator before rebuilding.
- `public/models/{watercraft,rider}{,-low}.glb`: runtime models with embedded textures and skin, no local absolute asset paths.

Run `npm run assets:build` with Blender 4.5+, or set `BLENDER_PATH`. The wrapper recognizes the existing local portable Blender. Missing Blender stops without replacing checked-in GLBs. Normal development/build does not require Blender.

## Hero deep refinement · 2026-10-16

The default `assets:build` now runs `scripts/art/refine-hero-assets.py`, opening the retained editable `racecraft.blend` and `racer.blend`. It reconstructs **only** `watercraft.glb` and `rider.glb`; the previous `*-low.glb` remain unchanged for AI. The older adaptation script above remains available explicitly as `blender --background --python scripts/art/build-racecraft.py`; running it replaces both high and low models with the historical adaptation.

- `source/hero-craft.blend`: original quad-section rising bow and double-chine hull, formed cowl and silver shoulder panels, separate rear fairings, recessed intake/vanes, two-zone saddle and stitching, molded footwell/chevrons/scuppers, swept steering/grip/clamps/triggers/cables, original LCD console, cast boarding handle, steering nozzle/stator/reverse linkage and deck fasteners. Uses curve surfaces, mesh editing, shell thickness, subdivision and beveling; no hero decimation. The CC0 baseline supplies the floor/spine and visual socket positions, not the new principal exterior shells.
- `source/hero-racer.blend`: retained anatomical human skin with garment allowance; new shaped garment panels cut to the body, sleeves/thigh/shin panels, seams/zipper/back identification, layered boots, fully reconstructed helmet with actual eye opening/visor/seals/vents/hinges, facial insert from the same CC0 human and original eye parts. The seated skeleton is reposed, arm skin updated and **28 digit bones** added to the original 15 bones. Garments inherit the anatomical weights; each glove digit is bound to its corresponding bone. No downloaded animation or third-party rig.
- `textures/hero/`: 36 original 2048² BaseColor/Normal/ORM images (12 material sets) and one original 1024² instrument image. ORM packs analytic occlusion, roughness and metallic into RGB. These are generated surface details, **not** a high-poly ray-baked AO set or photographed fabric. Images are packed in `.blend` and GLB as well as retained separately for editing. No new external bitmap source.
- Runtime `AnatomicalRider` detects the hero asset metadata. Its visual IK lowers elbows, keeps the closed hands oriented on the unchanged grips and allows the head to counter the torso lean. This does not modify driving or AI. The historical AI/low rig follows its previous path.

Both source licenses and their redistribution rights above still apply. New geometry, textures, equipment and rig additions are original project work; no new third-party asset or attribution obligation. No manufacturer marks or extracted commercial-game content. See `docs/hero-refinement-validation.md` for current screenshots and verification boundaries.

## VECTOR R7 PWC reconstruction · 2026-10-16

The current default `assets:build` runs `scripts/art/build-pwc-r7.py` and rebuilds **only the player PWC**. Rider and both low-tier GLBs are left byte-for-byte unchanged. The earlier hero generator remains a historical tool; running it directly replaces the current PWC with that historical version.

All current hull, foredeck, shoulders, pedestal, seat, footwell, steering and pump geometry is newly authored in Blender. The previous `hero-craft.blend` supplies only original project PBR finishes/LCD and unchanged sockets. The new editable source is `source/pwc-r7.blend`: 351 categorized parts and 11 hidden design-control meshes before cuts/thickness/subdivision. These cages are editable design snapshots, not a live parametric dependency graph. Original 2K maps are referenced relatively from `textures/hero/`; retain that folder with the source file.

Runtime: `public/models/watercraft.glb` plus **all** files in `public/models/pwc-r7/textures/`. The 19 PNGs retain full resolution and encoded pixel data; separating images from geometry avoids a single oversized file without decimation or image quality changes. The existing Three.js GLTFLoader resolves the relative glTF image URLs. No loader or driving code was changed. `public/models/manifest.json` lists each dependency.

New geometry and VECTOR/R7 markings are project-original, with no new downloaded assets, brand marks or attribution requirements. Candidate Sketchfab downloads required authentication and were not used; details, author/license listings and actual HTTP401 records are in `docs/pwc-r7-validation.md`. Existing CC0 source documentation is retained as provenance for historical assets, not a claim that the new PWC's geometry was downloaded or is automatically relicensed CC0.

Digital instrument, helmet/equipment, weave textures and water normal/shader are original project work. CC0 source parts remain CC0; original additions retain the project owner's chosen license. This file does not grant a new license for the entire game.
