import {
  logger
} from "./chunk-PFAIKYNR.js";

// src/processing/timestamp-overlay.ts
import sharp from "sharp";
function formatTimestamp(elapsedMs) {
  return `+${(elapsedMs / 1e3).toFixed(1)}s`;
}
async function createTimestampOverlay(text, cellWidth, cellHeight) {
  const fontSize = Math.max(12, Math.floor(cellHeight * 0.06));
  const dpi = Math.round(fontSize * 72 / 12);
  const padding = 4;
  try {
    const textResult = await sharp({
      text: {
        text: `<span foreground="white">${text}</span>`,
        font: "sans",
        dpi,
        rgba: true
      }
    }).toBuffer({ resolveWithObject: true });
    const bgWidth = textResult.info.width + padding * 2;
    const bgHeight = textResult.info.height + padding * 2;
    const overlay = await sharp({
      create: {
        width: bgWidth,
        height: bgHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.6 }
      }
    }).composite([
      {
        input: textResult.data,
        raw: {
          width: textResult.info.width,
          height: textResult.info.height,
          channels: textResult.info.channels
        },
        left: padding,
        top: padding
      }
    ]).png().toBuffer();
    return overlay;
  } catch (err) {
    logger.warn(
      `Timestamp text rendering failed, using fallback rectangle: ${err instanceof Error ? err.message : String(err)}`
    );
    const fallbackWidth = Math.max(40, Math.floor(cellWidth * 0.15));
    const fallbackHeight = fontSize + padding * 2;
    return sharp({
      create: {
        width: fallbackWidth,
        height: fallbackHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.6 }
      }
    }).png().toBuffer();
  }
}

export {
  formatTimestamp,
  createTimestampOverlay
};
