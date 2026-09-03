export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const paramNames = [];
    const regexPath = pattern
      .replace(/:[a-zA-Z0-9_]+/g, (match) => {
        paramNames.push(match.slice(1));
        return "([^/]+)";
      });
    const regex = new RegExp(`^${regexPath}$`);
    this.routes.push({ method, regex, paramNames, handler });
    return this;
  }

  get(pattern, handler) {
    return this.add("GET", pattern, handler);
  }

  post(pattern, handler) {
    return this.add("POST", pattern, handler);
  }

  put(pattern, handler) {
    return this.add("PUT", pattern, handler);
  }

  delete(pattern, handler) {
    return this.add("DELETE", pattern, handler);
  }

  async handle(request, env, ctx) {
    const url = new URL(request.url);
    for (const route of this.routes) {
      if (route.method !== request.method) continue;
      const match = route.regex.exec(url.pathname);
      if (!match) continue;
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      return route.handler({ request, env, ctx, url, params });
    }
    return null;
  }
}
