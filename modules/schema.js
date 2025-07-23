// export const universalSchema = {
//       "version": "3.1",
//       "type": "parametric_scene",
//       "metadata": {
//         "description": "Simple parametric cube demonstration",
//         "author": "Cube Framework",
//         "category": "basic_shapes"
//       },
//       "children": [
//         {
//           "type": "parametric_template",
//           "generator": "simple_cube",
//           "id": "cube",
//           "position": [0, 0, 0],
//           "parameters": {
//             "width": {
//               "value": 1.0,
//               "type": "number",
//               "min": 0.1,
//               "max": 3.0,
//               "step": 0.1,
//               "unit": "meters",
//               "label": "Cube Width",
//               "group": "dimensions"
//             },
//             "height": {
//               "value": 1.0,
//               "type": "number",
//               "min": 0.1,
//               "max": 3.0,
//               "step": 0.1,
//               "unit": "meters",
//               "label": "Cube Height",
//               "group": "dimensions"
//             },
//             "depth": {
//               "value": 1.0,
//               "type": "number",
//               "min": 0.1,
//               "max": 3.0,
//               "step": 0.1,
//               "unit": "meters",
//               "label": "Cube Depth",
//               "group": "dimensions"
//             },
//             "position_x": {
//               "value": 0.0,
//               "type": "number",
//               "min": -5.0,
//               "max": 5.0,
//               "step": 0.1,
//               "unit": "meters",
//               "label": "X Position",
//               "group": "position"
//             },
//             "position_y": {
//               "value": 1.0,
//               "type": "number",
//               "min": 0.0,
//               "max": 5.0,
//               "step": 0.1,
//               "unit": "meters",
//               "label": "Y Position",
//               "group": "position"
//             },
//             "position_z": {
//               "value": 0.0,
//               "type": "number",
//               "min": -5.0,
//               "max": 5.0,
//               "step": 0.1,
//               "unit": "meters",
//               "label": "Z Position",
//               "group": "position"
//             },
//             "rotation_x": {
//               "value": 0,
//               "type": "number",
//               "min": -180,
//               "max": 180,
//               "step": 5,
//               "unit": "degrees",
//               "label": "X Rotation",
//               "group": "rotation"
//             },
//             "rotation_y": {
//               "value": 0,
//               "type": "number",
//               "min": -180,
//               "max": 180,
//               "step": 5,
//               "unit": "degrees",
//               "label": "Y Rotation",
//               "group": "rotation"
//             },
//             "rotation_z": {
//               "value": 0,
//               "type": "number",
//               "min": -180,
//               "max": 180,
//               "step": 5,
//               "unit": "degrees",
//               "label": "Z Rotation",
//               "group": "rotation"
//             },
//             "material_type": {
//               "value": "standard",
//               "type": "enum",
//               "options": ["standard", "metallic", "glass", "wood"],
//               "label": "Material Type",
//               "group": "appearance"
//             },
//             "color_hue": {
//               "value": 180,
//               "type": "number",
//               "min": 0,
//               "max": 360,
//               "step": 10,
//               "unit": "degrees",
//               "label": "Color Hue",
//               "group": "appearance"
//             }
//           },
//           "constraints": {
//             "volume": {
//               "volume_limit": {
//                 "expression": "$width * $height * $depth <= 10.0",
//                 "message": "Total cube volume cannot exceed 10 cubic meters"
//               }
//             },
//             "proportions": {
//               "aspect_check": {
//                 "expression": "$width / $height <= 5.0 && $height / $width <= 5.0",
//                 "message": "Aspect ratio should not exceed 5:1 in any dimension"
//               }
//             }
//           },
//           "expressions": {
//             "center_height": "$position_y + $height/2",
//             "rotation_x_rad": "$rotation_x * 3.14159/180",
//             "rotation_y_rad": "$rotation_y * 3.14159/180", 
//             "rotation_z_rad": "$rotation_z * 3.14159/180",
//             "material_name": "if($material_type == \"metallic\", \"cube_metallic\", if($material_type == \"glass\", \"cube_glass\", if($material_type == \"wood\", \"cube_wood\", \"cube_standard\")))",
//             "hue_normalized": "$color_hue / 360",
//             "cube_color": "hsv_to_hex($color_hue, 0.7, 0.9)"
//           },
//           "template": [
//             {
//               "type": "group",
//               "id": "cube_assembly",
//               "position": ["$position_x", "$center_height", "$position_z"],
//               "rotation": ["$rotation_x_rad", "$rotation_y_rad", "$rotation_z_rad"],
//               "children": [
//                 {
//                   "type": "box",
//                   "id": "main_cube",
//                   "material": "$material_name",
//                   "dimensions": ["$width", "$height", "$depth"],
//                   "position": [0, 0, 0]
//                 },
//                 {
//                   "type": "group",
//                   "id": "corner_spheres",
//                   "children": [
//                     {
//                       "type": "repeat",
//                       "id": "corners",
//                       "count": 8,
//                       "distribution": {
//                         "type": "grid",
//                         "positions": [
//                           ["-$width/2", "-$height/2", "-$depth/2"],
//                           ["$width/2", "-$height/2", "-$depth/2"],
//                           ["-$width/2", "$height/2", "-$depth/2"],
//                           ["$width/2", "$height/2", "-$depth/2"],
//                           ["-$width/2", "-$height/2", "$depth/2"],
//                           ["$width/2", "-$height/2", "$depth/2"],
//                           ["-$width/2", "$height/2", "$depth/2"],
//                           ["$width/2", "$height/2", "$depth/2"]
//                         ]
//                       },
//                       "children": [
//                         {
//                           "type": "sphere",
//                           "id": "corner_sphere",
//                           "material": "corner_material",
//                           "dimensions": ["clamp($width * 0.05, 0.02, 0.1)", "clamp($width * 0.05, 0.02, 0.1)", "clamp($width * 0.05, 0.02, 0.1)"],
//                           "position": [0, 0, 0]
//                         }
//                       ]
//                     }
//                   ]
//                 }
//               ]
//             }
//           ]
//         }
//       ],
//       "materials": {
//         "cube_standard": {
//           "type": "standard",
//           "color": "#4A90E2",
//           "roughness": 0.6,
//           "metalness": 0.1
//         },
//         "cube_metallic": {
//           "type": "standard",
//           "color": "#C0C0C0",
//           "roughness": 0.2,
//           "metalness": 0.9
//         },
//         "cube_glass": {
//           "type": "standard",
//           "color": "#88CCFF",
//           "roughness": 0.1,
//           "metalness": 0.0,
//           "opacity": 0.6
//         },
//         "cube_wood": {
//           "type": "standard",
//           "color": "#8B4513",
//           "roughness": 0.8,
//           "metalness": 0.05,
//           "bumpScale": 0.01
//         },
//         "corner_material": {
//           "type": "standard",
//           "color": "#FF6B6B",
//           "roughness": 0.4,
//           "metalness": 0.6
//         }
//       },
//       "ui_controls": {
//         "groups": {
//           "dimensions": {
//             "label": "📐 Dimensions",
//             "order": 1,
//             "collapsible": true,
//             "default_open": true
//           },
//           "position": {
//             "label": "📍 Position",
//             "order": 2,
//             "collapsible": true,
//             "default_open": false
//           },
//           "rotation": {
//             "label": "🔄 Rotation",
//             "order": 3,
//             "collapsible": true,
//             "default_open": false
//           },
//           "appearance": {
//             "label": "🎨 Appearance",
//             "order": 4,
//             "collapsible": true,
//             "default_open": true
//           }
//         }
//       }
//     };

export const universalSchema = {
      "version": "3.1",
      "type": "parametric_scene",
      "metadata": {
        "description": "Fixed parametric furniture scene with proper expression evaluation",
        "author": "Enhanced Framework",
        "category": "furniture_design"
      },
      "children": [
        {
          "type": "parametric_template",
          "generator": "modern_chair",
          "id": "chair",
          "position": [-2, 0, 0],
          "parameters": {
            "seat_width": {
              "value": 0.4,
              "type": "number",
              "min": 0.3,
              "max": 0.7,
              "step": 0.01,
              "unit": "meters",
              "label": "Seat Width",
              "group": "dimensions"
            },
            "seat_depth": {
              "value": 0.4,
              "type": "number",
              "min": 0.3,
              "max": 0.6,
              "step": 0.01,
              "unit": "meters",
              "label": "Seat Depth",
              "group": "dimensions"
            },
            "seat_thickness": {
              "value": 0.05,
              "type": "number",
              "min": 0.02,
              "max": 0.1,
              "step": 0.005,
              "unit": "meters",
              "label": "Seat Thickness",
              "group": "dimensions"
            },
            "seat_height": {
              "value": 0.45,
              "type": "number",
              "min": 0.35,
              "max": 0.65,
              "step": 0.01,
              "unit": "meters",
              "label": "Seat Height",
              "group": "dimensions"
            },
            "back_height": {
              "value": 0.5,
              "type": "number",
              "min": 0.3,
              "max": 0.9,
              "step": 0.01,
              "unit": "meters",
              "label": "Backrest Height",
              "group": "dimensions"
            },
            "leg_radius": {
              "value": 0.025,
              "type": "number",
              "min": 0.015,
              "max": 0.05,
              "step": 0.001,
              "unit": "meters",
              "label": "Leg Thickness",
              "group": "structure"
            },
            "style": {
              "value": "modern",
              "type": "enum",
              "options": ["modern", "classic", "industrial"],
              "label": "Design Style",
              "group": "appearance"
            }
          },
          "constraints": {
            "global": {
              "stability_check": {
                "expression": "$seat_height >= $leg_radius * 8",
                "message": "Seat height must be at least 8x leg radius for stability"
              }
            }
          },
          "expressions": {
            "seat_center_height": "$seat_height + $seat_thickness/2",
            "back_center_height": "$seat_center_height + $seat_thickness/2 + $back_height/2",
            "back_thickness": "if($style == \"industrial\", 0.08, 0.05)",
            "back_position_z": "-($seat_depth/2 - $back_thickness/2)",
            "leg_inset": "clamp($seat_width * 0.15, 0.03, 0.08)",
            "leg_spacing_x": "$seat_width/2 - $leg_inset",
            "leg_spacing_z": "$seat_depth/2 - $leg_inset"
          },
          "template": [
            {
              "type": "group",
              "id": "seat_assembly",
              "children": [
                {
                  "type": "box",
                  "id": "seat_base",
                  "material": "wood_textured",
                  "dimensions": ["$seat_width", "$seat_thickness", "$seat_depth"],
                  "position": [0, "$seat_center_height", 0]
                }
              ]
            },
            {
              "type": "group",
              "id": "backrest",
              "children": [
                {
                  "type": "box",
                  "id": "back_panel",
                  "material": "wood_textured",
                  "dimensions": ["$seat_width", "$back_height", "$back_thickness"],
                  "position": [0, "$back_center_height", "$back_position_z"]
                }
              ]
            },
            {
              "type": "repeat",
              "id": "legs",
              "count": 4,
              "distribution": {
                "type": "grid",
                "positions": [
                  ["-$leg_spacing_x", "$seat_height/2", "$leg_spacing_z"],
                  ["$leg_spacing_x", "$seat_height/2", "$leg_spacing_z"],
                  ["-$leg_spacing_x", "$seat_height/2", "-$leg_spacing_z"],
                  ["$leg_spacing_x", "$seat_height/2", "-$leg_spacing_z"]
                ]
              },
              "children": [
                {
                  "type": "cylinder",
                  "id": "leg",
                  "material": "metal_brushed",
                  "dimensions": ["$leg_radius", "$leg_radius", "$seat_height"],
                  "position": [0, 0, 0]
                }
              ]
            }
          ]
        },
        {
          "type": "parametric_template",
          "generator": "modular_storage",
          "id": "storage_unit",
          "position": [2, 0, 0],
          "parameters": {
            "width": {
              "value": 1.0,
              "type": "number",
              "min": 0.6,
              "max": 2.0,
              "step": 0.1,
              "unit": "meters",
              "label": "Cabinet Width",
              "group": "dimensions"
            },
            "height": {
              "value": 1.2,
              "type": "number",
              "min": 0.8,
              "max": 2.0,
              "step": 0.1,
              "unit": "meters",
              "label": "Cabinet Height",
              "group": "dimensions"
            },
            "depth": {
              "value": 0.5,
              "type": "number",
              "min": 0.3,
              "max": 0.8,
              "step": 0.05,
              "unit": "meters",
              "label": "Cabinet Depth",
              "group": "dimensions"
            },
            "compartment_count": {
              "value": 3,
              "type": "integer",
              "min": 2,
              "max": 6,
              "step": 1,
              "label": "Number of Drawers",
              "group": "configuration"
            },
            "finish_quality": {
              "value": "standard",
              "type": "enum",
              "options": ["basic", "standard", "premium"],
              "label": "Finish Quality",
              "group": "appearance"
            },
            "handle_style": {
              "value": "modern",
              "type": "enum",
              "options": ["modern", "classic", "minimal", "industrial"],
              "label": "Handle Style",
              "group": "appearance"
            }
          },
          "constraints": {
            "structural": {
              "volume_limit": {
                "expression": "$width * $height * $depth <= 3.2",
                "message": "Total cabinet volume cannot exceed 3.2 cubic meters"
              },
              "aspect_ratio": {
                "expression": "$height / $width <= 2.5",
                "message": "Height to width ratio should not exceed 2.5 for stability"
              }
            }
          },
          "expressions": {
            "panel_thickness_base": "if($finish_quality == \"premium\", 0.06, 0.05)",
            "panel_thickness": "if($finish_quality == \"basic\", 0.04, $panel_thickness_base)",
            "support_height": "clamp($height * 0.08, 0.05, 0.15)",
            "support_radius": "$panel_thickness * 0.6",
            "available_height": "$height - $panel_thickness * 2",
            "compartment_height": "$available_height / $compartment_count * 0.85",
            "compartment_spacing": "$available_height / $compartment_count * 0.15",
            "compartment_start": "$support_height + $panel_thickness + $compartment_height/2 + $compartment_spacing/2",
            "compartment_step": "$available_height / $compartment_count",
            "content_scale": "if($finish_quality == \"premium\", 0.92, 0.9)",
            "content_width": "$width * $content_scale",
            "content_depth": "$depth * $content_scale",
            "sub_panel_thickness": "$panel_thickness * 0.5",
            "handle_size_base": "if($handle_style == \"minimal\", 0.015, 0.02)",
            "handle_size": "if($handle_style == \"industrial\", 0.025, $handle_size_base)"
          },
          "template": [
            {
              "type": "group",
              "id": "cabinet_structure",
              "children": [
                {
                  "type": "box",
                  "id": "back_panel",
                  "material": "wood_textured",
                  "dimensions": ["$width", "$height", "$panel_thickness"],
                  "position": [0, "$support_height + $height/2", "-($depth/2 - $panel_thickness/2)"]
                },
                {
                  "type": "box",
                  "id": "bottom_panel",
                  "material": "wood_textured",
                  "dimensions": ["$width", "$panel_thickness", "$depth"],
                  "position": [0, "$support_height + $panel_thickness/2", 0]
                },
                {
                  "type": "box",
                  "id": "top_panel",
                  "material": "wood_textured",
                  "dimensions": ["$width", "$panel_thickness", "$depth"],
                  "position": [0, "$support_height + $height - $panel_thickness/2", 0]
                },
                {
                  "type": "box",
                  "id": "left_panel",
                  "material": "wood_textured",
                  "dimensions": ["$panel_thickness", "$height", "$depth"],
                  "position": ["-($width/2 - $panel_thickness/2)", "$support_height + $height/2", 0]
                },
                {
                  "type": "box",
                  "id": "right_panel",
                  "material": "wood_textured",
                  "dimensions": ["$panel_thickness", "$height", "$depth"],
                  "position": ["$width/2 - $panel_thickness/2", "$support_height + $height/2", 0]
                }
              ]
            },
            {
              "type": "repeat",
              "id": "support_legs",
              "count": 4,
              "distribution": {
                "type": "grid",
                "positions": [
                  ["-($width/2 - $panel_thickness/2)", "$support_height/2", "$depth/2 - $panel_thickness/2"],
                  ["$width/2 - $panel_thickness/2", "$support_height/2", "$depth/2 - $panel_thickness/2"],
                  ["-($width/2 - $panel_thickness/2)", "$support_height/2", "-($depth/2 - $panel_thickness/2)"],
                  ["$width/2 - $panel_thickness/2", "$support_height/2", "-($depth/2 - $panel_thickness/2)"]
                ]
              },
              "children": [
                {
                  "type": "cylinder",
                  "id": "support_leg",
                  "material": "metal_brushed",
                  "dimensions": ["$support_radius", "$support_radius", "$support_height"],
                  "position": [0, 0, 0]
                }
              ]
            },
            {
              "type": "repeat",
              "id": "drawer_compartments",
              "count": "$compartment_count",
              "distribution": {
                "type": "linear",
                "axis": "y",
                "start": "$compartment_start",
                "step": "$compartment_step"
              },
              "instance_parameters": {
                "drawer_height": "$compartment_height"
              },
              "children": [
                {
                  "type": "box",
                  "id": "drawer_bottom",
                  "material": "wood_light",
                  "dimensions": ["$content_width", "$sub_panel_thickness", "$content_depth"],
                  "position": [0, "-$drawer_height/2", 0]
                },
                {
                  "type": "box",
                  "id": "drawer_back",
                  "material": "wood_light",
                  "dimensions": ["$content_width", "$drawer_height", "$sub_panel_thickness"],
                  "position": [0, 0, "-($content_depth/2 - $sub_panel_thickness/2)"]
                },
                {
                  "type": "box",
                  "id": "drawer_front",
                  "material": "wood_light",
                  "dimensions": ["$content_width", "$drawer_height", "$sub_panel_thickness"],
                  "position": [0, 0, "$content_depth/2 - $sub_panel_thickness/2"]
                },
                {
                  "type": "box",
                  "id": "drawer_left",
                  "material": "wood_light",
                  "dimensions": ["$sub_panel_thickness", "$drawer_height", "$content_depth"],
                  "position": ["-($content_width/2 - $sub_panel_thickness/2)", 0, 0]
                },
                {
                  "type": "box",
                  "id": "drawer_right",
                  "material": "wood_light",
                  "dimensions": ["$sub_panel_thickness", "$drawer_height", "$content_depth"],
                  "position": ["$content_width/2 - $sub_panel_thickness/2", 0, 0]
                },
                {
                  "type": "sphere",
                  "id": "drawer_handle",
                  "material": "metal_brushed",
                  "dimensions": ["$handle_size", "$handle_size", "$handle_size"],
                  "position": [0, 0, "$content_depth/2 + $sub_panel_thickness + $handle_size"]
                }
              ]
            }
          ]
        }
      ],
      "materials": {
        "wood_textured": {
          "type": "standard",
          "color": "#b5651d",
          "roughness": 0.8,
          "metalness": 0.1,
          "bumpScale": 0.005
        },
        "wood_light": {
          "type": "standard",
          "color": "#D2B48C",
          "roughness": 0.8,
          "metalness": 0.05
        },
        "metal_brushed": {
          "type": "standard",
          "color": "#B0B0B0",
          "roughness": 0.4,
          "metalness": 0.9
        },
        "metal_polished": {
          "type": "standard",
          "color": "#E0E0E0",
          "roughness": 0.1,
          "metalness": 1.0
        }
      },
      "ui_controls": {
        "groups": {
          "dimensions": {
            "label": "📏 Dimensions",
            "order": 1,
            "collapsible": true,
            "default_open": true
          },
          "appearance": {
            "label": "🎨 Appearance",
            "order": 2,
            "collapsible": true
          },
          "structure": {
            "label": "🏗️ Structure",
            "order": 3,
            "collapsible": true
          },
          "configuration": {
            "label": "⚙️ Configuration",
            "order": 4,
            "collapsible": true
          }
        }
      }
    };