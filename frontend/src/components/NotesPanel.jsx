import { useState } from "react";
import { api, formatDate } from "../api.js";
import Button from "./Button.jsx";
import Field from "./Field.jsx";

// Notes for one candidate: add, edit (inline), delete. onChange() reloads the candidate.
export default function NotesPanel({ candidateId, notes, onChange }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(null); // { id, text } while a note is being edited
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await onChange();
      return true;
    } catch (err) {
      setError((err.fields && err.fields.text) || err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (event) => {
    event.preventDefault();
    if (!text.trim()) return setError("Write something first.");
    if (await run(() => api.addNote(candidateId, text))) setText("");
  };

  const save = async (event) => {
    event.preventDefault();
    if (!editing.text.trim()) return setError("A note cannot be empty.");
    if (await run(() => api.editNote(editing.id, editing.text))) setEditing(null);
  };

  return (
    <div className="notes">
      <form onSubmit={add} noValidate>
        <Field as="textarea" label="Add a note" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" disabled={busy}>
          Add note
        </Button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notes.length === 0 ? (
        <p className="muted">No notes yet.</p>
      ) : (
        <ul className="note-list">
          {[...notes].reverse().map((note) => (
            <li key={note.id} className="note">
              {editing && editing.id === note.id ? (
                <form onSubmit={save} noValidate>
                  <Field as="textarea" label="Edit note" rows={3} value={editing.text}
                    onChange={(e) => setEditing({ id: note.id, text: e.target.value })} />
                  <div className="form-actions">
                    <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button type="submit" disabled={busy}>Save</Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="note-text">{note.text}</p>
                  <div className="note-meta">
                    <span>
                      {note.author.name} · {formatDate(note.created_at)}
                      {note.updated_at ? " (edited)" : ""}
                    </span>
                    <span className="note-actions">
                      <Button variant="ghost" onClick={() => setEditing({ id: note.id, text: note.text })}>Edit</Button>
                      <Button variant="ghost" disabled={busy} onClick={() => run(() => api.deleteNote(note.id))}>Delete</Button>
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
