import { Router } from "./router.js";
import { registerHealthRoutes } from "./routes/health.js";
import { notFound, withCors } from "./lib/responses.js";

const router = new Router();
registerHealthRoutes(router);

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || "*";

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), origin);
    }

    const response = (await router.handle(request, env, ctx)) ?? notFound();
    return withCors(response, origin);
  },
};
