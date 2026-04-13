import {
  compareFrames,
  extractRawPixels
} from "./chunk-DU7A36EE.js";
import {
  logger
} from "./chunk-PFAIKYNR.js";

// src/server.ts
import {
  McpServer,
  ResourceTemplate
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// src/capture/session-manager.ts
import crypto from "crypto";
var SessionManager = class _SessionManager {
  /** Maximum concurrent sessions to prevent memory exhaustion. */
  static MAX_SESSIONS = 10;
  sessions = /* @__PURE__ */ new Map();
  /**
   * Create a new capture session.
   * @throws Error if MAX_SESSIONS limit is reached.
   */
  create(config) {
    if (this.sessions.size >= _SessionManager.MAX_SESSIONS) {
      throw new Error(
        `Max session limit (${_SessionManager.MAX_SESSIONS}) reached. Complete or delete existing sessions first.`
      );
    }
    const session = {
      id: crypto.randomUUID(),
      config,
      state: "capturing",
      frames: [],
      startedAt: Date.now()
    };
    this.sessions.set(session.id, session);
    logger.info(`Session created: ${session.id}`);
    return session;
  }
  /**
   * Get a session by ID.
   */
  get(id) {
    return this.sessions.get(id);
  }
  /**
   * Update a session with partial changes.
   */
  update(id, updates) {
    const session = this.sessions.get(id);
    if (!session) {
      logger.warn(`Attempted to update non-existent session: ${id}`);
      return;
    }
    Object.assign(session, updates);
  }
  /**
   * Delete a session and free its resources.
   */
  delete(id) {
    const deleted = this.sessions.delete(id);
    if (deleted) {
      logger.info(`Session deleted: ${id}`);
    }
  }
  /**
   * List all completed sessions (for resource template listing).
   */
  listCompleted() {
    return Array.from(this.sessions.values()).filter(
      (s) => s.state === "complete"
    );
  }
};

// src/server.ts
import { Window as Window2 } from "node-screenshots";

// src/capture/targets/desktop-target.ts
import { Monitor } from "node-screenshots";
var DesktopTarget = class {
  name = "desktop";
  /** Cached monitor reference to avoid re-enumerating every frame. */
  cachedMonitor = null;
  /**
   * Get the primary monitor, caching the result for subsequent calls.
   */
  getMonitor() {
    if (this.cachedMonitor) {
      return this.cachedMonitor;
    }
    const monitors = Monitor.all();
    if (monitors.length === 0) {
      throw new Error("No monitors found");
    }
    const primary = monitors.find((m) => m.isPrimary());
    this.cachedMonitor = primary ?? monitors[0];
    logger.debug(
      `Using monitor: ${this.cachedMonitor.id()} (${this.cachedMonitor.width()}x${this.cachedMonitor.height()}, scale=${this.cachedMonitor.scaleFactor()})`
    );
    return this.cachedMonitor;
  }
  /**
   * Capture the desktop and return a PNG buffer.
   */
  async capture() {
    const monitor = this.getMonitor();
    const image = monitor.captureImageSync();
    return image.toPngSync();
  }
};

// src/capture/targets/window-utils.ts
import { Window } from "node-screenshots";

// src/capture/targets/dwm-capture.ts
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
var nativeAddon = null;
var loadAttempted = false;
function loadAddon() {
  if (loadAttempted) return nativeAddon;
  loadAttempted = true;
  try {
    const req = createRequire(import.meta.url);
    const nodeGypBuild = req("node-gyp-build");
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(thisDir, "..", "..", "..");
    nativeAddon = nodeGypBuild(projectRoot);
    return nativeAddon;
  } catch {
    return null;
  }
}
function isDwmCaptureAvailable() {
  const addon = loadAddon();
  return addon?.isAvailable() ?? false;
}
async function captureWindowDwm(hwnd) {
  const addon = loadAddon();
  if (!addon?.isAvailable()) return null;
  try {
    return await addon.captureWindow(hwnd);
  } catch {
    return null;
  }
}

// src/capture/targets/window-utils.ts
var dwmAvailable = null;
function findWindow(handle, title) {
  const windows = Window.all();
  if (handle !== void 0) {
    return windows.find((w) => w.id() === handle) ?? null;
  }
  if (title !== void 0) {
    const lower = title.toLowerCase();
    return windows.find((w) => w.title().toLowerCase().includes(lower)) ?? null;
  }
  return null;
}
async function captureWindowBest(win) {
  if (dwmAvailable === null) {
    dwmAvailable = isDwmCaptureAvailable();
    logger.debug(`DWM capture available: ${dwmAvailable}`);
  }
  if (dwmAvailable) {
    const result = await captureWindowDwm(win.id());
    if (result !== null) {
      logger.debug(`Captured window "${win.title()}" via DWM`);
      return result;
    }
    logger.debug(
      `DWM capture failed for "${win.title()}", falling back to node-screenshots`
    );
  }
  const image = win.captureImageSync();
  if (image.width === 0 || image.height === 0) {
    throw new Error(`Window capture returned empty image: "${win.title()}"`);
  }
  logger.debug(
    `Captured window "${win.title()}" via node-screenshots fallback`
  );
  return image.toPngSync();
}

// src/capture/targets/window-target.ts
var WindowTarget = class {
  name;
  handle;
  titleMatch;
  constructor(handle, title) {
    this.handle = handle;
    this.titleMatch = title;
    this.name = `window:${handle ?? title}`;
  }
  async capture() {
    const win = findWindow(this.handle, this.titleMatch);
    if (!win) {
      throw new Error(
        `Window not found: ${this.handle !== void 0 ? `handle=${this.handle}` : `title="${this.titleMatch}"`}`
      );
    }
    if (win.isMinimized()) {
      throw new Error(`Window is minimized: "${win.title()}"`);
    }
    return captureWindowBest(win);
  }
};

// src/capture/targets/region-target.ts
import { Monitor as Monitor2 } from "node-screenshots";
var RegionTarget = class {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.name = `region:${x},${y},${width}x${height}`;
  }
  x;
  y;
  width;
  height;
  name;
  async capture() {
    const monitor = Monitor2.fromPoint(this.x, this.y);
    if (!monitor) {
      throw new Error(`No monitor found at point (${this.x}, ${this.y})`);
    }
    const image = monitor.captureImageSync();
    const relX = this.x - monitor.x();
    const relY = this.y - monitor.y();
    if (relX >= image.width || relY >= image.height) {
      throw new Error(
        `Region (${this.x},${this.y}) is outside monitor bounds (${monitor.x()},${monitor.y()} ${image.width}x${image.height})`
      );
    }
    const clampedWidth = Math.min(this.width, image.width - relX);
    const clampedHeight = Math.min(this.height, image.height - relY);
    const cropped = image.cropSync(relX, relY, clampedWidth, clampedHeight);
    if (cropped.width === 0 || cropped.height === 0) {
      throw new Error(
        `Region crop produced empty image at (${this.x},${this.y},${this.width}x${this.height})`
      );
    }
    logger.debug(
      `Captured region ${this.name} (${cropped.width}x${cropped.height})`
    );
    return cropped.toPngSync();
  }
};

// src/capture/targets/window-region-target.ts
import sharp from "sharp";
var WindowRegionTarget = class {
  constructor(windowHandle, windowTitle, regionX, regionY, regionWidth, regionHeight) {
    this.regionX = regionX;
    this.regionY = regionY;
    this.regionWidth = regionWidth;
    this.regionHeight = regionHeight;
    this.windowHandle = windowHandle;
    this.windowTitle = windowTitle;
    this.name = `window_region:${windowHandle ?? windowTitle}@${regionX},${regionY},${regionWidth}x${regionHeight}`;
  }
  regionX;
  regionY;
  regionWidth;
  regionHeight;
  name;
  windowHandle;
  windowTitle;
  async capture() {
    const win = findWindow(this.windowHandle, this.windowTitle);
    if (!win) {
      throw new Error(
        `Window not found: ${this.windowHandle !== void 0 ? `handle=${this.windowHandle}` : `title="${this.windowTitle}"`}`
      );
    }
    if (win.isMinimized()) {
      throw new Error(`Window is minimized: "${win.title()}"`);
    }
    const fullPng = await captureWindowBest(win);
    const metadata = await sharp(fullPng).metadata();
    const imgW = metadata.width;
    const imgH = metadata.height;
    if (this.regionX >= imgW || this.regionY >= imgH) {
      throw new Error(
        `Region (${this.regionX},${this.regionY}) is outside window bounds (${imgW}x${imgH})`
      );
    }
    const clampedW = Math.min(this.regionWidth, imgW - this.regionX);
    const clampedH = Math.min(this.regionHeight, imgH - this.regionY);
    const cropped = await sharp(fullPng).extract({
      left: this.regionX,
      top: this.regionY,
      width: clampedW,
      height: clampedH
    }).png().toBuffer();
    logger.debug(
      `Captured window region "${win.title()}" sub-region (${clampedW}x${clampedH})`
    );
    return cropped;
  }
};

// src/processing/grid-compiler.ts
import sharp2 from "sharp";
sharp2.concurrency(1);
async function compileGrid(frames, options) {
  if (frames.length === 0) {
    throw new Error("Cannot compile grid with zero frames");
  }
  const maxEdge = options?.maxEdge ?? 1568;
  const jpegQuality = options?.jpegQuality ?? 80;
  let processedFrames = [...frames];
  if (options?.compressIdle) {
    try {
      const { compressIdleFrames } = await import("./idle-compressor-5BIC3FI3.js");
      processedFrames = await compressIdleFrames(processedFrames);
      logger.info(`Idle compression: ${frames.length} -> ${processedFrames.length} frames`);
    } catch {
      logger.debug("Idle compressor unavailable, skipping compression");
    }
  }
  if (options?.deltaHighlight) {
    try {
      const { applyDeltaHighlights } = await import("./delta-highlighter-VTCFNN56.js");
      processedFrames = await applyDeltaHighlights(processedFrames);
      logger.info("Delta highlighting applied");
    } catch {
      logger.debug("Delta highlighter unavailable, skipping highlights");
    }
  }
  const cols = Math.ceil(Math.sqrt(processedFrames.length));
  const rows = Math.ceil(processedFrames.length / cols);
  const firstMeta = await sharp2(processedFrames[0].buffer).metadata();
  const srcWidth = firstMeta.width ?? 1920;
  const srcHeight = firstMeta.height ?? 1080;
  const srcAspect = srcWidth / srcHeight;
  const maxCellWidth = Math.floor(maxEdge / cols);
  const maxCellHeight = Math.floor(maxEdge / rows);
  let cellWidth;
  let cellHeight;
  if (maxCellWidth / maxCellHeight > srcAspect) {
    cellHeight = maxCellHeight;
    cellWidth = Math.floor(cellHeight * srcAspect);
  } else {
    cellWidth = maxCellWidth;
    cellHeight = Math.floor(cellWidth / srcAspect);
  }
  const canvasWidth = cellWidth * cols;
  const canvasHeight = cellHeight * rows;
  const resized = await Promise.all(
    processedFrames.map(
      (f) => sharp2(f.buffer).resize(cellWidth, cellHeight, { fit: "contain", background: { r: 30, g: 30, b: 30, alpha: 1 } }).png().toBuffer()
    )
  );
  const composites = resized.map((buf, i) => ({
    input: buf,
    left: i % cols * cellWidth,
    top: Math.floor(i / cols) * cellHeight
  }));
  if (options?.includeTimestamps !== false) {
    try {
      const { createTimestampOverlay, formatTimestamp } = await import("./timestamp-overlay-EGDRQFHG.js");
      for (let i = 0; i < processedFrames.length; i++) {
        const text = formatTimestamp(processedFrames[i].elapsedMs);
        const overlay = await createTimestampOverlay(
          text,
          cellWidth,
          cellHeight
        );
        const overlayMeta = await sharp2(overlay).metadata();
        const overlayHeight = overlayMeta.height ?? 20;
        composites.push({
          input: overlay,
          left: i % cols * cellWidth + 4,
          top: Math.floor(i / cols) * cellHeight + cellHeight - overlayHeight - 4
        });
      }
    } catch {
      logger.debug("Timestamp overlay unavailable, compiling grid without timestamps");
    }
  }
  const result = await sharp2({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 30, g: 30, b: 30, alpha: 1 }
    }
  }).composite(composites).jpeg({ quality: jpegQuality }).toBuffer();
  logger.info(
    `Grid compiled: ${processedFrames.length} frames -> ${cols}x${rows} grid (${canvasWidth}x${canvasHeight}px) at JPEG quality ${jpegQuality}`
  );
  return result;
}

// src/profiles/profile-manager.ts
import { readFile, writeFile, mkdir } from "fs/promises";
import path2 from "path";

// src/profiles/profile-types.ts
function slugify(name) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (slug === "") {
    throw new Error("Slug is empty after slugification");
  }
  return slug;
}

// src/profiles/timing-presets.ts
var BUILTIN_TIMING_PRESETS = {
  "quick-glance": {
    slug: "quick-glance",
    displayName: "Quick Glance",
    intervalMs: 500,
    maxFrames: 6,
    description: "Fast 3-second snapshot burst for checking if something is happening",
    builtin: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "steady-watch": {
    slug: "steady-watch",
    displayName: "Steady Watch",
    intervalMs: 2e3,
    maxFrames: 20,
    durationMs: 4e4,
    description: "40-second watch at 2s intervals for observing gradual changes",
    builtin: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "debug-flicker": {
    slug: "debug-flicker",
    displayName: "Debug Flicker",
    intervalMs: 200,
    maxFrames: 30,
    deltaHighlight: true,
    description: "Rapid capture with delta highlighting for diagnosing visual flicker",
    builtin: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "slow-monitor": {
    slug: "slow-monitor",
    displayName: "Slow Monitor",
    intervalMs: 5e3,
    maxFrames: 50,
    durationMs: 3e5,
    compressIdle: true,
    description: "5-minute idle-compressed monitor for long-running processes",
    builtin: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
};
function generateParameterSummary(profile) {
  const parts = [];
  if (profile.intervalMs !== void 0) {
    parts.push(
      profile.intervalMs >= 1e3 ? `every ${profile.intervalMs / 1e3}s` : `every ${profile.intervalMs}ms`
    );
  }
  if (profile.maxFrames !== void 0) {
    parts.push(`max ${profile.maxFrames} frames`);
  }
  if (profile.durationMs !== void 0) {
    const seconds = profile.durationMs / 1e3;
    parts.push(seconds >= 60 ? `for ${seconds / 60}min` : `for ${seconds}s`);
  }
  if (profile.jpegQuality !== void 0) {
    parts.push(`quality ${profile.jpegQuality}%`);
  }
  const flags = [];
  if (profile.deltaHighlight) flags.push("delta");
  if (profile.compressIdle) flags.push("idle-compressed");
  if (profile.gifExport) flags.push("gif");
  if (flags.length > 0) parts.push(flags.join(", "));
  return parts.join(", ") || "no timing params set";
}

// src/profiles/profile-manager.ts
var ProfileManager = class {
  profiles = null;
  timingProfiles = null;
  filePath;
  /** Serializes concurrent persist() calls to prevent write races (WR-03). */
  persistQueue = Promise.resolve();
  constructor(filePath) {
    this.filePath = path2.resolve(
      filePath ?? process.env.SCREEN_TIMELAPSE_PROFILES_PATH ?? ".screen-timelapse/profiles.json"
    );
  }
  /**
   * Lazy-load profiles from disk on first access.
   */
  async ensureLoaded() {
    if (this.profiles !== null) return this.profiles;
    await this.load();
    return this.profiles;
  }
  /**
   * Load profiles from the JSON file.
   * On ENOENT or parse error, starts with empty data.
   */
  async load() {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const data = JSON.parse(raw);
      this.profiles = new Map(Object.entries(data.screenshot ?? {}));
      const timingEntries = data.timing ?? {};
      this.timingProfiles = new Map(
        Object.entries(timingEntries)
      );
      logger.debug(
        `Loaded ${this.profiles.size} profiles from ${this.filePath}`
      );
    } catch (err) {
      if (err instanceof Error && err.code === "ENOENT") {
        logger.debug(`No profiles file found at ${this.filePath}, starting empty`);
      } else {
        logger.debug(
          `Failed to parse profiles file: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      this.profiles = /* @__PURE__ */ new Map();
      this.timingProfiles = /* @__PURE__ */ new Map();
    }
  }
  /**
   * Persist current state to JSON file.
   * Creates the directory if it does not exist.
   * Serialized via persistQueue to prevent concurrent write races (WR-03).
   */
  async persist() {
    this.persistQueue = this.persistQueue.then(async () => {
      const dir = path2.dirname(this.filePath);
      await mkdir(dir, { recursive: true });
      const data = {
        screenshot: Object.fromEntries(this.profiles),
        timing: Object.fromEntries(this.timingProfiles ?? /* @__PURE__ */ new Map())
      };
      await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    });
    return this.persistQueue;
  }
  /**
   * Lazy-load timing profiles from disk on first access.
   */
  async ensureTimingLoaded() {
    if (this.timingProfiles !== null) return this.timingProfiles;
    await this.load();
    return this.timingProfiles;
  }
  /**
   * Save (create or update) a profile.
   * If a profile with the same slug already exists, it is overwritten
   * but createdAt is preserved.
   */
  async save(input) {
    const profiles = await this.ensureLoaded();
    const slug = slugify(input.name);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = profiles.get(slug);
    const profile = {
      slug,
      displayName: input.name,
      target: input.target,
      windowTitle: input.windowTitle,
      windowHandle: input.windowHandle,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      regionX: input.regionX,
      regionY: input.regionY,
      regionWidth: input.regionWidth,
      regionHeight: input.regionHeight,
      description: input.description,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    profiles.set(slug, profile);
    await this.persist();
    logger.info(`Profile saved: "${input.name}" -> ${slug}`);
    return profile;
  }
  /**
   * Get a profile by slug.
   */
  async get(slug) {
    const profiles = await this.ensureLoaded();
    return profiles.get(slug);
  }
  /**
   * Delete a profile by slug.
   * @returns true if deleted, false if not found.
   */
  async delete(slug) {
    const profiles = await this.ensureLoaded();
    if (!profiles.has(slug)) return false;
    profiles.delete(slug);
    await this.persist();
    logger.info(`Profile deleted: ${slug}`);
    return true;
  }
  /**
   * List all saved profiles.
   */
  async list() {
    const profiles = await this.ensureLoaded();
    return Array.from(profiles.values());
  }
  /**
   * Create a profile from an existing capture session's config.
   * Extracts target parameters from the session and saves as a named profile.
   * @throws Error if session is not found.
   */
  async saveFromSession(name, sessionId, sessionManager2) {
    const session = sessionManager2.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const config = session.config;
    return this.save({
      name,
      target: config.target,
      windowTitle: config.windowTitle,
      windowHandle: config.windowHandle,
      x: config.target === "region" ? config.regionX : void 0,
      y: config.target === "region" ? config.regionY : void 0,
      width: config.target === "region" ? config.regionWidth : void 0,
      height: config.target === "region" ? config.regionHeight : void 0,
      regionX: config.target === "window_region" ? config.regionX : void 0,
      regionY: config.target === "window_region" ? config.regionY : void 0,
      regionWidth: config.target === "window_region" ? config.regionWidth : void 0,
      regionHeight: config.target === "window_region" ? config.regionHeight : void 0
    });
  }
  // ── Timing Profile CRUD ──────────────────────────────────────────
  /**
   * Save (create or update) a timing profile.
   * Preserves createdAt on overwrite (D-02).
   */
  async saveTiming(input) {
    const timingProfiles = await this.ensureTimingLoaded();
    const slug = slugify(input.name);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = timingProfiles.get(slug);
    const profile = {
      slug,
      displayName: input.name,
      intervalMs: input.intervalMs,
      maxFrames: input.maxFrames,
      durationMs: input.durationMs,
      jpegQuality: input.jpegQuality,
      deltaHighlight: input.deltaHighlight,
      compressIdle: input.compressIdle,
      gifExport: input.gifExport,
      description: input.description,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    timingProfiles.set(slug, profile);
    await this.persist();
    logger.info(`Timing profile saved: "${input.name}" -> ${slug}`);
    return profile;
  }
  /**
   * Get a timing profile by slug.
   * User profiles take priority over builtins (D-14 shadow semantics).
   */
  async getTiming(slug) {
    const timingProfiles = await this.ensureTimingLoaded();
    const userProfile = timingProfiles.get(slug);
    if (userProfile) return userProfile;
    return BUILTIN_TIMING_PRESETS[slug];
  }
  /**
   * Delete a timing profile by slug.
   * Built-in presets cannot be deleted (returns isBuiltin: true).
   */
  async deleteTiming(slug) {
    const timingProfiles = await this.ensureTimingLoaded();
    if (timingProfiles.has(slug)) {
      timingProfiles.delete(slug);
      await this.persist();
      logger.info(`Timing profile deleted: ${slug}`);
      return { deleted: true, isBuiltin: false };
    }
    if (slug in BUILTIN_TIMING_PRESETS) {
      return { deleted: false, isBuiltin: true };
    }
    return { deleted: false, isBuiltin: false };
  }
  /**
   * List all timing profiles (builtins merged with user profiles).
   * User profiles shadow builtins with the same slug (D-14).
   * Sorted: builtins first (alphabetical), then user profiles (alphabetical).
   */
  async listTiming() {
    const timingProfiles = await this.ensureTimingLoaded();
    const userSlugs = new Set(timingProfiles.keys());
    const builtins = [];
    for (const [slug, preset] of Object.entries(BUILTIN_TIMING_PRESETS)) {
      if (!userSlugs.has(slug)) {
        builtins.push(preset);
      }
    }
    builtins.sort((a, b) => a.slug.localeCompare(b.slug));
    const userProfiles = Array.from(timingProfiles.values());
    userProfiles.sort((a, b) => a.slug.localeCompare(b.slug));
    return [...builtins, ...userProfiles];
  }
  /**
   * Create a timing profile from an existing capture session's config (D-16).
   * Extracts timing/diagnostic parameters from the session.
   * @throws Error if session is not found.
   */
  async saveTimingFromSession(name, sessionId, sessionManager2) {
    const session = sessionManager2.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const config = session.config;
    return this.saveTiming({
      name,
      intervalMs: config.intervalMs,
      maxFrames: config.maxFrames,
      durationMs: config.durationMs,
      jpegQuality: config.jpegQuality,
      deltaHighlight: config.deltaHighlight,
      compressIdle: config.compressIdle,
      gifExport: config.gifExport
    });
  }
};
var singletonManager = null;
function getProfileManager() {
  if (!singletonManager) {
    singletonManager = new ProfileManager();
  }
  return singletonManager;
}

// src/profiles/profile-resolver.ts
function resolveScreenshotProfile(profile, inlineParams) {
  return {
    target: inlineParams.target ?? profile.target,
    window_title: inlineParams.window_title ?? profile.windowTitle,
    window_handle: inlineParams.window_handle ?? profile.windowHandle,
    x: inlineParams.x ?? profile.x,
    y: inlineParams.y ?? profile.y,
    width: inlineParams.width ?? profile.width,
    height: inlineParams.height ?? profile.height,
    region_x: inlineParams.region_x ?? profile.regionX,
    region_y: inlineParams.region_y ?? profile.regionY,
    region_width: inlineParams.region_width ?? profile.regionWidth,
    region_height: inlineParams.region_height ?? profile.regionHeight
  };
}
function resolveTimingProfile(profile, inlineParams) {
  const raw = {
    interval_ms: inlineParams.interval_ms ?? profile.intervalMs,
    max_frames: inlineParams.max_frames ?? profile.maxFrames,
    duration_ms: inlineParams.duration_ms ?? profile.durationMs,
    jpeg_quality: inlineParams.jpeg_quality ?? profile.jpegQuality,
    delta_highlight: inlineParams.delta_highlight ?? profile.deltaHighlight,
    compress_idle: inlineParams.compress_idle ?? profile.compressIdle,
    gif_export: inlineParams.gif_export ?? profile.gifExport
  };
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== void 0)
  );
}

// src/repository/repository-manager.ts
import crypto2 from "crypto";
import { readdir, readFile as readFile2, writeFile as writeFile2, mkdir as mkdir2, rm } from "fs/promises";
import path3 from "path";
var RETENTION_MS = 24 * 60 * 60 * 1e3;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateSessionId(sessionId) {
  if (!UUID_RE.test(sessionId)) {
    throw new Error(
      `Invalid session ID format: expected UUID, got "${sessionId}"`
    );
  }
}
function validateSessionName(name) {
  if (/[/\\:*?"<>|]/.test(name)) {
    throw new Error(
      `Invalid session name: contains forbidden characters (${name})`
    );
  }
  if (name === "." || name === ".." || name.includes("..")) {
    throw new Error(`Invalid session name: path traversal detected (${name})`);
  }
}
var RepositoryManager = class {
  sessions = null;
  nameIndex = /* @__PURE__ */ new Map();
  basePath;
  /** Serialized writes to prevent concurrent manifest corruption (T-11-04). */
  persistQueue = Promise.resolve();
  constructor(basePath) {
    this.basePath = path3.resolve(
      basePath ?? process.env.SCREEN_TIMELAPSE_FRAMES_PATH ?? ".screen-timelapse/frames/"
    );
  }
  /**
   * Lazy-load all sessions from disk on first access.
   * Creates basePath if it does not exist.
   * Runs retention cleanup to purge expired sessions (D-07).
   */
  async ensureLoaded() {
    if (this.sessions !== null) return;
    await mkdir2(this.basePath, { recursive: true });
    this.sessions = /* @__PURE__ */ new Map();
    this.nameIndex = /* @__PURE__ */ new Map();
    try {
      const entries = await readdir(this.basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!UUID_RE.test(entry.name)) continue;
        const manifestPath = path3.join(
          this.basePath,
          entry.name,
          "manifest.json"
        );
        try {
          const raw = await readFile2(manifestPath, "utf-8");
          const manifest = JSON.parse(raw);
          this.sessions.set(manifest.sessionId, manifest);
          if (manifest.sessionName) {
            this.nameIndex.set(manifest.sessionName, manifest.sessionId);
          }
        } catch {
          logger.warn(
            `Skipping session directory ${entry.name}: no valid manifest.json`
          );
        }
      }
    } catch (err) {
      logger.warn(
        `Failed to scan sessions directory: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    await this.runRetentionCleanup();
    logger.debug(
      `Loaded ${this.sessions.size} repository sessions from ${this.basePath}`
    );
  }
  /**
   * Create a new capture session with disk persistence.
   * @throws Error if sessionName is a duplicate (Pitfall 4).
   */
  async createSession(config, sessionName) {
    await this.ensureLoaded();
    if (sessionName !== void 0) {
      validateSessionName(sessionName);
      if (this.nameIndex.has(sessionName)) {
        throw new Error(
          `Session name already in use: "${sessionName}"`
        );
      }
    }
    const sessionId = crypto2.randomUUID();
    const sessionDir = path3.join(this.basePath, sessionId);
    await mkdir2(sessionDir, { recursive: true });
    const manifest = {
      sessionId,
      sessionName,
      captureConfig: config,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      state: "capturing",
      frameCount: 0,
      frames: [],
      skippedFrames: []
    };
    this.sessions.set(sessionId, manifest);
    if (sessionName) {
      this.nameIndex.set(sessionName, sessionId);
    }
    await this.persistManifest(sessionId);
    logger.info(
      `Repository session created: ${sessionId}${sessionName ? ` (${sessionName})` : ""}`
    );
    return manifest;
  }
  /**
   * Append a frame entry to a session manifest and persist.
   * Serialized via persistQueue to prevent concurrent corruption (Pitfall 1, T-11-04).
   */
  async appendFrame(sessionId, entry) {
    await this.ensureLoaded();
    validateSessionId(sessionId);
    const manifest = this.sessions.get(sessionId);
    if (!manifest) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    manifest.frames.push(entry);
    manifest.frameCount = manifest.frames.length;
    await this.persistManifest(sessionId);
  }
  /**
   * Mark a session as complete and persist.
   */
  async completeSession(sessionId) {
    await this.ensureLoaded();
    validateSessionId(sessionId);
    const manifest = this.sessions.get(sessionId);
    if (!manifest) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    manifest.state = "complete";
    await this.persistManifest(sessionId);
    logger.info(`Repository session completed: ${sessionId}`);
  }
  /**
   * Mark a session as errored and persist.
   */
  async errorSession(sessionId, error) {
    await this.ensureLoaded();
    validateSessionId(sessionId);
    const manifest = this.sessions.get(sessionId);
    if (!manifest) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    manifest.state = "error";
    manifest.error = error;
    await this.persistManifest(sessionId);
    logger.warn(`Repository session errored: ${sessionId} - ${error}`);
  }
  /**
   * Get a session by ID.
   */
  async getSession(sessionId) {
    await this.ensureLoaded();
    validateSessionId(sessionId);
    return this.sessions.get(sessionId);
  }
  /**
   * Resolve a session by ID or name (D-23).
   * Tries ID lookup first, then falls back to name lookup.
   */
  async resolveSession(idOrName) {
    await this.ensureLoaded();
    const byId = this.sessions.get(idOrName);
    if (byId) return byId;
    const id = this.nameIndex.get(idOrName);
    if (id) return this.sessions.get(id);
    return void 0;
  }
  /**
   * List all sessions sorted by startedAt descending (newest first).
   */
  async listSessions() {
    await this.ensureLoaded();
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }
  /**
   * Delete a session and remove its directory from disk (D-08, D-24).
   * @returns freed bytes calculated from frame entries.
   */
  async deleteSession(sessionId) {
    await this.ensureLoaded();
    validateSessionId(sessionId);
    const manifest = this.sessions.get(sessionId);
    if (!manifest) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const freedBytes = manifest.frames.reduce(
      (sum, f) => sum + f.size_bytes,
      0
    );
    const sessionDir = path3.join(this.basePath, sessionId);
    await rm(sessionDir, { recursive: true, force: true });
    this.sessions.delete(sessionId);
    if (manifest.sessionName) {
      this.nameIndex.delete(manifest.sessionName);
    }
    logger.info(
      `Repository session deleted: ${sessionId} (freed ${freedBytes} bytes)`
    );
    return { freedBytes };
  }
  /**
   * Record a skipped frame in the manifest and persist (WR-04).
   * Ensures skipped frame data survives process crashes.
   */
  async recordSkippedFrame(sessionId, skippedFrame) {
    await this.ensureLoaded();
    validateSessionId(sessionId);
    const manifest = this.sessions.get(sessionId);
    if (!manifest) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    manifest.skippedFrames.push(skippedFrame);
    await this.persistManifest(sessionId);
  }
  /**
   * Get total disk usage for a session from manifest frame entries.
   */
  async getSessionDiskUsage(sessionId) {
    await this.ensureLoaded();
    const manifest = this.sessions.get(sessionId);
    if (!manifest) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return manifest.frames.reduce((sum, f) => sum + f.size_bytes, 0);
  }
  /**
   * Get the retention deadline for a session (startedAt + 24h) (D-18).
   */
  getRetentionDeadline(manifest) {
    const deadline = new Date(
      new Date(manifest.startedAt).getTime() + RETENTION_MS
    );
    return deadline.toISOString();
  }
  /**
   * Get the base path for session directories.
   * Useful for constructing frame file paths.
   */
  getBasePath() {
    return this.basePath;
  }
  /**
   * Persist a session's manifest to disk.
   * Serialized via persistQueue to prevent concurrent write races (T-11-04).
   */
  async persistManifest(sessionId) {
    this.persistQueue = this.persistQueue.then(async () => {
      const manifest = this.sessions?.get(sessionId);
      if (!manifest) return;
      const manifestPath = path3.join(
        this.basePath,
        sessionId,
        "manifest.json"
      );
      await writeFile2(
        manifestPath,
        JSON.stringify(manifest, null, 2),
        "utf-8"
      );
    }).catch((err) => {
      logger.error(`Failed to persist manifest for ${sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    });
    return this.persistQueue;
  }
  /**
   * Remove sessions older than 24 hours (D-07, D-09).
   */
  async runRetentionCleanup() {
    if (!this.sessions) return;
    const now = Date.now();
    const expired = [];
    for (const [id, manifest] of this.sessions) {
      const age = now - new Date(manifest.startedAt).getTime();
      if (age > RETENTION_MS) {
        expired.push(id);
      }
    }
    for (const id of expired) {
      const manifest = this.sessions.get(id);
      const sessionDir = path3.join(this.basePath, id);
      try {
        await rm(sessionDir, { recursive: true, force: true });
      } catch {
        logger.warn(`Failed to remove expired session directory: ${id}`);
      }
      this.sessions.delete(id);
      if (manifest?.sessionName) {
        this.nameIndex.delete(manifest.sessionName);
      }
      logger.info(`Purged expired repository session: ${id}`);
    }
  }
};
var instance = null;
function getRepositoryManager() {
  if (!instance) {
    instance = new RepositoryManager();
  }
  return instance;
}

// src/repository/frame-query.ts
function detectQueryMode(params) {
  const hasFromMs = params.from_ms !== void 0;
  const hasToMs = params.to_ms !== void 0;
  const hasLengthMs = params.length_ms !== void 0;
  const hasFromIndex = params.from_index !== void 0;
  const hasToIndex = params.to_index !== void 0;
  const hasFrameCount = params.frame_count !== void 0;
  const hasTimeParams = hasFromMs || hasToMs || hasLengthMs;
  const hasIndexParams = hasFromIndex || hasToIndex || hasFrameCount;
  if (hasToMs && hasLengthMs) {
    return { error: "Cannot specify both to_ms and length_ms" };
  }
  if (hasToIndex && hasFrameCount) {
    return { error: "Cannot specify both to_index and frame_count" };
  }
  if (hasTimeParams && hasIndexParams) {
    return { error: "Cannot mix time-based and index-based query params" };
  }
  if (hasFromMs && hasToMs) {
    return { mode: "time_range", from_ms: params.from_ms, to_ms: params.to_ms };
  }
  if (hasFromMs && hasLengthMs) {
    return { mode: "time_length", from_ms: params.from_ms, length_ms: params.length_ms };
  }
  if (hasFromIndex && hasToIndex) {
    return { mode: "index_range", from_index: params.from_index, to_index: params.to_index };
  }
  if (hasFromIndex && hasFrameCount) {
    return { mode: "index_count", from_index: params.from_index, frame_count: params.frame_count };
  }
  if (hasToMs && !hasFromMs) {
    return { error: "to_ms requires from_ms" };
  }
  if (hasLengthMs && !hasFromMs) {
    return { error: "length_ms requires from_ms" };
  }
  if (hasToIndex && !hasFromIndex) {
    return { error: "to_index requires from_index" };
  }
  if (hasFrameCount && !hasFromIndex) {
    return { error: "frame_count requires from_index" };
  }
  return { mode: "all" };
}
function sampleFrames(frames, maxFrames) {
  if (frames.length <= maxFrames) {
    return frames;
  }
  if (maxFrames === 1) {
    return [frames[0]];
  }
  const step = (frames.length - 1) / (maxFrames - 1);
  const result = [];
  for (let i = 0; i < maxFrames; i++) {
    result.push(frames[Math.round(i * step)]);
  }
  return result;
}
function applyQuery(frames, params) {
  const mode = detectQueryMode(params);
  if ("error" in mode) {
    return mode;
  }
  let filtered;
  switch (mode.mode) {
    case "time_range":
      filtered = frames.filter(
        (f) => f.elapsed_ms >= mode.from_ms && f.elapsed_ms <= mode.to_ms
      );
      break;
    case "time_length":
      filtered = frames.filter(
        (f) => f.elapsed_ms >= mode.from_ms && f.elapsed_ms <= mode.from_ms + mode.length_ms
      );
      break;
    case "index_range":
      filtered = frames.filter(
        (f) => f.index >= mode.from_index && f.index <= mode.to_index
      );
      break;
    case "index_count":
      filtered = frames.filter(
        (f) => f.index >= mode.from_index && f.index < mode.from_index + mode.frame_count
      );
      break;
    case "all":
      filtered = frames;
      break;
  }
  if (params.max_frames !== void 0 && filtered.length > params.max_frames) {
    filtered = sampleFrames(filtered, params.max_frames);
  }
  return filtered;
}

// src/server.ts
import { readFile as readFile3 } from "fs/promises";
import path4 from "path";
import sharp3 from "sharp";
var sessionManager = new SessionManager();
var desktopTarget = new DesktopTarget();
function createServer() {
  const server = new McpServer({
    name: "screen-timelapse",
    version: "0.1.0"
  });
  server.registerTool(
    "start_capture",
    {
      title: "Start Screen Capture",
      description: "Begin a timed capture session targeting the desktop, a specific window, or a screen region. Returns a session ID immediately. Use get_capture_status to check progress and retrieve results.",
      inputSchema: {
        interval_ms: z.number().min(100).optional().describe("Milliseconds between captures (required unless timing_profile provides it)"),
        max_frames: z.number().min(1).max(50).optional().describe("Maximum frames to capture (default: 20)"),
        duration_ms: z.number().min(100).optional().describe(
          "Total capture duration in ms; if both max_frames and duration_ms set, whichever limit hits first stops capture"
        ),
        jpeg_quality: z.number().min(1).max(100).optional().describe("JPEG output quality 1-100 (default: 80)"),
        target: z.enum(["desktop", "window", "region", "window_region"]).optional().describe("Capture target type (defaults to 'desktop' when no screenshot_profile is used)"),
        window_handle: z.number().optional().describe(
          "Window handle from list_windows. Required for target='window' or 'window_region' unless window_title provided"
        ),
        window_title: z.string().optional().describe(
          "Window title substring, case-insensitive. Required for target='window' or 'window_region' unless window_handle provided"
        ),
        x: z.number().min(0).optional().describe(
          "Region left X in screen pixels. Required for target='region'"
        ),
        y: z.number().min(0).optional().describe(
          "Region top Y in screen pixels. Required for target='region'"
        ),
        width: z.number().min(1).optional().describe("Region width in pixels. Required for target='region'"),
        height: z.number().min(1).optional().describe("Region height in pixels. Required for target='region'"),
        region_x: z.number().min(0).optional().describe(
          "Sub-region left X relative to window. Required for target='window_region'"
        ),
        region_y: z.number().min(0).optional().describe(
          "Sub-region top Y relative to window. Required for target='window_region'"
        ),
        region_width: z.number().min(1).optional().describe(
          "Sub-region width in pixels. Required for target='window_region'"
        ),
        region_height: z.number().min(1).optional().describe(
          "Sub-region height in pixels. Required for target='window_region'"
        ),
        delta_highlight: z.boolean().optional().describe("Enable delta highlighting to show changed regions between frames (default: false)"),
        compress_idle: z.boolean().optional().describe("Collapse consecutive identical frames into one with duration label (default: false)"),
        gif_export: z.boolean().optional().describe("Also export capture as animated GIF (default: false)"),
        screenshot_profile: z.string().optional().describe("Named screenshot profile to use as base target config. Inline target params override profile values."),
        timing_profile: z.string().optional().describe("Named timing profile to use as base timing/diagnostic config. Inline params override profile values.")
      }
    },
    async (args) => {
      logger.info(
        `start_capture called: interval=${args.interval_ms ?? "profile"}ms, max_frames=${args.max_frames ?? "default"}, target=${args.target ?? "profile"}`
      );
      let resolvedArgs = { ...args, target: args.target ?? "desktop" };
      if (args.timing_profile) {
        const profileManager = getProfileManager();
        const tSlug = slugify(args.timing_profile);
        const timingProfile = await profileManager.getTiming(tSlug);
        if (!timingProfile) {
          const userProfiles = await profileManager.listTiming();
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "error",
                error: `Timing profile not found: "${args.timing_profile}"`,
                available_timing_profiles: userProfiles.map((p) => p.slug)
              })
            }],
            isError: true
          };
        }
        const resolvedTiming = resolveTimingProfile(timingProfile, {
          interval_ms: args.interval_ms,
          max_frames: args.max_frames,
          duration_ms: args.duration_ms,
          jpeg_quality: args.jpeg_quality,
          delta_highlight: args.delta_highlight,
          compress_idle: args.compress_idle,
          gif_export: args.gif_export
        });
        resolvedArgs = { ...resolvedArgs, ...resolvedTiming };
        logger.info(`Resolved timing profile "${tSlug}": ${JSON.stringify(resolvedTiming)}`);
      }
      if (args.screenshot_profile) {
        const profileManager = getProfileManager();
        const slug = slugify(args.screenshot_profile);
        const profile = await profileManager.get(slug);
        if (!profile) {
          const allProfiles = await profileManager.list();
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "error",
                error: `Screenshot profile not found: "${args.screenshot_profile}"`,
                available_profiles: allProfiles.map((p) => p.slug)
              })
            }],
            isError: true
          };
        }
        const resolved = resolveScreenshotProfile(profile, {
          target: args.target,
          window_title: args.window_title,
          window_handle: args.window_handle,
          x: args.x,
          y: args.y,
          width: args.width,
          height: args.height,
          region_x: args.region_x,
          region_y: args.region_y,
          region_width: args.region_width,
          region_height: args.region_height
        });
        resolvedArgs = { ...resolvedArgs, ...resolved };
        logger.info(`Resolved screenshot profile "${slug}": target=${resolved.target}`);
      }
      if (resolvedArgs.target === "window") {
        if (resolvedArgs.window_handle === void 0 && resolvedArgs.window_title === void 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: "target='window' requires window_handle or window_title"
                })
              }
            ],
            isError: true
          };
        }
      }
      if (resolvedArgs.target === "region") {
        if (resolvedArgs.x === void 0 || resolvedArgs.y === void 0 || resolvedArgs.width === void 0 || resolvedArgs.height === void 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: "target='region' requires x, y, width, and height"
                })
              }
            ],
            isError: true
          };
        }
      }
      if (resolvedArgs.target === "window_region") {
        if (resolvedArgs.window_handle === void 0 && resolvedArgs.window_title === void 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: "target='window_region' requires window_handle or window_title"
                })
              }
            ],
            isError: true
          };
        }
        if (resolvedArgs.region_x === void 0 || resolvedArgs.region_y === void 0 || resolvedArgs.region_width === void 0 || resolvedArgs.region_height === void 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: "target='window_region' requires region_x, region_y, region_width, and region_height"
                })
              }
            ],
            isError: true
          };
        }
      }
      if (resolvedArgs.target === "window" || resolvedArgs.target === "window_region") {
        const win = findWindow(resolvedArgs.window_handle, resolvedArgs.window_title);
        if (!win) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: `Window not found: ${resolvedArgs.window_handle !== void 0 ? `handle=${resolvedArgs.window_handle}` : `title="${resolvedArgs.window_title}"`}`
                })
              }
            ],
            isError: true
          };
        }
      }
      let captureTarget;
      switch (resolvedArgs.target) {
        case "window":
          captureTarget = new WindowTarget(resolvedArgs.window_handle, resolvedArgs.window_title);
          break;
        case "region":
          captureTarget = new RegionTarget(
            resolvedArgs.x,
            resolvedArgs.y,
            resolvedArgs.width,
            resolvedArgs.height
          );
          break;
        case "window_region":
          captureTarget = new WindowRegionTarget(
            resolvedArgs.window_handle,
            resolvedArgs.window_title,
            resolvedArgs.region_x,
            resolvedArgs.region_y,
            resolvedArgs.region_width,
            resolvedArgs.region_height
          );
          break;
        case "desktop":
        default:
          captureTarget = desktopTarget;
          break;
      }
      const finalIntervalMs = resolvedArgs.interval_ms;
      if (finalIntervalMs === void 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              error: "interval_ms is required (provide it directly or via a timing_profile)"
            })
          }],
          isError: true
        };
      }
      const finalMaxFrames = resolvedArgs.max_frames ?? 20;
      const finalJpegQuality = resolvedArgs.jpeg_quality ?? 80;
      const finalDeltaHighlight = resolvedArgs.delta_highlight ?? false;
      const finalCompressIdle = resolvedArgs.compress_idle ?? false;
      const finalGifExport = resolvedArgs.gif_export ?? false;
      const config = {
        intervalMs: finalIntervalMs,
        maxFrames: finalMaxFrames,
        durationMs: resolvedArgs.duration_ms,
        jpegQuality: finalJpegQuality,
        target: resolvedArgs.target,
        windowHandle: resolvedArgs.window_handle,
        windowTitle: resolvedArgs.window_title,
        regionX: resolvedArgs.target === "region" ? resolvedArgs.x : resolvedArgs.region_x,
        regionY: resolvedArgs.target === "region" ? resolvedArgs.y : resolvedArgs.region_y,
        regionWidth: resolvedArgs.target === "region" ? resolvedArgs.width : resolvedArgs.region_width,
        regionHeight: resolvedArgs.target === "region" ? resolvedArgs.height : resolvedArgs.region_height,
        deltaHighlight: finalDeltaHighlight,
        compressIdle: finalCompressIdle,
        gifExport: finalGifExport
      };
      const session = sessionManager.create(config);
      import("./scheduler-SWPF2KKU.js").then(
        ({ startScheduler }) => startScheduler(session, captureTarget, sessionManager)
      ).catch((err) => {
        logger.error(
          `Scheduler failed to start: ${err instanceof Error ? err.message : String(err)}`
        );
        sessionManager.update(session.id, {
          state: "error",
          error: `Scheduler start failed: ${err instanceof Error ? err.message : String(err)}`
        });
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "started",
              sessionId: session.id,
              target: resolvedArgs.target,
              config: {
                intervalMs: config.intervalMs,
                maxFrames: config.maxFrames,
                durationMs: config.durationMs,
                jpegQuality: config.jpegQuality
              }
            })
          }
        ]
      };
    }
  );
  server.registerTool(
    "get_capture_status",
    {
      title: "Get Capture Status",
      description: "Check the status of a capture session. Returns progress while capturing, or completed grid image when done.",
      inputSchema: {
        session_id: z.string().uuid().describe("Session ID returned by start_capture")
      }
    },
    async (args) => {
      logger.info(`get_capture_status called: session=${args.session_id}`);
      const session = sessionManager.get(args.session_id);
      if (!session) {
        const repoManager = getRepositoryManager();
        const repoSession = await repoManager.getSession(args.session_id);
        if (repoSession) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: repoSession.state,
                sessionId: repoSession.sessionId,
                sessionName: repoSession.sessionName,
                framesCaptured: repoSession.frameCount,
                maxFrames: repoSession.captureConfig.maxFrames,
                startedAt: repoSession.startedAt,
                repository: true,
                ...repoSession.error ? { error: repoSession.error } : {}
              })
            }]
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "error",
                error: "Session not found",
                sessionId: args.session_id
              })
            }
          ]
        };
      }
      if (session.state === "capturing") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "capturing",
                sessionId: session.id,
                framesCaptured: session.frames.length,
                maxFrames: session.config.maxFrames,
                progress: `${session.frames.length}/${session.config.maxFrames}`
              })
            }
          ]
        };
      }
      if (session.state === "complete") {
        if (session.frames.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "complete",
                  sessionId: session.id,
                  frameCount: 0,
                  timestamps: [],
                  capturedDurationMs: 0,
                  skippedFrames: session.skippedFrames?.length ?? 0
                })
              }
            ]
          };
        }
        const cols = Math.ceil(Math.sqrt(session.frames.length));
        const rows = Math.ceil(session.frames.length / cols);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "complete",
                sessionId: session.id,
                frameCount: session.frames.length,
                timestamps: session.frames.map((f) => f.elapsedMs),
                capturedDurationMs: session.frames[session.frames.length - 1]?.elapsedMs ?? 0,
                gridDimensions: { cols, rows },
                skippedFrames: session.skippedFrames?.length ?? 0,
                ...session.config.gifExport ? { gifUri: `capture://${session.id}/gif` } : {}
              })
            },
            {
              type: "resource_link",
              uri: `capture://${session.id}/grid`,
              name: "Grid Image",
              mimeType: "image/jpeg"
            },
            ...session.config.gifExport ? [{
              type: "resource_link",
              uri: `capture://${session.id}/gif`,
              name: "GIF Animation",
              mimeType: "image/gif"
            }] : []
          ]
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "error",
              sessionId: session.id,
              error: session.error ?? "Unknown error"
            })
          }
        ]
      };
    }
  );
  server.registerTool(
    "list_windows",
    {
      title: "List Windows",
      description: "List all visible application windows with their handles, titles, process names, and positions. Use the handle or title with start_capture to target a specific window.",
      inputSchema: {}
    },
    async () => {
      logger.info("list_windows called");
      const windows = Window2.all().filter(
        (w) => w.title() !== "" && w.width() > 0 && w.height() > 0 && !w.isMinimized()
      ).map((w) => ({
        handle: w.id(),
        title: w.title(),
        processName: w.appName(),
        x: w.x(),
        y: w.y(),
        width: w.width(),
        height: w.height()
      }));
      logger.info(`list_windows returning ${windows.length} windows`);
      return {
        content: [
          { type: "text", text: JSON.stringify({ windows }) }
        ]
      };
    }
  );
  server.registerResource(
    "capture-grid",
    new ResourceTemplate("capture://{sessionId}/grid", {
      list: async () => ({
        resources: sessionManager.listCompleted().map((s) => ({
          uri: `capture://${s.id}/grid`,
          name: `Capture ${s.id} Grid`,
          mimeType: "image/jpeg"
        }))
      })
    }),
    {
      description: "Grid image for a completed capture session",
      mimeType: "image/jpeg"
    },
    async (uri, { sessionId }) => {
      logger.info(`Resource read: capture://${sessionId}/grid`);
      const session = sessionManager.get(sessionId);
      if (!session) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: "Session not found"
            }
          ]
        };
      }
      if (session.state !== "complete") {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Capture in progress: ${session.frames.length} frames`
            }
          ]
        };
      }
      const gridBuffer = await compileGrid(session.frames, {
        jpegQuality: session.config.jpegQuality,
        deltaHighlight: session.config.deltaHighlight,
        compressIdle: session.config.compressIdle
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "image/jpeg",
            blob: gridBuffer.toString("base64")
          }
        ]
      };
    }
  );
  server.registerResource(
    "capture-gif",
    new ResourceTemplate("capture://{sessionId}/gif", {
      list: async () => ({
        resources: sessionManager.listCompleted().filter((s) => s.config.gifExport).map((s) => ({
          uri: `capture://${s.id}/gif`,
          name: `Capture ${s.id} GIF`,
          mimeType: "image/gif"
        }))
      })
    }),
    {
      description: "Animated GIF for a completed capture session",
      mimeType: "image/gif"
    },
    async (uri, { sessionId }) => {
      logger.info(`Resource read: capture://${sessionId}/gif`);
      const session = sessionManager.get(sessionId);
      if (!session) {
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: "Session not found" }] };
      }
      if (session.state !== "complete") {
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: `Capture in progress: ${session.frames.length} frames` }] };
      }
      if (!session.config.gifExport) {
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: "GIF export was not enabled for this session" }] };
      }
      try {
        let processedFrames = [...session.frames];
        if (session.config.compressIdle) {
          const { compressIdleFrames } = await import("./idle-compressor-5BIC3FI3.js");
          processedFrames = await compressIdleFrames(processedFrames);
        }
        if (session.config.deltaHighlight) {
          const { applyDeltaHighlights } = await import("./delta-highlighter-VTCFNN56.js");
          processedFrames = await applyDeltaHighlights(processedFrames);
        }
        const { exportGif } = await import("./gif-exporter-FFVMNARE.js");
        const gifBuffer = await exportGif(processedFrames);
        return {
          contents: [{
            uri: uri.href,
            mimeType: "image/gif",
            blob: gifBuffer.toString("base64")
          }]
        };
      } catch (err) {
        logger.error(`GIF export failed: ${err instanceof Error ? err.message : String(err)}`);
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "GIF export failed" }]
        };
      }
    }
  );
  server.registerTool(
    "save_screenshot_profile",
    {
      title: "Save Screenshot Profile",
      description: "Save a named screenshot profile for reuse. Profiles store target parameters (window, region, etc.) so you define a capture area once and reuse it by name. Optionally copy config from an existing capture session.",
      inputSchema: {
        name: z.string().min(1).describe("Profile name (case-insensitive, slugified for storage)"),
        target: z.enum(["desktop", "window", "region", "window_region"]).optional().describe("Capture target type (not needed if source_session provided)"),
        window_title: z.string().optional().describe("Window title substring for window/window_region targets"),
        window_handle: z.number().optional().describe("Window handle for window/window_region targets"),
        x: z.number().min(0).optional().describe("Region left X in screen pixels (target=region)"),
        y: z.number().min(0).optional().describe("Region top Y in screen pixels (target=region)"),
        width: z.number().min(1).optional().describe("Region width in pixels (target=region)"),
        height: z.number().min(1).optional().describe("Region height in pixels (target=region)"),
        region_x: z.number().min(0).optional().describe("Sub-region left X relative to window (target=window_region)"),
        region_y: z.number().min(0).optional().describe("Sub-region top Y relative to window (target=window_region)"),
        region_width: z.number().min(1).optional().describe("Sub-region width (target=window_region)"),
        region_height: z.number().min(1).optional().describe("Sub-region height (target=window_region)"),
        description: z.string().optional().describe("Human-readable description of this profile"),
        source_session: z.string().uuid().optional().describe("Copy target config from this session ID instead of specifying params")
      }
    },
    async (args) => {
      logger.info(`save_screenshot_profile called: name="${args.name}"`);
      const profileManager = getProfileManager();
      if (args.source_session) {
        try {
          const saved2 = await profileManager.saveFromSession(
            args.name,
            args.source_session,
            sessionManager
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ status: "saved", profile: saved2 })
              }
            ]
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: err instanceof Error ? err.message : String(err)
                })
              }
            ],
            isError: true
          };
        }
      }
      if (!args.target) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "error",
                error: "target is required when source_session is not provided"
              })
            }
          ],
          isError: true
        };
      }
      if (args.target === "window" || args.target === "window_region") {
        if (args.window_handle === void 0 && args.window_title === void 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: `target='${args.target}' requires window_handle or window_title`
                })
              }
            ],
            isError: true
          };
        }
      }
      if (args.target === "region") {
        if (args.x === void 0 || args.y === void 0 || args.width === void 0 || args.height === void 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: "target='region' requires x, y, width, and height"
                })
              }
            ],
            isError: true
          };
        }
      }
      if (args.target === "window_region") {
        if (args.region_x === void 0 || args.region_y === void 0 || args.region_width === void 0 || args.region_height === void 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "error",
                  error: "target='window_region' requires region_x, region_y, region_width, and region_height"
                })
              }
            ],
            isError: true
          };
        }
      }
      const saved = await profileManager.save({
        name: args.name,
        target: args.target,
        windowTitle: args.window_title,
        windowHandle: args.window_handle,
        x: args.x,
        y: args.y,
        width: args.width,
        height: args.height,
        regionX: args.region_x,
        regionY: args.region_y,
        regionWidth: args.region_width,
        regionHeight: args.region_height,
        description: args.description
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "saved", profile: saved })
          }
        ]
      };
    }
  );
  server.registerTool(
    "list_screenshot_profiles",
    {
      title: "List Screenshot Profiles",
      description: "List all saved screenshot profiles with liveness status. The 'test' field indicates whether the target is currently available (window still open, etc.).",
      inputSchema: {}
    },
    async () => {
      logger.info("list_screenshot_profiles called");
      const profileManager = getProfileManager();
      const profiles = await profileManager.list();
      const profilesWithTest = profiles.map((profile) => {
        let test = true;
        if (profile.target === "window" || profile.target === "window_region") {
          test = findWindow(profile.windowHandle, profile.windowTitle) !== null;
        }
        return { ...profile, test };
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ profiles: profilesWithTest })
          }
        ]
      };
    }
  );
  server.registerTool(
    "delete_screenshot_profile",
    {
      title: "Delete Screenshot Profile",
      description: "Delete a saved screenshot profile by name.",
      inputSchema: {
        name: z.string().min(1).describe("Profile name to delete")
      }
    },
    async (args) => {
      const profileManager = getProfileManager();
      const slug = slugify(args.name);
      logger.info(`delete_screenshot_profile called: slug="${slug}"`);
      const deleted = await profileManager.delete(slug);
      if (deleted) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "deleted", name: slug })
            }
          ]
        };
      }
      const available = (await profileManager.list()).map((p) => p.slug);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "not_found",
              name: slug,
              available
            })
          }
        ],
        isError: true
      };
    }
  );
  server.registerTool(
    "save_timing_profile",
    {
      title: "Save Timing Profile",
      description: "Save or update a named timing profile with capture timing parameters and diagnostic flags. Optionally copy config from an existing capture session.",
      inputSchema: {
        name: z.string().min(1).describe("Profile name (case-insensitive, slugified for storage)"),
        interval_ms: z.number().min(100).optional().describe("Milliseconds between captures"),
        max_frames: z.number().min(1).max(50).optional().describe("Maximum frames to capture"),
        duration_ms: z.number().min(100).optional().describe("Total capture duration in ms"),
        jpeg_quality: z.number().min(1).max(100).optional().describe("JPEG quality (1-100)"),
        delta_highlight: z.boolean().optional().describe("Enable delta highlighting"),
        compress_idle: z.boolean().optional().describe("Collapse identical frames"),
        gif_export: z.boolean().optional().describe("Export as animated GIF"),
        description: z.string().optional().describe("Human-readable description"),
        source_session: z.string().uuid().optional().describe("Copy timing config from this session")
      }
    },
    async (args) => {
      logger.info(`save_timing_profile called: name="${args.name}"`);
      const profileManager = getProfileManager();
      if (args.source_session) {
        try {
          const saved2 = await profileManager.saveTimingFromSession(
            args.name,
            args.source_session,
            sessionManager
          );
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "saved",
                profile: saved2,
                parameter_summary: generateParameterSummary(saved2)
              })
            }]
          };
        } catch (err) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "error",
                error: err instanceof Error ? err.message : String(err)
              })
            }],
            isError: true
          };
        }
      }
      const saved = await profileManager.saveTiming({
        name: args.name,
        intervalMs: args.interval_ms,
        maxFrames: args.max_frames,
        durationMs: args.duration_ms,
        jpegQuality: args.jpeg_quality,
        deltaHighlight: args.delta_highlight,
        compressIdle: args.compress_idle,
        gifExport: args.gif_export,
        description: args.description
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "saved",
            profile: saved,
            parameter_summary: generateParameterSummary(saved)
          })
        }]
      };
    }
  );
  server.registerTool(
    "list_timing_profiles",
    {
      title: "List Timing Profiles",
      description: "List all timing profiles (both user-saved and built-in presets). Built-in presets are tagged with builtin: true.",
      inputSchema: {}
    },
    async () => {
      logger.info("list_timing_profiles called");
      const profileManager = getProfileManager();
      const profiles = await profileManager.listTiming();
      const profilesWithSummary = profiles.map((p) => ({
        ...p,
        parameter_summary: generateParameterSummary(p)
      }));
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ profiles: profilesWithSummary })
        }]
      };
    }
  );
  server.registerTool(
    "delete_timing_profile",
    {
      title: "Delete Timing Profile",
      description: "Delete a saved timing profile by name. Built-in presets cannot be deleted.",
      inputSchema: {
        name: z.string().min(1).describe("Profile name to delete")
      }
    },
    async (args) => {
      const profileManager = getProfileManager();
      const slug = slugify(args.name);
      logger.info(`delete_timing_profile called: slug="${slug}"`);
      const result = await profileManager.deleteTiming(slug);
      if (result.deleted) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ status: "deleted", name: slug })
          }]
        };
      }
      if (result.isBuiltin) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              error: `Cannot delete built-in preset "${slug}". Save a user profile with the same name to override it.`
            })
          }],
          isError: true
        };
      }
      const available = (await profileManager.listTiming()).map((p) => p.slug);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "not_found",
            name: slug,
            available
          })
        }],
        isError: true
      };
    }
  );
  server.registerTool(
    "start_repository_capture",
    {
      title: "Start Repository Capture",
      description: "Begin a long-running disk-backed capture session. Frames are written to disk as JPEG files (not held in RAM). Supports up to 200 frames. Returns a session ID immediately. Use get_capture_status to check progress.",
      inputSchema: {
        interval_ms: z.number().min(100).optional().describe("Milliseconds between captures (required unless timing_profile provides it)"),
        max_frames: z.number().min(1).max(200).optional().describe("Maximum frames to capture (default: 200, capped at 200 per D-11)"),
        duration_ms: z.number().min(100).optional().describe("Total capture duration in ms; if both max_frames and duration_ms set, whichever limit hits first stops capture"),
        jpeg_quality: z.number().min(1).max(100).optional().describe("JPEG output quality 1-100 (default: 80)"),
        target: z.enum(["desktop", "window", "region", "window_region"]).optional().describe("Capture target type (defaults to 'desktop' when no screenshot_profile is used)"),
        window_handle: z.number().optional().describe("Window handle from list_windows. Required for target='window' or 'window_region' unless window_title provided"),
        window_title: z.string().optional().describe("Window title substring, case-insensitive. Required for target='window' or 'window_region' unless window_handle provided"),
        x: z.number().min(0).optional().describe("Region left X in screen pixels. Required for target='region'"),
        y: z.number().min(0).optional().describe("Region top Y in screen pixels. Required for target='region'"),
        width: z.number().min(1).optional().describe("Region width in pixels. Required for target='region'"),
        height: z.number().min(1).optional().describe("Region height in pixels. Required for target='region'"),
        region_x: z.number().min(0).optional().describe("Sub-region left X relative to window. Required for target='window_region'"),
        region_y: z.number().min(0).optional().describe("Sub-region top Y relative to window. Required for target='window_region'"),
        region_width: z.number().min(1).optional().describe("Sub-region width in pixels. Required for target='window_region'"),
        region_height: z.number().min(1).optional().describe("Sub-region height in pixels. Required for target='window_region'"),
        delta_highlight: z.boolean().optional().describe("Enable delta highlighting (default: false)"),
        compress_idle: z.boolean().optional().describe("Collapse consecutive identical frames (default: false)"),
        gif_export: z.boolean().optional().describe("Also export capture as animated GIF (default: false)"),
        screenshot_profile: z.string().optional().describe("Named screenshot profile to use as base target config. Inline target params override."),
        timing_profile: z.string().optional().describe("Named timing profile to use as base timing/diagnostic config. Inline params override."),
        session_name: z.string().max(100).optional().describe("Optional friendly name for this session. Must be unique across active sessions.")
      }
    },
    async (args) => {
      logger.info(
        `start_repository_capture called: interval=${args.interval_ms ?? "profile"}ms, max_frames=${args.max_frames ?? "default"}, target=${args.target ?? "profile"}, session_name=${args.session_name ?? "none"}`
      );
      let resolvedArgs = { ...args, target: args.target ?? "desktop" };
      if (args.timing_profile) {
        const profileManager = getProfileManager();
        const tSlug = slugify(args.timing_profile);
        const timingProfile = await profileManager.getTiming(tSlug);
        if (!timingProfile) {
          const userProfiles = await profileManager.listTiming();
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "error",
                error: `Timing profile not found: "${args.timing_profile}"`,
                available_timing_profiles: userProfiles.map((p) => p.slug)
              })
            }],
            isError: true
          };
        }
        const resolvedTiming = resolveTimingProfile(timingProfile, {
          interval_ms: args.interval_ms,
          max_frames: args.max_frames,
          duration_ms: args.duration_ms,
          jpeg_quality: args.jpeg_quality,
          delta_highlight: args.delta_highlight,
          compress_idle: args.compress_idle,
          gif_export: args.gif_export
        });
        resolvedArgs = { ...resolvedArgs, ...resolvedTiming };
        logger.info(`Resolved timing profile "${tSlug}": ${JSON.stringify(resolvedTiming)}`);
      }
      if (args.screenshot_profile) {
        const profileManager = getProfileManager();
        const slug = slugify(args.screenshot_profile);
        const profile = await profileManager.get(slug);
        if (!profile) {
          const allProfiles = await profileManager.list();
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "error",
                error: `Screenshot profile not found: "${args.screenshot_profile}"`,
                available_profiles: allProfiles.map((p) => p.slug)
              })
            }],
            isError: true
          };
        }
        const resolved = resolveScreenshotProfile(profile, {
          target: args.target,
          window_title: args.window_title,
          window_handle: args.window_handle,
          x: args.x,
          y: args.y,
          width: args.width,
          height: args.height,
          region_x: args.region_x,
          region_y: args.region_y,
          region_width: args.region_width,
          region_height: args.region_height
        });
        resolvedArgs = { ...resolvedArgs, ...resolved };
        logger.info(`Resolved screenshot profile "${slug}": target=${resolved.target}`);
      }
      if (resolvedArgs.target === "window") {
        if (resolvedArgs.window_handle === void 0 && resolvedArgs.window_title === void 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ status: "error", error: "target='window' requires window_handle or window_title" }) }],
            isError: true
          };
        }
      }
      if (resolvedArgs.target === "region") {
        if (resolvedArgs.x === void 0 || resolvedArgs.y === void 0 || resolvedArgs.width === void 0 || resolvedArgs.height === void 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ status: "error", error: "target='region' requires x, y, width, and height" }) }],
            isError: true
          };
        }
      }
      if (resolvedArgs.target === "window_region") {
        if (resolvedArgs.window_handle === void 0 && resolvedArgs.window_title === void 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ status: "error", error: "target='window_region' requires window_handle or window_title" }) }],
            isError: true
          };
        }
        if (resolvedArgs.region_x === void 0 || resolvedArgs.region_y === void 0 || resolvedArgs.region_width === void 0 || resolvedArgs.region_height === void 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ status: "error", error: "target='window_region' requires region_x, region_y, region_width, and region_height" }) }],
            isError: true
          };
        }
      }
      if (resolvedArgs.target === "window" || resolvedArgs.target === "window_region") {
        const win = findWindow(resolvedArgs.window_handle, resolvedArgs.window_title);
        if (!win) {
          return {
            content: [{ type: "text", text: JSON.stringify({ status: "error", error: `Window not found: ${resolvedArgs.window_handle !== void 0 ? `handle=${resolvedArgs.window_handle}` : `title="${resolvedArgs.window_title}"`}` }) }],
            isError: true
          };
        }
      }
      let captureTarget;
      switch (resolvedArgs.target) {
        case "window":
          captureTarget = new WindowTarget(resolvedArgs.window_handle, resolvedArgs.window_title);
          break;
        case "region":
          captureTarget = new RegionTarget(resolvedArgs.x, resolvedArgs.y, resolvedArgs.width, resolvedArgs.height);
          break;
        case "window_region":
          captureTarget = new WindowRegionTarget(resolvedArgs.window_handle, resolvedArgs.window_title, resolvedArgs.region_x, resolvedArgs.region_y, resolvedArgs.region_width, resolvedArgs.region_height);
          break;
        case "desktop":
        default:
          captureTarget = desktopTarget;
          break;
      }
      const finalIntervalMs = resolvedArgs.interval_ms;
      if (finalIntervalMs === void 0) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "error", error: "interval_ms is required (provide it directly or via a timing_profile)" }) }],
          isError: true
        };
      }
      const finalMaxFrames = resolvedArgs.max_frames ?? 200;
      const finalJpegQuality = resolvedArgs.jpeg_quality ?? 80;
      const finalDeltaHighlight = resolvedArgs.delta_highlight ?? false;
      const finalCompressIdle = resolvedArgs.compress_idle ?? false;
      const finalGifExport = resolvedArgs.gif_export ?? false;
      const config = {
        intervalMs: finalIntervalMs,
        maxFrames: finalMaxFrames,
        durationMs: resolvedArgs.duration_ms,
        jpegQuality: finalJpegQuality,
        target: resolvedArgs.target,
        windowHandle: resolvedArgs.window_handle,
        windowTitle: resolvedArgs.window_title,
        regionX: resolvedArgs.target === "region" ? resolvedArgs.x : resolvedArgs.region_x,
        regionY: resolvedArgs.target === "region" ? resolvedArgs.y : resolvedArgs.region_y,
        regionWidth: resolvedArgs.target === "region" ? resolvedArgs.width : resolvedArgs.region_width,
        regionHeight: resolvedArgs.target === "region" ? resolvedArgs.height : resolvedArgs.region_height,
        deltaHighlight: finalDeltaHighlight,
        compressIdle: finalCompressIdle,
        gifExport: finalGifExport
      };
      const repoManager = getRepositoryManager();
      let manifest;
      try {
        manifest = await repoManager.createSession(config, args.session_name);
      } catch (err) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "error", error: err instanceof Error ? err.message : String(err) }) }],
          isError: true
        };
      }
      const sessionDir = path4.join(repoManager.getBasePath(), manifest.sessionId);
      import("./repository-scheduler-GA2NJF46.js").then(
        ({ startRepositoryScheduler }) => startRepositoryScheduler(manifest, captureTarget, repoManager, sessionDir)
      ).catch((err) => {
        logger.error(`Repository scheduler failed: ${err instanceof Error ? err.message : String(err)}`);
        repoManager.errorSession(manifest.sessionId, err instanceof Error ? err.message : String(err));
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "started",
            sessionId: manifest.sessionId,
            sessionName: args.session_name,
            target: resolvedArgs.target,
            config: {
              intervalMs: config.intervalMs,
              maxFrames: config.maxFrames,
              durationMs: config.durationMs,
              jpegQuality: config.jpegQuality
            },
            repository: true
          })
        }]
      };
    }
  );
  server.registerTool(
    "list_repository_sessions",
    {
      title: "List Repository Sessions",
      description: "List all disk-backed repository capture sessions with metadata, frame counts, disk usage, and retention deadlines.",
      inputSchema: {}
    },
    async () => {
      logger.info("list_repository_sessions called");
      const repoManager = getRepositoryManager();
      const sessions = await repoManager.listSessions();
      const sessionList = sessions.map((s) => ({
        sessionId: s.sessionId,
        sessionName: s.sessionName,
        state: s.state,
        startedAt: s.startedAt,
        frameCount: s.frameCount,
        maxFrames: s.captureConfig.maxFrames,
        target: s.captureConfig.target,
        intervalMs: s.captureConfig.intervalMs,
        diskUsageBytes: s.frames.reduce((sum, f) => sum + f.size_bytes, 0),
        retentionDeadline: repoManager.getRetentionDeadline(s),
        elapsedMs: Date.now() - new Date(s.startedAt).getTime()
      }));
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ sessions: sessionList, count: sessions.length })
        }]
      };
    }
  );
  server.registerTool(
    "delete_repository_session",
    {
      title: "Delete Repository Session",
      description: "Delete a disk-backed repository capture session by ID or name. Removes all frame files from disk and returns freed space.",
      inputSchema: {
        session: z.string().describe("Session ID (UUID) or session name")
      }
    },
    async (args) => {
      logger.info(`delete_repository_session called: session="${args.session}"`);
      const repoManager = getRepositoryManager();
      const session = await repoManager.resolveSession(args.session);
      if (!session) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              error: `Session not found: ${args.session}`
            })
          }],
          isError: true
        };
      }
      const { freedBytes } = await repoManager.deleteSession(session.sessionId);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "deleted",
            sessionId: session.sessionId,
            sessionName: session.sessionName,
            freedBytes,
            freedMB: (freedBytes / 1024 / 1024).toFixed(2)
          })
        }]
      };
    }
  );
  server.registerTool(
    "list_repository_frames",
    {
      title: "List Repository Frames",
      description: "Inspect frames in a repository session with optional query filtering and per-frame change metrics. Returns frame manifest, query echo, and session change_summary.",
      inputSchema: {
        session: z.string().describe("Session ID (UUID) or session name"),
        from_ms: z.number().min(0).optional().describe("Start time in ms relative to capture start"),
        to_ms: z.number().min(0).optional().describe("End time in ms relative to capture start"),
        length_ms: z.number().min(0).optional().describe("Duration window in ms (used with from_ms)"),
        from_index: z.number().min(0).optional().describe("Start frame index (inclusive)"),
        to_index: z.number().min(0).optional().describe("End frame index (inclusive)"),
        frame_count: z.number().min(1).optional().describe("Number of frames from start index"),
        max_frames: z.number().min(1).max(200).optional().describe("Maximum frames to return; evenly samples if exceeded"),
        include_changes: z.boolean().default(false).describe("Include per-frame change_from_previous metric (slower, requires reading frame files)")
      }
    },
    async (args) => {
      logger.info(`list_repository_frames called: session="${args.session}", include_changes=${args.include_changes}`);
      const repoManager = getRepositoryManager();
      const session = await repoManager.resolveSession(args.session);
      if (!session) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "error", error: `Session not found: ${args.session}` }) }],
          isError: true
        };
      }
      const result = applyQuery(session.frames, {
        from_ms: args.from_ms,
        to_ms: args.to_ms,
        length_ms: args.length_ms,
        from_index: args.from_index,
        to_index: args.to_index,
        frame_count: args.frame_count,
        max_frames: args.max_frames
      });
      if ("error" in result) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "error", error: result.error }) }],
          isError: true
        };
      }
      const selectedEntries = result;
      const sessionDir = path4.join(repoManager.getBasePath(), session.sessionId);
      const frames = [];
      if (args.include_changes && selectedEntries.length > 0) {
        let prevRaw = null;
        for (let i = 0; i < selectedEntries.length; i++) {
          const entry = selectedEntries[i];
          const frameOutput = {
            index: entry.index,
            elapsed_ms: entry.elapsed_ms,
            filename: entry.filename,
            size_bytes: entry.size_bytes
          };
          try {
            const buf = await readFile3(path4.join(sessionDir, entry.filename));
            const raw = await extractRawPixels(buf);
            if (prevRaw === null) {
              frameOutput.change_from_previous = null;
            } else {
              const { changedFraction } = compareFrames(prevRaw, raw);
              frameOutput.change_from_previous = changedFraction;
            }
            prevRaw = raw;
          } catch {
            frameOutput.change_from_previous = null;
            prevRaw = null;
          }
          frames.push(frameOutput);
        }
      } else {
        for (const entry of selectedEntries) {
          frames.push({
            index: entry.index,
            elapsed_ms: entry.elapsed_ms,
            filename: entry.filename,
            size_bytes: entry.size_bytes
          });
        }
      }
      const allFrames = session.frames;
      let longestIdleMs = 0;
      let mostActiveStartMs = 0;
      let mostActiveEndMs = 0;
      if (allFrames.length > 1) {
        for (let i = 1; i < allFrames.length; i++) {
          const gap = allFrames[i].elapsed_ms - allFrames[i - 1].elapsed_ms;
          if (gap > longestIdleMs) {
            longestIdleMs = gap;
          }
        }
        const windowMs = 5e3;
        let maxCount = 0;
        let bestStart = allFrames[0].elapsed_ms;
        let bestEnd = allFrames[0].elapsed_ms;
        for (let i = 0; i < allFrames.length; i++) {
          const startMs = allFrames[i].elapsed_ms;
          const endMs = startMs + windowMs;
          let count = 0;
          for (let j = i; j < allFrames.length && allFrames[j].elapsed_ms <= endMs; j++) {
            count++;
          }
          if (count > maxCount) {
            maxCount = count;
            bestStart = startMs;
            let lastInWindow = i;
            for (let j = i; j < allFrames.length && allFrames[j].elapsed_ms <= endMs; j++) {
              lastInWindow = j;
            }
            bestEnd = allFrames[lastInWindow].elapsed_ms;
          }
        }
        mostActiveStartMs = bestStart;
        mostActiveEndMs = bestEnd;
      }
      const changeSummary = {
        totalFrames: session.frameCount,
        longestIdleMs,
        mostActiveStartMs,
        mostActiveEndMs
      };
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionId: session.sessionId,
            sessionName: session.sessionName,
            state: session.state,
            query: {
              from_ms: args.from_ms,
              to_ms: args.to_ms,
              length_ms: args.length_ms,
              from_index: args.from_index,
              to_index: args.to_index,
              frame_count: args.frame_count,
              max_frames: args.max_frames
            },
            selectedFrames: frames.length,
            totalSessionFrames: session.frameCount,
            frames,
            change_summary: changeSummary
          })
        }]
      };
    }
  );
  server.registerTool(
    "compile_subset_grid",
    {
      title: "Compile Subset Grid",
      description: "Compile a subset of frames from a repository session into a JPEG grid image. Supports query-based frame selection, label overlay, delta highlighting, idle compression, and custom JPEG quality. Returns the grid image and metadata.",
      inputSchema: {
        session: z.string().describe("Session ID (UUID) or session name"),
        from_ms: z.number().min(0).optional().describe("Start time in ms relative to capture start"),
        to_ms: z.number().min(0).optional().describe("End time in ms relative to capture start"),
        length_ms: z.number().min(0).optional().describe("Duration window in ms (used with from_ms)"),
        from_index: z.number().min(0).optional().describe("Start frame index (inclusive)"),
        to_index: z.number().min(0).optional().describe("End frame index (inclusive)"),
        frame_count: z.number().min(1).optional().describe("Number of frames from start index"),
        max_frames: z.number().min(1).max(200).optional().describe("Maximum frames in grid; evenly samples if exceeded"),
        label: z.string().max(100).optional().describe("Title label burned into the top of the grid image"),
        delta_highlight: z.boolean().default(false).describe("Enable delta highlighting between frames"),
        compress_idle: z.boolean().default(false).describe("Collapse consecutive identical frames"),
        jpeg_quality: z.number().min(1).max(100).default(80).describe("JPEG quality for the output grid")
      }
    },
    async (args) => {
      logger.info(`compile_subset_grid called: session="${args.session}", label="${args.label ?? "none"}", delta_highlight=${args.delta_highlight}, compress_idle=${args.compress_idle}`);
      const repoManager = getRepositoryManager();
      const session = await repoManager.resolveSession(args.session);
      if (!session) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "error", error: `Session not found: ${args.session}` }) }],
          isError: true
        };
      }
      if (session.state === "error" && session.frameCount === 0) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "error", error: "Session has no frames (capture errored before any frames were saved)" }) }],
          isError: true
        };
      }
      const result = applyQuery(session.frames, {
        from_ms: args.from_ms,
        to_ms: args.to_ms,
        length_ms: args.length_ms,
        from_index: args.from_index,
        to_index: args.to_index,
        frame_count: args.frame_count,
        max_frames: args.max_frames
      });
      if ("error" in result) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "error", error: result.error }) }],
          isError: true
        };
      }
      const selectedEntries = result;
      if (selectedEntries.length === 0) {
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "error", error: "No frames match the query parameters" }) }],
          isError: true
        };
      }
      const sessionDir = path4.join(repoManager.getBasePath(), session.sessionId);
      const captureFrames = await Promise.all(
        selectedEntries.map(async (entry) => ({
          buffer: await readFile3(path4.join(sessionDir, entry.filename)),
          elapsedMs: entry.elapsed_ms,
          index: entry.index
        }))
      );
      let gridBuffer = await compileGrid(captureFrames, {
        jpegQuality: args.jpeg_quality,
        includeTimestamps: true,
        deltaHighlight: args.delta_highlight,
        compressIdle: args.compress_idle
      });
      if (args.label) {
        const gridMeta = await sharp3(gridBuffer).metadata();
        const labelHeight = 28;
        const svgLabel = Buffer.from(`<svg width="${gridMeta.width}" height="${labelHeight}">
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)"/>
  <text x="8" y="20" font-family="Arial,sans-serif" font-size="16" fill="white">${escapeXml(args.label)}</text>
</svg>`);
        gridBuffer = await sharp3(gridBuffer).composite([{ input: svgLabel, top: 0, left: 0 }]).jpeg({ quality: args.jpeg_quality }).toBuffer();
      }
      const firstMs = selectedEntries[0].elapsed_ms;
      const lastMs = selectedEntries[selectedEntries.length - 1].elapsed_ms;
      const timeSpanMs = lastMs - firstMs;
      const cols = Math.ceil(Math.sqrt(captureFrames.length));
      const rows = Math.ceil(captureFrames.length / cols);
      return {
        content: [{
          type: "image",
          data: gridBuffer.toString("base64"),
          mimeType: "image/jpeg"
        }, {
          type: "text",
          text: JSON.stringify({
            sessionId: session.sessionId,
            sessionName: session.sessionName,
            framesInGrid: captureFrames.length,
            timeSpanMs,
            firstFrameMs: firstMs,
            lastFrameMs: lastMs,
            gridDimensions: { cols, rows },
            query: {
              from_ms: args.from_ms,
              to_ms: args.to_ms,
              length_ms: args.length_ms,
              from_index: args.from_index,
              to_index: args.to_index,
              frame_count: args.frame_count,
              max_frames: args.max_frames
            },
            options: {
              delta_highlight: args.delta_highlight,
              compress_idle: args.compress_idle,
              jpeg_quality: args.jpeg_quality,
              label: args.label
            }
          })
        }]
      };
    }
  );
  logger.info("Registered tools: start_capture, get_capture_status, list_windows, save_screenshot_profile, list_screenshot_profiles, delete_screenshot_profile, save_timing_profile, list_timing_profiles, delete_timing_profile, start_repository_capture, list_repository_sessions, delete_repository_session, list_repository_frames, compile_subset_grid");
  logger.info("Registered resource: capture://{sessionId}/grid");
  logger.info("Registered resource: capture://{sessionId}/gif");
  return server;
}
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
var originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function(chunk, ...args) {
  if (typeof chunk === "string" && chunk.trimStart().startsWith("{")) {
    return originalStdoutWrite(chunk, ...args);
  }
  return process.stderr.write(chunk, ...args);
};
console.log = console.error;
console.warn = console.error;
console.info = console.error;
async function main() {
  try {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Server connected via stdio transport");
  } catch (error) {
    logger.error(
      `Failed to start server: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
main();
