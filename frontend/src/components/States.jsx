import Button from "./Button.jsx";

// Loading: shimmering placeholder rows (CSS only).
export function Skeleton({ rows = 4 }) {
  return (
    <div className="skeleton-list" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

// Empty: friendly message with an optional call to action.
export function EmptyState({ title, text, action }) {
  return (
    <div className="state">
      <div className="state-icon" aria-hidden="true">
        ○
      </div>
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

// Error: says what happened and offers a retry.
export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <div className="state-icon" aria-hidden="true">
        !
      </div>
      <h3>Something went wrong</h3>
      <p>{(error && error.message) || "Please try again."}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
