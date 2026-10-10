/**
 * Unit tests for the R2 storage helpers (`src/lib/storage.ts`).
 *
 * All `fetch` calls are intercepted via `vi.stubGlobal` — no network or real
 * credentials required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeFile(name: string, type: string, content = "fake-content"): File {
  return new File([content], name, { type });
}

/** Build a mock fetch that returns the given body once per call. */
function mockFetch(...responses: { ok: boolean; status?: number; body: unknown }[]) {
  const queue = [...responses];
  return vi.fn().mockImplementation(async () => {
    const next = queue.shift();
    if (!next) throw new Error("Unexpected fetch call");
    return {
      ok: next.ok,
      status: next.status ?? (next.ok ? 200 : 400),
      statusText: next.ok ? "OK" : "Bad Request",
      json: async () => next.body,
    };
  });
}

// ── presignUpload ─────────────────────────────────────────────────────────────

describe("presignUpload", () => {
  beforeEach(() => {
    // Suppress localStorage access in jsdom / happy-dom
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue("test-token"),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls /uploads/presign and returns upload_url + key on success", async () => {
    const fakeFetch = mockFetch({
      ok: true,
      body: {
        status: true,
        message: "Presigned URL generated",
        data: { upload_url: "https://put.r2.test/proof/abc?sig=x", key: "proof/abc" },
      },
    });
    vi.stubGlobal("fetch", fakeFetch);

    const { presignUpload } = await import("../storage");
    const file = makeFile("receipt.pdf", "application/pdf");
    const result = await presignUpload(file, "proof");

    expect(result.upload_url).toBe("https://put.r2.test/proof/abc?sig=x");
    expect(result.key).toBe("proof/abc");

    const [url, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/uploads/presign");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      content_type: "application/pdf",
      prefix: "proof",
    });
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-token",
    );
  });

  it("throws when the API returns a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ ok: false, status: 401, body: { message: "Unauthorized" } }),
    );

    const { presignUpload } = await import("../storage");
    const file = makeFile("receipt.pdf", "application/pdf");

    await expect(presignUpload(file)).rejects.toThrow("Unauthorized");
  });

  it("uses 'upload' as default prefix when none supplied", async () => {
    const fakeFetch = mockFetch({
      ok: true,
      body: {
        status: true,
        message: "OK",
        data: { upload_url: "https://put.r2.test/upload/xyz", key: "upload/xyz" },
      },
    });
    vi.stubGlobal("fetch", fakeFetch);

    const { presignUpload } = await import("../storage");
    await presignUpload(makeFile("x.png", "image/png"));

    const body = JSON.parse(
      (fakeFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.prefix).toBe("proof"); // default passed in helper
  });
});

// ── putToR2 ───────────────────────────────────────────────────────────────────

describe("putToR2", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("PUTs the file to the presigned URL with correct Content-Type", async () => {
    const fakeFetch = mockFetch({ ok: true, body: "" });
    vi.stubGlobal("fetch", fakeFetch);

    const { putToR2 } = await import("../storage");
    const file = makeFile("receipt.pdf", "application/pdf");
    await putToR2("https://put.r2.test/proof/abc?sig=x", file);

    const [url, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://put.r2.test/proof/abc?sig=x");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/pdf",
    );
    expect(init.body).toBe(file);
  });

  it("throws when R2 returns a non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ ok: false, status: 403, body: "Forbidden" }),
    );

    const { putToR2 } = await import("../storage");
    await expect(
      putToR2("https://put.r2.test/proof/abc", makeFile("x.pdf", "application/pdf")),
    ).rejects.toThrow("R2 upload failed: 403");
  });
});

// ── uploadProof ───────────────────────────────────────────────────────────────

describe("uploadProof", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue("test-token"),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("presigns then PUTs and returns the key", async () => {
    const presignResp = {
      ok: true,
      body: {
        status: true,
        message: "OK",
        data: { upload_url: "https://put.r2.test/proof/uuid1?sig=y", key: "proof/uuid1" },
      },
    };
    const r2Resp = { ok: true, body: "" };

    vi.stubGlobal("fetch", mockFetch(presignResp, r2Resp));

    const { uploadProof } = await import("../storage");
    const key = await uploadProof(makeFile("receipt.pdf", "application/pdf"));

    expect(key).toBe("proof/uuid1");
  });

  it("propagates presign errors before touching R2", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ ok: false, status: 500, body: { message: "Storage error" } }),
    );

    const { uploadProof } = await import("../storage");
    await expect(
      uploadProof(makeFile("receipt.pdf", "application/pdf")),
    ).rejects.toThrow("Storage error");
  });
});
