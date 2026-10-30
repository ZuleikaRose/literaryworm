/** Where the e2e run serves the app: a port of its own, so it doesn't clash with `npm run dev`. */
export const PORT = Number(process.env.E2E_PORT ?? 5199);
export const BASE_URL = `http://localhost:${PORT}`;
