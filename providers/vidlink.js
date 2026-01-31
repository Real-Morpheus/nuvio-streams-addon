/**
 * Vidlink Provider for Nuvio
 * Ported from yoruix/nuvio-providers
 */

const axios = require('axios');
const { execSync } = require('child_process');

// Helper to use curl for the encryption API as a fallback for ECONNRESET
function makeRequestWithCurl(url) {
    try {
        console.log(`[VidLink] Using curl for: ${url}`);
        const output = execSync(`curl -s "${url}"`, { encoding: 'utf8' });
        return JSON.parse(output);
    } catch (error) {
        console.error(`[Vidlink] curl failed: ${error.message}`);
        throw error;
    }
}

// Constants
const TMDB_API_KEY = process.env.TMDB_API_KEY || "68e094699525b18a70bab2f86b1fa706";
const ENC_DEC_API = "https://enc-dec.app/api";
const VIDLINK_API = "https://vidlink.pro/api/b";
const VIDLINK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "Connection": "keep-alive",
    "Referer": "https://vidlink.pro/",
    "Origin": "https://vidlink.pro"
};

const QUALITY_ORDER = {
    "4K": 5,
    "1440p": 4,
    "1080p": 3,
    "720p": 2,
    "480p": 1,
    "360p": 0,
    "240p": -1,
    "Auto": -2,
    "Unknown": -3
};

// Helper function for HTTP requests using axios
async function makeRequest(url, options = {}) {
    const defaultHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "Accept": "application/json,*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive"
    };

    const config = {
        method: options.method || "GET",
        url: url,
        headers: {
            ...defaultHeaders,
            ...options.headers
        },
        timeout: 15000
    };

    try {
        const response = await axios(config);
        return response;
    } catch (error) {
        console.error(`[Vidlink] Request failed for ${url}: ${error.message}`);
        throw error;
    }
}

// TMDB Info helper
async function getTmdbInfo(tmdbId, mediaType) {
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const response = await makeRequest(url);
    const data = response.data;
    const title = mediaType === "tv" ? data.name : data.title;
    const year = mediaType === "tv" ? data.first_air_date?.substring(0, 4) : data.release_date?.substring(0, 4);

    if (!title) {
        throw new Error("Could not extract title from TMDB response");
    }
    console.log(`[Vidlink] TMDB Info: "${title}" (${year})`);
    return { title, year, data };
}

// Encrypt TMDB ID helper
async function encryptTmdbId(tmdbId) {
    console.log(`[Vidlink] Encrypting TMDB ID: ${tmdbId}`);
    const url = `${ENC_DEC_API}/enc-vidlink?text=${tmdbId}`;

    try {
        const response = await makeRequest(url);
        const data = response.data;
        if (data && data.result) {
            console.log(`[Vidlink] Successfully encrypted TMDB ID`);
            return data.result;
        }
    } catch (error) {
        if (error.message.includes('ECONNRESET') || error.message.includes('socket hang up')) {
            console.warn(`[Vidlink] Axios failed with ECONNRESET, trying curl.exe fallback...`);
            const data = makeRequestWithCurl(url);
            if (data && data.result) {
                console.log(`[Vidlink] Successfully encrypted TMDB ID using curl.exe`);
                return data.result;
            }
        }
        throw error;
    }
    throw new Error("Invalid encryption response format");
}

// URL Resolver
function resolveUrl(url, baseUrl) {
    if (url.startsWith("http")) return url;
    try {
        return new URL(url, baseUrl).toString();
    } catch (error) {
        return url;
    }
}

// Quality from Resolution helper
function getQualityFromResolution(resolution) {
    if (!resolution) return "Auto";
    const [, height] = resolution.split("x").map(Number);
    if (height >= 2160) return "4K";
    if (height >= 1440) return "1440p";
    if (height >= 1080) return "1080p";
    if (height >= 720) return "720p";
    if (height >= 480) return "480p";
    if (height >= 360) return "360p";
    return "240p";
}

// M3U8 Parser
function parseM3U8(content, baseUrl) {
    const lines = content.split("\n").map((line) => line.trim()).filter((line) => line);
    const streams = [];
    let currentStream = null;
    for (const line of lines) {
        if (line.startsWith("#EXT-X-STREAM-INF:")) {
            currentStream = { bandwidth: null, resolution: null, url: null };
            const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
            if (bandwidthMatch) currentStream.bandwidth = parseInt(bandwidthMatch[1]);
            const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            if (resolutionMatch) currentStream.resolution = resolutionMatch[1];
        } else if (currentStream && !line.startsWith("#")) {
            currentStream.url = resolveUrl(line, baseUrl);
            streams.push(currentStream);
            currentStream = null;
        }
    }
    return streams;
}

// Fetch and Parse M3U8 helper
async function fetchAndParseM3U8(playlistUrl, mediaInfo) {
    console.log(`[Vidlink] Fetching M3U8 playlist...`);
    try {
        const response = await makeRequest(playlistUrl, { headers: VIDLINK_HEADERS });
        const m3u8Content = response.data;
        const parsedStreams = parseM3U8(m3u8Content, playlistUrl);

        if (parsedStreams.length === 0) {
            return [{
                name: "Vidlink - Auto",
                title: mediaInfo.title,
                url: playlistUrl,
                quality: "Auto",
                size: "Unknown",
                headers: VIDLINK_HEADERS,
                provider: "vidlink"
            }];
        }

        return parsedStreams.map((stream) => {
            const quality = getQualityFromResolution(stream.resolution);
            return {
                name: `Vidlink - ${quality}`,
                title: mediaInfo.title,
                url: stream.url,
                quality,
                size: "Unknown",
                headers: VIDLINK_HEADERS,
                provider: "vidlink"
            };
        });
    } catch (error) {
        return [{
            name: "Vidlink - Auto",
            title: mediaInfo.title,
            url: playlistUrl,
            quality: "Auto",
            size: "Unknown",
            headers: VIDLINK_HEADERS,
            provider: "vidlink"
        }];
    }
}

// Quality Extractor
function extractQuality(streamData) {
    if (!streamData) return "Unknown";
    const qualityFields = ["quality", "resolution", "label", "name"];
    for (const field of qualityFields) {
        if (streamData[field]) {
            const quality = streamData[field].toString().toLowerCase();
            if (quality.includes("2160") || quality.includes("4k")) return "4K";
            if (quality.includes("1440") || quality.includes("2k")) return "1440p";
            if (quality.includes("1080") || quality.includes("fhd")) return "1080p";
            if (quality.includes("720") || quality.includes("hd")) return "720p";
            if (quality.includes("480") || quality.includes("sd")) return "480p";
            if (quality.includes("360")) return "360p";
            if (quality.includes("240")) return "240p";

            const match = quality.match(/(\d{3,4})[pP]?/);
            if (match) {
                const resolution = parseInt(match[1]);
                if (resolution >= 2160) return "4K";
                if (resolution >= 1440) return "1440p";
                if (resolution >= 1080) return "1080p";
                if (resolution >= 720) return "720p";
                if (resolution >= 480) return "480p";
                if (resolution >= 360) return "360p";
                return "240p";
            }
        }
    }
    return "Unknown";
}

// Title Creator
function createStreamTitle(mediaInfo) {
    if (mediaInfo.mediaType === "tv" && mediaInfo.season && mediaInfo.episode) {
        return `${mediaInfo.title} S${String(mediaInfo.season).padStart(2, "0")}E${String(mediaInfo.episode).padStart(2, "0")}`;
    }
    return mediaInfo.year ? `${mediaInfo.title} (${mediaInfo.year})` : mediaInfo.title;
}

// Response Processor
function processVidlinkResponse(data, mediaInfo) {
    const streams = [];
    try {
        const streamTitle = createStreamTitle(mediaInfo);
        if (data.stream && data.stream.qualities) {
            Object.entries(data.stream.qualities).forEach(([qualityKey, qualityData]) => {
                if (qualityData.url) {
                    const quality = extractQuality({ quality: qualityKey });
                    streams.push({
                        name: `Vidlink - ${quality}`,
                        title: streamTitle,
                        url: qualityData.url,
                        quality,
                        size: "Unknown",
                        headers: VIDLINK_HEADERS,
                        provider: "vidlink"
                    });
                }
            });
            if (data.stream.playlist) {
                streams.push({
                    _isPlaylist: true,
                    url: data.stream.playlist,
                    mediaInfo: { ...mediaInfo, title: streamTitle }
                });
            }
        } else if (data.stream && data.stream.playlist && !data.stream.qualities) {
            streams.push({
                _isPlaylist: true,
                url: data.stream.playlist,
                mediaInfo: { ...mediaInfo, title: streamTitle }
            });
        } else if (data.url) {
            const quality = extractQuality(data);
            streams.push({
                name: `Vidlink - ${quality}`,
                title: streamTitle,
                url: data.url,
                quality,
                size: "Unknown",
                headers: VIDLINK_HEADERS,
                provider: "vidlink"
            });
        } else if (data.streams && Array.isArray(data.streams)) {
            data.streams.forEach((stream, index) => {
                if (stream.url) {
                    const quality = extractQuality(stream);
                    streams.push({
                        name: `Vidlink Stream ${index + 1} - ${quality}`,
                        title: streamTitle,
                        url: stream.url,
                        quality,
                        size: stream.size || "Unknown",
                        headers: VIDLINK_HEADERS,
                        provider: "vidlink"
                    });
                }
            });
        }
    } catch (error) {
        console.error(`[Vidlink] Error processing response: ${error.message}`);
    }
    return streams;
}

// Main function
async function getVidLinkStreams(tmdbId, mediaType = "movie", seasonNum = null, episodeNum = null) {
    console.log(`[Vidlink] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
    try {
        const { title, year } = await getTmdbInfo(tmdbId, mediaType);
        const encryptedId = await encryptTmdbId(tmdbId);

        let vidlinkUrl;
        if (mediaType === "tv" && seasonNum && episodeNum) {
            vidlinkUrl = `${VIDLINK_API}/tv/${encryptedId}/${seasonNum}/${episodeNum}`;
        } else {
            vidlinkUrl = `${VIDLINK_API}/movie/${encryptedId}`;
        }

        console.log(`[Vidlink] Requesting: ${vidlinkUrl}`);
        let data;
        try {
            const response = await makeRequest(vidlinkUrl, { headers: VIDLINK_HEADERS });
            data = response.data;
        } catch (error) {
            if (error.message.includes('ECONNRESET') || error.message.includes('socket hang up')) {
                console.warn(`[Vidlink] Main API failed with ECONNRESET, trying curl.exe fallback...`);
                data = makeRequestWithCurl(vidlinkUrl);
            } else {
                throw error;
            }
        }

        const mediaInfo = { title, year, mediaType, season: seasonNum, episode: episodeNum };
        const streams = processVidlinkResponse(data, mediaInfo);

        if (streams.length === 0) return [];

        const playlistStreams = streams.filter((s) => s._isPlaylist);
        const directStreams = streams.filter((s) => !s._isPlaylist);

        let allStreams = [...directStreams];
        if (playlistStreams.length > 0) {
            const playlistPromises = playlistStreams.map(ps => fetchAndParseM3U8(ps.url, ps.mediaInfo));
            const parsedStreamArrays = await Promise.all(playlistPromises);
            allStreams = allStreams.concat(...parsedStreamArrays);
        }

        allStreams.sort((a, b) => (QUALITY_ORDER[b.quality] || -3) - (QUALITY_ORDER[a.quality] || -3));
        return allStreams;
    } catch (error) {
        console.error(`[Vidlink] Error in getVidLinkStreams: ${error.message}`);
        return [];
    }
}

module.exports = {
    getVidLinkStreams,
    getStreams: getVidLinkStreams
};
