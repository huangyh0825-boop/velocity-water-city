# Racecraft art sources · checked 2026-10-15

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

Digital instrument, helmet/equipment, weave textures and water normal/shader are original project work. CC0 source parts remain CC0; original additions retain the project owner's chosen license. This file does not grant a new license for the entire game.
