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

import type { IndexerConfig } from "./config.js";
import { coverExtension, sanitizeCoverSlug } from "./covers.js";

export type IpfsPinResult = {
  cid: string;
  imageUrl: string;
};

function coverFilename(slug: string, contentType: string): string {
  const ext = coverExtension(contentType) ?? ".bin";
  const safeSlug = sanitizeCoverSlug(slug) || "market";
  return `${safeSlug}${ext}`;
}

async function pinViaPinata(
  config: IndexerConfig,
  data: Buffer,
  filename: string,
): Promise<IpfsPinResult> {
  const jwt = config.ipfsPinataJwt;
  if (!jwt) {
    throw new Error("IPFS_PINATA_JWT is required when INDEXER_COVER_STORAGE=ipfs and IPFS_PIN_PROVIDER=pinata");
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)]), filename);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: `x-market-cover:${filename}` }),
  );

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pinata pin failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { IpfsHash?: string };
  const cid = json.IpfsHash?.trim();
  if (!cid) {
    throw new Error("Pinata response missing IpfsHash");
  }
  return { cid, imageUrl: `ipfs://${cid}` };
}

async function pinViaKubo(
  config: IndexerConfig,
  data: Buffer,
  filename: string,
): Promise<IpfsPinResult> {
  const base = config.ipfsKuboApiUrl.replace(/\/$/, "");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)]), filename);

  const res = await fetch(`${base}/api/v0/add?pin=true&cid-version=1`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kubo add failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const text = await res.text();
  const line = text.trim().split("\n").find(Boolean);
  if (!line) {
    throw new Error("Kubo add returned empty response");
  }
  const json = JSON.parse(line) as { Hash?: string };
  const cid = json.Hash?.trim();
  if (!cid) {
    throw new Error("Kubo response missing Hash");
  }
  return { cid, imageUrl: `ipfs://${cid}` };
}

export async function pinMarketCoverToIpfs(
  config: IndexerConfig,
  slug: string,
  contentType: string,
  data: Buffer,
): Promise<IpfsPinResult> {
  const filename = coverFilename(slug, contentType);
  switch (config.ipfsPinProvider) {
    case "pinata":
      return pinViaPinata(config, data, filename);
    case "kubo":
      return pinViaKubo(config, data, filename);
    default:
      throw new Error(`unsupported IPFS_PIN_PROVIDER: ${config.ipfsPinProvider}`);
  }
}

export async function pinBinaryToIpfs(
  config: IndexerConfig,
  data: Buffer,
  filename: string,
  pinName: string,
): Promise<IpfsPinResult> {
  switch (config.ipfsPinProvider) {
    case "pinata": {
      const jwt = config.ipfsPinataJwt;
      if (!jwt) {
        throw new Error(
          "IPFS_PINATA_JWT is required when INDEXER_PROPHET_STORAGE=ipfs and IPFS_PIN_PROVIDER=pinata",
        );
      }
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(data)]), filename);
      form.append("pinataMetadata", JSON.stringify({ name: pinName }));
      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
        body: form,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Pinata pin failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as { IpfsHash?: string };
      const cid = json.IpfsHash?.trim();
      if (!cid) throw new Error("Pinata response missing IpfsHash");
      return { cid, imageUrl: `ipfs://${cid}` };
    }
    case "kubo":
      return pinViaKubo(config, data, filename);
    default:
      throw new Error(`unsupported IPFS_PIN_PROVIDER: ${config.ipfsPinProvider}`);
  }
}
