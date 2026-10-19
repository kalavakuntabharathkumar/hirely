import Button from "./Button.jsx";

function Pager({ page, pages, total, pageSize, onPage }) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  return (
    <nav className="pager" aria-label="Pagination">
      <span className="muted">
        {first}-{last} of {total}
      </span>
      <div className="pager-buttons">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="pager-page">
          Page {page} of {pages}
        </span>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}

// columns: [{ key, header, render?(row) }]. On narrow screens rows become stacked cards
// (each cell shows its header through data-label), so the page never scrolls sideways.
export default function DataTable({ columns, rows, onRowClick, pagination, busy }) {
  return (
    <div className="table-card" aria-busy={busy ? "true" : "false"}>
      <table className={`table${busy ? " is-busy" : ""}`}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={onRowClick ? "clickable" : undefined} onClick={onRowClick && ((event) => !event.target.closest("a, button") && onRowClick(row))}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && <Pager {...pagination} />}
    </div>
  );
}
