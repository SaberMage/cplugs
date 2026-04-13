import {
  logger
} from "./chunk-PFAIKYNR.js";

// src/repository/repository-scheduler.ts
import { writeFile } from "fs/promises";
import path from "path";
function startRepositoryScheduler(manifest, target, repositoryManager, sessionDir) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let frameIndex = 0;
    let consecutiveFailures = 0;
    async function captureFrame() {
      const buffer = await target.capture();
      const elapsed = Date.now() - startTime;
      const filename = `${String(frameIndex).padStart(6, "0")}.jpg`;
      await writeFile(path.join(sessionDir, filename), buffer);
      await repositoryManager.appendFrame(manifest.sessionId, {
        index: frameIndex,
        elapsed_ms: elapsed,
        filename,
        size_bytes: buffer.length
      });
      frameIndex++;
      logger.debug(
        `Repository frame ${frameIndex}/${manifest.captureConfig.maxFrames} at +${elapsed}ms (${buffer.length} bytes)`
      );
    }
    function shouldStop() {
      if (frameIndex >= manifest.captureConfig.maxFrames) {
        return true;
      }
      if (manifest.captureConfig.durationMs !== void 0 && Date.now() - startTime >= manifest.captureConfig.durationMs) {
        return true;
      }
      return false;
    }
    async function scheduleTick() {
      if (shouldStop()) {
        await repositoryManager.completeSession(manifest.sessionId);
        logger.info(
          `Repository session ${manifest.sessionId} complete: ${frameIndex} frames captured`
        );
        resolve();
        return;
      }
      if (consecutiveFailures >= 5) {
        await repositoryManager.errorSession(
          manifest.sessionId,
          `5 consecutive capture failures`
        );
        logger.error(
          `Repository session ${manifest.sessionId} aborted: 5 consecutive failures`
        );
        resolve();
        return;
      }
      try {
        await captureFrame();
        consecutiveFailures = 0;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        consecutiveFailures++;
        const elapsed = Date.now() - startTime;
        await repositoryManager.recordSkippedFrame(manifest.sessionId, {
          index: frameIndex,
          elapsedMs: elapsed,
          reason: message
        });
        frameIndex++;
        logger.warn(
          `Repository session ${manifest.sessionId} frame ${frameIndex - 1} skipped: ${message} (${consecutiveFailures} consecutive failures)`
        );
      }
      if (shouldStop()) {
        await repositoryManager.completeSession(manifest.sessionId);
        logger.info(
          `Repository session ${manifest.sessionId} complete: ${frameIndex} frames captured`
        );
        resolve();
        return;
      }
      const nextExpectedTime = startTime + frameIndex * manifest.captureConfig.intervalMs;
      const delay = Math.max(0, nextExpectedTime - Date.now());
      setTimeout(() => {
        scheduleTick().catch((err) => {
          logger.error(`Scheduler tick failed: ${err instanceof Error ? err.message : String(err)}`);
          repositoryManager.errorSession(manifest.sessionId, err instanceof Error ? err.message : String(err)).catch(() => {
          });
          resolve();
        });
      }, delay);
    }
    scheduleTick().catch((err) => {
      logger.error(`Scheduler tick failed: ${err instanceof Error ? err.message : String(err)}`);
      repositoryManager.errorSession(manifest.sessionId, err instanceof Error ? err.message : String(err)).catch(() => {
      });
      resolve();
    });
  });
}
export {
  startRepositoryScheduler
};
