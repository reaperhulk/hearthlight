import { useCallback } from "react";
import { drawBuilding } from "./village-draw.js";
export function BuildingIcon({ type }) {
  const mount = useCallback(
    (canvas) => {
      if (!canvas) return;
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      drawBuilding(ctx, type, 50, 57, 1.45);
    },
    [type],
  );
  return <canvas className="building-icon" ref={mount} aria-hidden="true" />;
}
