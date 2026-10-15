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

Digital instrument, helmet/equipment, weave textures and water normal/shader are original project work. CC0 source parts remain CC0; original additions retain the project owner's chosen license. This file does not grant a new license for the entire game.
