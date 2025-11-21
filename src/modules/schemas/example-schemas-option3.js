// ============================================================================
// example-schemas-option3.js - FIXED SYNTAX
// ============================================================================

// ===========================================================================
// EXAMPLE 1: Twisted Tower with Checkerboard Facade
// ===========================================================================

export const twistedTowerSchema = {
  "version": "4.2",
  "type": "emergent_procedure",
  "intent": "Correctly Aligned Twisted Tower",
  "materials": {
    "wall": { "color": "#1a3a5c", "roughness": 0.7, "metalness": 0.1 },
    "window": { "color": "#b3d9ff", "roughness": 0.1, "metalness": 0.2, "transparent": true, "opacity": 0.3 },
    "core": { "color": "#c1440e", "roughness": 0.6, "metalness": 0 },
    "column": { "color": "#2a2a2a", "roughness": 0.8, "metalness": 0.3 },
    "floor_slab": { "color": "#b8b8b8", "roughness": 0.7, "metalness": 0.1 }
  },
  "globalParameters": {
    "floors": { "value": 15, "type": "integer", "min": 3, "max": 30 },
    "floorHeight": { "value": 3.5, "type": "number", "min": 2, "max": 5 },
    "coreWidth": { "value": 8, "type": "number", "min": 4, "max": 16 },
    "coreDepth": { "value": 8, "type": "number", "min": 4, "max": 12 },
    "slabExpansion": { "value": 2, "type": "number", "min": 0, "max": 4 },
    "rotationPerFloor": { "value": 0.08, "type": "number", "min": 0, "max": 0.2 }
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
      "thought": "1. Create Slab - Shifted DOWN so Top is at Y=0",
      "do": "createBox",
      "params": {
        "width": "ctx.coreWidth + ctx.slabExpansion",
        "height": 0.3,
        "depth": "ctx.coreDepth + ctx.slabExpansion",
        "position": [0, "-0.15", 0] 
      },
      "as": "slab_geometry"
    },
    {
      "thought": "2. Create Core - Shifted UP so Bottom is at Y=0",
      "do": "createBox",
      "params": {
        "width": "ctx.coreWidth",
        "height": "ctx.floorHeight", 
        "depth": "ctx.coreDepth",
        "position": [0, "ctx.floorHeight/2", 0]
      },
      "as": "core_geometry"
    },
    {
      "thought": "3. Create Columns - Shifted UP so Bottom is at Y=0",
      "do": "createCylinder",
      "params": {
        "radiusTop": 0.4, "radiusBottom": 0.4, "height": "ctx.floorHeight",
        "position": [0, "ctx.floorHeight/2", 0]
      },
      "as": "col_geometry"
    },
    {
      "thought": "Distribute Columns",
      "do": "distributeOnGrid3d",
      "params": {
        "geometry": "col_geometry",
        "rows": 2, "cols": 2,
        "spacing": ["ctx.coreWidth + 1", 0, "ctx.coreDepth + 1"],
        "centered": true
      },
      "as": "cols_group"
    },
    {
      "thought": "4. Create Facade Panels - Aligned to Slab Edge",
      "do": "createBox",
      "params": {
        "width": "ctx.coreWidth + ctx.slabExpansion",
        "height": "ctx.floorHeight",
        "depth": 0.2,
        "position": [0, "ctx.floorHeight/2", "(ctx.coreDepth + ctx.slabExpansion)/2 - 0.1"] 
      },
      "as": "wall_front"
    },
    {
      "thought": "Back Wall",
      "do": "createBox",
      "params": {
        "width": "ctx.coreWidth + ctx.slabExpansion",
        "height": "ctx.floorHeight",
        "depth": 0.2,
        "position": [0, "ctx.floorHeight/2", "-(ctx.coreDepth + ctx.slabExpansion)/2 + 0.1"]
      },
      "as": "wall_back"
    },
    {
      "thought": "Right Wall",
      "do": "createBox",
      "params": {
        "width": 0.2,
        "height": "ctx.floorHeight",
        "depth": "ctx.coreDepth + ctx.slabExpansion - 0.4", // Subtract overlapping corners
        "position": ["(ctx.coreWidth + ctx.slabExpansion)/2 - 0.1", "ctx.floorHeight/2", 0]
      },
      "as": "wall_right"
    },
    {
      "thought": "Left Wall",
      "do": "createBox",
      "params": {
        "width": 0.2,
        "height": "ctx.floorHeight",
        "depth": "ctx.coreDepth + ctx.slabExpansion - 0.4", // Subtract overlapping corners
        "position": ["-(ctx.coreWidth + ctx.slabExpansion)/2 + 0.1", "ctx.floorHeight/2", 0]
      },
      "as": "wall_left"
    },
    {
      "thought": "5. Stack Floors",
      "do": "loop",
      "var": "i",
      "from": 0,
      "to": "ctx.floors",
      "body": [
        {
          "do": "clone",
          "params": { "id": "slab_geometry" },
          "transform": { "position": [0, "i * ctx.floorHeight", 0], "rotation": [0, "i * ctx.rotationPerFloor", 0] },
          "material": "floor_slab"
        },
        {
          "do": "clone",
          "params": { "id": "core_geometry" },
          "transform": { "position": [0, "i * ctx.floorHeight", 0], "rotation": [0, "i * ctx.rotationPerFloor", 0] },
          "material": "core"
        },
        {
          "do": "clone",
          "params": { "id": "cols_group" },
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






// ============================================================================
// Alternative: Simpler approach - use flat structure
// ============================================================================

export const simpleTowerSchema = {
  version: "3.2",
  type: "parametric_procedure",
  materials: {
    wall: { color: "#1a3a5c", roughness: 0.7, metalness: 0.1 },
    window: { color: "#b3d9ff", roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.3 },
    core: { color: "#c1440e", roughness: 0.6, metalness: 0.0 },
    floor_slab: { color: "#b8b8b8", roughness: 0.7, metalness: 0.1 }
  },

  globalParameters: {
    floors: { value: 10, type: "integer", min: 3, max: 20 },
    floorHeight: { value: 3, type: "number", min: 2, max: 6 },
    coreSize: { value: 8, type: "number", min: 4, max: 16 },
    twistPerFloor: { value: 0.06, type: "number", min: 0, max: 0.2 }
  },

  procedures: [
    {
      name: "buildSimpleTower",
      steps: [
        // Repeat floor cores
        {
          action: "repeat",
          helper: "createBox",
          count: "$floors",
          axis: "y",
          spacing: "$floorHeight",
          params: {
            width: "$coreSize",
            height: "$floorHeight",
            depth: "$coreSize",
            id: "core"
          },
          material: "core",
          rotationPerStep: [0, "$twistPerFloor", 0]
        }
      ]
    }
  ]
};

// ===========================================================================
// EXAMPLE 2: Simple Grid
// ===========================================================================

export const simpleGridSchema = {
  version: "3.2",
  type: "parametric_procedure",
  materials: {
    red: { color: "#ff0000", roughness: 0.5, metalness: 0 },
    blue: { color: "#0000ff", roughness: 0.5, metalness: 0 }
  },

  globalParameters: {
    gridSize: { value: 5, type: "integer", min: 2, max: 10 }
  },

  procedures: [
    {
      name: "buildGrid",
      steps: [
        {
          action: "repeat",
          helper: "createBox",
          count: "$gridSize",
          axis: "x",
          spacing: 3,
          params: {
            width: 2,
            height: 2,
            depth: 2,
            id: "box"
          },
          material: "if(mod(index,2)==0,'red','blue')"
        }
      ]
    }
  ]
};

// ===========================================================================
// EXAMPLE 3: Pavilion
// ===========================================================================

export const pavilionSchema = {
  version: "3.2",
  type: "parametric_procedure",
  materials: {
    concrete: { color: "#999999", roughness: 0.9, metalness: 0 }
  },

  globalParameters: {
    unitCount: { value: 6, type: "integer", min: 3, max: 20 },
    unitSize: { value: 4, type: "number", min: 2, max: 8 },
    height: { value: 3.5, type: "number", min: 2, max: 6 },
    spiralRadius: { value: 20, type: "number", min: 10, max: 50 }
  },

  procedures: [
    {
      name: "buildPavilion",
      steps: [
        {
          action: "loop",
          var: "unitIndex",
          from: 0,
          to: "$unitCount",
          body: [
            {
              action: "createGeometry",
              helper: "createBox",
              params: {
                width: "$unitSize",
                height: "$height",
                depth: "$unitSize",
                position: [
                  "$spiralRadius * cos(unitIndex * 2 * pi / $unitCount)",
                  0,
                  "$spiralRadius * sin(unitIndex * 2 * pi / $unitCount)"
                ],
                id: "unit"
              },
              material: "concrete",
              transform: {
                rotateY: "$unitIndex * 2 * pi / $unitCount + pi / 2"
              }
            }
          ]
        }
      ]
    }
  ]
};

// ===========================================================================
// EXAMPLE 4: Spa Center
// ===========================================================================

export const spaSchema = {
  version: "3.2",
  type: "parametric_procedure",
  materials: {
    tiling: { color: "#e8d7c3", roughness: 0.6, metalness: 0 },
    water: { color: "#3aa9e0", roughness: 0.2, metalness: 0, transparent: true, opacity: 0.7 }
  },

  globalParameters: {
    modules: { value: 4, type: "integer", min: 2, max: 8 },
    moduleWidth: { value: 6, type: "number", min: 4, max: 10 }
  },

  procedures: [
    {
      name: "buildSpa",
      steps: [
        {
          action: "loop",
          var: "modIndex",
          from: 0,
          to: "$modules",
          body: [
            {
              action: "createGeometry",
              helper: "createBox",
              params: {
                width: "$moduleWidth",
                height: 3.2,
                depth: 5,
                position: ["$modIndex * $moduleWidth + modIndex", 0, 0],
                id: "module"
              },
              material: "tiling"
            }
          ]
        }
      ]
    }
  ]
};

// ===========================================================================
// EXAMPLE 5: Roman Viaduct
// ===========================================================================

export const romanViaductSchema = {
  version: "3.2",
  type: "parametric_procedure",
  materials: {
    stone: { color: "#d4c5b9", roughness: 0.8, metalness: 0 }
  },

  globalParameters: {
    spans: { value: 8, type: "integer", min: 3, max: 15 },
    archWidth: { value: 6, type: "number", min: 4, max: 10 }
  },

  procedures: [
    {
      name: "buildViaduct",
      steps: [
        {
          action: "repeat",
          helper: "createBox",
          count: "$spans",
          axis: "x",
          spacing: "$archWidth + 2",
          params: {
            width: "$archWidth",
            height: 5,
            depth: 4,
            id: "arch"
          },
          material: "stone"
        }
      ]
    }
  ]
};

// ===========================================================================
// EXAMPLE 6: Stacked Cylinders
// ===========================================================================

export const stackedCylindersSchema = {
  version: "3.2",
  type: "parametric_procedure",
  materials: {
    gold: { color: "#ffd700", roughness: 0.3, metalness: 0.9 },
    silver: { color: "#c0c0c0", roughness: 0.4, metalness: 0.8 }
  },

  globalParameters: {
    layers: { value: 8, type: "integer", min: 3, max: 20 },
    radius: { value: 5, type: "number", min: 2, max: 10 },
    height: { value: 1, type: "number", min: 0.5, max: 3 }
  },

  procedures: [
    {
      name: "buildStack",
      steps: [
        {
          action: "repeat",
          helper: "createCylinder",
          count: "$layers",
          axis: "y",
          spacing: "$height",
          params: {
            radiusTop: "$radius",
            radiusBottom: "$radius",
            height: "$height",
            id: "cylinder"
          },
          material: "if(mod(index,2)==0,'gold','silver')"
        }
      ]
    }
  ]
};

// ===========================================================================
// EXAMPLE 7: Sphere Grid
// ===========================================================================

export const sphereGridSchema = {
  version: "3.2",
  type: "parametric_procedure",
  materials: {
    sphere_mat: { color: "#ff6b9d", roughness: 0.4, metalness: 0.3 }
  },

  globalParameters: {
    gridCount: { value: 5, type: "integer", min: 2, max: 10 }
  },

  procedures: [
    {
      name: "buildSphereGrid",
      steps: [
        {
          action: "loop",
          var: "x",
          from: 0,
          to: "$gridCount",
          body: [
            {
              action: "loop",
              var: "z",
              from: 0,
              to: "$gridCount",
              body: [
                {
                  action: "createGeometry",
                  helper: "createSphere",
                  params: {
                    radius: 0.8,
                    position: ["$x * 3", 0, "$z * 3"],
                    id: "sphere"
                  },
                  material: "sphere_mat"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};


// custom wall panels tower schema
export const customWallPanelsTowerSchema = {
  "version": "3.2",
  "type": "parametric_procedure",
  "materials": {
    "wall": { "color": "#ebebebff", "roughness": 0.7, "metalness": 0.1 },
    "window": { "color": "#b3d9ff", "roughness": 0.1, "metalness": 0.2, "transparent": true, "opacity": 0.5 },
    "core": { "color": "#c1440e", "roughness": 0.6, "metalness": 0 },
    "column": { "color": "#2a2a2a", "roughness": 0.8, "metalness": 0.3 },
    "floor_slab": { "color": "#b8b8b8", "roughness": 0.7, "metalness": 0.1 }
  },

  "globalParameters": {
    "floors": { "value": 12, "type": "integer", "min": 3, "max": 30 },
    "floorHeight": { "value": 3, "type": "number", "min": 2, "max": 5 },
    "coreWidth": { "value": 8, "type": "number", "min": 4, "max": 16 },
    "coreDepth": { "value": 6, "type": "number", "min": 4, "max": 12 },
    "slabExpansion": { "value": 1.1, "type": "number", "min": 1.0, "max": 2.0 },
    "columnRad": { "value": 0.3, "type": "number", "min": 0.1, "max": 1.0 },

    "panelsPerSideFront": { "value": 12, "type": "integer", "min": 4, "max": 24 },
    "panelsPerSideBack": { "value": 12, "type": "integer", "min": 4, "max": 24 },
    "panelsPerSideLeft": { "value": 12, "type": "integer", "min": 4, "max": 24 },
    "panelsPerSideRight": { "value": 12, "type": "integer", "min": 4, "max": 24 },

    "twistPerFloor": { "value": 0.06, "type": "number", "min": 0, "max": 0.3 },
    "twistStartFloor": { "value": 2, "type": "integer", "min": 0, "max": 30 },
    "twistEndFloor": { "value": 9, "type": "integer", "min": 0, "max": 30 },
    
    "hexRadius": { "value": 0.5, "type": "number", "min": 0.5, "max": 2.5 }
  },

  "procedures": [
    {
      "name": "buildTower",
      "steps": [
        {
          "action": "createGeometry",
          "helper": "createBox",
          "params": { "width": "$coreWidth", "height": "$floorHeight", "depth": "$coreDepth" },
          "material": "core",
          "store": "core"
        },

        {
          "action": "createGeometry",
          "helper": "createBox",
          "params": {
            "width": "$coreWidth * 2 * $slabExpansion",
            "height": 0.25,
            "depth": "$coreDepth * 2 * $slabExpansion",
            "position": [0, "-$floorHeight / 2", 0]
          },
          "material": "floor_slab",
          "store": "slab"
        },

        {
          "action": "createGeometry",
          "helper": "createCylinder",
          "params": { "radiusTop": "$columnRad", "radiusBottom": "$columnRad", "height": "$floorHeight" },
          "material": "column",
          "store": "col_single"
        },

        {
          "action": "createGeometry",
          "helper": "distributeOnGrid3d",
          "params": {
            "geometry": "col_single",
            "rows": 2,
            "cols": 2,
            "spacing": ["$coreWidth * 1.8", 0, "$coreDepth * 1.8"],
            "centered": true
          },
          "material": "column",
          "store": "columns"
        },

        {
          "action": "repeat",
          "helper": "createExtrude",
          "count": "$panelsPerSideFront",
          "axis": "x",
          "spacing": "$coreWidth * 2 * $slabExpansion / $panelsPerSideFront",
          "params": {
            "profile": "polygon2d(0, 0, $hexRadius, 6)",
            "depth": "$floorHeight - 0.1",
            "bevelEnabled": false,
            "rot": [1.5708, 0, 0],
            "pos": [
              "-$coreWidth * $slabExpansion + ($coreWidth * 2 * $slabExpansion / $panelsPerSideFront / 2)",
              "$floorHeight / 2",
              "$coreDepth * $slabExpansion"
            ]
          },
          "material": "if(mod(index,2)==0,'wall','window')",
          "store": "front_a"
        },

        {
          "action": "repeat",
          "helper": "createExtrude",
          "count": "$panelsPerSideFront",
          "axis": "x",
          "spacing": "$coreWidth * 2 * $slabExpansion / $panelsPerSideFront",
          "params": {
            "profile": "polygon2d(0, 0, $hexRadius, 6)",
            "depth": "$floorHeight - 0.1",
            "bevelEnabled": false,
            "rot": [1.5708, 0, 0],
            "pos": [
              "-$coreWidth * $slabExpansion + ($coreWidth * 2 * $slabExpansion / $panelsPerSideFront / 2)",
              "$floorHeight / 2",
              "$coreDepth * $slabExpansion"
            ]
          },
          "material": "if(mod(index,2)==1,'wall','window')",
          "store": "front_b"
        },

        {
          "action": "repeat",
          "helper": "createExtrude",
          "count": "$panelsPerSideBack",
          "axis": "x",
          "spacing": "$coreWidth * 2 * $slabExpansion / $panelsPerSideBack",
          "params": {
            "profile": "polygon2d(0, 0, $hexRadius, 6)",
            "depth": "$floorHeight - 0.1",
            "bevelEnabled": false,
            "rot": [1.5708, 0, 0],
            "pos": [
              "-$coreWidth * $slabExpansion + ($coreWidth * 2 * $slabExpansion / $panelsPerSideBack / 2)",
              "$floorHeight / 2",
              "-$coreDepth * $slabExpansion"
            ]
          },
          "material": "if(mod(index,2)==0,'wall','window')",
          "store": "back_a"
        },

        {
          "action": "repeat",
          "helper": "createExtrude",
          "count": "$panelsPerSideBack",
          "axis": "x",
          "spacing": "$coreWidth * 2 * $slabExpansion / $panelsPerSideBack",
          "params": {
            "profile": "polygon2d(0, 0, $hexRadius, 6)",
            "depth": "$floorHeight - 0.1",
            "bevelEnabled": false,
            "rot": [1.5708, 0, 0],
            "pos": [
              "-$coreWidth * $slabExpansion + ($coreWidth * 2 * $slabExpansion / $panelsPerSideBack / 2)",
              "$floorHeight / 2",
              "-$coreDepth * $slabExpansion"
            ]
          },
          "material": "if(mod(index,2)==1,'wall','window')",
          "store": "back_b"
        },

        {
          "action": "repeat",
          "helper": "createExtrude",
          "count": "$panelsPerSideLeft",
          "axis": "z",
          "spacing": "$coreDepth * 2 * $slabExpansion / $panelsPerSideLeft",
          "params": {
            "profile": "polygon2d(0, 0, $hexRadius, 6)",
            "depth": "$floorHeight - 0.1",
            "bevelEnabled": false,
            "rot": [1.5708, 0, -1.5708],
            "pos": [
              "-$coreWidth * $slabExpansion",
              "$floorHeight / 2",
              "-$coreDepth * $slabExpansion + ($coreDepth * 2 * $slabExpansion / $panelsPerSideLeft / 2)"
            ]
          },
          "material": "if(mod(index,2)==0,'wall','window')",
          "store": "left_a"
        },

        {
          "action": "repeat",
          "helper": "createExtrude",
          "count": "$panelsPerSideLeft",
          "axis": "z",
          "spacing": "$coreDepth * 2 * $slabExpansion / $panelsPerSideLeft",
          "params": {
            "profile": "polygon2d(0, 0, $hexRadius, 6)",
            "depth": "$floorHeight - 0.1",
            "bevelEnabled": false,
            "rot": [1.5708, 0, -1.5708],
            "pos": [
              "-$coreWidth * $slabExpansion",
              "$floorHeight / 2",
              "-$coreDepth * $slabExpansion + ($coreDepth * 2 * $slabExpansion / $panelsPerSideLeft / 2)"
            ]
          },
          "material": "if(mod(index,2)==1,'wall','window')",
          "store": "left_b"
        },

        {
          "action": "repeat",
          "helper": "createExtrude",
          "count": "$panelsPerSideRight",
          "axis": "z",
          "spacing": "$coreDepth * 2 * $slabExpansion / $panelsPerSideRight",
          "params": {
            "profile": "polygon2d(0, 0, $hexRadius, 6)",
            "depth": "$floorHeight - 0.1",
            "bevelEnabled": false,
            "rot": [1.5708, 0, 1.5708],
            "pos": [
              "$coreWidth * $slabExpansion",
              "$floorHeight / 2",
              "-$coreDepth * $slabExpansion + ($coreDepth * 2 * $slabExpansion / $panelsPerSideRight / 2)"
            ]
          },
          "material": "if(mod(index,2)==0,'wall','window')",
          "store": "right_a"
        },

        {
          "action": "repeat",
          "helper": "createExtrude",
          "count": "$panelsPerSideRight",
          "axis": "z",
          "spacing": "$coreDepth * 2 * $slabExpansion / $panelsPerSideRight",
          "params": {
            "profile": "polygon2d(0, 0, $hexRadius, 6)",
            "depth": "$floorHeight - 0.1",
            "bevelEnabled": false,
            "rot": [1.5708, 0, 1.5708],
            "pos": [
              "$coreWidth * $slabExpansion",
              "$floorHeight / 2",
              "-$coreDepth * $slabExpansion + ($coreDepth * 2 * $slabExpansion / $panelsPerSideRight / 2)"
            ]
          },
          "material": "if(mod(index,2)==1,'wall','window')",
          "store": "right_b"
        },

        {
          "action": "group",
          "children": ["core", "slab", "columns", "front_a", "back_a", "left_a", "right_a"],
          "store": "floor_even"
        },

        {
          "action": "group",
          "children": ["core", "slab", "columns", "front_b", "back_b", "left_b", "right_b"],
          "store": "floor_odd"
        },

        {
          "action": "loop",
          "var": "floorIndex",
          "from": 0,
          "to": "$floors",
          "body": [
            {
              "action": "conditional",
              "condition": "mod($floorIndex, 2) == 0",
              "body": [
                {
                  "action": "group",
                  "children": ["floor_even"],
                  "position": [0, "$floorIndex * $floorHeight", 0],
                  "rotation": [0, "if($floorIndex < $twistStartFloor, 0, if($floorIndex < $twistEndFloor, ($floorIndex - $twistStartFloor) * $twistPerFloor, ($twistEndFloor - $twistStartFloor) * $twistPerFloor))", 0]
                }
              ]
            },
            {
              "action": "conditional",
              "condition": "mod($floorIndex, 2) != 0",
              "body": [
                {
                  "action": "group",
                  "children": ["floor_odd"],
                  "position": [0, "$floorIndex * $floorHeight", 0],
                  "rotation": [0, "if($floorIndex < $twistStartFloor, 0, if($floorIndex < $twistEndFloor, ($floorIndex - $twistStartFloor) * $twistPerFloor, ($twistEndFloor - $twistStartFloor) * $twistPerFloor))", 0]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}


// sine wave facade pattern
export const waveFacadePatternSchema = {
  "version": "3.2",
  "type": "parametric_procedure",
  "materials": {
    "wall": {
      "color": "#1a3a5c",
      "roughness": 0.7,
      "metalness": 0.1
    },
    "window": {
      "color": "#b3d9ff",
      "roughness": 0.1,
      "metalness": 0.2,
      "transparent": true,
      "opacity": 0.3
    },
    "core": {
      "color": "#c1440e",
      "roughness": 0.6,
      "metalness": 0
    },
    "column": {
      "color": "#2a2a2a",
      "roughness": 0.8,
      "metalness": 0.3
    },
    "floor_slab": {
      "color": "#b8b8b8",
      "roughness": 0.7,
      "metalness": 0.1
    }
  },
  "globalParameters": {
    "floors": {
      "value": 12,
      "type": "integer",
      "min": 3,
      "max": 30
    },
    "floorHeight": {
      "value": 3,
      "type": "number",
      "min": 2,
      "max": 5
    },
    "coreWidth": {
      "value": 8,
      "type": "number",
      "min": 4,
      "max": 16
    },
    "coreDepth": {
      "value": 6,
      "type": "number",
      "min": 4,
      "max": 12
    },
    "slabExpansion": {
      "value": 1.1,
      "type": "number",
      "min": 1,
      "max": 2
    },
    "columnRad": {
      "value": 0.3,
      "type": "number",
      "min": 0.1,
      "max": 1
    },
    "panelsPerSideFront": {
      "value": 12,
      "type": "integer",
      "min": 4,
      "max": 24
    },
    "panelsPerSideBack": {
      "value": 12,
      "type": "integer",
      "min": 4,
      "max": 24
    },
    "panelsPerSideLeft": {
      "value": 12,
      "type": "integer",
      "min": 4,
      "max": 24
    },
    "panelsPerSideRight": {
      "value": 12,
      "type": "integer",
      "min": 4,
      "max": 24
    },
    "twistPerFloor": {
      "value": 0.06,
      "type": "number",
      "min": 0,
      "max": 0.3
    },
    "twistStartFloor": {
      "value": 2,
      "type": "integer",
      "min": 0,
      "max": 30
    },
    "twistEndFloor": {
      "value": 9,
      "type": "integer",
      "min": 0,
      "max": 30
    },
    "wallGlassPhase": {
      "value": 0.5236,
      "type": "number",
      "min": 0.1,
      "max": 3.14159,
      "description": "Phase for sine wave variation (0.5236 \u2248 \u03c0/6)"
    },
    "wallGlassOffset": {
      "value": 1.5708,
      "type": "number",
      "min": 0.1,
      "max": 6.28318,
      "description": "Phase offset for sine wave (1.5708 \u2248 \u03c0/2 for max wall at floor 1)"
    }
  },
  "procedures": [
    {
      "name": "buildTower",
      "steps": [
        {
          "action": "loop",
          "var": "floorIndex",
          "from": 0,
          "to": "$floors",
          "body": [
            {
              "action": "createGeometry",
              "helper": "createBox",
              "params": {
                "width": "$coreWidth",
                "height": "$floorHeight",
                "depth": "$coreDepth"
              },
              "material": "core",
              "store": "core_@floorIndex"
            },
            {
              "action": "createGeometry",
              "helper": "createBox",
              "params": {
                "width": "$coreWidth * 2 * $slabExpansion",
                "height": 0.25,
                "depth": "$coreDepth * 2 * $slabExpansion",
                "position": [
                  0,
                  "-$floorHeight / 2",
                  0
                ]
              },
              "material": "floor_slab",
              "store": "slab_@floorIndex"
            },
            {
              "action": "createGeometry",
              "helper": "createCylinder",
              "params": {
                "radiusTop": "$columnRad",
                "radiusBottom": "$columnRad",
                "height": "$floorHeight"
              },
              "material": "column",
              "store": "col_single_@floorIndex"
            },
            {
              "action": "createGeometry",
              "helper": "distributeOnGrid3d",
              "params": {
                "geometry": "col_single_@floorIndex",
                "rows": 2,
                "cols": 2,
                "spacing": [
                  "$coreWidth * 1.8",
                  0,
                  "$coreDepth * 1.8"
                ],
                "centered": true
              },
              "material": "column",
              "store": "columns_@floorIndex"
            },
            {
              "action": "repeat",
              "helper": "createBox",
              "count": "$panelsPerSideFront",
              "axis": "x",
              "spacing": "$coreWidth * 2 * $slabExpansion / $panelsPerSideFront",
              "params": {
                "width": "$coreWidth * 2 * $slabExpansion / $panelsPerSideFront * (0.5 + 0.4 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                "height": "$floorHeight - 0.1",
                "depth": 0.2,
                "position": [
                  "-$coreWidth * $slabExpansion + $coreWidth * $slabExpansion / $panelsPerSideFront + ($coreWidth * 2 * $slabExpansion / $panelsPerSideFront) * (-0.25 + 0.2 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                  0,
                  "$coreDepth * $slabExpansion"
                ]
              },
              "material": "wall",
              "store": "front_walls_@floorIndex"
            },
            {
              "action": "repeat",
              "helper": "createBox",
              "count": "$panelsPerSideFront",
              "axis": "x",
              "spacing": "$coreWidth * 2 * $slabExpansion / $panelsPerSideFront",
              "params": {
                "width": "$coreWidth * 2 * $slabExpansion / $panelsPerSideFront * (0.5 - 0.4 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                "height": "$floorHeight - 0.1",
                "depth": 0.2,
                "position": [
                  "-$coreWidth * $slabExpansion + $coreWidth * $slabExpansion / $panelsPerSideFront + ($coreWidth * 2 * $slabExpansion / $panelsPerSideFront) * (0.25 + 0.2 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                  0,
                  "$coreDepth * $slabExpansion"
                ]
              },
              "material": "window",
              "store": "front_glass_@floorIndex"
            },
            {
              "action": "repeat",
              "helper": "createBox",
              "count": "$panelsPerSideBack",
              "axis": "x",
              "spacing": "$coreWidth * 2 * $slabExpansion / $panelsPerSideBack",
              "params": {
                "width": "$coreWidth * 2 * $slabExpansion / $panelsPerSideBack * (0.5 + 0.4 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                "height": "$floorHeight - 0.1",
                "depth": 0.2,
                "position": [
                  "-$coreWidth * $slabExpansion + $coreWidth * $slabExpansion / $panelsPerSideBack + ($coreWidth * 2 * $slabExpansion / $panelsPerSideBack) * (-0.25 + 0.2 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                  0,
                  "-$coreDepth * $slabExpansion"
                ]
              },
              "material": "wall",
              "store": "back_walls_@floorIndex"
            },
            {
              "action": "repeat",
              "helper": "createBox",
              "count": "$panelsPerSideBack",
              "axis": "x",
              "spacing": "$coreWidth * 2 * $slabExpansion / $panelsPerSideBack",
              "params": {
                "width": "$coreWidth * 2 * $slabExpansion / $panelsPerSideBack * (0.5 - 0.4 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                "height": "$floorHeight - 0.1",
                "depth": 0.2,
                "position": [
                  "-$coreWidth * $slabExpansion + $coreWidth * $slabExpansion / $panelsPerSideBack + ($coreWidth * 2 * $slabExpansion / $panelsPerSideBack) * (0.25 + 0.2 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                  0,
                  "-$coreDepth * $slabExpansion"
                ]
              },
              "material": "window",
              "store": "back_glass_@floorIndex"
            },
            {
              "action": "repeat",
              "helper": "createBox",
              "count": "$panelsPerSideLeft",
              "axis": "z",
              "spacing": "$coreDepth * 2 * $slabExpansion / $panelsPerSideLeft",
              "params": {
                "width": 0.2,
                "height": "$floorHeight - 0.1",
                "depth": "$coreDepth * 2 * $slabExpansion / $panelsPerSideLeft * (0.5 + 0.4 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                "position": [
                  "-$coreWidth * $slabExpansion",
                  0,
                  "-$coreDepth * $slabExpansion + $coreDepth * $slabExpansion / $panelsPerSideLeft + ($coreDepth * 2 * $slabExpansion / $panelsPerSideLeft) * (-0.25 + 0.2 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))"
                ]
              },
              "material": "wall",
              "store": "left_walls_@floorIndex"
            },
            {
              "action": "repeat",
              "helper": "createBox",
              "count": "$panelsPerSideLeft",
              "axis": "z",
              "spacing": "$coreDepth * 2 * $slabExpansion / $panelsPerSideLeft",
              "params": {
                "width": 0.2,
                "height": "$floorHeight - 0.1",
                "depth": "$coreDepth * 2 * $slabExpansion / $panelsPerSideLeft * (0.5 - 0.4 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                "position": [
                  "-$coreWidth * $slabExpansion",
                  0,
                  "-$coreDepth * $slabExpansion + $coreDepth * $slabExpansion / $panelsPerSideLeft + ($coreDepth * 2 * $slabExpansion / $panelsPerSideLeft) * (0.25 + 0.2 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))"
                ]
              },
              "material": "window",
              "store": "left_glass_@floorIndex"
            },
            {
              "action": "repeat",
              "helper": "createBox",
              "count": "$panelsPerSideRight",
              "axis": "z",
              "spacing": "$coreDepth * 2 * $slabExpansion / $panelsPerSideRight",
              "params": {
                "width": 0.2,
                "height": "$floorHeight - 0.1",
                "depth": "$coreDepth * 2 * $slabExpansion / $panelsPerSideRight * (0.5 + 0.4 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                "position": [
                  "$coreWidth * $slabExpansion",
                  0,
                  "-$coreDepth * $slabExpansion + $coreDepth * $slabExpansion / $panelsPerSideRight + ($coreDepth * 2 * $slabExpansion / $panelsPerSideRight) * (-0.25 + 0.2 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))"
                ]
              },
              "material": "wall",
              "store": "right_walls_@floorIndex"
            },
            {
              "action": "repeat",
              "helper": "createBox",
              "count": "$panelsPerSideRight",
              "axis": "z",
              "spacing": "$coreDepth * 2 * $slabExpansion / $panelsPerSideRight",
              "params": {
                "width": 0.2,
                "height": "$floorHeight - 0.1",
                "depth": "$coreDepth * 2 * $slabExpansion / $panelsPerSideRight * (0.5 - 0.4 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))",
                "position": [
                  "$coreWidth * $slabExpansion",
                  0,
                  "-$coreDepth * $slabExpansion + $coreDepth * $slabExpansion / $panelsPerSideRight + ($coreDepth * 2 * $slabExpansion / $panelsPerSideRight) * (0.25 + 0.2 * sin(($floorIndex + 1) * $wallGlassPhase + $wallGlassOffset))"
                ]
              },
              "material": "window",
              "store": "right_glass_@floorIndex"
            },
            {
              "action": "group",
              "children": [
                "core_@floorIndex",
                "slab_@floorIndex",
                "columns_@floorIndex",
                "front_walls_@floorIndex",
                "front_glass_@floorIndex",
                "back_walls_@floorIndex",
                "back_glass_@floorIndex",
                "left_walls_@floorIndex",
                "left_glass_@floorIndex",
                "right_walls_@floorIndex",
                "right_glass_@floorIndex"
              ],
              "position": [
                0,
                "$floorIndex * $floorHeight",
                0
              ],
              "rotation": [
                0,
                "if($floorIndex < $twistStartFloor, 0, if($floorIndex < $twistEndFloor, ($floorIndex - $twistStartFloor) * $twistPerFloor, ($twistEndFloor - $twistStartFloor) * $twistPerFloor))",
                0
              ],
              "store": "floor_@floorIndex"
            }
          ]
        }
      ]
    }
  ]
}