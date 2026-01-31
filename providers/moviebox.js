// MovieBox Scraper for Nuvio
// Optimized for speed with caching and parallelization

const CryptoJS = require('crypto-js');

const HEADERS = {
    'User-Agent': 'com.community.mbox.in/50020042 (Linux; U; Android 16; en_IN; sdk_gphone64_x86_64; Build/BP22.250325.006; Cronet/133.0.6876.3)',
    'Connection': 'keep-alive',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-client-info': '{"package_name":"com.community.mbox.in","version_name":"3.0.03.0529.03","version_code":50020042,"os":"android","os_version":"16","device_id":"da2b99c821e6ea023e4be55b54d5f7d8","install_store":"ps","gaid":"d7578036d13336cc","brand":"google","model":"sdk_gphone64_x86_64","system_language":"en","net":"NETWORK_WIFI","region":"IN","timezone":"Asia/Calcutta","sp_code":""}',
    'x-client-status': '0'
};

const API_BASE = "https://api.inmoviebox.com";

// Key Derivation using CryptoJS (Double Decode)
const KEY_B64_DEFAULT = "NzZpUmwwN3MweFNOOWpxbUVXQXQ3OUVCSlp1bElRSXNWNjRGWnIyTw==";
const KEY_B64_ALT = "WHFuMm5uTzQxL0w5Mm8xaXVYaFNMSFRiWHZZNFo1Wlo2Mm04bVNMQQ==";

const SECRET_KEY_DEFAULT = CryptoJS.enc.Base64.parse(
    CryptoJS.enc.Base64.parse(KEY_B64_DEFAULT).toString(CryptoJS.enc.Utf8)
);
const SECRET_KEY_ALT = CryptoJS.enc.Base64.parse(
    CryptoJS.enc.Base64.parse(KEY_B64_ALT).toString(CryptoJS.enc.Utf8)
);

// In-memory Cache
const movieboxCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Helpers
function md5(input) {
    return CryptoJS.MD5(input).toString(CryptoJS.enc.Hex);
}

function hmacMd5(key, data) {
    return CryptoJS.HmacMD5(data, key).toString(CryptoJS.enc.Base64);
}

function generateXClientToken(timestamp) {
    const ts = (timestamp || Date.now()).toString();
    const reversed = ts.split('').reverse().join('');
    const hash = md5(reversed);
    return `${ts},${hash}`;
}

function buildCanonicalString(method, accept, contentType, url, body, timestamp) {
    let path = "";
    let query = "";

    try {
        const urlObj = new URL(url);
        path = urlObj.pathname;
        const params = Array.from(urlObj.searchParams.keys()).sort();
        if (params.length > 0) {
            query = params.map(key => {
                const values = urlObj.searchParams.getAll(key);
                return values.map(val => `${key}=${val}`).join('&');
            }).join('&');
        }
    } catch (e) {
        console.error("Invalid URL for canonical:", url);
    }

    const canonicalUrl = query ? `${path}?${query}` : path;

    let bodyHash = "";
    let bodyLength = "";

    if (body) {
        const bodyWords = CryptoJS.enc.Utf8.parse(body);
        const totalBytes = bodyWords.sigBytes;
        bodyHash = md5(bodyWords);
        bodyLength = totalBytes.toString();
    }

    return `${method.toUpperCase()}\n` +
        `${accept || ""}\n` +
        `${contentType || ""}\n` +
        `${bodyLength}\n` +
        `${timestamp}\n` +
        `${bodyHash}\n` +
        canonicalUrl;
}

function generateXTrSignature(method, accept, contentType, url, body, useAltKey = false, customTimestamp = null) {
    const timestamp = customTimestamp || Date.now();
    const canonical = buildCanonicalString(method, accept, contentType, url, body, timestamp);
    const secret = useAltKey ? SECRET_KEY_ALT : SECRET_KEY_DEFAULT;
    const signatureB64 = hmacMd5(secret, canonical);
    return `${timestamp}|2|${signatureB64}`;
}

async function request(method, url, body = null, customHeaders = {}) {
    const timestamp = Date.now();
    const xClientToken = generateXClientToken(timestamp);
    let headerContentType = customHeaders['Content-Type'] || 'application/json';
    const accept = customHeaders['Accept'] || 'application/json';
    const xTrSignature = generateXTrSignature(method, accept, headerContentType, url, body, false, timestamp);

    const headers = {
        'Accept': accept,
        'Content-Type': headerContentType,
        'x-client-token': xClientToken,
        'x-tr-signature': xTrSignature,
        'User-Agent': HEADERS['User-Agent'],
        'x-client-info': HEADERS['x-client-info'],
        'x-client-status': HEADERS['x-client-status'],
        ...customHeaders
    };

    const options = { method, headers };
    if (body) options.body = body;

    try {
        const res = await fetch(url, options);
        if (!res.ok) return null;
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            return text;
        }
    } catch (err) {
        return null;
    }
}

function normalizeTitle(s) {
    if (!s) return "";
    return s.replace(/\[.*?\]/g, " ")
        .replace(/\(.*?\)/g, " ")
        .replace(/\b(dub|dubbed|hd|4k|hindi|tamil|telugu|dual audio)\b/gi, " ")
        .trim()
        .toLowerCase()
        .replace(/:/g, " ")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ");
}

async function searchMovieBox(query) {
    const cacheKey = `search_${query}`;
    const cached = movieboxCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return cached.data;

    const url = `${API_BASE}/wefeed-mobile-bff/subject-api/search/v2`;
    const body = `{"page": 1, "perPage": 10, "keyword": "${query}"}`;

    const res = await request('POST', url, body);
    if (res && res.data && res.data.results) {
        let allSubjects = [];
        res.data.results.forEach(group => {
            if (group.subjects) allSubjects = allSubjects.concat(group.subjects);
        });
        movieboxCache.set(cacheKey, { data: allSubjects, timestamp: Date.now() });
        return allSubjects;
    }
    return [];
}

function findBestMatch(subjects, tmdbTitle, tmdbYear, mediaType) {
    const normTmdbTitle = normalizeTitle(tmdbTitle);
    const targetType = mediaType === 'movie' ? 1 : 2;

    let bestMatch = null;
    let bestScore = 0;

    for (const subject of subjects) {
        if (subject.subjectType !== targetType) continue;

        const title = subject.title;
        const normTitle = normalizeTitle(title);
        const year = subject.year || (subject.releaseDate ? subject.releaseDate.substring(0, 4) : null);

        let score = 0;
        if (normTitle === normTmdbTitle) score += 50;
        else if (normTitle.includes(normTmdbTitle) || normTmdbTitle.includes(normTitle)) score += 15;

        if (tmdbYear && year && tmdbYear == year) score += 35;

        if (score > bestScore) {
            bestScore = score;
            bestMatch = subject;
        }
    }

    return bestScore >= 40 ? bestMatch : null;
}

async function getStreamLinks(subjectId, season = 0, episode = 0, mediaTitle = '', mediaType = 'movie') {
    const cacheKey = `links_${subjectId}_${season}_${episode}`;
    const cached = movieboxCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) return cached.data;

    const subjectUrl = `${API_BASE}/wefeed-mobile-bff/subject-api/get?subjectId=${subjectId}`;
    const subjectRes = await request('GET', subjectUrl);
    if (!subjectRes || !subjectRes.data) return [];

    const subjectIds = [];
    let originalLang = "Original";
    const dubs = subjectRes.data.dubs;
    if (Array.isArray(dubs)) {
        dubs.forEach(dub => {
            if (dub.subjectId == subjectId) {
                originalLang = dub.lanName || "Original";
            } else {
                // Only include Hindi dubs
                const lang = (dub.lanName || "").toLowerCase();
                if (lang.includes('hindi')) {
                    subjectIds.push({ id: dub.subjectId, lang: dub.lanName });
                }
            }
        });
    }
    // Always include original audio first
    subjectIds.unshift({ id: subjectId, lang: originalLang });

    const promises = subjectIds.map(async (item) => {
        const playUrl = `${API_BASE}/wefeed-mobile-bff/subject-api/play-info?subjectId=${item.id}&se=${season}&ep=${episode}`;
        const playRes = await request('GET', playUrl);
        const streams = [];
        if (playRes && playRes.data && playRes.data.streams) {
            playRes.data.streams.forEach(stream => {
                if (stream.url) {
                    const qualityField = stream.resolutions || stream.quality || 'Auto';
                    let candidates = Array.isArray(qualityField) ? qualityField :
                        (typeof qualityField === 'string' ? qualityField.split(',').map(s => s.trim()) : [qualityField]);

                    const parseQ = (v) => {
                        const m = String(v || '').match(/(\d{3,4})/);
                        return m ? parseInt(m[1], 10) : 0;
                    };

                    const maxQ = candidates.reduce((m, v) => Math.max(m, parseQ(v)), 0);
                    const quality = maxQ ? `${maxQ}p` : (candidates[0] || 'Auto');

                    const u = stream.url.toLowerCase();
                    const formatType = u.includes('.mpd') ? 'DASH' : (u.includes('.m3u8') ? 'HLS' : (u.includes('.mp4') ? 'MP4' : (u.includes('.mkv') ? 'MKV' : 'VIDEO')));

                    streams.push({
                        name: `MovieBox (${item.lang}) ${quality} [${formatType}]`,
                        title: (mediaType === 'tv' && season > 0 && episode > 0) ? `${mediaTitle} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}` : (mediaTitle || 'Stream'),
                        url: stream.url,
                        quality,
                        headers: {
                            "Referer": API_BASE,
                            "User-Agent": HEADERS['User-Agent'],
                            ...(stream.signCookie ? { "Cookie": stream.signCookie } : {})
                        },
                        provider: 'MovieBox'
                    });
                }
            });
        }
        return streams;
    });

    const results = await Promise.all(promises);
    const flat = results.flat();

    flat.sort((a, b) => {
        const parseQ = (v) => parseInt(String(v || '').match(/(\d+)/)?.[1] || 0, 10);
        const qDiff = parseQ(b.quality) - parseQ(a.quality);
        if (qDiff !== 0) return qDiff;

        const rank = (u) => {
            const l = u.toLowerCase();
            if (l.includes('.mpd')) return 3;
            if (l.includes('.m3u8')) return 2;
            return 1;
        };
        return rank(b.url) - rank(a.url);
    });

    movieboxCache.set(cacheKey, { data: flat, timestamp: Date.now() });
    return flat;
}

/**
 * getStreams - Optimized version
 * @param {string} tmdbId 
 * @param {string} mediaType 
 * @param {number} seasonNum 
 * @param {number} episodeNum 
 * @param {object} preFetchedDetails - Optional: { title, year, originalTitle }
 */
async function getStreams(tmdbId, mediaType, seasonNum = 1, episodeNum = 1, preFetchedDetails = null) {
    let details = preFetchedDetails;

    if (!details) {
        // Fallback to fetching TMDB details if not provided
        const TMDB_API_KEY = 'd131017ccc6e5462a81c9304d21476de';
        const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            details = {
                title: mediaType === 'movie' ? (data.title || data.original_title) : (data.name || data.original_name),
                year: (data.release_date || data.first_air_date || '').substring(0, 4),
                originalTitle: data.original_title || data.original_name
            };
        } catch (e) {
            return [];
        }
    }

    if (!details) return [];

    // Parallel search for title and original title
    const searchQueries = [details.title];
    if (details.originalTitle && details.originalTitle !== details.title) {
        searchQueries.push(details.originalTitle);
    }

    const searchPromises = searchQueries.map(q => searchMovieBox(q));
    const searchResults = await Promise.all(searchPromises);
    const allSubjects = searchResults.flat();

    const bestMatch = findBestMatch(allSubjects, details.title, details.year, mediaType) ||
        (details.originalTitle ? findBestMatch(allSubjects, details.originalTitle, details.year, mediaType) : null);

    if (bestMatch) {
        const s = (mediaType === 'tv') ? seasonNum : 0;
        const e = (mediaType === 'tv') ? episodeNum : 0;
        return getStreamLinks(bestMatch.subjectId, s, e, details.title, mediaType);
    }

    return [];
}

module.exports = { getStreams };
