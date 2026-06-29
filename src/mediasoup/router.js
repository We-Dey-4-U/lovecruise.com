// backend/src/mediasoup/router.js
// Premium codec configuration: VP9 + H.264 + Opus high-quality

const { getWorker } = require("./worker");

const routers = new Map();

const MEDIA_CODECS = [
  // ── AUDIO ── Opus: stereo, 48kHz, FEC, DTX
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
    parameters: {
      "minptime": 10,
      "useinbandfec": 1,
      "usedtx": 1,
      "maxaveragebitrate": 510000,
      "stereo": 1,
      "sprop-stereo": 1
    }
  },

  // ── VIDEO: VP9 (preferred — best quality/bitrate ratio) ──
  {
    kind: "video",
    mimeType: "video/VP9",
    clockRate: 90000,
    parameters: {
      "profile-id": 2   // VP9 Profile 2 = 10-bit HDR capable
    }
  },

  // ── VIDEO: VP8 (universal fallback) ──
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {}
  },

  // ── VIDEO: H.264 (hardware-accelerated on most devices) ──
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",  // Baseline 3.1 — widest hw compat
      "level-asymmetry-allowed": 1
    }
  },

  // ── VIDEO: H.264 High Profile (better quality on capable devices) ──
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "640032",  // High profile 5.0
      "level-asymmetry-allowed": 1
    }
  }
];

async function createRouter(roomId) {
  if (routers.has(roomId)) return routers.get(roomId);

  const worker = getWorker();
  if (!worker) throw new Error("Mediasoup worker not ready");

  const router = await worker.createRouter({ mediaCodecs: MEDIA_CODECS });

  routers.set(roomId, router);
  console.log(`✅ Premium router created for room ${roomId}`);
  return router;
}

function getRouter(roomId) {
  const router = routers.get(roomId);
  if (!router) throw new Error(`Router not initialized for room ${roomId}`);
  return router;
}

function hasRouter(roomId) {
  return routers.has(roomId);
}

function closeRouter(roomId) {
  const router = routers.get(roomId);
  if (router) {
    try { router.close(); } catch (e) {}
  }
  routers.delete(roomId);
  console.log(`🗑️  Router closed for room ${roomId}`);
}

module.exports = { createRouter, getRouter, hasRouter, closeRouter };