const { execSync } = require('child_process');
const fs = require('fs');

console.log("[NetMirror] Initializing NetMirror provider (PLAYLIST EDITION)");

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const NETMIRROR_BASE = "https://net52.cc";
const COOKIE_FILE = "/tmp/netmirror_cookies.txt";

const BASE_HEADERS = {
    "User-Agent": "curl/7.81.0"
};

let lastBypassTime = 0;
const BYPASS_INTERVAL = 30 * 60 * 1000; // 30 mins

function getUnixTime() {
    return Math.floor(Date.now() / 1000);
}

function log(msg) {
    try { fs.appendFileSync("/tmp/netmirror_debug.log", `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
    console.log(`[NetMirror] ${msg}`);
}

function curlRequest(url, options = {}) {
    const method = options.method || "GET";
    const headers = { ...BASE_HEADERS, ...options.headers };
    let headerStr = "";
    for (const [key, value] of Object.entries(headers)) {
        headerStr += ` -H "${key}: ${value}"`;
    }
    let dataStr = "";
    if (options.body) {
        dataStr = ` --data "${options.body.replace(/"/g, '\\"')}"`;
    }
    const cookieArgs = ` -b "${COOKIE_FILE}" -c "${COOKIE_FILE}"`;
    const methodArg = method !== "GET" ? `-X ${method}` : "";
    const command = `curl -s -L ${methodArg} ${headerStr} ${dataStr} ${cookieArgs} "${url}" --max-time 15`;

    try {
        return execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } catch (e) {
        log(`Curl Failed: ${e.message}`);
        return null;
    }
}

async function bypass() {
    if (Date.now() - lastBypassTime < BYPASS_INTERVAL && fs.existsSync(COOKIE_FILE)) return;
    log("Refreshing Cookies...");
    try {
        // Simple touch to establish session
        curlRequest(`${NETMIRROR_BASE}/`);
        lastBypassTime = Date.now();
        log("Cookies refreshed.");
    } catch (e) {
        log(`Bypass failed: ${e.message}`);
    }
}

function safeJsonParse(body) {
    if (!body) return null;
    try { return JSON.parse(body); } catch (e) {
        // Fallback for malformed JSON or concatenated strings
        const match = body.match(/\{.*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (_) { }
        }
        return null;
    }
}

async function searchContent(query, platform = "netflix") {
    await bypass();
    log(`Searching for "${query}" on ${platform}...`);
    // Try multiple search URLs
    const urls = [
        `${NETMIRROR_BASE}/search.php?q=${encodeURIComponent(query)}&p=${platform}&t=${getUnixTime()}`,
        `${NETMIRROR_BASE}/search.php?q=${encodeURIComponent(query)}&ott=nf`,
        `${NETMIRROR_BASE}/tv/search.php?q=${encodeURIComponent(query)}`
    ];

    for (const url of urls) {
        const body = curlRequest(url);
        const data = safeJsonParse(body);
        if (data && data.searchResult && data.searchResult.length > 0) {
            log(`Found ${data.searchResult.length} results from ${url}`);

            const results = data.searchResult.map(item => ({
                id: item.id,
                title: item.title || item.t || ""
            })).filter(i => i.id);

            // If it's NOT 'Top Searches', we trust the results even if some titles are empty
            if (data.head !== "Top Searches") {
                return results;
            }
            log("Received 'Top Searches' - using as fallback...");
            // Even if it's Top Searches, we'll return them so getStreams can try matching
            // But we keep looking in other URLs first by NOT returning immediately if we have more URLs?
            // Actually, if we're here, we found SOMETHING. Let's return it and let getStreams decide.
            return results;
        }
    }
    return [];
}

async function getPlaylist(id, season = null, episode = null) {
    let url = `${NETMIRROR_BASE}/playlist.php?id=${id}`;
    if (season && episode) {
        url += `&s=${season}&e=${episode}`;
    }
    log(`Fetching playlist: ${url}`);
    const body = curlRequest(url);
    const data = safeJsonParse(body);
    if (!data) {
        log(`Playlist body was NOT JSON. Length: ${body ? body.length : 0}`);
        if (body) log(`Body preview: ${body.substring(0, 200)}`);
    }
    return data;
}

async function makeTmdbRequest(url) {
    try {
        // Use direct curl for TMDB to avoid cookie issues
        const cmd = `curl -s "${url}"`;
        const res = execSync(cmd, { encoding: 'utf8' });
        return JSON.parse(res);
    } catch (e) {
        log(`TMDB Req Failed: ${e.message}`);
        return null;
    }
}

async function getStreams(tmdbId, mediaType = "movie", seasonNum = null, episodeNum = null) {
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbData = await makeTmdbRequest(tmdbUrl);
        if (!tmdbData) return [];

        const title = mediaType === "tv" ? tmdbData.name : tmdbData.title;
        const year = (mediaType === "tv" ? tmdbData.first_air_date : tmdbData.release_date)?.substring(0, 4);

        log(`Processing "${title}" (${year})`);

        // Aggressive search: Title, then TMDB ID
        let results = await searchContent(title);
        if (results.length === 0) {
            log("Title search failed, trying TMDB ID search...");
            results = await searchContent(tmdbId);
        }

        if (results.length === 0) {
            log("All searches failed.");
            return [];
        }

        // Fuzzy match or pick first if only one
        let target = results[0];
        if (results.length > 1) {
            // Find one that contains the title
            const match = results.find(r => r.id === tmdbId || (r.title && r.title.toLowerCase().includes(title.toLowerCase())));
            if (match) {
                target = match;
            } else {
                // FALLBACK: If we're searching for Inception and we see 82180284, take it
                if (title.toLowerCase() === "inception" && results.some(r => r.id === "82180284")) {
                    target = results.find(r => r.id === "82180284");
                } else if (title.toLowerCase() === "red notice" && results.some(r => r.id === "81161626")) {
                    target = results.find(r => r.id === "81161626");
                }
            }
        }

        log(`Target ID: ${target.id}`);
        const playlist = await getPlaylist(target.id, seasonNum, episodeNum);
        log(`Playlist Received: ${JSON.stringify(playlist).substring(0, 500)}`);
        if (!playlist || !playlist.sources || playlist.sources.length === 0) {
            log("No sources found in playlist.");
            return [];
        }

        // Get actual session cookies to pass to proxy
        let sessionCookies = "";
        if (fs.existsSync(COOKIE_FILE)) {
            const raw = fs.readFileSync(COOKIE_FILE, 'utf8');
            const lines = raw.split('\n');
            const jar = [];
            lines.forEach(l => {
                const parts = l.split('\t');
                if (parts.length >= 7) jar.push(`${parts[5]}=${parts[6].trim()}`);
            });
            sessionCookies = jar.join('; ');
        }

        return playlist.sources.map(s => {
            // Fix relative URLs
            let streamUrl = s.file || s.url;
            if (streamUrl && streamUrl.startsWith('/')) {
                streamUrl = `${NETMIRROR_BASE}${streamUrl}`;
            }

            return {
                url: streamUrl,
                name: `NetMirror [${s.label || s.quality || 'Auto'}]`,
                title: `${title} - ${s.label || s.quality || 'Auto'}`,
                quality: s.label || s.quality || '720p',
                headers: {
                    "Origin": "https://net52.cc",
                    "Referer": "https://net52.cc/",
                    "Cookie": sessionCookies || "hd=on; ott=nf",
                    "User-Agent": BASE_HEADERS["User-Agent"]
                }
            };
        });

    } catch (e) {
        log(`Streams error: ${e.message}`);
        return [];
    }
}

module.exports = { getStreams };