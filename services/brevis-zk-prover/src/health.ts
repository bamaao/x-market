import http from "node:http";

export function startHealth(
  port: number,
  snapshot: () => Record<string, unknown>,
): http.Server {
  const host = process.env.HOST ?? "0.0.0.0";
  const server = http.createServer((req, res) => {
    if (req.method !== "GET" || req.url !== "/health") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const body = snapshot();
    const ok = body.ok === true;
    res.writeHead(ok ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });
  server.listen(port, host, () => {
    console.log(JSON.stringify({ event: "brevis_zk_prover_health", host, port }));
  });
  return server;
}
