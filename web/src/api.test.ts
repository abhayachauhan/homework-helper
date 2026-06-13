import { describe, it, expect, vi, afterEach } from "vitest";
import { getProfiles, submitText, submitImage, getHistory, ApiError } from "./api.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("getProfiles returns the parsed list", async () => {
    vi.stubGlobal("fetch", mockFetch(200, [{ id: "jai", name: "Jai", level: "Year 9", age: 14 }]));
    const profiles = await getProfiles();
    expect(profiles[0].id).toBe("jai");
  });

  it("submitText posts JSON to /api/submit", async () => {
    const f = mockFetch(200, { id: "s1", result: { subject: "maths", summary: "ok", items: [] } });
    vi.stubGlobal("fetch", f);
    const res = await submitText("jai", "2+2");
    expect(res.id).toBe("s1");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/submit");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ profileId: "jai", text: "2+2" });
  });

  it("submitImage posts multipart with profileId in the query string", async () => {
    const f = mockFetch(200, { id: "s2", result: { subject: "maths", summary: "ok", items: [] } });
    vi.stubGlobal("fetch", f);
    const file = new File(["x"], "hw.jpg", { type: "image/jpeg" });
    await submitImage("zane", file);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/submit?profileId=zane");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBe(file);
  });

  it("getHistory encodes the profileId", async () => {
    const f = mockFetch(200, []);
    vi.stubGlobal("fetch", f);
    await getHistory("keeran");
    expect(f.mock.calls[0][0]).toBe("/api/history?profileId=keeran");
  });

  it("throws ApiError with the server message on non-2xx", async () => {
    vi.stubGlobal("fetch", mockFetch(429, { message: "enough for today" }));
    await expect(submitText("jai", "x")).rejects.toMatchObject({ status: 429, message: "enough for today" });
    await expect(submitText("jai", "x")).rejects.toBeInstanceOf(ApiError);
  });
});
