// ================================================================================
// Nuvio Streams Addon for Stremio
// ================================================================================

const { addonBuilder } = require('stremio-addon-sdk');
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Redis = require('ioredis');

const USE_REDIS_CACHE = process.env.USE_REDIS_CACHE === 'true';
let redis = null;
let redisKeepAliveInterval = null;

if (USE_REDIS_CACHE) {
    try {
        if (!process.env.REDIS_URL) throw new Error("REDIS_URL not set");
        redis = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 5,
            retryStrategy: times => Math.min(times * 500, 5000),
            reconnectOnError: err => err.message.includes('READONLY'),
            tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
            enableOfflineQueue: true,
            enableReadyCheck: true,
            autoResubscribe: true,
            lazyConnect: false
        });

        redis.on('connect', () => {
            console.log('[Redis] Connected');
            if (redisKeepAliveInterval) clearInterval(redisKeepAliveInterval);
            redisKeepAliveInterval = setInterval(() => redis.ping().catch(() => {}), 4 * 60 * 1000);
        });

        redis.on('error', err => console.error('[Redis] Error:', err.message));
        redis.on('reconnecting', delay => console.warn(`[Redis] Reconnecting in ${delay}ms`));
        redis.on('close', () => console.warn('[Redis] Connection closed'));
        redis.on('end', () => console.error('[Redis] Connection ended'));
    } catch (err) {
        console.error('[Redis] Init failed:', err.message);
        redis = null;
    }
}

// =============================================================================
// Provider enable flags & imports (only allowed providers)
// =============================================================================

const ENABLE_CASTLE_PROVIDER     = process.env.ENABLE_CASTLE_PROVIDER     !== 'false';
const ENABLE_HDHUB4U_PROVIDER    = process.env.ENABLE_HDHUB4U_PROVIDER    !== 'false';
const ENABLE_HIANIME_PROVIDER    = process.env.ENABLE_HIANIME_PROVIDER    !== 'false';
const ENABLE_MOVIEBOX_PROVIDER   = process.env.ENABLE_MOVIEBOX_PROVIDER   !== 'false';
const ENABLE_MOVIESDRIVE_PROVIDER= process.env.ENABLE_MOVIESDRIVE_PROVIDER!== 'false';
const ENABLE_NETMIRROR_PROVIDER  = process.env.ENABLE_NETMIRROR_PROVIDER  !== 'false';
const ENABLE_STREAMFLIX_PROVIDER = process.env.ENABLE_STREAMFLIX_PROVIDER !== 'false';
const ENABLE_VIDLINK_PROVIDER    = process.env.ENABLE_VIDLINK_PROVIDER    !== 'false';
const ENABLE_XDMOVIES_PROVIDER   = process.env.ENABLE_XDMOVIES_PROVIDER   !== 'false';

console.log(`
Enabled providers:
  Castle      : ${ENABLE_CASTLE_PROVIDER}
  HDHub4u     : ${ENABLE_HDHUB4U_PROVIDER}
  HiAnime     : ${ENABLE_HIANIME_PROVIDER}
  MovieBox    : ${ENABLE_MOVIEBOX_PROVIDER}
  MoviesDrive : ${ENABLE_MOVIESDRIVE_PROVIDER}
  NetMirror   : ${ENABLE_NETMIRROR_PROVIDER}
  StreamFlix  : ${ENABLE_STREAMFLIX_PROVIDER}
  VidLink     : ${ENABLE_VIDLINK_PROVIDER}
  XDMovies    : ${ENABLE_XDMOVIES_PROVIDER}
`);

const { getStreams: getCastleStreams }     = require('./providers/castle.js');
const { getStreams: getHDHub4uStreams }    = require('./providers/hdhub4u.js');
const { getStreams: getHiAnimeStreams }    = require('./providers/hianime.js');
const { getStreams: getMovieBoxStreams }   = require('./providers/moviebox.js');
const { getMoviesDriveStreams }            = require('./providers/moviesdrive.js');
const { getStreams: getNetMirrorStreams }  = require('./providers/netmirror.js');
const { getStreams: getStreamFlixStreams } = require('./providers/streamflix.js');
const { getStreams: getVidLinkStreams }    = require('./providers/vidlink.js');
const { getStreams: getXDMoviesStreams }   = require('./providers/xdmovies.js');

const axios = require('axios');
const manifest = require('./manifest.json');

const builder = new addonBuilder(manifest);

// =============================================================================
// Cache & utility helpers (kept almost unchanged)
// =============================================================================

const STREAM_CACHE_DIR = process.env.VERCEL ? path.join('/tmp', '.streams_cache') : path.join(__dirname, '.streams_cache');
const STREAM_CACHE_TTL_MS = 30 * 60 * 1000;
const ENABLE_STREAM_CACHE = process.env.DISABLE_STREAM_CACHE !== 'true';

const ensureStreamCacheDir = async () => {
    if (!ENABLE_STREAM_CACHE) return;
    await fs.mkdir(STREAM_CACHE_DIR, { recursive: true }).catch(() => {});
};

ensureStreamCacheDir();

const getStreamCacheKey = (provider, type, id, season = null, episode = null) => {
    let key = `streams_${provider.toLowerCase()}_${type}_${id}`;
    if (season != null && episode != null) key += `_s${season}e${episode}`;
    return key;
};

const getStreamFromCache = async (provider, type, id, season, episode) => {
    if (!ENABLE_STREAM_CACHE) return null;
    const key = getStreamCacheKey(provider, type, id, season, episode);
    if (redis) {
        try {
            const data = await redis.get(key);
            if (data) {
                const obj = JSON.parse(data);
                if (obj.expiry && Date.now() > obj.expiry) {
                    await redis.del(key);
                    return null;
                }
                return obj.streams;
            }
        } catch {}
    }
    try {
        const file = path.join(STREAM_CACHE_DIR, key + '.json');
        const data = await fs.readFile(file, 'utf-8');
        const obj = JSON.parse(data);
        if (obj.expiry && Date.now() > obj.expiry) {
            await fs.unlink(file).catch(() => {});
            return null;
        }
        return obj.streams;
    } catch {
        return null;
    }
};

const saveStreamToCache = async (provider, type, id, streams, status = 'ok', season = null, episode = null, ttlMs = STREAM_CACHE_TTL_MS) => {
    if (!ENABLE_STREAM_CACHE) return;
    const key = getStreamCacheKey(provider, type, id, season, episode);
    const data = { streams, status, expiry: Date.now() + ttlMs, timestamp: Date.now() };

    if (redis) {
        try {
            await redis.set(key, JSON.stringify(data), 'PX', ttlMs);
            return;
        } catch {}
    }
    try {
        const file = path.join(STREAM_CACHE_DIR, key + '.json');
        await fs.writeFile(file, JSON.stringify(data), 'utf-8');
    } catch {}
};

// =============================================================================
// Stream handler
// =============================================================================

builder.defineStreamHandler(async (args) => {
    const { type, id, config = {} } = args;

    if (!['movie', 'series'].includes(type)) return { streams: [] };

    // Parse ID
    let tmdbId, seasonNum = null, episodeNum = null;
    const parts = id.split(':');

    if (parts[0] === 'tmdb') {
        tmdbId = parts[1];
        if (parts.length >= 4) {
            seasonNum = parseInt(parts[2], 10);
            episodeNum = parseInt(parts[3], 10);
        }
    } else if (parts[0].startsWith('tt')) {
        // You should add IMDb → TMDB conversion here if needed
        // For simplicity — assuming most clients send tmdb:xxx now
        return { streams: [] };
    } else {
        return { streams: [] };
    }

    if (!tmdbId) return { streams: [] };

    const tmdbType = type === 'movie' ? 'movie' : 'series';

    // Provider selection (only allowed ones)
    const allowedProviders = new Set([
        'castle', 'hdhub4u', 'hianime', 'moviebox', 'moviesdrive',
        'netmirror', 'streamflix', 'vidlink', 'xdmovies'
    ]);

    const selected = (config.providers || '')
        .split(',')
        .map(p => p.trim().toLowerCase())
        .filter(p => allowedProviders.has(p));

    const shouldFetch = name => selected.length === 0 || selected.includes(name.toLowerCase());

    const fetchers = {};

    if (ENABLE_CASTLE_PROVIDER)     fetchers.castle     = () => getCastleStreams(tmdbId, tmdbType, seasonNum, episodeNum);
    if (ENABLE_HDHUB4U_PROVIDER)    fetchers.hdhub4u    = () => getHDHub4uStreams(tmdbId, tmdbType, seasonNum, episodeNum);
    if (ENABLE_HIANIME_PROVIDER)    fetchers.hianime    = () => getHiAnimeStreams(tmdbId, tmdbType, seasonNum, episodeNum);
    if (ENABLE_MOVIEBOX_PROVIDER)   fetchers.moviebox   = () => getMovieBoxStreams(tmdbId, tmdbType, seasonNum, episodeNum);
    if (ENABLE_MOVIESDRIVE_PROVIDER)fetchers.moviesdrive= () => getMoviesDriveStreams(tmdbId, tmdbType, seasonNum, episodeNum);
    if (ENABLE_NETMIRROR_PROVIDER)  fetchers.netmirror  = () => getNetMirrorStreams(tmdbId, tmdbType, seasonNum, episodeNum);
    if (ENABLE_STREAMFLIX_PROVIDER) fetchers.streamflix = () => getStreamFlixStreams(tmdbId, tmdbType, seasonNum, episodeNum);
    if (ENABLE_VIDLINK_PROVIDER)    fetchers.vidlink    = () => getVidLinkStreams(tmdbId, tmdbType, seasonNum, episodeNum);
    if (ENABLE_XDMOVIES_PROVIDER)   fetchers.xdmovies   = () => getXDMoviesStreams(tmdbId, tmdbType, seasonNum, episodeNum);

    const results = await Promise.allSettled(
        Object.entries(fetchers).map(async ([name, fn]) => {
            if (!shouldFetch(name)) return { name, streams: [] };

            const cached = await getStreamFromCache(name, tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return { name, streams: cached };

            try {
                const streams = await fn();
                await saveStreamToCache(name, tmdbType, tmdbId, streams, 'ok', seasonNum, episodeNum);
                return { name, streams: streams || [] };
            } catch (err) {
                console.error(`[${name}] error:`, err.message);
                await saveStreamToCache(name, tmdbType, tmdbId, [], 'failed', seasonNum, episodeNum);
                return { name, streams: [] };
            }
        })
    );

    let allStreams = [];

    const providerPriority = [
        'castle', 'moviebox', 'hdhub4u', 'xdmovies', 'streamflix',
        'vidlink', 'moviesdrive', 'netmirror', 'hianime'
    ];

    for (const prio of providerPriority) {
        const res = results.find(r => r.status === 'fulfilled' && r.value?.name === prio);
        if (res?.value?.streams?.length > 0) {
            allStreams.push(
                ...res.value.streams.map(s => ({ ...s, provider: prio }))
            );
        }
    }

    // Format for Stremio
    const streams = allStreams.map(s => {
        let name = `${s.provider} • ${s.quality || '?'}`;
        let title = s.title || `${s.provider} - ${s.quality || '?'}`;

        if (s.size && s.size !== 'Unknown') {
            title += `\n${s.size}`;
        }

        const obj = {
            name,
            title,
            url: s.url,
            type: s.type || 'url',
            availability: 2,
            behaviorHints: {
                notWebReady: true
            }
        };

        if (s.headers) {
            obj.behaviorHints.headers = s.headers;
            obj.behaviorHints.proxyHeaders = { request: s.headers };
        }

        return obj;
    });

    return { streams };
});

module.exports = builder.getInterface();
