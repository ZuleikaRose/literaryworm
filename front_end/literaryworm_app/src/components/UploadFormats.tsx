import { UPLOAD_FORMATS } from "../lib/bookFile";
import { useT } from "../lib/useT";

/**
 * *What you can upload*: every DRM-free file type Uploads takes (UPLOAD_FORMATS in lib/bookFile.ts),
 * shown wherever a book can be uploaded: My Library → Uploads, starting a club on an upload, and a
 * club's *Choose your copy*.
 */
export function UploadFormats({ id }: { id?: string }) {
  const t = useT();
  return (
    <div className="upload-formats" id={id}>
      <p className="upload-formats-title">{t("You can upload these DRM-free files:")}</p>
      <ul>
        {UPLOAD_FORMATS.map((f) => (
          <li key={f.kind}>
            <strong>{f.name}</strong> <span className="upload-formats-ext">({f.extensions.join(", ")})</span>: {t(f.note)}
          </li>
        ))}
      </ul>
      <p className="upload-formats-note">{t("Books with DRM, as most ebook shops' own apps sell them, can't be uploaded. Each file can be up to 50 MB.")}</p>
    </div>
  );
}
