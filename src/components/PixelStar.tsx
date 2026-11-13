// The balance cards' marks: 8-bit drawings built from brand pixel blocks with a hard drop shadow.
// "#" = body pixel, "*" = shine pixel. Only Games uses it (the star, with sparkle pixels that blink
// in steps, stopped for reduced motion in CSS); Earn and Spend use isometric figures instead.
type Art = { rows: string[]; sparks?: [number, number, string][] };

const STAR: Art = {
  rows: [
    ".....*.....",
    ".....*.....",
    "....*##....",
    "....*##....",
    "*****######",
    ".#########.",
    "..#######..",
    "..#######..",
    ".####.####.",
    ".###...###.",
    "##.......##",
  ],
  sparks: [
    [-1.5, 1, "is-cyan"],
    [13, 1.5, "is-magenta"],
    [13.5, 8.5, "is-cyan"],
  ],
};

const ARTS = { star: STAR };

export function PixelArt({ art, className }: { art: keyof typeof ARTS; className?: string }) {
  const { rows, sparks = [] } = ARTS[art];
  const cells: [number, number, boolean][] = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => c !== "." && cells.push([x, y, c === "*"])));
  return (
    <svg className={`pixel-star pixel-${art} ${className ?? ""}`} viewBox="-3 -1 18 14" shapeRendering="crispEdges" aria-hidden>
      <g className="pixel-star-shadow">
        {cells.map(([x, y]) => <rect key={`s${x},${y}`} x={x + 0.7} y={y + 0.7} width={1} height={1} />)}
      </g>
      <g className="pixel-star-body">
        {cells.map(([x, y, accent]) => <rect key={`b${x},${y}`} x={x} y={y} width={1.02} height={1.02} className={accent ? "is-shine" : undefined} />)}
      </g>
      {sparks.map(([x, y, tone], i) => (
        <g key={i} className={`pixel-spark ${tone}`} style={{ animationDelay: `${i * 0.7}s` }}>
          <rect x={x - 0.5} y={y - 1.5} width={1} height={3} />
          <rect x={x - 1.5} y={y - 0.5} width={3} height={1} />
        </g>
      ))}
    </svg>
  );
}

export function PixelStar({ className }: { className?: string }) {
  return <PixelArt art="star" className={className} />;
}
