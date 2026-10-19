// Stage pill. Each stage has its own subtle colour (see styles.css).
export default function Badge({ stage }) {
  return <span className={`badge badge-${stage.toLowerCase()}`}>{stage}</span>;
}
