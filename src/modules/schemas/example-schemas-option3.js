export const twistedTowerSchema = {
  "version": "4.3",
  "type": "emergent_procedure",
  "intent": "Robust Aligned Tower",
  "materials": {
    "wall": { "color": "#1a3a5c", "roughness": 0.7, "metalness": 0.1 },
    "window": { "color": "#b3d9ff", "roughness": 0.1, "metalness": 0.2, "transparent": true, "opacity": 0.3 },
    "core": { "color": "#c1440e", "roughness": 0.6, "metalness": 0 },
    "column": { "color": "#2a2a2a", "roughness": 0.8, "metalness": 0.3 },
    "floor_slab": { "color": "#b8b8b8", "roughness": 0.7, "metalness": 0.1 }
  },
  "context": {
    "floors": 15,
    "floorHeight": 3.5,
    "coreWidth": 8,
    "coreDepth": 8,
    "slabExpansion": 2,
    "rotationPerFloor": 0.08
  },
  "actions": [
    {
      "thought": "1. Create Slab (Geometry only, centered)",
      "do": "createBox",
      "params": {
        "width": "ctx.coreWidth + ctx.slabExpansion",
        "height": 0.3,
        "depth": "ctx.coreDepth + ctx.slabExpansion"
      },
      "transform": { "position": [0, -0.15, 0] }, // Shift geometry DOWN relative to group origin
      "as": "slab_mesh"
    },
    {
      "thought": "2. Create Core (Shifted UP relative to group origin)",
      "do": "createBox",
      "params": {
        "width": "ctx.coreWidth",
        "height": "ctx.floorHeight", 
        "depth": "ctx.coreDepth"
      },
      "transform": { "position": [0, "ctx.floorHeight/2", 0] },
      "as": "core_mesh"
    },
    {
      "thought": "3. Create Columns (Shifted UP)",
      "do": "createCylinder",
      "params": {
        "radiusTop": 0.4, "radiusBottom": 0.4, "height": "ctx.floorHeight"
      },
      "transform": { "position": [0, "ctx.floorHeight/2", 0] },
      "as": "col_base"
    },
    {
      "thought": "Distribute Columns",
      "do": "distributeOnGrid3d",
      "params": {
        "geometry": "col_base",
        "rows": 2, "cols": 2,
        "spacing": ["ctx.coreWidth + 1", 0, "ctx.coreDepth + 1"],
        "centered": true,
        "autoMerge": true
      },
      // No extra transform here because col_base already has the Y-shift
      "as": "cols_mesh"
    },
    {
      "thought": "4. Create Facade Panels (Walls)",
      "do": "createBox",
      "params": {
        "width": "ctx.coreWidth + ctx.slabExpansion",
        "height": "ctx.floorHeight",
        "depth": 0.2
      },
      // Shift UP (for height) and BACK (for radius)
      "transform": { "position": [0, "ctx.floorHeight/2", "(ctx.coreDepth + ctx.slabExpansion)/2 - 0.1"] },
      "as": "wall_front"
    },
    {
      "thought": "Back Wall",
      "do": "createBox",
      "params": {
        "width": "ctx.coreWidth + ctx.slabExpansion",
        "height": "ctx.floorHeight",
        "depth": 0.2
      },
      "transform": { "position": [0, "ctx.floorHeight/2", "-(ctx.coreDepth + ctx.slabExpansion)/2 + 0.1"] },
      "as": "wall_back"
    },
    {
      "thought": "Right Wall",
      "do": "createBox",
      "params": {
        "width": 0.2,
        "height": "ctx.floorHeight",
        "depth": "ctx.coreDepth + ctx.slabExpansion - 0.4"
      },
      "transform": { "position": ["(ctx.coreWidth + ctx.slabExpansion)/2 - 0.1", "ctx.floorHeight/2", 0] },
      "as": "wall_right"
    },
    {
      "thought": "Left Wall",
      "do": "createBox",
      "params": {
        "width": 0.2,
        "height": "ctx.floorHeight",
        "depth": "ctx.coreDepth + ctx.slabExpansion - 0.4"
      },
      "transform": { "position": ["-(ctx.coreWidth + ctx.slabExpansion)/2 + 0.1", "ctx.floorHeight/2", 0] },
      "as": "wall_left"
    },
    {
      "thought": "5. STACKING LOOP - Cloning the *transformed* meshes",
      "do": "loop",
      "var": "i",
      "from": 0,
      "to": "ctx.floors",
      "body": [
        // The TRICK: When cloning, we use the executor's transform to move the *Clone*
        // The *original* transform (internal offset) is preserved inside the geometry/mesh
        {
          "do": "clone",
          "params": { "id": "slab_mesh" },
          // This applies to the GROUP/MESH container, moving it up
          "transform": { "position": [0, "i * ctx.floorHeight", 0], "rotation": [0, "i * ctx.rotationPerFloor", 0] },
          "material": "floor_slab"
        },
        {
          "do": "clone",
          "params": { "id": "core_mesh" },
          "transform": { "position": [0, "i * ctx.floorHeight", 0], "rotation": [0, "i * ctx.rotationPerFloor", 0] },
          "material": "core"
        },
        {
          "do": "clone",
          "params": { "id": "cols_mesh" },
          "transform": { "position": [0, "i * ctx.floorHeight", 0], "rotation": [0, "i * ctx.rotationPerFloor", 0] },
          "material": "column"
        },
        {
          "do": "clone",
          "params": { "id": "wall_front" },
          "transform": { "position": [0, "i * ctx.floorHeight", 0], "rotation": [0, "i * ctx.rotationPerFloor", 0] },
          "material": "(i % 2 === 0) ? 'wall' : 'window'"
        },
        {
          "do": "clone",
          "params": { "id": "wall_back" },
          "transform": { "position": [0, "i * ctx.floorHeight", 0], "rotation": [0, "i * ctx.rotationPerFloor", 0] },
          "material": "(i % 2 === 1) ? 'wall' : 'window'"
        },
        {
          "do": "clone",
          "params": { "id": "wall_right" },
          "transform": { "position": [0, "i * ctx.floorHeight", 0], "rotation": [0, "i * ctx.rotationPerFloor", 0] },
          "material": "(i % 2 === 0) ? 'window' : 'wall'"
        },
        {
          "do": "clone",
          "params": { "id": "wall_left" },
          "transform": { "position": [0, "i * ctx.floorHeight", 0], "rotation": [0, "i * ctx.rotationPerFloor", 0] },
          "material": "(i % 2 === 1) ? 'window' : 'wall'"
        }
      ]
    }
  ]
} 
;
