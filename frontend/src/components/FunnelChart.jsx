import { useEffect, useState } from "react";
import Badge from "./Badge.jsx";

// CSS-only proportional bars. Width = share of the largest stage; average days sit beside each bar.
export default function FunnelChart({ rows }) {
  const [shown, setShown] = useState(false); // start at 0 width so the first paint animates
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="funnel" aria-label="Hiring funnel">
      {rows.map((row) => {
        const width = shown && row.count > 0 ? Math.max(2, (row.count / max) * 100) : 0;
        return (
          <li key={row.stage} className="funnel-row">
            <Badge stage={row.stage} />
            <div className="funnel-track">
              <div className={`funnel-bar bar-${row.stage.toLowerCase()}`} style={{ width: `${width}%` }} />
            </div>
            <span className="funnel-count">{row.count}</span>
            <span className="funnel-days">{row.avg_days == null ? "-" : `${row.avg_days} d avg`}</span>
          </li>
        );
      })}
    </ul>
  );
}
