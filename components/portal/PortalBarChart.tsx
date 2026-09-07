import type { DayPoint } from "@/lib/portal-home";

const WIDTH = 480;
const HEIGHT = 228;
const PAD = { top: 14, right: 14, bottom: 38, left: 50 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

function formatDayTick(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatTick(value: number, kind: "number" | "rand") {
  if (kind === "rand") {
    const rands = value / 100;
    return `R ${Math.round(rands)}`;
  }
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(value);
}

export function PortalBarChart({
  label,
  summary,
  stat,
  points,
  color,
  kind = "number",
}: {
  label: string;
  summary: string;
  stat?: { label: string; value: string };
  points: DayPoint[];
  color: string;
  kind?: "number" | "rand";
}) {
  const raw = points.map((point) => point.value);
  const maxRaw = Math.max(0, ...raw);
  const yMax = maxRaw === 0 ? 1 : maxRaw;
  const count = Math.max(points.length, 1);
  const slot = PLOT_W / count;
  const gap =
    count <= 12 ? Math.min(10, slot * 0.32) : count <= 40 ? Math.min(4, slot * 0.18) : 1;
  const barW = Math.max(2, slot - gap);
  const radius = barW >= 6 ? 3 : barW >= 3 ? 1.5 : 0;

  const xAt = (index: number) => PAD.left + index * slot + (slot - barW) / 2;
  const yAt = (value: number) => {
    const t = value / yMax;
    return PAD.top + PLOT_H * (1 - t);
  };

  const ticks = maxRaw > 0 ? [0, yMax / 2, yMax] : [0];
  const labelStep =
    count <= 8 ? 1 : count <= 16 ? 2 : Math.max(1, Math.ceil((count - 1) / 3));
  const xLabels = points
    .map((point, index) => ({ point, index }))
    .filter(({ index }) => index === 0 || index === count - 1 || index % labelStep === 0);

  return (
    <figure className="portal-chart">
      <figcaption>
        <span>{label}</span>
        <div className="portal-chart-nums">
          <strong>{summary}</strong>
          {stat ? (
            <span className="portal-chart-stat">
              {stat.value} {stat.label}
            </span>
          ) : null}
        </div>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${label} by date`}>
        <title>{label}</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
              className="portal-chart-grid"
            />
            <text x={PAD.left - 8} y={yAt(tick) + 4} textAnchor="end" className="portal-chart-tick">
              {formatTick(tick, kind)}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const barH = Math.max(point.value > 0 ? 3 : 0, PAD.top + PLOT_H - yAt(point.value));
          if (barH <= 0) return null;
          return (
            <rect
              key={point.day}
              x={xAt(index)}
              y={yAt(point.value)}
              width={barW}
              height={barH}
              rx={radius}
              fill={color}
            />
          );
        })}
        {xLabels.map(({ point, index }) => (
          <text
            key={`${point.day}-${index}`}
            x={xAt(index) + barW / 2}
            y={HEIGHT - 10}
            textAnchor={index === 0 ? "start" : index === count - 1 ? "end" : "middle"}
            className="portal-chart-tick"
          >
            {formatDayTick(point.day)}
          </text>
        ))}
      </svg>
    </figure>
  );
}
