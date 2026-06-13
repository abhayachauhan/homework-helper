import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { resizeToBase64 } from "../src/images.js";

describe("resizeToBase64", () => {
  it("downscales a large image and returns base64 jpeg", async () => {
    const big = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: "#888" },
    }).png().toBuffer();

    const { base64, mediaType } = await resizeToBase64(big);
    expect(mediaType).toBe("image/jpeg");
    expect(base64.length).toBeGreaterThan(0);

    const meta = await sharp(Buffer.from(base64, "base64")).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600);
  });
});
