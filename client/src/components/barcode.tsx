/**
 * Code 128 as crisp SVG (B4.3, TZ §2). Bars are whole rectangles in module
 * units with crispEdges, so a thermal printer gets clean edges at any scale.
 */
import { code128Widths } from "@shared/code128";

export function Code128({
  value,
  height = 34,
  quiet = 10,
  className,
}: {
  value: string;
  /** Bar height in module units (the width scales with the container). */
  height?: number;
  /** Quiet zone on each side, in modules — scanners need it. */
  quiet?: number;
  className?: string;
}) {
  const widths = code128Widths(value);
  const total = widths.reduce((s, w) => s + w, 0) + quiet * 2;
  let x = quiet;
  const bars: { x: number; w: number }[] = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, w });
    x += w;
  });
  return (
    <svg
      viewBox={`0 0 ${total} ${height}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Shtrix-kod ${value}`}
      className={className}
      data-testid="barcode-code128"
      data-value={value}
    >
      <rect x={0} y={0} width={total} height={height} fill="#fff" />
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={b.w} height={height} fill="#000" />
      ))}
    </svg>
  );
}
