import {
  logger
} from "./chunk-PFAIKYNR.js";

// src/processing/gif-exporter.ts
import { GifEncoder } from "@skyra/gifenc";
import sharp from "sharp";
import { buffer as streamToBuffer } from "stream/consumers";
async function exportGif(frames, maxWidth = 800) {
  if (frames.length === 0) {
    throw new Error("Cannot export GIF with zero frames");
  }
  const firstMeta = await sharp(frames[0].buffer).metadata();
  const srcWidth = firstMeta.width ?? 640;
  const srcHeight = firstMeta.height ?? 480;
  let outWidth = srcWidth;
  let outHeight = srcHeight;
  if (outWidth > maxWidth) {
    const scale = maxWidth / outWidth;
    outWidth = maxWidth;
    outHeight = Math.round(srcHeight * scale);
  }
  outWidth = Math.max(2, outWidth);
  outHeight = Math.max(2, outHeight);
  const encoder = new GifEncoder(outWidth, outHeight);
  const readStream = encoder.createReadStream();
  const bufferPromise = streamToBuffer(readStream);
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.start();
  for (let i = 0; i < frames.length; i++) {
    let delay;
    if (i === 0) {
      delay = frames.length > 1 ? frames[1].elapsedMs - frames[0].elapsedMs : 100;
    } else {
      delay = frames[i].elapsedMs - frames[i - 1].elapsedMs;
    }
    delay = Math.max(20, delay);
    encoder.setDelay(delay);
    const rawBuffer = await sharp(frames[i].buffer).resize(outWidth, outHeight, { fit: "fill" }).ensureAlpha().raw().toBuffer();
    encoder.addFrame(new Uint8ClampedArray(rawBuffer));
  }
  encoder.finish();
  const gifBuffer = await bufferPromise;
  logger.info(
    `GIF exported: ${frames.length} frames, ${outWidth}x${outHeight}px, ${gifBuffer.byteLength} bytes`
  );
  return Buffer.from(gifBuffer);
}
export {
  exportGif
};
