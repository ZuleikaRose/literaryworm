import { useId, useState } from "react";
import { initials } from "../lib/bookDetail";
import type { ReadingLog } from "../types";
import { Icon } from "./Icon";

interface LogCardProps {
  log: ReadingLog;
  /** Set for the active profile's own logs: they can edit and delete them. */
  onEdit?: () => void;
  onDelete?: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const LONG = 420;

/** One reader's log: display name, date, optional rating and the text. */
export function LogCard({ log, onEdit, onDelete }: LogCardProps) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const long = log.body.length > LONG;
  const edited = log.updatedAt - log.createdAt > 60_000;
  const own = Boolean(onEdit);

  return (
    <article className={`log-card${own ? " is-own" : ""}`}>
      <header className="log-header">
        <span className="reader-avatar" aria-hidden="true">
          {initials(log.displayName)}
        </span>
        <div className="log-byline">
          <h3 className="reader-name">
            {log.displayName}
            {own && <span className="own-tag">You</span>}
          </h3>
          <small>
            <time dateTime={new Date(log.createdAt).toISOString()}>{dateFormat.format(log.createdAt)}</time>
            {edited && " · edited"}
          </small>
        </div>
        {log.rating !== null && (
          <span className="log-rating" role="img" aria-label={`Rated ${log.rating} out of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Icon key={i} name="star" size={13} filled={i < log.rating!} />
            ))}
          </span>
        )}
      </header>
      <p id={bodyId} className={`log-body${long && !expanded ? " is-clamped" : ""}`}>
        {log.body}
      </p>
      <div className="log-actions">
        {long && (
          <button type="button" className="text-button" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Show less" : "Read full log"}
            <Icon name="chevronDown" size={14} className={expanded ? "flip" : undefined} />
          </button>
        )}
        {onEdit && (
          <button type="button" className="ghost-button small-button" onClick={onEdit}>
            <Icon name="edit" size={15} /> Edit<span className="visually-hidden"> your log</span>
          </button>
        )}
        {onDelete && (
          <button type="button" className="ghost-button small-button danger-text" onClick={onDelete}>
            <Icon name="trash" size={15} /> Delete<span className="visually-hidden"> your log</span>
          </button>
        )}
      </div>
    </article>
  );
}
