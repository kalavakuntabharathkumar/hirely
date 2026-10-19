import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { api } from "../api.js";
import { useApi } from "../useApi.js";
import Badge from "./Badge.jsx";
import Button from "./Button.jsx";
import { EmptyState, ErrorState, Skeleton } from "./States.jsx";
import { STAGES } from "./StageBar.jsx";

function CardBody({ card }) {
  return (
    <>
      <Link to={`/candidates/${card.id}`} className="kcard-name">
        {card.name}
      </Link>
      <span className="muted">{card.role}</span>
    </>
  );
}

function BoardCard({ card }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: Boolean(card.pending), // locked while the server is still answering
  });
  const classes = `kcard${isDragging ? " dragging" : ""}${card.pending ? " pending" : ""}`;
  return (
    <li ref={setNodeRef} className={classes} {...attributes} {...listeners}>
      <CardBody card={card} />
    </li>
  );
}

// data-state tells the CSS whether this column is a valid drop, an invalid one, or the card's own column.
function Column({ stage, cards, dragged }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  let state = "idle";
  if (dragged) {
    if (dragged.stage === stage) state = "current";
    else state = dragged.allowed_moves.includes(stage) ? "valid" : "invalid";
  }
  return (
    <section className={`column${isOver ? " over" : ""}`} data-state={state} aria-label={`${stage} column`}>
      <header className="column-head">
        <Badge stage={stage} />
        <span className="muted">{cards.length}</span>
      </header>
      <ul ref={setNodeRef} className="column-body">
        {cards.map((card) => (
          <BoardCard key={card.id} card={card} />
        ))}
        {cards.length === 0 && <li className="column-empty">Drop here</li>}
      </ul>
    </section>
  );
}

export default function KanbanBoard() {
  const { data, error, reload } = useApi(() => api.listCandidates({ page_size: 200 }), []);
  const [cards, setCards] = useState([]);
  const [dragged, setDragged] = useState(null);
  const [notice, setNotice] = useState("");

  // Mouse needs a small move (so clicking the name still opens the candidate); touch needs a short
  // press (so scrolling the board still works); keyboard: focus a card, Space, arrow keys, Space.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (data) setCards(data.items);
  }, [data]);

  const onDragStart = ({ active }) => {
    setNotice("");
    setDragged(cards.find((c) => c.id === active.id) || null);
  };

  const onDragEnd = async ({ active, over }) => {
    setDragged(null);
    const card = cards.find((c) => c.id === active.id);
    if (!card || !over || over.id === card.stage) return;
    const target = over.id;
    if (!card.allowed_moves.includes(target)) {
      setNotice(`${card.name} cannot move from ${card.stage} to ${target}.`);
      return;
    }
    // Optimistic: the card moves now. If the server says no, only this card snaps back.
    setCards((all) => all.map((c) => (c.id === card.id ? { ...c, stage: target, allowed_moves: [], pending: true } : c)));
    try {
      const saved = await api.moveStage(card.id, target);
      setCards((all) => all.map((c) => (c.id === card.id ? { ...c, stage: saved.stage, allowed_moves: saved.allowed_moves, pending: false } : c)));
    } catch (err) {
      setCards((all) => all.map((c) => (c.id === card.id ? card : c)));
      setNotice(`Could not move ${card.name}: ${err.message}`);
    }
  };

  const onDragCancel = () => setDragged(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Skeleton rows={5} />;
  if (data.total === 0) {
    return (
      <EmptyState
        title="No candidates yet"
        text="Add your first candidate and they will appear in the Applied column."
        action={<Link to="/candidates" className="btn btn-primary">Add candidate</Link>}
      />
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>Board</h1>
        <Button variant="secondary" onClick={reload}>Refresh</Button>
      </div>
      <p className="muted board-hint">
        Drag a card to a highlighted column. Keyboard: focus a card, press Space, use the arrow keys, press Space to drop.
      </p>
      {notice && <p className="form-error" role="alert">{notice}</p>}
      {data.total > data.items.length && <p className="muted">Showing the newest {data.items.length} of {data.total} candidates.</p>}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className="board">
          {STAGES.map((stage) => (
            <Column key={stage} stage={stage} dragged={dragged} cards={cards.filter((c) => c.stage === stage)} />
          ))}
        </div>
        <DragOverlay>
          {dragged ? (
            <div className="kcard overlay">
              <CardBody card={dragged} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
