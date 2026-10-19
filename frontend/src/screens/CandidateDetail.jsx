import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatDate } from "../api.js";
import { useApi } from "../useApi.js";
import Badge from "../components/Badge.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import CandidateForm from "../components/CandidateForm.jsx";
import Modal from "../components/Modal.jsx";
import NotesPanel from "../components/NotesPanel.jsx";
import StageBar from "../components/StageBar.jsx";
import { ErrorState, Skeleton } from "../components/States.jsx";

export default function CandidateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: c, error, loading, reload } = useApi(() => api.getCandidate(id), [id]);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [actionError, setActionError] = useState("");

  const move = async (stage) => {
    setMoving(true);
    setActionError("");
    try {
      await api.moveStage(id, stage);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setMoving(false);
    }
  };

  const archive = async () => {
    try {
      await api.archiveCandidate(id);
      navigate("/candidates", { replace: true });
    } catch (err) {
      setConfirming(false);
      setActionError(err.message);
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!c || String(c.id) !== id) return <Skeleton rows={5} />;

  return (
    <div>
      <p><Link to="/candidates" className="back-link">← Candidates</Link></p>
      <div className="page-head">
        <h1>
          {c.name} <Badge stage={c.stage} />
        </h1>
        <div className="page-actions">
          <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="danger" onClick={() => setConfirming(true)}>Archive</Button>
        </div>
      </div>
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      <div className="detail-grid">
        <div className="detail-main">
          <Card title="Stage">
            <StageBar stage={c.stage} moves={c.allowed_moves} onMove={move} busy={moving || loading} />
          </Card>
          <Card title="Details">
            <dl className="facts">
              <dt>Email</dt><dd>{c.email}</dd>
              <dt>Phone</dt><dd>{c.phone || "-"}</dd>
              <dt>Role</dt><dd>{c.role}</dd>
              <dt>Skills</dt><dd>{c.skills || "-"}</dd>
              <dt>Source</dt><dd>{c.source || "-"}</dd>
              <dt>Added</dt><dd>{formatDate(c.created_at)}</dd>
            </dl>
          </Card>
          <Card title="History">
            <ul className="history">
              {[...c.history].reverse().map((h) => (
                <li key={h.id}>
                  {h.from_stage ? (
                    <><Badge stage={h.from_stage} /> → <Badge stage={h.to_stage} /></>
                  ) : (
                    <>Added as <Badge stage={h.to_stage} /></>
                  )}
                  <span className="muted"> by {h.changed_by.name} · {formatDate(h.changed_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card title="Notes" className="detail-notes">
          <NotesPanel candidateId={c.id} notes={c.notes} onChange={reload} />
        </Card>
      </div>

      <Modal open={editing} title="Edit candidate" onClose={() => setEditing(false)}>
        <CandidateForm
          initial={{ name: c.name, email: c.email, phone: c.phone, role: c.role, skills: c.skills, source: c.source }}
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await api.updateCandidate(id, values);
            setEditing(false);
            reload();
          }}
        />
      </Modal>
      <Modal
        open={confirming}
        title="Archive this candidate?"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="danger" onClick={archive}>Archive</Button>
          </>
        }
      >
        <p>
          {c.name} will be hidden from lists and the board. Their history is kept, their email stays reserved,
          and this version cannot restore them.
        </p>
      </Modal>
    </div>
  );
}
