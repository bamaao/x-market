// Copyright (c) 2026 zouyc zouyccq@gmail.com.
// All rights reserved.
//
// Licensed under the Business Source License 1.1 (BSL 1.1).
// You may not use this file except in compliance with the License.
//
// Change Date: 2031-01-01
// On the Change Date, or the fourth anniversary of the first publicly available
// distribution of the code under the BSL, whichever comes first, the code
// automatically becomes available under the Apache License 2.0.

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
    console.log(JSON.stringify({ event: "uma_dvm_relayer_health", host, port }));
  });
  return server;
}
