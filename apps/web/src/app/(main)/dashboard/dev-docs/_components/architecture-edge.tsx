"use client";

import { BaseEdge, type Edge, type EdgeProps, getBezierPath, getSmoothStepPath } from "@xyflow/react";

export type ArchitectureFlowEdge = Edge<{ animate: boolean }, "flow">;

export function ArchitectureEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
  style,
  markerEnd,
}: EdgeProps<ArchitectureFlowEdge>) {
  const endpoints = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  const [path] =
    sourcePosition === targetPosition
      ? getSmoothStepPath({ ...endpoints, offset: 40, borderRadius: 16 })
      : getBezierPath({ ...endpoints, curvature: 0.15 });
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {data?.animate && (
        <circle r={3.5} fill="var(--primary)" pointerEvents="none">
          <animateMotion dur="3.5s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  );
}
