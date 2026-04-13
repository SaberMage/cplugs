// src/logger.ts
var logger = {
  info(message) {
    console.error(`[screen-timelapse] [INFO] ${message}`);
  },
  warn(message) {
    console.error(`[screen-timelapse] [WARN] ${message}`);
  },
  error(message) {
    console.error(`[screen-timelapse] [ERROR] ${message}`);
  },
  debug(message) {
    console.error(`[screen-timelapse] [DEBUG] ${message}`);
  }
};

export {
  logger
};
