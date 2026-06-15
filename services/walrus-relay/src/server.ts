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

const upstream =
  process.env.WALRUS_UPSTREAM_PUBLISHER_URL?.trim() ??
  "https://publisher.walrus-testnet.walrus.space";
const port = Number(process.env.WALRUS_RELAY_PORT ?? "8791");
const apiKey = process.env.WALRUS_RELAY_API_KEY?.trim() ?? "";
const maxBody = Number(process.env.WALRUS_RELAY_MAX_BODY_BYTES ?? "10485760");
const host = process.env.HOST ?? "0.0.0.0";

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBody) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, {
      ok: true,
      service: "x-market-walrus-relay",
      upstream,
    });
    return;
  }

  if (req.method === "PUT" && req.url?.startsWith("/v1/blobs")) {
    if (apiKey) {
      const key = req.headers["x-api-key"];
      if (key !== apiKey) {
        json(res, 401, { error: "unauthorized" });
        return;
      }
    }
    try {
      const body = await readBody(req);
      const target = `${upstream}${req.url}`;
      const upstreamRes = await fetch(target, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Uint8Array(body),
      });
      const text = await upstreamRes.text();
      res.writeHead(upstreamRes.status, {
        "Content-Type": upstreamRes.headers.get("content-type") ?? "application/json",
      });
      res.end(text);
    } catch (e) {
      json(res, 502, {
        error: e instanceof Error ? e.message : "upstream failed",
      });
    }
    return;
  }

  json(res, 404, { error: "not found" });
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      event: "walrus_relay_started",
      host,
      port,
      upstream,
      auth: Boolean(apiKey),
    }),
  );
});
