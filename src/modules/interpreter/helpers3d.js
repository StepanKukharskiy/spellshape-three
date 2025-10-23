// helpers3d.js — Parametric 3D pattern helpers for spellshape-three
import { 
  rect2d, 
  roundedRect2d, 
  polygon2d, 
  ellipse2d 
} from './helpers2d.js';

/**
 * Alternating wall/glass panel facade.
 * Generates a single array of panels, alternating along one axis.
 */
export function checkerboardPanels3D(params) {
  const {
    count,                    // Now this is the number of PAIRS
    panelWidth = 1,           
    wallRatio = 0.5,          
    windowRatio = 0.5,        
    height = 3,               
    wallHeight = 3,           
    wallDepth = 0.1,
    windowDepth = 0.05,
    origin = [0, 0, 0],
    axis = 'x',
    start = 0,
    direction = 1,
    wallMaterial = 'wall',
    windowMaterial = 'window',
    startWith = 'wall',
    id = 'checkerboard_facade'
  } = params;
  
  const panels = [];
  let pos = start;

  // Calculate actual widths based on ratios
  const wallWidth = panelWidth * wallRatio;
  const windowWidth = panelWidth * windowRatio;

  for (let i = 0; i < count; ++i) {
    // Determine order for this pair based on startWith and floor
    const wallFirst = (startWith === 'wall');
    
    // First panel of the pair
    const firstIsWall = wallFirst;
    const firstW = firstIsWall ? wallWidth : windowWidth;
    const firstH = firstIsWall ? wallHeight : height;
    const firstD = firstIsWall ? wallDepth : windowDepth;
    const firstM = firstIsWall ? wallMaterial : windowMaterial;
    
    let panelPos;
    if (axis === 'x') {
      panelPos = [Number(origin[0]) + pos + direction * firstW/2, origin[1], origin[2]];
      panels.push({
        type: 'box',
        dimensions: [firstW, firstH, firstD],
        position: panelPos,
        material: firstM,
      });
    } else {
      panelPos = [origin[0], origin[1], Number(origin[2]) + pos + direction * firstW/2];
      panels.push({
        type: 'box',
        dimensions: [firstD, firstH, firstW],
        position: panelPos,
        material: firstM,
      });
    }
    pos += direction * firstW;
    
    // Second panel of the pair
    const secondIsWall = !wallFirst;
    const secondW = secondIsWall ? wallWidth : windowWidth;
    const secondH = secondIsWall ? wallHeight : height;
    const secondD = secondIsWall ? wallDepth : windowDepth;
    const secondM = secondIsWall ? wallMaterial : windowMaterial;
    
    if (axis === 'x') {
      panelPos = [Number(origin[0]) + pos + direction * secondW/2, origin[1], origin[2]];
      panels.push({
        type: 'box',
        dimensions: [secondW, secondH, secondD],
        position: panelPos,
        material: secondM,
      });
    } else {
      panelPos = [origin[0], origin[1], Number(origin[2]) + pos + direction * secondW/2];
      panels.push({
        type: 'box',
        dimensions: [secondD, secondH, secondW],
        position: panelPos,
        material: secondM,
      });
    }
    pos += direction * secondW;
  }
  
  return {
    type: 'group',
    id: id,
    children: panels
  };
}







/**
 * Wave facade 3D panel helper.
 * Panels arranged with sinusoidal offset along a chosen axis.
 */
export function waveFacade3D({ cols, rows, size = [1, 3, 0.1], amplitude = 0.5, frequency = 1.0, axis = 'z', material = 'wave_mat' }) {
  const panels = [];
  for (let r = 0; r < rows; ++r) {
    for (let c = 0; c < cols; ++c) {
      const norm = c / Math.max(cols - 1, 1);
      const waveOffset = Math.sin(norm * frequency * 2 * Math.PI) * amplitude;
      const pos = [c * size[0], 0, r * size[1]];
      if (axis === 'z') pos[2] += waveOffset;
      else if (axis === 'x') pos[0] += waveOffset;
      panels.push({
        type: 'box',
        dimensions: size,
        position: pos,
        material,
      });
    }
  }
  return panels;
}

/**
 * Perimeter panel facade helper.
 * Returns panels for the edges of a rectangular building.
 */
export function perimeterPanels3D({ width, depth, floorHeight, floors, panelWidth, panelHeight, materialArray }) {
  const panels = [];
  const countWidth = Math.floor(width / panelWidth);
  const countDepth = Math.floor(depth / panelWidth);
  for (let f = 0; f < floors; ++f) {
    const y = f * floorHeight;
    for (let c = 0; c < countWidth; ++c) {
      const x = -width / 2 + c * panelWidth + panelWidth / 2;
      panels.push({
        type: 'box',
        dimensions: [panelWidth, panelHeight || floorHeight - 0.4, 0.12],
        position: [x, y, depth / 2],
        material: materialArray ? materialArray[c % materialArray.length] : 'wall_mat',
      });
      panels.push({
        type: 'box',
        dimensions: [panelWidth, panelHeight || floorHeight - 0.4, 0.12],
        position: [x, y, -depth / 2],
        material: materialArray ? materialArray[c % materialArray.length] : 'wall_mat',
      });
    }
    for (let c = 0; c < countDepth; ++c) {
      const z = -depth / 2 + c * panelWidth + panelWidth / 2;
      panels.push({
        type: 'box',
        dimensions: [panelWidth, panelHeight || floorHeight - 0.4, 0.12],
        position: [width / 2, y, z],
        material: materialArray ? materialArray[c % materialArray.length] : 'glass_mat',
      });
      panels.push({
        type: 'box',
        dimensions: [panelWidth, panelHeight || floorHeight - 0.4, 0.12],
        position: [-width / 2, y, z],
        material: materialArray ? materialArray[c % materialArray.length] : 'glass_mat',
      });
    }
  }
  return panels;
}

/**
 * Custom grid3D helper for general rectangular arrays.
 */
export function grid3D({ xCount, yCount, cellSize = [1, 1, 0.1], origin = [0, 0, 0], material = 'default_mat' }) {
  const panels = [];
  for (let i = 0; i < xCount; ++i) {
    for (let j = 0; j < yCount; ++j) {
      panels.push({
        type: 'box',
        dimensions: cellSize,
        position: [
          origin[0] + i * cellSize[0],
          origin[1],
          origin[2] + j * cellSize[1]
        ],
        material,
      });
    }
  }
  return panels;
}
