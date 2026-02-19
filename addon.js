// ================================================================================
// Nuvio Streams Addon for Stremio – Limited to requested providers only
// Providers kept: Castle, Hdhub4u, Hianime, MovieBox, Moviesdrive, Netmirror, Streamflix, Vidlink, Xdmovies
// ================================================================================

const { addonBuilder } = require('stremio-addon-sdk');
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Redis = require('ioredis');
const axios = require('axios');

const USE_REDIS_CACHE = process.env.USE_REDIS_CACHE === 'true';
let redis = null;
let redisKeepAliveInterval = null;

if (USE_REDIS_CACHE) {
    try {
        console.log(`[Redis] Initializing Redis (URL present: ${!!process.env.REDIS_URL})`);
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
            console.log('[Redis] Connected successfully');
            if (redisKeepAliveInterval) clearInterval(redisKeepAliveInterval);
            redisKeepAliveInterval = setInterval(() => {
                if (redis && redis.status === 'ready') {
                    redis.ping().catch(e => console.error('[Redis Keep-Alive] Ping failed:', e.message));
                }
            }, 4 * 60 * 1000);
        });

        redis.on('reconnecting', delay => console.warn(`[Redis] Reconnecting in ${delay}ms`));
        redis.on('close', () => console.warn('[Redis] Connection closed'));
        redis.on('end', () => console.error('[Redis] Connection ended'));
        redis.on('ready', () => console.log('[Redis] Ready for commands'));

    } catch (err) {
        console.error(`[Redis] Failed to init: ${err.message} → falling back to file cache`);
        redis = null;
    }
}

// Provider enable flags (only the 9 you want)
const ENABLE_CASTLE     = process.env.ENABLE_CASTLE     !== 'false';
const ENABLE_HDHUB4U    = process.env.ENABLE_HDHUB4U    !== 'false';
const ENABLE_HIANIME    = process.env.ENABLE_HIANIME    !== 'false';
const ENABLE_MOVIEBOX   = process.env.ENABLE_MOVIEBOX   !== 'false';
const ENABLE_MOVIESDRIVE= process.env.ENABLE_MOVIESDRIVE!== 'false';
const ENABLE_NETMIRROR  = process.env.ENABLE_NETMIRROR  !== 'false';
const ENABLE_STREAMFLIX = process.env.ENABLE_STREAMFLIX !== 'false';
const ENABLE_VIDLINK    = process.env.ENABLE_VIDLINK    !== 'false';
const ENABLE_XDMOVIES   = process.env.ENABLE_XDMOVIES   !== 'false';

console.log(`[Providers] Castle: ${ENABLE_CASTLE}`);
console.log(`[Providers] HDHub4u: ${ENABLE_HDHUB4U}`);
console.log(`[Providers] HiAnime: ${ENABLE_HIANIME}`);
console.log(`[Providers] MovieBox: ${ENABLE_MOVIEBOX}`);
console.log(`[Providers] MoviesDrive: ${ENABLE_MOVIESDRIVE}`);
console.log(`[Providers] NetMirror: ${ENABLE_NETMIRROR}`);
console.log(`[Providers] StreamFlix: ${ENABLE_STREAMFLIX}`);
console.log(`[Providers] VidLink: ${ENABLE_VIDLINK}`);
console.log(`[Providers] XDMovies: ${ENABLE_XDMOVIES}`);

// Cache settings
const STREAM_CACHE_DIR = process.env.VERCEL ? path.join('/tmp', '.streams_cache') : path.join(__dirname, '.streams_cache');
const STREAM_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const ENABLE_STREAM_CACHE = process.env.DISABLE_STREAM_CACHE !== 'true';
console.log(`[Cache] Stream caching ${ENABLE_STREAM_CACHE ? 'enabled' : 'disabled'}`);
console.log(`[Cache] Redis ${redis ? 'available' : 'not available'}`);

// Load only the requested providers
const { getStreams: getCastleStreams }     = require('./providers/castle.js');
const { getStreams: getHDHub4uStreams }    = require('./providers/hdhub4u.js');
const { getStreams: getHiAnimeStreams }    = require('./providers/hianime.js');
const { getStreams: getMovieBoxStreams }   = require('./providers/moviebox.js');
const { getMoviesDriveStreams }            = require('./providers/moviesdrive.js');
const { getStreams: getNetMirrorStreams }  = require('./providers/netmirror.js');
const { getStreams: getStreamFlixStreams } = require('./providers/streamflix.js');
const { getStreams: getVidLinkStreams }    = require('./providers/vidlink.js');
const { getStreams: getXDMoviesStreams }   = require('./providers/xdmovies.js');

const manifest = require('./manifest.json');
const builder = new addonBuilder(manifest);

// ================================================================================
// Helpers (quality parsing, size parsing, filters)
// ================================================================================

function parseQuality(qualityString) {
    if (!qualityString || typeof qualityString !== 'string') return 0;
    const q = qualityString.toLowerCase();
    if (q.includes('4k') || q.includes('2160')) return 2160;
    if (q.includes('1440')) return 1440;
    if (q.includes('1080')) return 1080;
    if (q.includes('720')) return 720;
    if (q.includes('576')) return 576;
    if (q.includes('480')) return 480;
    if (q.includes('org')) return 4320;
    const kbps = q.match(/(\d+)k/);
    if (kbps) return parseInt(kbps[1], 10) / 1000;
    return 0;
}

function parseSize(sizeString) {
    if (!sizeString || typeof sizeString !== 'string') return 0;
    const match = sizeString.match(/([0-9.,]+)\s*(GB|MB|KB)/i);
    if (!match) return 0;
    let val = parseFloat(match[1].replace(/,/g, ''));
    const unit = match[2].toUpperCase();
    if (unit === 'GB') val *= 1024;
    if (unit === 'KB') val /= 1024;
    return val;
}

function filterStreamsByQuality(streams, minQuality, provider) {
    if (!minQuality || minQuality.toLowerCase() === 'all') return streams;
    const minQ = parseQuality(minQuality);
    if (minQ === 0) return streams;
    console.log(`[${provider}] Filtering min quality: \( {minQuality} ( \){minQ})`);
    return streams.filter(s => parseQuality(s.quality) >= minQ);
}

function filterStreamsByCodecs(streams, excludeCodecs, provider) {
    if (!excludeCodecs || Object.keys(excludeCodecs).length === 0) return streams;
    const noDV  = excludeCodecs.excludeDV  === true;
    const noHDR = excludeCodecs.excludeHDR === true;
    if (!noDV && !noHDR) return streams;
    return streams.filter(s => {
        if (!s.codecs || !Array.isArray(s.codecs)) return true;
        if (noDV  && s.codecs.includes('DV')) return false;
        if (noHDR && s.codecs.some(c => c.includes('HDR'))) return false;
        return true;
    });
}

function applyAllStreamFilters(streams, providerName, minQualitySetting, excludeCodecSettings) {
    let filtered = filterStreamsByQuality(streams, minQualitySetting, providerName);
    filtered = filterStreamsByCodecs(filtered, excludeCodecSettings, providerName);
    return filtered;
}

// Cache helpers (get/save) – standard pattern
async function getStreamFromCache(provider, type, id, season = null, episode = null) {
    if (!ENABLE_STREAM_CACHE) return null;
    const key = `streams_\( {provider}_ \){type}_\( {id} \){season ? `_s\( {season}e \){episode}` : ''}`;
    // Redis first
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
        } catch (e) { console.warn(`[Redis] Read fail for ${key}`); }
    }
    // File fallback
    const filePath = path.join(STREAM_CACHE_DIR, `${key}.json`);
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.expiry && Date.now() > parsed.expiry) {
            await fs.unlink(filePath).catch(() => {});
            return null;
        }
        return parsed.streams;
    } catch (e) {
        if (e.code !== 'ENOENT') console.warn(`[FileCache] Read fail ${key}: ${e.message}`);
        return null;
    }
}

async function saveStreamToCache(provider, type, id, streams, status = 'ok', season = null, episode = null, ttl = STREAM_CACHE_TTL_MS) {
    if (!ENABLE_STREAM_CACHE) return;
    const key = `streams_\( {provider}_ \){type}_\( {id} \){season ? `_s\( {season}e \){episode}` : ''}`;
    const data = { streams, status, expiry: Date.now() + ttl, timestamp: Date.now() };

    // Redis
    if (redis) {
        try {
            await redis.set(key, JSON.stringify(data), 'PX', ttl);
            return;
        } catch (e) { console.warn(`[Redis] Write fail ${key}`); }
    }
    // File
    const filePath = path.join(STREAM_CACHE_DIR, `${key}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
    } catch (e) {
        console.warn(`[FileCache] Write fail ${key}: ${e.message}`);
    }
}

// ================================================================================
// Stream Handler
// ================================================================================

builder.defineStreamHandler(async (args) => {
    const { type, id, config: sdkConfig } = args;
    const requestConfig = global.currentRequestConfig || sdkConfig || {};

    if (!['movie', 'series', 'tv'].includes(type)) return { streams: [] };

    const minQualities = requestConfig.minQualities || {};
    const excludeCodecs = requestConfig.excludeCodecs || {};
    const selectedProviders = requestConfig.providers 
        ? requestConfig.providers.split(',').map(p => p.trim().toLowerCase()) 
        : null;

    const shouldFetch = (prov) => !selectedProviders || selectedProviders.includes(prov.toLowerCase());

    // Parse TMDB / IMDb ID
    let tmdbId, tmdbType, seasonNum = null, episodeNum = null;
    const idParts = id.split(':');

    if (idParts[0] === 'tmdb') {
        tmdbId = idParts[1];
        tmdbType = type === 'movie' ? 'movie' : 'tv';
        if (idParts.length >= 4) {
            seasonNum = parseInt(idParts[2], 10);
            episodeNum = parseInt(idParts[3], 10);
        }
    } else if (id.startsWith('tt')) {
        // TODO: Add IMDb → TMDB conversion if needed in future
        console.log(`IMDb ID received but conversion not implemented: ${id}`);
        return { streams: [] };
    } else {
        return { streams: [] };
    }

    if (!tmdbId || !tmdbType) return { streams: [] };

    // Provider fetch map – only the 9 you want
    const providerFetches = {
        castle: async () => {
            if (!ENABLE_CASTLE || !shouldFetch('castle')) return [];
            const cached = await getStreamFromCache('castle', tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return cached.map(s => ({ ...s, provider: 'Castle' }));

            try {
                const streams = await getCastleStreams(tmdbId, tmdbType, seasonNum, episodeNum);
                await saveStreamToCache('castle', tmdbType, tmdbId, streams, streams.length ? 'ok' : 'failed', seasonNum, episodeNum);
                return streams.map(s => ({ ...s, provider: 'Castle' }));
            } catch (err) {
                console.error(`[Castle] Error: ${err.message}`);
                return [];
            }
        },

        hdhub4u: async () => {
            if (!ENABLE_HDHUB4U || !shouldFetch('hdhub4u')) return [];
            const cached = await getStreamFromCache('hdhub4u', tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return cached.map(s => ({ ...s, provider: 'HDHub4u' }));

            try {
                const streams = await getHDHub4uStreams(tmdbId, tmdbType, seasonNum, episodeNum);
                await saveStreamToCache('hdhub4u', tmdbType, tmdbId, streams, streams.length ? 'ok' : 'failed', seasonNum, episodeNum);
                return streams.map(s => ({ ...s, provider: 'HDHub4u' }));
            } catch (err) {
                console.error(`[HDHub4u] Error: ${err.message}`);
                return [];
            }
        },

        hianime: async () => {
            if (!ENABLE_HIANIME || !shouldFetch('hianime')) return [];
            const cached = await getStreamFromCache('hianime', tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return cached.map(s => ({ ...s, provider: 'HiAnime' }));

            try {
                const streams = await getHiAnimeStreams(tmdbId, tmdbType, seasonNum, episodeNum);
                await saveStreamToCache('hianime', tmdbType, tmdbId, streams, streams.length ? 'ok' : 'failed', seasonNum, episodeNum);
                return streams.map(s => ({ ...s, provider: 'HiAnime' }));
            } catch (err) {
                console.error(`[HiAnime] Error: ${err.message}`);
                return [];
            }
        },

        moviebox: async () => {
            if (!ENABLE_MOVIEBOX || !shouldFetch('moviebox')) return [];
            const cached = await getStreamFromCache('moviebox', tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return cached.map(s => ({ ...s, provider: 'MovieBox' }));

            try {
                const streams = await getMovieBoxStreams(tmdbId, tmdbType, seasonNum, episodeNum);
                await saveStreamToCache('moviebox', tmdbType, tmdbId, streams, streams.length ? 'ok' : 'failed', seasonNum, episodeNum);
                return streams.map(s => ({ ...s, provider: 'MovieBox' }));
            } catch (err) {
                console.error(`[MovieBox] Error: ${err.message}`);
                return [];
            }
        },

        moviesdrive: async () => {
            if (!ENABLE_MOVIESDRIVE || !shouldFetch('moviesdrive')) return [];
            const cached = await getStreamFromCache('moviesdrive', tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return cached.map(s => ({ ...s, provider: 'MoviesDrive' }));

            try {
                const streams = await getMoviesDriveStreams(tmdbId, tmdbType, seasonNum, episodeNum);
                await saveStreamToCache('moviesdrive', tmdbType, tmdbId, streams, streams.length ? 'ok' : 'failed', seasonNum, episodeNum);
                return streams.map(s => ({ ...s, provider: 'MoviesDrive' }));
            } catch (err) {
                console.error(`[MoviesDrive] Error: ${err.message}`);
                return [];
            }
        },

        netmirror: async () => {
            if (!ENABLE_NETMIRROR || !shouldFetch('netmirror')) return [];
            const cached = await getStreamFromCache('netmirror', tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return cached.map(s => ({ ...s, provider: 'NetMirror' }));

            try {
                const streams = await getNetMirrorStreams(tmdbId, tmdbType, seasonNum, episodeNum);
                // NetMirror often needs special proxy/headers handling – adjust if needed
                const processed = streams.map(s => ({
                    ...s,
                    provider: 'NetMirror',
                    behaviorHints: { notWebReady: true, proxyHeaders: { request: s.headers || {} } }
                }));
                await saveStreamToCache('netmirror', tmdbType, tmdbId, processed, processed.length ? 'ok' : 'failed', seasonNum, episodeNum);
                return processed;
            } catch (err) {
                console.error(`[NetMirror] Error: ${err.message}`);
                return [];
            }
        },

        streamflix: async () => {
            if (!ENABLE_STREAMFLIX || !shouldFetch('streamflix')) return [];
            const cached = await getStreamFromCache('streamflix', tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return cached.map(s => ({ ...s, provider: 'StreamFlix' }));

            try {
                const streams = await getStreamFlixStreams(tmdbId, tmdbType, seasonNum, episodeNum);
                await saveStreamToCache('streamflix', tmdbType, tmdbId, streams, streams.length ? 'ok' : 'failed', seasonNum, episodeNum);
                return streams.map(s => ({ ...s, provider: 'StreamFlix' }));
            } catch (err) {
                console.error(`[StreamFlix] Error: ${err.message}`);
                return [];
            }
        },

        vidlink: async () => {
            if (!ENABLE_VIDLINK || !shouldFetch('vidlink')) return [];
            const cached = await getStreamFromCache('vidlink', tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return cached.map(s => ({ ...s, provider: 'VidLink' }));

            try {
                const streams = await getVidLinkStreams(tmdbId, tmdbType, seasonNum, episodeNum);
                await saveStreamToCache('vidlink', tmdbType, tmdbId, streams, streams.length ? 'ok' : 'failed', seasonNum, episodeNum);
                return streams.map(s => ({ ...s, provider: 'VidLink' }));
            } catch (err) {
                console.error(`[VidLink] Error: ${err.message}`);
                return [];
            }
        },

        xdmovies: async () => {
            if (!ENABLE_XDMOVIES || !shouldFetch('xdmovies')) return [];
            const cached = await getStreamFromCache('xdmovies', tmdbType, tmdbId, seasonNum, episodeNum);
            if (cached) return cached.map(s => ({ ...s, provider: 'XDMovies' }));

            try {
                const streams = await getXDMoviesStreams(tmdbId, tmdbType, seasonNum, episodeNum);
                await saveStreamToCache('xdmovies', tmdbType, tmdbId, streams, streams.length ? 'ok' : 'failed', seasonNum, episodeNum);
                return streams.map(s => ({ ...s, provider: 'XDMovies' }));
            } catch (err) {
                console.error(`[XDMovies] Error: ${err.message}`);
                return [];
            }
        }
    };

    console.log(`Fetching streams for ${tmdbType} \( {tmdbId} (s \){seasonNum || '-' }e${episodeNum || '-'})`);

    // Run parallel with timeout
    const PROVIDER_TIMEOUT = 45000; // 45 seconds – adjust if Tor is slow

    const results = await Promise.allSettled(
        Object.entries(providerFetches).map(async ([name, fn]) => {
            try {
                return await Promise.race([
                    fn(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout ${name}`)), PROVIDER_TIMEOUT))
                ]);
            } catch (e) {
                console.warn(`[${name}] Failed or timed out: ${e.message}`);
                return [];
            }
        })
    );

    let combinedStreams = [];
    results.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            combinedStreams.push(...r.value);
        }
    });

    // Final filtering & sorting (global or per-provider if needed)
    combinedStreams = combinedStreams.sort((a, b) => {
        const qa = parseQuality(a.quality || '');
        const qb = parseQuality(b.quality || '');
        return qb - qa; // higher quality first
    });

    // Format for Stremio
    const stremioStreams = combinedStreams.map(stream => {
        let name = `${stream.provider} • ${stream.quality || 'Unknown'}`;
        let title = stream.title || stream.name || `${stream.provider} stream`;

        if (stream.size) title += ` • ${stream.size}`;

        return {
            name,
            title,
            url: stream.url,
            type: stream.type || 'url',
            behaviorHints: {
                notWebReady: true,
                ...(stream.headers && {
                    proxyHeaders: { request: stream.headers }
                })
            },
            ...(stream.headers && { headers: stream.headers })
        };
    });

    if (stremioStreams.length === 0) {
        console.log('No streams found from selected providers');
    } else {
        console.log(`Returning ${stremioStreams.length} formatted streams`);
    }

    return { streams: stremioStreams };
});

module.exports = builder.getInterface();
