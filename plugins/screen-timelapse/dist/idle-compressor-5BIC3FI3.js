import {
  createTimestampOverlay
} from "./chunk-M7CUPRQ2.js";
import {
  compareFrames,
  extractRawPixels
} from "./chunk-DU7A36EE.js";
import "./chunk-PFAIKYNR.js";

// src/processing/idle-compressor.ts
import sharp from "sharp";
function formatIdleDuration(durationMs) {
  return `unchanged ${(durationMs / 1e3).toFixed(1)}s`;
}
async function compressIdleFrames(frames, threshold) {
  if (frames.length <= 1) {
    return [...frames];
  }
  const result = [];
  let idleRunStart = 0;
  let lastWasIdle = false;
  let prevRaw = await extractRawPixels(frames[0].buffer);
  for (let i = 1; i < frames.length; i++) {
    const currRaw = await extractRawPixels(frames[i].buffer);
    let comparePrev = prevRaw;
    if (prevRaw.width !== currRaw.width || prevRaw.height !== currRaw.height) {
      comparePrev = await extractRawPixels(
        await sharp(frames[i - 1].buffer).resize(currRaw.width, currRaw.height, { fit: "fill" }).png().toBuffer()
      );
    }
    const { changedFraction } = compareFrames(comparePrev, currRaw, threshold);
    const isIdle = changedFraction === 0;
    if (!isIdle) {
      if (i - 1 > idleRunStart) {
        result.push(
          await createCollapsedFrame(frames, idleRunStart, i - 1)
        );
      } else {
        result.push(frames[idleRunStart]);
      }
      idleRunStart = i;
    }
    lastWasIdle = isIdle;
    prevRaw = currRaw;
  }
  if (frames.length - 1 > idleRunStart && lastWasIdle) {
    result.push(
      await createCollapsedFrame(frames, idleRunStart, frames.length - 1)
    );
  } else if (frames.length - 1 > idleRunStart && !lastWasIdle) {
    for (let j = idleRunStart; j < frames.length; j++) {
      result.push(frames[j]);
    }
  } else {
    result.push(frames[idleRunStart]);
  }
  return result;
}
async function createCollapsedFrame(frames, startIdx, endIdx) {
  const firstFrame = frames[startIdx];
  const lastFrame = frames[endIdx];
  const durationMs = lastFrame.elapsedMs - firstFrame.elapsedMs;
  const label = formatIdleDuration(durationMs);
  const meta = await sharp(firstFrame.buffer).metadata();
  const width = meta.width ?? 100;
  const height = meta.height ?? 100;
  let overlay = await createTimestampOverlay(label, width, height);
  const overlayMeta = await sharp(overlay).metadata();
  let overlayWidth = overlayMeta.width ?? 80;
  let overlayHeight = overlayMeta.height ?? 20;
  if (overlayWidth > width || overlayHeight > height) {
    const scale = Math.min(width / overlayWidth, height / overlayHeight);
    overlayWidth = Math.floor(overlayWidth * scale);
    overlayHeight = Math.floor(overlayHeight * scale);
    overlay = await sharp(overlay).resize(Math.max(1, overlayWidth), Math.max(1, overlayHeight), { fit: "inside" }).png().toBuffer();
    const resizedMeta = await sharp(overlay).metadata();
    overlayWidth = resizedMeta.width ?? overlayWidth;
    overlayHeight = resizedMeta.height ?? overlayHeight;
  }
  const left = Math.max(0, Math.floor((width - overlayWidth) / 2));
  const top = Math.max(0, Math.floor((height - overlayHeight) / 2));
  const buffer = await sharp(firstFrame.buffer).composite([{ input: overlay, left, top }]).png().toBuffer();
  return {
    buffer,
    elapsedMs: firstFrame.elapsedMs,
    index: firstFrame.index
  };
}
export {
  compressIdleFrames
};
