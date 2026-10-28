// LiteraryWorm's service worker: keeps the app's own files so pages open without a connection,
// and serves books saved for offline (their text and, if chosen, their LibriVox audio) from the
// device. Accounts, Supabase and the Edge Functions always go to the network.
//
// Caches:
//   lw-shell-<version>  the page and its hashed /assets files, refreshed whenever online
//   lw-books            texts and audio the reader chose to save (src/lib/offline.ts writes it)

const SHELL = "lw-shell-v1";
const BOOKS = "lw-books";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.add("/"))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lw-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Saved audio (any origin): served from the device, honouring Range so seeking works.
  if (/\.mp3$/i.test(url.pathname)) {
    event.respondWith(savedAudio(request));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pages: the network first (so a new version shows), the saved page when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((cache) => cache.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/", { cacheName: SHELL }).then((res) => res ?? Response.error())),
    );
    return;
  }

  // Built files never change under the same name: keep each one the first time it loads.
  if (url.pathname.startsWith("/assets/") || url.pathname === "/favicon.svg") {
    event.respondWith(
      caches.match(request, { cacheName: SHELL }).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // A saved book's text, else the network.
  if (url.pathname.startsWith("/texts/")) {
    event.respondWith(caches.match(url.pathname, { cacheName: BOOKS }).then((hit) => hit ?? fetch(request)));
  }
});

async function savedAudio(request) {
  const hit = await caches.match(request.url, { cacheName: BOOKS, ignoreVary: true });
  if (!hit) return fetch(request);
  const range = request.headers.get("Range");
  if (!range) return hit;
  const blob = await hit.blob();
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const size = blob.size;
  let start = match && match[1] ? Number(match[1]) : 0;
  let end = match && match[2] ? Number(match[2]) : size - 1;
  if (match && !match[1] && match[2]) {
    // "bytes=-500": the last 500 bytes.
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  end = Math.min(end, size - 1);
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": hit.headers.get("Content-Type") ?? "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}
