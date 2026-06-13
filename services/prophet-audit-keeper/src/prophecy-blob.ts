function parseIpfsCid(ref: string): string | null {
  const trimmed = ref.trim();
  if (trimmed.startsWith("ipfs://")) {
    return trimmed.slice("ipfs://".length).split("/")[0]?.trim() || null;
  }
  if (trimmed.startsWith("ipfs:")) {
    return trimmed.slice("ipfs:".length).split("/")[0]?.trim() || null;
  }
  return null;
}

function parseIdxFilename(blobId: string): string | null {
  if (!blobId.startsWith("idx:")) return null;
  const filename = blobId.slice("idx:".length).trim();
  return /^[a-f0-9-]+\.bin$/i.test(filename) ? filename : null;
}

export async function readProphecyBlobBytes(
  blobId: string,
  opts: {
    indexerUrl: string;
    ipfsGatewayUrl: string;
  },
): Promise<Uint8Array | null> {
  const idxFilename = parseIdxFilename(blobId);
  if (idxFilename && opts.indexerUrl) {
    try {
      const url = `${opts.indexerUrl}/v1/prophecies/blobs/${encodeURIComponent(idxFilename)}`;
      const res = await fetch(url);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  const cid = parseIpfsCid(blobId);
  if (cid) {
    const base = opts.ipfsGatewayUrl.replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/ipfs/${encodeURIComponent(cid)}`);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  return null;
}
