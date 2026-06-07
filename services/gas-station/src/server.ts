import http from "node:http";
import { sendWebhookAlert } from "../../shared/alert.js";
import { loadConfig } from "./config.js";
import { collectHealth } from "./health.js";
import { sponsorTransaction } from "./sponsor.js";

const config = loadConfig();
const hits = new Map<string, { count: number; windowStart: number }>();

function rateLimited(sender: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const entry = hits.get(sender);
  if (!entry || now - entry.windowStart >= windowMs) {
    hits.set(sender, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > config.rateLimitPerMin;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": config.corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    const report = await collectHealth(config);
    json(res, report.ok ? 200 : 503, report);
    return;
  }

  if (req.method === "POST" && req.url === "/v1/sponsor") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw) as {
        transactionKindBcs?: string;
        txBytes?: string;
        sender?: string;
      };
      const transactionKindBcs = body.transactionKindBcs ?? body.txBytes;
      const sender = body.sender;
      if (!transactionKindBcs || !sender) {
        json(res, 400, { error: "transactionKindBcs and sender are required" });
        return;
      }
      if (rateLimited(sender)) {
        json(res, 429, { error: "rate limit exceeded" });
        return;
      }
      const result = await sponsorTransaction({
        transactionKindBcs,
        sender,
      });
      json(res, 200, result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "sponsor failed";
      json(res, 400, { error: message });
    }
    return;
  }

  json(res, 404, { error: "not found" });
});

server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      event: "gas_station_started",
      host: config.host,
      port: config.port,
      network: config.network,
      production: config.production,
      packageId: config.packageId || null,
    }),
  );
  console.log(`  POST /v1/sponsor`);
  console.log(`  GET  /health`);
  if (!config.gasPayerPrivateKey) {
    console.warn("  WARN: GAS_PAYER_PRIVATE_KEY not set — sponsor will fail");
  }
  if (!config.packageId) {
    console.warn("  WARN: PACKAGE_ID not set — whitelist accepts any package id");
  }

  let lastBalanceAlert = false;
  setInterval(async () => {
    const report = await collectHealth(config);
    if (report.gasBalanceLow && !lastBalanceAlert) {
      lastBalanceAlert = true;
      console.warn(
        JSON.stringify({
          event: "gas_balance_low",
          balance: report.gasBalanceMist,
          owner: report.gasOwner,
        }),
      );
      await sendWebhookAlert(config.alertWebhookUrl, {
        alert: "gas_balance_low",
        service: "gas-station",
        gasOwner: report.gasOwner,
        gasBalanceMist: report.gasBalanceMist,
      });
    }
    if (!report.gasBalanceLow) lastBalanceAlert = false;
  }, config.balanceCheckMs);
});
