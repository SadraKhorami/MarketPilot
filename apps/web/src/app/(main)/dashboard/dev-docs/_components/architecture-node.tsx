"use client";

import { memo } from "react";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";

import type { DiagramService } from "./architecture-diagram";

export type ServiceNode = Node<{ service: DiagramService; active: boolean }, "service">;

const positions = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left };

const handleStyle = { background: "var(--primary)", borderColor: "var(--background)", width: 8, height: 8 };

export const ArchitectureNode = memo(function ArchitectureNode({ data, selected }: NodeProps<ServiceNode>) {
  const { service, active } = data;
  const Icon = service.icon;
  return (
    <div
      className={cn(
        "flex w-72 flex-col gap-4 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-[border-color,box-shadow,opacity]",
        selected && "border-primary shadow-lg ring-2 ring-primary/15",
        !active && "opacity-50",
      )}
    >
      {service.ports.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type={port.type}
          position={positions[port.side]}
          style={{
            ...handleStyle,
            ...(port.side === "top" || port.side === "bottom"
              ? { left: `${port.offset}%` }
              : { top: `${port.offset}%` }),
          }}
        />
      ))}
      <div className="flex items-center justify-between gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl border bg-muted",
            selected && "border-primary/20 bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-5" />
        </div>
        <Badge variant="outline">{service.layer}</Badge>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="font-semibold text-lg tracking-tight">{service.title}</p>
        <p className="text-base text-muted-foreground leading-relaxed">{service.subtitle}</p>
      </div>
    </div>
  );
});
