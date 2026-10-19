import Button from "./Button.jsx";

export const STAGES = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];
const PIPELINE = STAGES.slice(0, 5);

// Presentation only: WHICH moves are legal always comes from the server (stages.py).
function describe(from, to) {
  if (to === "Rejected") return { text: "Reject", variant: "danger" };
  if (from === "Rejected") return { text: `Reopen as ${to}`, variant: "secondary" };
  const forward = STAGES.indexOf(to) > STAGES.indexOf(from);
  return forward ? { text: `Advance to ${to}`, variant: "primary" } : { text: `Back to ${to}`, variant: "secondary" };
}

export default function StageBar({ stage, moves, onMove, busy }) {
  const current = PIPELINE.indexOf(stage);
  return (
    <div className="stagebar">
      <ol className="stepper" aria-label="Hiring stage">
        {PIPELINE.map((name, i) => (
          <li
            key={name}
            className={`step${i < current ? " done" : ""}${name === stage ? " current" : ""}`}
            aria-current={name === stage ? "step" : undefined}
          >
            <span className="step-dot">{i < current ? "✓" : i + 1}</span>
            <span className="step-name">{name}</span>
          </li>
        ))}
      </ol>
      {stage === "Rejected" && <p className="rejected-note">This candidate was rejected.</p>}
      <div className="stage-actions">
        {moves.length === 0 ? (
          <p className="muted">{stage} is final. No further moves.</p>
        ) : (
          moves.map((to) => {
            const { text, variant } = describe(stage, to);
            return (
              <Button key={to} variant={variant} disabled={busy} onClick={() => onMove(to)}>
                {text}
              </Button>
            );
          })
        )}
      </div>
    </div>
  );
}
