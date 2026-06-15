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
import type { MonitorState } from "./state.js";

export function startHealthServer(
  port: number,
  getState: () => MonitorState,
): http.Server {
  const host = process.env.HOST ?? "0.0.0.0";
  const server = http.createServer(async (req, res) => {
    const state = getState();
    if (req.method === "GET" && req.url === "/health") {
      const body = {
        ok: state.errors.length === 0,
        service: "x-market-chain-monitor",
        errors: state.errors,
        lastPollAt: state.lastPollAt,
        alertsOpen: state.alerts.filter((a) => !a.resolved).length,
      };
      res.writeHead(body.ok ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }
    if (req.method === "GET" && req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(state.metrics));
      return;
    }
    if (req.method === "GET" && req.url === "/alerts") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ alerts: state.alerts }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });
  server.listen(port, host, () => {
    console.log(
      JSON.stringify({ event: "chain_monitor_health", host, port }),
    );
  });
  return server;
}
