import { useCallback } from 'react';
import { drawStructureGlyph, STRUCTURE_COLORS } from './draw.js';

// The same silhouette the map uses, as a DOM icon for cards and panels.
export function StructureIcon({ type, size = 30 }) {
  const ref = useCallback(node => {
    if (!node) return;
    const dpr = 2;
    node.width = size * dpr;
    node.height = size * dpr;
    const ctx = node.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStructureGlyph(ctx, type, size / 2, size / 2, size * 0.38, STRUCTURE_COLORS[type] || '#aeb8c5');
  }, [type, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}
