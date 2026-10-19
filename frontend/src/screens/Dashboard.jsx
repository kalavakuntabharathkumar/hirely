import { Link } from "react-router-dom";
import { api, formatDate } from "../api.js";
import { useApi } from "../useApi.js";
import Badge from "../components/Badge.jsx";
import Card from "../components/Card.jsx";
import FunnelChart from "../components/FunnelChart.jsx";
import { EmptyState, ErrorState, Skeleton } from "../components/States.jsx";

function Stat({ label, value, hint }) {
  return (
    <Card className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {hint && <p className="stat-hint">{hint}</p>}
    </Card>
  );
}

export default function Dashboard() {
  const { data, error, reload } = useApi(() => api.dashboard(), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Skeleton rows={5} />;

  const { cards, funnel, recent } = data;
  const empty = (
    <EmptyState
      title="No candidates yet"
      text="Add a candidate to start filling the funnel."
      action={<Link to="/candidates" className="btn btn-primary">Add candidate</Link>}
    />
  );
  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>
      <div className="stats">
        <Stat label="Total candidates" value={cards.total} />
        <Stat label="In interview" value={cards.in_interview} />
        <Stat label="Offers out" value={cards.offers} />
        <Stat
          label="Hire rate"
          value={`${cards.hire_rate}%`}
          hint={`${cards.hired} hired ÷ ${cards.active} active (not archived, not rejected)`}
        />
      </div>
      <div className="dash-grid">
        <Card title="Hiring funnel">
          {cards.total === 0 ? empty : <FunnelChart rows={funnel} />}
          <p className="muted funnel-note">Bars count candidates who reached each stage. Days are the average time spent in it.</p>
        </Card>
        <Card title="Recent candidates">
          {recent.length === 0 ? (
            empty
          ) : (
            <ul className="recent">
              {recent.map((c) => (
                <li key={c.id}>
                  <div>
                    <Link to={`/candidates/${c.id}`}>{c.name}</Link>
                    <span className="muted"> {c.role} · {formatDate(c.created_at)}</span>
                  </div>
                  <Badge stage={c.stage} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
