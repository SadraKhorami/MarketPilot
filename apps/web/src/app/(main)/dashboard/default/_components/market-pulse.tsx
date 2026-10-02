"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PulseCard, type Snapshot } from "./overview-cards";
import "./market-pulse.css";

export function MarketPulse({
  symbols,
  snapshots,
  loading,
}: {
  symbols: string[];
  snapshots: Record<string, Snapshot | null>;
  loading: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const node = viewport.current;
    if (node) setEdges({ left: node.scrollLeft > 1, right: node.scrollWidth - node.clientWidth - node.scrollLeft > 1 });
  }, []);
  useEffect(() => {
    if (!symbols.length) return;
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    updateEdges();
    return () => observer.disconnect();
  }, [symbols.length, updateEdges]);
  if (!symbols.length)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Choose the markets you want to follow</EmptyTitle>
          <EmptyDescription>Use the settings button to add cards to your Market pulse.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  const loop = symbols.length > 4;
  const cards = symbols.map((symbol) => (
    <div className="pulse-item min-w-0" key={symbol}>
      <PulseCard symbol={symbol} snapshot={snapshots[symbol]} loading={loading} />
    </div>
  ));
  return (
    <div className="space-y-2">
      {loop ? (
        <div className="hidden justify-end md:flex motion-reduce:hidden">
          <Button
            size="sm"
            variant="ghost"
            aria-label={paused ? "Resume Market pulse animation" : "Pause Market pulse animation"}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
            {paused ? "Resume" : "Pause motion"}
          </Button>
        </div>
      ) : null}
      <div className="pulse-viewport" data-loop={loop} data-left={edges.left} data-right={edges.right}>
        <div
          ref={viewport}
          onScroll={updateEdges}
          className={`market-pulse ${loop ? "market-pulse-loop" : ""}`}
          data-paused={paused}
        >
          <div className="pulse-track">
            <div className="pulse-group">{cards}</div>
            {loop ? (
              <div className="pulse-group pulse-copy" aria-hidden="true" inert>
                {cards}
              </div>
            ) : null}
          </div>
        </div>
        <span className="pulse-shadow pulse-shadow-left" aria-hidden="true" />
        <span className="pulse-shadow pulse-shadow-right" aria-hidden="true" />
      </div>
    </div>
  );
}
