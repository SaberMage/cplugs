// src/processing/pixel-compare.ts
import sharp from "sharp";
async function extractRawPixels(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels
  };
}
function compareFrames(a, b, threshold = 25) {
  if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) {
    throw new Error(
      `Frame dimension mismatch: ${a.width}x${a.height}x${a.channels} vs ${b.width}x${b.height}x${b.channels}`
    );
  }
  const totalPixels = a.width * a.height;
  const mask = new Uint8Array(totalPixels);
  let changedCount = 0;
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const dr = a.data[offset] - b.data[offset];
    const dg = a.data[offset + 1] - b.data[offset + 1];
    const db = a.data[offset + 2] - b.data[offset + 2];
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance > threshold) {
      mask[i] = 255;
      changedCount++;
    }
  }
  return {
    mask,
    changedFraction: totalPixels > 0 ? changedCount / totalPixels : 0
  };
}

export {
  extractRawPixels,
  compareFrames
};
