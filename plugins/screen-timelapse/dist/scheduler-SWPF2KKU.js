import {
  logger
} from "./chunk-PFAIKYNR.js";

// src/capture/scheduler.ts
function startScheduler(session, target, sessionManager) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let frameIndex = 0;
    let consecutiveFailures = 0;
    session.skippedFrames = [];
    async function captureFrame() {
      const elapsed = Date.now() - startTime;
      const buffer = await target.capture();
      session.frames.push({
        buffer,
        elapsedMs: elapsed,
        index: frameIndex
      });
      frameIndex++;
      logger.debug(
        `Captured frame ${frameIndex}/${session.config.maxFrames} at +${elapsed}ms`
      );
    }
    function shouldStop() {
      if (frameIndex >= session.config.maxFrames) {
        return true;
      }
      if (session.config.durationMs !== void 0 && Date.now() - startTime >= session.config.durationMs) {
        return true;
      }
      return false;
    }
    function scheduleNext() {
      const nextExpectedTime = startTime + frameIndex * session.config.intervalMs;
      const nextDelay = Math.max(0, nextExpectedTime - Date.now());
      setTimeout(tick, nextDelay);
    }
    async function tick() {
      try {
        await captureFrame();
        consecutiveFailures = 0;
        if (shouldStop()) {
          session.state = "complete";
          sessionManager.update(session.id, { state: "complete" });
          logger.info(
            `Session ${session.id} complete: ${session.frames.length} frames captured, ${session.skippedFrames.length} skipped`
          );
          resolve();
          return;
        }
        scheduleNext();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        consecutiveFailures++;
        const elapsed = Date.now() - startTime;
        session.skippedFrames.push({
          index: frameIndex,
          elapsedMs: elapsed,
          reason: message
        });
        frameIndex++;
        logger.warn(
          `Session ${session.id} frame ${frameIndex - 1} skipped: ${message} (${consecutiveFailures} consecutive failures)`
        );
        if (consecutiveFailures >= 3) {
          session.state = "error";
          session.error = `Target unavailable: ${consecutiveFailures} consecutive capture failures. Last error: ${message}`;
          sessionManager.update(session.id, {
            state: "error",
            error: session.error
          });
          logger.error(
            `Session ${session.id} aborted: ${consecutiveFailures} consecutive failures`
          );
          resolve();
          return;
        }
        if (shouldStop()) {
          session.state = "complete";
          sessionManager.update(session.id, { state: "complete" });
          logger.info(
            `Session ${session.id} complete: ${session.frames.length} frames captured, ${session.skippedFrames.length} skipped`
          );
          resolve();
          return;
        }
        scheduleNext();
      }
    }
    tick();
  });
}
export {
  startScheduler
};
