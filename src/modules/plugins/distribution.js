// src/modules/plugins/distribution.js

export const distributionPlugins = {
  // Linear distribution along an axis
  linear(d, count, ctx, evaluator) {
    const spacing = evaluator.evaluate(d.spacing || 1, ctx);
    const axis = d.axis || 'x';
    const centered = d.centered !== false;
    
    const positions = [];
    const offset = centered ? -spacing * (count - 1) / 2 : 0;
    
    for (let i = 0; i < count; i++) {
      const pos = offset + i * spacing;
      if (axis === 'x') positions.push([pos, 0, 0]);
      else if (axis === 'y') positions.push([0, pos, 0]);
      else if (axis === 'z') positions.push([0, 0, pos]);
    }
    
    return positions;
  },
  
  // Grid distribution in XZ plane
  grid(d, count, ctx, evaluator) {
    const spacingX = evaluator.evaluate(d.spacingX || d.spacing || 1, ctx);
    const spacingZ = evaluator.evaluate(d.spacingZ || d.spacing || 1, ctx);
    const cols = d.columns || Math.ceil(Math.sqrt(count));
    
    const positions = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push([col * spacingX, 0, row * spacingZ]);
    }
    
    return positions;
  },
  
  // Radial distribution in a circle
  radial(d, count, ctx, evaluator) {
    const radius = evaluator.evaluate(d.radius || 1, ctx);
    const axis = d.axis || 'y';
    const startAngle = evaluator.evaluate(d.startAngle || 0, ctx);
    const endAngle = evaluator.evaluate(d.endAngle || Math.PI * 2, ctx);
    
    const positions = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const angle = startAngle + (endAngle - startAngle) * t;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      
      if (axis === 'y') positions.push([x, 0, z]);
      else if (axis === 'x') positions.push([0, x, z]);
      else if (axis === 'z') positions.push([x, z, 0]);
    }
    
    return positions;
  },
  
  // Along curve (placeholder - actual resolution in sceneBuilder)
  along_curve(d, count, ctx, evaluator) {
    // This returns dummy positions - sceneBuilder handles the actual curve distribution
    return Array(count).fill([0, 0, 0]);
  }
};
