import {
  compareFrames,
  extractRawPixels
} from "./chunk-DU7A36EE.js";

// src/processing/delta-highlighter.ts
import sharp from "sharp";
async function applyDeltaHighlights(frames, threshold) {
  if (frames.length === 0) {
    return [];
  }
  const result = [frames[0]];
  for (let i = 1; i < frames.length; i++) {
    const currRaw = await extractRawPixels(frames[i].buffer);
    let prevBuffer = frames[i - 1].buffer;
    const prevMeta = await sharp(prevBuffer).metadata();
    if (prevMeta.width !== currRaw.width || prevMeta.height !== currRaw.height) {
      prevBuffer = await sharp(prevBuffer).resize(currRaw.width, currRaw.height, { fit: "fill" }).png().toBuffer();
    }
    const prevRaw = await extractRawPixels(prevBuffer);
    const { mask } = compareFrames(prevRaw, currRaw, threshold);
    let hasChanges = false;
    for (let j = 0; j < mask.length; j++) {
      if (mask[j] === 255) {
        hasChanges = true;
        break;
      }
    }
    if (!hasChanges) {
      result.push(frames[i]);
      continue;
    }
    const overlayData = Buffer.alloc(currRaw.width * currRaw.height * 4);
    for (let j = 0; j < mask.length; j++) {
      if (mask[j] === 255) {
        const offset = j * 4;
        overlayData[offset] = 255;
        overlayData[offset + 1] = 0;
        overlayData[offset + 2] = 0;
        overlayData[offset + 3] = 100;
      }
    }
    const buffer = await sharp(frames[i].buffer).composite([
      {
        input: overlayData,
        raw: {
          width: currRaw.width,
          height: currRaw.height,
          channels: 4
        },
        blend: "over"
      }
    ]).png().toBuffer();
    result.push({
      buffer,
      elapsedMs: frames[i].elapsedMs,
      index: frames[i].index
    });
  }
  return result;
}
export {
  applyDeltaHighlights
};
