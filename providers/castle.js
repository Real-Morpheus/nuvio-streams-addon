const fetch = require('node-fetch');
// Castle Scraper for Nuvio Local Scrapers
// Updated: merged with compiled plugin (2025-12-31) improvements
// React Native compatible - Promise-based approach only
// Extracts streaming links using TMDB ID for Castle API with AES-CBC decryption

// ─── Constants ───────────────────────────────────────────────────────────────

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const CASTLE_BASE = 'https://api.fstcy.com';
const PKG = 'com.external.castle';
const CHANNEL = 'IndiaA';
const CLIENT = '1';
const LANG = 'en-US';

// Updated from plugin: renamed WORKING_HEADERS → API_HEADERS (matches compiled source)
const API_HEADERS = {
    'User-Agent': 'okhttp/4.9.3',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'Keep-Alive',
    'Referer': CASTLE_BASE
};

const PLAYBACK_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'video',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
    'DNT': '1'
};

// ─── Utils ────────────────────────────────────────────────────────────────────
// Updated from plugin: getQualityValue now uses a map lookup first (faster),
// formatSize and resolutionToQuality extracted into dedicated helpers

function getQualityValue(quality) {
    if (!quality) return 0;

    const cleanQuality = quality.toString().toLowerCase()
        .replace(/^(sd|hd|fhd|uhd|4k)\s*/i, '')
        .replace(/p$/, '')
        .trim();

    // Plugin improvement: map lookup before parseInt (cleaner and faster)
    const qualityMap = {
        '4k':   2160,
        '2160': 2160,
        '1440': 1440,
        '1080': 1080,
        '720':  720,
        '480':  480,
        '360':  360,
        '240':  240
    };
    if (qualityMap[cleanQuality]) return qualityMap[cleanQuality];

    const numQuality = parseInt(cleanQuality);
    if (!isNaN(numQuality) && numQuality > 0) return numQuality;

    return 0;
}

// Plugin improvement: dedicated formatSize helper (replaces inline ternary in addon)
function formatSize(sizeValue) {
    if (typeof sizeValue !== 'number' || sizeValue <= 0) return 'Unknown';
    if (sizeValue > 1000000000) return `${(sizeValue / 1000000000).toFixed(2)} GB`;
    return `${(sizeValue / 1000000).toFixed(0)} MB`;
}

// Plugin improvement: dedicated resolutionToQuality helper (replaces inline qualityMap in addon)
function resolutionToQuality(resolution) {
    const qualityMap = {
        1: '480p',
        2: '720p',
        3: '1080p'
    };
    return qualityMap[resolution] || `${resolution}p`;
}

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────
// Updated from plugin: options.body passed directly (no timeout option — cleaner)

function makeRequest(url, options = {}) {
    return fetch(url, {
        method: options.method || 'GET',
        headers: Object.assign({}, API_HEADERS, options.headers),
        body: options.body
    }).then(function (response) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
    }).catch(function (error) {
        console.error(`[Castle] Request failed for ${url}: ${error.message}`);
        throw error;
    });
}

// Unchanged from both — extracts cipher string from raw or JSON-wrapped response
function extractCipherFromResponse(response) {
    return response.text().then(function (text) {
        const trimmed = text.trim();
        if (!trimmed) {
            throw new Error('Empty response');
        }
        try {
            const json = JSON.parse(trimmed);
            if (json && json.data && typeof json.data === 'string') {
                return json.data.trim();
            }
        } catch (e) {
            // Not JSON — treat as raw base64
        }
        return trimmed;
    });
}

// Unchanged from both
function extractDataBlock(obj) {
    if (obj && obj.data && typeof obj.data === 'object') {
        return obj.data;
    }
    return obj || {};
}

// ─── Decryption ───────────────────────────────────────────────────────────────
// Updated from plugin: removed extra .catch wrapper — errors propagate naturally

function decryptCastle(encryptedB64, securityKeyB64) {
    console.log('[Castle] Starting AES-CBC decryption...');

    return fetch('https://aesdec.nuvioapp.space/decrypt-castle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            encryptedData: encryptedB64,
            securityKey: securityKeyB64
        })
    }).then(function (response) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }).then(function (data) {
        if (data.error) throw new Error(data.error);
        console.log('[Castle] Decryption successful');
        return data.decrypted;
    });
}

// ─── TMDB ─────────────────────────────────────────────────────────────────────

function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;

    return makeRequest(url).then(function (response) {
        return response.json();
    }).then(function (data) {
        const title = mediaType === 'tv' ? data.name : data.title;
        const releaseDate = mediaType === 'tv' ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;
        return { title, year, tmdbId };
    });
}

// ─── Castle API ───────────────────────────────────────────────────────────────

function getSecurityKey() {
    console.log('[Castle] Fetching security key...');
    const url = `${CASTLE_BASE}/v0.1/system/getSecurityKey/1?channel=${CHANNEL}&clientType=${CLIENT}&lang=${LANG}`;

    return makeRequest(url).then(function (response) {
        return response.json();
    }).then(function (data) {
        if (data.code !== 200 || !data.data) {
            throw new Error(`Security key API error: ${JSON.stringify(data)}`);
        }
        console.log('[Castle] Security key obtained');
        return data.data;
    });
}

function searchCastle(securityKey, keyword, page, size) {
    page = page || 1;
    size = size || 30;
    console.log(`[Castle] Searching for: ${keyword}`);

    const params = new URLSearchParams({
        channel: CHANNEL,
        clientType: CLIENT,
        keyword: keyword,
        lang: LANG,
        mode: '1',
        packageName: PKG,
        page: page.toString(),
        size: size.toString()
    });
    const url = `${CASTLE_BASE}/film-api/v1.1.0/movie/searchByKeyword?${params.toString()}`;

    return makeRequest(url)
        .then(extractCipherFromResponse)
        .then(function (cipher) { return decryptCastle(cipher, securityKey); })
        .then(JSON.parse);
}

function getDetails(securityKey, movieId) {
    console.log(`[Castle] Fetching details for movieId: ${movieId}`);
    const url = `${CASTLE_BASE}/film-api/v1.1/movie?channel=${CHANNEL}&clientType=${CLIENT}&lang=${LANG}&movieId=${movieId}&packageName=${PKG}`;

    return makeRequest(url)
        .then(extractCipherFromResponse)
        .then(function (cipher) { return decryptCastle(cipher, securityKey); })
        .then(JSON.parse);
}

// Updated from plugin: body passed as JSON string directly (no timeout option)
function getVideo2(securityKey, movieId, episodeId, resolution) {
    resolution = resolution || 2;
    console.log(`[Castle] Fetching video (v2) for movieId: ${movieId}, episodeId: ${episodeId}`);

    const url = `${CASTLE_BASE}/film-api/v2.0.1/movie/getVideo2?clientType=${CLIENT}&packageName=${PKG}&channel=${CHANNEL}&lang=${LANG}`;
    const body = {
        mode: '1',
        appMarket: 'GuanWang',
        clientType: '1',
        woolUser: 'false',
        apkSignKey: 'ED0955EB04E67A1D9F3305B95454FED485261475',
        androidVersion: '13',
        movieId: movieId,
        episodeId: episodeId,
        isNewUser: 'true',
        resolution: resolution.toString(),
        packageName: PKG
    };

    return makeRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
        .then(extractCipherFromResponse)
        .then(function (cipher) { return decryptCastle(cipher, securityKey); })
        .then(JSON.parse);
}

function getVideoV1(securityKey, movieId, episodeId, languageId, resolution) {
    resolution = resolution || 2;
    console.log(`[Castle] Fetching video (v1) for movieId: ${movieId}, episodeId: ${episodeId}, languageId: ${languageId}`);

    const params = new URLSearchParams({
        apkSignKey: 'ED0955EB04E67A1D9F3305B95454FED485261475',
        channel: CHANNEL,
        clientType: CLIENT,
        episodeId: episodeId.toString(),
        lang: LANG,
        languageId: languageId.toString(),
        mode: '1',
        movieId: movieId.toString(),
        packageName: PKG,
        resolution: resolution.toString()
    });
    const url = `${CASTLE_BASE}/film-api/v1.9.1/movie/getVideo?${params.toString()}`;

    return makeRequest(url)
        .then(extractCipherFromResponse)
        .then(function (cipher) { return decryptCastle(cipher, securityKey); })
        .then(JSON.parse);
}

function findCastleMovieId(securityKey, tmdbInfo) {
    const searchTerm = tmdbInfo.year
        ? `${tmdbInfo.title} ${tmdbInfo.year}`
        : tmdbInfo.title;

    return searchCastle(securityKey, searchTerm).then(function (searchResult) {
        const data = extractDataBlock(searchResult);
        const rows = data.rows || [];

        if (rows.length === 0) {
            throw new Error('No search results found');
        }

        for (var i = 0; i < rows.length; i++) {
            var item = rows[i];
            var itemTitle = (item.title || item.name || '').toLowerCase();
            var searchTitle = tmdbInfo.title.toLowerCase();
            if (itemTitle.includes(searchTitle) || searchTitle.includes(itemTitle)) {
                var id = item.id || item.redirectId || item.redirectIdStr;
                if (id) {
                    console.log(`[Castle] Found match: ${item.title || item.name} (id: ${id})`);
                    return id.toString();
                }
            }
        }

        // Fallback to first result
        var first = rows[0];
        var movieId = first.id || first.redirectId || first.redirectIdStr;
        if (movieId) {
            console.log(`[Castle] Using first result: ${first.title || first.name} (id: ${movieId})`);
            return movieId.toString();
        }

        throw new Error('Could not extract movie ID from search results');
    });
}

// ─── Stream Processing ────────────────────────────────────────────────────────
// Updated from plugin: uses formatSize() and resolutionToQuality() helpers

function processVideoResponse(videoData, mediaInfo, seasonNum, episodeNum, resolution, languageInfo) {
    const streams = [];
    const data = extractDataBlock(videoData);
    const videoUrl = data.videoUrl;

    if (!videoUrl) {
        console.log('[Castle] No videoUrl found in response');
        return streams;
    }

    // Build media title
    let mediaTitle = mediaInfo.title || 'Unknown';
    if (mediaInfo.year) mediaTitle += ` (${mediaInfo.year})`;
    if (seasonNum && episodeNum) {
        mediaTitle = `${mediaInfo.title} S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`;
    }

    const quality = resolutionToQuality(resolution); // Plugin improvement: uses helper

    if (data.videos && Array.isArray(data.videos)) {
        data.videos.forEach(function (video) {
            let videoQuality = video.resolutionDescription || video.resolution || quality;
            videoQuality = videoQuality.replace(/^(SD|HD|FHD)\s+/i, '');

            const streamName = languageInfo
                ? `Castle ${languageInfo} - ${videoQuality}`
                : `Castle - ${videoQuality}`;

            streams.push({
                name: streamName,
                title: mediaTitle,
                url: video.url || videoUrl,
                quality: videoQuality,
                size: formatSize(video.size), // Plugin improvement: uses formatSize()
                headers: PLAYBACK_HEADERS,
                provider: 'castle'
            });
        });
    } else {
        const streamName = languageInfo
            ? `Castle ${languageInfo} - ${quality}`
            : `Castle - ${quality}`;

        streams.push({
            name: streamName,
            title: mediaTitle,
            url: videoUrl,
            quality: quality,
            size: formatSize(data.size), // Plugin improvement: uses formatSize()
            headers: PLAYBACK_HEADERS,
            provider: 'castle'
        });
    }

    return streams;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────
// Updated from plugin:
//   - Uses currentMovieId (tracks season-specific movieId correctly)
//   - Language loop uses for-of style logic (sequential via chained promises)
//   - Cleaner try/catch structure at top level

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    console.log(`[Castle] Starting extraction for TMDB ID: ${tmdbId}, Type: ${mediaType}${mediaType === 'tv' ? `, S:${seasonNum}E:${episodeNum}` : ''}`);

    return new Promise(function (resolve) {

        // Step 1: TMDB details
        getTMDBDetails(tmdbId, mediaType)
            .then(function (tmdbInfo) {
                console.log(`[Castle] TMDB Info: "${tmdbInfo.title}" (${tmdbInfo.year || 'N/A'})`);
                return getSecurityKey().then(function (securityKey) {
                    return { tmdbInfo, securityKey };
                });
            })

            // Step 2: Find Castle movie ID
            .then(function (ctx) {
                return findCastleMovieId(ctx.securityKey, ctx.tmdbInfo).then(function (movieId) {
                    return Object.assign({}, ctx, { movieId });
                });
            })

            // Step 3: Fetch details (may switch to season-specific movieId)
            .then(function (ctx) {
                return getDetails(ctx.securityKey, ctx.movieId).then(function (details) {
                    return Object.assign({}, ctx, { details, currentMovieId: ctx.movieId });
                });
            })

            // Step 4: Resolve season movieId for TV shows
            .then(function (ctx) {
                if (mediaType === 'tv' && seasonNum && episodeNum) {
                    var data = extractDataBlock(ctx.details);
                    var seasons = data.seasons || [];
                    var season = seasons.find(function (s) { return s.number === seasonNum; });

                    if (season && season.movieId && season.movieId.toString() !== ctx.movieId) {
                        console.log(`[Castle] Fetching season ${seasonNum} details...`);
                        return getDetails(ctx.securityKey, season.movieId.toString())
                            .then(function (seasonDetails) {
                                // Plugin improvement: currentMovieId tracks the season-level movieId
                                return Object.assign({}, ctx, {
                                    details: seasonDetails,
                                    currentMovieId: season.movieId.toString()
                                });
                            });
                    }
                }
                return ctx;
            })

            // Step 5: Resolve episode ID
            .then(function (ctx) {
                var data = extractDataBlock(ctx.details);
                var episodes = data.episodes || [];

                var episodeId = null;
                if (mediaType === 'tv' && seasonNum && episodeNum) {
                    var ep = episodes.find(function (e) { return e.number === episodeNum; });
                    if (ep && ep.id) episodeId = ep.id.toString();
                } else if (episodes.length > 0) {
                    episodeId = episodes[0].id.toString();
                }

                if (!episodeId) throw new Error('Could not find episode ID');

                var episode = episodes.find(function (e) { return e.id.toString() === episodeId; });
                var tracks = (episode && episode.tracks) || [];

                return Object.assign({}, ctx, { episodeId, episodes, tracks });
            })

            // Step 6: Fetch per-language streams, then fallback to shared v2
            .then(function (ctx) {
                var resolution = 2; // 720p default
                var allStreams = [];

                // Plugin improvement: simpler sequential loop using reduce
                var languageChain = ctx.tracks.reduce(function (chain, track) {
                    return chain.then(function () {
                        var langName = track.languageName || track.abbreviate || 'Unknown';

                        if (!track.existIndividualVideo || !track.languageId) {
                            console.log(`[Castle] ⏭️  ${langName}: No individual video`);
                            return;
                        }

                        console.log(`[Castle] Fetching ${langName} (languageId: ${track.languageId})`);
                        return getVideoV1(ctx.securityKey, ctx.currentMovieId, ctx.episodeId, track.languageId, resolution)
                            .then(function (videoData) {
                                var langStreams = processVideoResponse(
                                    videoData, ctx.tmdbInfo, seasonNum, episodeNum,
                                    resolution, `[${langName}]`
                                );
                                if (langStreams.length > 0) {
                                    console.log(`[Castle] ✅ ${langName}: Found ${langStreams.length} streams`);
                                    allStreams.push.apply(allStreams, langStreams);
                                } else {
                                    console.log(`[Castle] ⚠️  ${langName}: No streams returned`);
                                }
                            })
                            .catch(function (err) {
                                console.log(`[Castle] ⚠️  ${langName}: Failed - ${err.message}`);
                            });
                    });
                }, Promise.resolve());

                return languageChain.then(function () {
                    if (allStreams.length > 0) return allStreams;

                    // Plugin improvement: cleaner fallback block
                    console.log('[Castle] Falling back to shared stream (v2)');
                    return getVideo2(ctx.securityKey, ctx.currentMovieId, ctx.episodeId, resolution)
                        .then(function (videoData) {
                            return processVideoResponse(
                                videoData, ctx.tmdbInfo, seasonNum, episodeNum,
                                resolution, '[Shared]'
                            );
                        });
                });
            })

            .then(function (streams) {
                // Sort highest quality first
                streams.sort(function (a, b) {
                    return getQualityValue(b.quality) - getQualityValue(a.quality);
                });
                console.log(`[Castle] Total streams found: ${streams.length}`);
                resolve(streams);
            })

            .catch(function (error) {
                console.error(`[Castle] Error: ${error.message}`);
                resolve([]); // Always resolve with empty array for Nuvio compatibility
            });
    });
}

// ─── Export ───────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
