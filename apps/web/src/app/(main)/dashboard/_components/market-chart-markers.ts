export interface ChartMarker {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PlacedChartMarker extends ChartMarker {
  left: number;
  top: number;
}

/** Keep badges inside the plot and separate nearby alerts and journal entries. */
export function layoutChartMarkers(markers: ChartMarker[], width: number, height: number): PlacedChartMarker[] {
  const placed: PlacedChartMarker[] = [];
  for (const marker of markers) {
    const left = Math.max(4, Math.min(marker.x - marker.width / 2, width - marker.width - 4));
    const preferred = marker.y - marker.height / 2;
    let top = Math.max(4, Math.min(preferred, height - marker.height - 4));
    for (let step = 0; step < Math.ceil(height / (marker.height + 6)); step++) {
      const offset = Math.ceil(step / 2) * (marker.height + 6) * (step % 2 ? -1 : 1);
      const candidate = Math.max(4, Math.min(preferred + offset, height - marker.height - 4));
      const overlaps = placed.some(
        (other) =>
          left < other.left + other.width + 6 &&
          left + marker.width + 6 > other.left &&
          candidate < other.top + other.height + 6 &&
          candidate + marker.height + 6 > other.top,
      );
      if (!overlaps) {
        top = candidate;
        break;
      }
    }
    placed.push({ ...marker, left, top });
  }
  return placed;
}
