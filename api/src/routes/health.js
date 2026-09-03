import { json } from "../lib/responses.js";

export function registerHealthRoutes(router) {
  router.get("/api/health", () => json({ status: "ok" }));
}
