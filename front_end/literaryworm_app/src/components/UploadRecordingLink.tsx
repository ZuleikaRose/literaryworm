import { Link } from "react-router-dom";
import { rich } from "../lib/i18n";
import { recordingFor } from "../lib/uploadRecording";
import { useT } from "../lib/useT";
import { useActiveProfile } from "../store/context";
import type { UploadedBook } from "../types";
import { Icon } from "./Icon";

/**
 * Under an uploaded book (My Library → Uploads, its page, the player): when the catalog has the
 * same public-domain title with a LibriVox recording (lib/uploadRecording.ts), a link to hear a
 * person read it instead of a device voice. Nothing shows otherwise.
 */
export function UploadRecordingLink({ upload, className = "upload-recording" }: { upload: Pick<UploadedBook, "title" | "author">; className?: string }) {
  const t = useT();
  const profile = useActiveProfile();
  const match = recordingFor(upload, profile?.ageRating ?? "kids");
  if (!match?.recording) return null;
  return (
    <p className={className}>
      <Icon name="headphones" size={15} />{" "}
      {rich(t("A person reads this book: {narrator} recorded it for LibriVox. {link}", { narrator: match.recording.narrator }), {
        link: (
          <Link to={`/listen/${match.id}`}>
            {t("Listen to their recording")}
            <span className="visually-hidden"> ({match.title})</span>
          </Link>
        ),
      })}
    </p>
  );
}
