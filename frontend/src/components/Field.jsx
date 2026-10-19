import { useId } from "react";

// Label + input (or select/textarea via as="...") + an error shown next to the field.
export default function Field({ label, error, as: Tag = "input", ...props }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <Tag id={id} aria-invalid={error ? "true" : undefined} aria-describedby={error ? errorId : undefined} {...props} />
      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
