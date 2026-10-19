import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatDate } from "../api.js";
import { useApi, useDebounced } from "../useApi.js";
import Badge from "../components/Badge.jsx";
import Button from "../components/Button.jsx";
import CandidateForm from "../components/CandidateForm.jsx";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import { EmptyState, ErrorState, Skeleton } from "../components/States.jsx";
import { STAGES } from "../components/StageBar.jsx";

const PAGE_SIZE = 20;

const COLUMNS = [
  {
    key: "name",
    header: "Candidate",
    render: (c) => (
      <>
        <Link to={`/candidates/${c.id}`} className="cell-name">{c.name}</Link>
        <span className="cell-sub">{c.email}</span>
      </>
    ),
  },
  { key: "role", header: "Role" },
  { key: "stage", header: "Stage", render: (c) => <Badge stage={c.stage} /> },
  { key: "skills", header: "Skills", render: (c) => <span className="clamp">{c.skills || "-"}</span> },
  { key: "created_at", header: "Added", render: (c) => formatDate(c.created_at) },
];

export default function Candidates() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [adding, setAdding] = useState(false);
  const q = useDebounced(search, 300); // the server is asked only after typing stops for 300 ms

  // The page number belongs to one (search, stage) pair; a new pair silently starts at page 1.
  const [pageState, setPageState] = useState({ key: "", page: 1 });
  const key = `${q}|${stage}`;
  const page = pageState.key === key ? pageState.page : 1;
  const setPage = (p) => setPageState({ key, page: p });

  const { data, error, loading, reload } = useApi(() => api.listCandidates({ q, stage, page, page_size: PAGE_SIZE }), [q, stage, page]);

  useEffect(() => {
    if (data && page > data.pages) setPage(data.pages); // e.g. the last item on the last page was archived
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = Boolean(q || stage);
  let body;
  if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (!data) body = <Skeleton rows={6} />;
  else if (data.total === 0 && filtered) {
    body = <EmptyState title="No results for this search" text="Try a different name, role, skill or stage." />;
  } else if (data.total === 0) {
    body = (
      <EmptyState
        title="No candidates yet"
        text="Add your first candidate to get started."
        action={<Button onClick={() => setAdding(true)}>Add candidate</Button>}
      />
    );
  } else {
    body = (
      <DataTable
        columns={COLUMNS}
        rows={data.items}
        busy={loading}
        onRowClick={(c) => navigate(`/candidates/${c.id}`)}
        pagination={{ page: data.page, pages: data.pages, total: data.total, pageSize: data.page_size, onPage: setPage }}
      />
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>Candidates</h1>
        <Button onClick={() => setAdding(true)}>Add candidate</Button>
      </div>
      <div className="toolbar">
        <div className="field">
          <label htmlFor="search">Search</label>
          <input id="search" type="search" value={search} placeholder="Name, email, role or skills"
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="stage-filter">Stage</label>
          <select id="stage-filter" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      {body}
      <Modal open={adding} title="Add candidate" onClose={() => setAdding(false)}>
        <CandidateForm
          submitLabel="Add candidate"
          onCancel={() => setAdding(false)}
          onSubmit={async (values) => {
            const created = await api.createCandidate(values);
            setAdding(false);
            navigate(`/candidates/${created.id}`);
          }}
        />
      </Modal>
    </div>
  );
}
