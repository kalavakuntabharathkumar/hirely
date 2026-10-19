import { useState } from "react";
import Button from "./Button.jsx";
import Field from "./Field.jsx";

const EMPTY = { name: "", email: "", phone: "", role: "", skills: "", source: "" };
const SOURCES = ["Referral", "LinkedIn", "Job board", "Career site", "Agency", "Other"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/; // same rules as the server (schemas.py)
const PHONE_RE = /^[+(]?[0-9][0-9 ()-]{5,18}[0-9]$/;

function validate(v) {
  const errors = {};
  if (!v.name.trim()) errors.name = "Name is required.";
  if (!EMAIL_RE.test(v.email.trim())) errors.email = "Enter a valid email address, like name@example.com.";
  if (v.phone.trim() && !PHONE_RE.test(v.phone.trim())) errors.phone = "Enter a valid phone number (digits, spaces, + ( ) -).";
  if (!v.role.trim()) errors.role = "Role is required.";
  return errors;
}

// Used for both "Add candidate" and "Edit". onSubmit(values) may throw an ApiError;
// its per-field messages (e.g. duplicate email from the server) appear next to the fields.
export default function CandidateForm({ initial, onSubmit, onCancel, submitLabel = "Save" }) {
  const [values, setValues] = useState({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      const fields = err.fields || {};
      setErrors(fields);
      setFormError(Object.keys(fields).length ? "" : err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="form-grid">
      <Field label="Full name" value={values.name} onChange={set("name")} error={errors.name} autoComplete="off" required />
      <Field label="Email" type="email" value={values.email} onChange={set("email")} error={errors.email} autoComplete="off" required />
      <Field label="Phone (optional)" type="tel" value={values.phone} onChange={set("phone")} error={errors.phone} autoComplete="off" />
      <Field label="Role applied for" value={values.role} onChange={set("role")} error={errors.role} autoComplete="off" required />
      <Field label="Skills (comma separated)" value={values.skills} onChange={set("skills")} error={errors.skills} />
      <Field as="select" label="Source" value={values.source} onChange={set("source")} error={errors.source}>
        <option value="">Not specified</option>
        {SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Field>
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
