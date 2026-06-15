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
import { quoteBuy, type MarketKind } from "./quote.js";

const port = Number(process.env.PRICING_ENGINE_PORT ?? "8801");
const host = process.env.HOST ?? "0.0.0.0";
const cors = process.env.PRICING_CORS_ORIGIN ?? "*";

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": cors,
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, service: "x-market-pricing-engine" });
    return;
  }
  if (req.method === "GET" && req.url?.startsWith("/v1/quote")) {
    const q = new URL(req.url, "http://localhost").searchParams;
    const kind = (q.get("kind") ?? "poisson") as MarketKind;
    const stake = BigInt(q.get("stake_usdc") ?? "1000000");
    try {
      const result = quoteBuy({
        kind,
        stakeUsdc: stake,
        lambdaTenths: Number(q.get("lambda_tenths") ?? "25"),
        poissonA: Number(q.get("poisson_a") ?? "0"),
        poissonB: Number(q.get("poisson_b") ?? "2"),
        poissonK: Number(q.get("poisson_k") ?? "0"),
        mode: (q.get("mode") as "interval" | "digital") ?? "interval",
        dirichletAlphas: q.get("alphas")?.split(",").map(Number),
        dirichletOutcome: Number(q.get("outcome") ?? "0"),
        muTenths: Number(q.get("mu_tenths") ?? "25"),
        sigmaTenths: Number(q.get("sigma_tenths") ?? "4"),
        normalThresholdTenths: Number(q.get("threshold_tenths") ?? "30"),
      });
      json(res, 200, { quote: result });
    } catch (e) {
      json(res, 400, { error: e instanceof Error ? e.message : "quote failed" });
    }
    return;
  }
  json(res, 404, { error: "not found" });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ event: "pricing_engine_started", host, port }));
});
