import sharp from "sharp";
import { MAX_IMAGE_EDGE } from "./config.js";

export interface NormalisedImage {
  base64: string;
  mediaType: "image/jpeg";
}

export async function resizeToBase64(buf: Buffer): Promise<NormalisedImage> {
  const out = await sharp(buf)
    .rotate()
    .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return { base64: out.toString("base64"), mediaType: "image/jpeg" };
}
