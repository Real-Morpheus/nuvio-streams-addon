// ================================================================================
// Nuvio Streams Addon – Limited to 9 providers
// Castle, HDHub4u, HiAnime, MovieBox, MoviesDrive, NetMirror, StreamFlix, VidLink, XDMovies
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
        console.log(`[Redis] Initializing (URL: ${process.env.REDIS_URL ? 'present' : 'missing'})`);
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

        redis.on('error', err => {
            console.error(`[Redis] Error: ${err.message}`);
            if (redisKeepAliveInterval) clearInterval(redisKeepAliveInterval);
        });

        redis.on('connect', () => {
            console.log('[Redis] Connected');
            if (redisKeepAliveInterval) clearInterval(redisKeepAliveInterval);
            redisKeepAliveInterval = setInterval(() => {
                if (redis?.status === 'ready') redis.ping().catch(e => console.error('[Redis KA] Ping fail:', e));
            }, 240000); // 4 minutes
        });

        redis.on('reconnecting', delay => console.warn(`[Redis] Reconnecting in ${delay}ms`));
        redis.on('close', () => console.warn('[Redis] Closed'));
        redis.on('end', () => console.error('[Redis] Ended'));
        redis.on('ready', () => console.log('[Redis] Ready'));

    } catch (err) {
        console.error(`[Redis] Init failed: ${err.message} → file cache only`);
        redis = null;
    }
}

// Provider toggles
const ENABLE_CASTLE      = process.env.ENABLE_CASTLE      !== 'false';
const ENABLE_HDHUB4U     = process.env.ENABLE_HDHUB4U     !== 'false';
const ENABLE_HIANIME     = process.env.ENABLE_HIANIME     !== 'false';
const ENABLE_MOVIEBOX    = process.env.ENABLE_MOVIEBOX    !== 'false';
const ENABLE_MOVIESDRIVE = process.env.ENABLE_MOVIESDRIVE !== 'false';
const ENABLE_NETMIRROR   = process.env.ENABLE_NETMIRROR   !== 'false';
const ENABLE_STREAMFLIX  = process.env.ENABLE_STREAMFLIX  !== 'false';
const ENABLE_VIDLINK     = process.env.ENABLE_VIDLINK     !== 'false';
const ENABLE_XDMOVIES    = process.env.ENABLE_XDMOVIES    !== 'false';

console.log(`Castle: ${ENABLE_CASTLE}, HDHub4u: ${ENABLE_HDHUB4U}, HiAnime: ${ENABLE_HIANIME}`);
console.log(`MovieBox: ${ENABLE_MOVIEBOX}, MoviesDrive: ${ENABLE_MOVIESDRIVE}, NetMirror: ${ENABLE_NETMIRROR}`);
console.log(`StreamFlix: ${ENABLE_STREAMFLIX}, VidLink: ${ENABLE_VIDLINK}, XDMovies: ${ENABLE_XDMOVIES}`);

// Cache config
const STREAM_CACHE_DIR = process.env.VERCEL ? '/tmp/.streams_cache' : path.join(__dirname, '.streams_cache');
const STREAM_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ENABLE_STREAM_CACHE = process.env.DISABLE_STREAM_CACHE !== 'true';
console.log(`Stream cache: ${ENABLE_STREAM_CACHE ? 'enabled' : 'disabled'} | Redis: ${redis ? 'yes' : 'no'}`);

// Load providers
const { getStreams: getCastleStreams }      = require('./providers/castle.js');
const { getStreams: getHDHub4uStreams }     = require('./providers/hdhub4u.js');
const { getStreams: getHiAnimeStreams }     = require('./providers/hianime.js');
const { getStreams: getMovieBoxStreams }    = require('./providers/moviebox.js');
const { getMoviesDriveStreams }             = require('./providers/moviesdrive.js');
const { getStreams: getNetMirrorStreams }   = require('./providers/netmirror.js');
const { getStreams: getStreamFlixStreams }  = require('./providers/streamflix.js');
const { getStreams: getVidLinkStreams }     = require('./providers/vidlink.js');
const { getStreams: getXDMoviesStreams }    = require('./providers/xdmovies.js');

const manifest = require('./manifest.json');
const builder = new addonBuilder(manifest);

// ================================================================================
// Cache helpers – FIXED template literal syntax
// ================================================================================

async function getStreamFromCache(provider, type, id, season = null, episode = null) {
    if (!ENABLE_STREAM_CACHE) return null;

    const key = `streams_\( {provider}_ \){type}_\( {id} \){season !== null && episode !== null ? `_s\( {season}e \){episode}` : ''}`;

    if (redis) {
        try {
            const data = await redis.get(key);
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.expiry && Date.now() > parsed.expiry) {
                    await redis.del(key);
                    return null;
                }
                return parsed.streams;
            }
        } catch (err) {
            console.warn(`[Redis] Read error ${key}: ${err.message}`);
        }
    }

    const filePath = path.join(STREAM_CACHE_DIR, `${key}.json`);
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.expiry && Date.now() > parsed.expiry) {
            await fs.unlink(filePath).catch(() => {});
            return null;
        }
        return parsed.streams;
    } catch (err) {
        if (err.code !== 'ENOENT') console.warn(`[File] Read error ${key}: ${err.message}`);
        return null;
    }
}

async function saveStreamToCache(provider, type, id, streams, status = 'ok', season = null, episode = null, ttl = STREAM_CACHE_TTL_MS) {
    if (!ENABLE_STREAM_CACHE) return;

    const key = `streams_\( {provider}_ \){type}_\( {id} \){season !== null && episode !== null ? `_s\( {season}e \){episode}` : ''}`;

    const data = { streams, status, expiry: Date.now() + ttl, timestamp: Date.now() };

    if (redis) {
        try {
            await redis.set(key, JSON.stringify(data), 'PX', ttl);
            return;
        } catch (err) {
            console.warn(`[Redis] Write error ${key}: ${err.message}`);
        }
    }

    const filePath = path.join(STREAM_CACHE_DIR, `${key}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
    } catch (err) {
        console.warn(`[File] Write error ${key}: ${err.message}`);
    }
}

// ================================================================================
// Helper functions
// ================================================================================

function parseQuality(q) {
    if (!q || typeof q !== 'string') return 0;
    q = q.toLowerCase();
    if (q.includes('4k') || q.includes('2160')) return 2160;
    if (q.includes('1080')) return 1080;
    if (q.includes('720')) return 720;
    if (q.includes('480')) return 480;
    const kb = q.match(/(\d+)k/);
    if (kb) return parseInt(kb[1]) / 1000;
    return 0;
}

function applyFilters(streams, minQuality = 'all', excludeCodecs = {}) {
    let filtered = streams;

    if (minQuality !== 'all') {
        const minQ = parseQuality(minQuality);
        if (minQ > 0) {
            filtered = filtered.filter(s => parseQuality(s.quality) >= minQ);
        }
    }

    if (excludeCodecs.excludeDV || excludeCodecs.excludeHDR) {
        filtered = filtered.filter(s => {
            if (!s.codecs) return true;
            if (excludeCodecs.excludeDV && s.codecs.includes('DV')) return false;
            if (excludeCodecs.excludeHDR && s.codecs.some(c => c.includes('HDR'))) return false;
            return true;
        });
    }

    return filtered;
}

// ================================================================================
// Stream handler
// ================================================================================

builder.defineStreamHandler(async ({ type, id, config }) => {
    const reqConfig = global.currentRequestConfig || config || {};

    if (!['movie', 'series', 'tv'].includes(type)) return { streams: [] };

    const minQualities = reqConfig.minQualities || {};
    const excludeCodecs = reqConfig.excludeCodecs || {};
    const selected = reqConfig.providers
        ? new Set(reqConfig.providers.split(',').map(p => p.trim().toLowerCase()))
        : null;

    const shouldFetch = prov => !selected || selected.has(prov.toLowerCase());

    // Parse ID
    let tmdbId, tmdbType, seasonNum = null, episodeNum = null;
    const parts = id.split(':');

    if (parts[0] === 'tmdb') {
        tmdbId = parts[1];
        tmdbType = type === 'movie' ? 'movie' : 'tv';
        if (parts.length >= 4) {
            seasonNum = parseInt(parts[2], 10);
            episodeNum = parseInt(parts[3], 10);
        }
    } else {
        return { streams: [] }; // add IMDb conversion later if needed
    }

    if (!tmdbId) return { streams: [] };

    const fetches = {
        castle:      async () => shouldFetch('castle')     && ENABLE_CASTLE      ? (await getCastleStreams     (tmdbId, tmdbType, seasonNum, episodeNum) || []).map(s => ({...s, provider: 'Castle'}))      : [],
        hdhub4u:     async () => shouldFetch('hdhub4u')    && ENABLE_HDHUB4U     ? (await getHDHub4uStreams    (tmdbId, tmdbType, seasonNum, episodeNum) || []).map(s => ({...s, provider: 'HDHub4u'}))     : [],
        hianime:     async () => shouldFetch('hianime')    && ENABLE_HIANIME     ? (await getHiAnimeStreams    (tmdbId, tmdbType, seasonNum, episodeNum) || []).map(s => ({...s, provider: 'HiAnime'}))     : [],
        moviebox:    async () => shouldFetch('moviebox')   && ENABLE_MOVIEBOX    ? (await getMovieBoxStreams   (tmdbId, tmdbType, seasonNum, episodeNum) || []).map(s => ({...s, provider: 'MovieBox'}))    : [],
        moviesdrive: async () => shouldFetch('moviesdrive')&& ENABLE_MOVIESDRIVE ? (await getMoviesDriveStreams(tmdbId, tmdbType, seasonNum, episodeNum) || []).map(s => ({...s, provider: 'MoviesDrive'})) : [],
        netmirror:   async () => shouldFetch('netmirror')  && ENABLE_NETMIRROR   ? (await getNetMirrorStreams  (tmdbId, tmdbType, seasonNum, episodeNum) || []).map(s => ({...s, provider: 'NetMirror'}))   : [],
        streamflix:  async () => shouldFetch('streamflix') && ENABLE_STREAMFLIX  ? (await getStreamFlixStreams (tmdbId, tmdbType, seasonNum, episodeNum) || []).map(s => ({...s, provider: 'StreamFlix'}))  : [],
        vidlink:     async () => shouldFetch('vidlink')    && ENABLE_VIDLINK     ? (await getVidLinkStreams    (tmdbId, tmdbType, seasonNum, episodeNum) || []).map(s => ({...s, provider: 'VidLink'}))     : [],
        xdmovies:    async () => shouldFetch('xdmovies')   && ENABLE_XDMOVIES    ? (await getXDMoviesStreams   (tmdbId, tmdbType, seasonNum, episodeNum) || []).map(s => ({...s, provider: 'XDMovies'}))    : [],
    };

    const results = await Promise.allSettled(Object.values(fetches));
    let allStreams = [];

    results.forEach(r => {
        if (r.status === 'fulfilled') {
            allStreams.push(...r.value);
        }
    });

    // Apply per-provider filters if you have different settings per provider
    // For simplicity we apply global here – adjust if needed
    allStreams = applyFilters(allStreams, minQualities.all || 'all', excludeCodecs);

    // Sort by quality (higher first)
    allStreams.sort((a, b) => parseQuality(b.quality || '0') - parseQuality(a.quality || '0'));

    // Format for Stremio
    const stremioStreams = allStreams.map(stream => ({
        name:   `${stream.provider} • ${stream.quality || '?'}`,
        title:  stream.title || stream.name || `${stream.provider} stream`,
        url:    stream.url,
        type:   stream.type || 'url',
        behaviorHints: {
            notWebReady: true,
            ...(stream.headers && { proxyHeaders: { request: stream.headers } })
        },
        ...(stream.headers && { headers: stream.headers })
    }));

    console.log(`Returning ${stremioStreams.length} streams for ${tmdbType} ${tmdbId}`);

    return { streams: stremioStreams };
});

module.exports = builder.getInterface();
