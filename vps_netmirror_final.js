const { execSync } = require('child_process');
const fs = require('fs');

console.log("[NetMirror] Initializing NetMirror provider (CURL JAR EDITION)");

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const NETMIRROR_BASE = "https://net52.cc";
const COOKIE_FILE = "/tmp/netmirror_cookies.txt";

const BASE_HEADERS = {
    "User-Agent": "curl/8.5.0",
};

let lastBypassTime = 0;
const BYPASS_INTERVAL = 45 * 60 * 1000;

function getUnixTime() {
    return Math.floor(Date.now() / 1000);
}

const LOG_FILE = "/tmp/netmirror_debug.log";
function logToFile(msg) {
    try { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
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
        const escapedBody = options.body.replace(/"/g, '\\"');
        dataStr = ` --data "${escapedBody}"`;
    }

    const includeHeaders = options.includeHeaders ? " -i" : "";
    const cookieArgs = ` -b "${COOKIE_FILE}" -c "${COOKIE_FILE}"`;

    const command = `curl -s -L${includeHeaders} -X ${method}${headerStr}${dataStr}${cookieArgs} "${url}" --max-time 30`;

    try {
        const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        return output;
    } catch (e) {
        logToFile(`Curl Failed: ${e.message}`);
        throw e;
    }
}

function ensureCookieFile() {
    if (!fs.existsSync(COOKIE_FILE)) {
        fs.writeFileSync(COOKIE_FILE, "");
    }
}

function bypass() {
    const now = Date.now();
    if (lastBypassTime && now - lastBypassTime < BYPASS_INTERVAL && fs.existsSync(COOKIE_FILE)) {
        return Promise.resolve();
    }

    console.log(`[NetMirror Debug] Bypassing auth & Refreshing Cookies...`);
    ensureCookieFile();

    try {
        const output = curlRequest(`${NETMIRROR_BASE}/tv/p.php`, {
            method: "POST",
            includeHeaders: true
        });

        if (output.match(/t_hash_t=/)) {
            console.log("[NetMirror] Auth successful, cookies updated.");
            lastBypassTime = now;

            const cookieContent = fs.readFileSync(COOKIE_FILE, 'utf8');
            let newContent = cookieContent;

            const domain = "net52.cc";
            const expires = Math.floor(Date.now() / 1000) + 3600 * 24;

            if (!cookieContent.includes("hd\ton")) {
                newContent += `\n.${domain}\tTRUE\t/\tFALSE\t${expires}\thd\ton`;
            }
            if (!cookieContent.includes("ott\t")) {
                newContent += `\n.${domain}\tTRUE\t/\tFALSE\t${expires}\tott\tnf`;
            }

            fs.writeFileSync(COOKIE_FILE, newContent);
            return Promise.resolve();
        } else {
            console.log("[NetMirror] Warning: t_hash_t not seen in output.");
        }
    } catch (e) {
        console.error(`[NetMirror] Bypass failed: ${e.message}`);
    }
    return Promise.resolve();
}

function safeJsonParse(body) {
    if (!body) return null;
    let data;
    try {
        data = JSON.parse(body);
        return data;
    } catch (e) {
        console.log(`[NetMirror] Direct parse failed: ${e.message}. Body starts with: ${body ? body.substring(0, 500) : "NULL"}`);
        const lastBracket = body.lastIndexOf(']');
        if (lastBracket !== -1) {
            const candidate = body.substring(0, lastBracket + 1);
            try { return JSON.parse(candidate); } catch (e2) { }
        }
        const arrayMatch = body.match(/\[.*\]/s);
        if (arrayMatch) {
            try { return JSON.parse(arrayMatch[0]); } catch (e2) { }
        }
        const objectMatch = body.match(/\{.*\}/s);
        if (objectMatch) {
            try { return JSON.parse(objectMatch[0]); } catch (e3) { }
        }
    }
    return null;
}

function searchContent(query, platform) {
    console.log(`[NetMirror] Searching for "${query}" on ${platform}...`);
    return bypass().then(function () {
        const searchUrl = `${NETMIRROR_BASE}/tv/search.php`;
        const cmd = `curl -s -L -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" "${searchUrl}?q=${encodeURIComponent(query)}&t=${getUnixTime()}"`;

        try {
            const responseBody = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
            let data = safeJsonParse(responseBody);
            if (!data) return [];

            if (data.head === "Top Searches") {
                console.log("[NetMirror] 'Top Searches' detected, ignoring results.");
                return [];
            }

            let results = [];
            if (Array.isArray(data)) {
                results = data;
            } else if (data.results && Array.isArray(data.results)) {
                results = data.results;
            } else if (data.searchResult && Array.isArray(data.searchResult)) {
                results = data.searchResult;
            } else {
                results = Object.values(data).filter(i => typeof i === 'object' && i !== null);
            }

            const converted = results.map(item => ({
                ...item,
                title: item.title || item.t,
                id: item.id
            })).filter(i => i.id && i.title);

            return converted;
        } catch (e) {
            console.error(`[NetMirror] Search failed: ${e.message}`);
            return [];
        }
    });
}

function loadContent(contentId, year, platform) {
    console.log(`[NetMirror] Loading content details for ${contentId}...`);
    return bypass().then(function () {
        const detailsUrl = `${NETMIRROR_BASE}/tv/details.php`;
        const cmd = `curl -s -L -e "${NETMIRROR_BASE}/tv/home" -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" "${detailsUrl}?id=${contentId}&t=${getUnixTime()}"`;

        try {
            const body = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
            const postData = safeJsonParse(body);
            if (!postData) throw new Error("Failed to parse details JSON");

            const allEpisodes = [];
            // Simplified episode logic
            if (postData.episodes && postData.episodes.length > 0 && postData.episodes[0] !== null) {
                allEpisodes.push(...postData.episodes);
            }

            return {
                id: contentId,
                title: postData.title,
                episodes: allEpisodes,
                isMovie: !postData.episodes || postData.episodes.length === 0 || postData.episodes[0] === null
            };
        } catch (e) {
            console.error(`[NetMirror] Failed to load content: ${e.message}`);
            return { id: contentId, title: "Unknown", episodes: [], isMovie: true };
        }
    });
}

function getStreamingLinks(contentId, title, platform) {
    console.log(`[NetMirror] Getting streaming links for: ${title} (ID: ${contentId})`);
    return bypass().then(function () {
        const playlistUrl = `${NETMIRROR_BASE}/tv/playlist.php`;
        const cmd = `curl -s -L -e "${NETMIRROR_BASE}/tv/home" -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" "${playlistUrl}?id=${contentId}&t=${encodeURIComponent(title)}&tm=${getUnixTime()}"`;
        try {
            const body = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
            let playlist = safeJsonParse(body);
            if (!playlist) return { sources: [] };

            let items = Array.isArray(playlist) ? playlist : [playlist];
            const sources = [];
            items.forEach(item => {
                if (item.sources) {
                    item.sources.forEach(source => {
                        let fullUrl = source.file.replace("/tv/", "/");
                        if (!fullUrl.startsWith("/")) fullUrl = "/" + fullUrl;
                        fullUrl = NETMIRROR_BASE + fullUrl;
                        if (fullUrl.includes('in=')) fullUrl = fullUrl.replace(/(in=[^&]*::)[^&]*/g, '$1ni');
                        sources.push({ url: fullUrl, quality: source.label });
                    });
                }
            });
            return { sources };
        } catch (e) {
            return { sources: [] };
        }
    });
}

function makeTmdbRequest(url) {
    const cmd = `curl -s "${url}"`;
    try {
        const body = execSync(cmd, { encoding: 'utf8' });
        return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(body)) });
    } catch (e) {
        return Promise.reject(new Error(`TMDB Failed: ${e.message}`));
    }
}

async function getStreams(tmdbId, mediaType = "movie", seasonNum = null, episodeNum = null) {
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const tmdbRes = await makeTmdbRequest(tmdbUrl);
        const tmdbData = await tmdbRes.json();
        const title = mediaType === "tv" ? tmdbData.name : tmdbData.title;
        const year = (mediaType === "tv" ? tmdbData.first_air_date : tmdbData.release_date)?.substring(0, 4);

        const platforms = ["netflix", "disney", "hotstar", "apple", "prime", "hbo", "hulu", "paramount"];
        let results = [];
        for (const plat of platforms) {
            results = await searchContent(title, plat);
            if (results.length > 0) break;
        }

        if (results.length === 0) return [];

        let target = results.find(r => r.title.toLowerCase().replace(/[^a-z0-9]/g, '') === title.toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (!target) target = results[0];

        const contentData = await loadContent(target.id, year, "netflix");
        let streamId = target.id;
        let streamTitle = target.title;

        if (mediaType === 'tv' && seasonNum && episodeNum) {
            const episode = contentData.episodes.find(e => parseInt(e.s) === parseInt(seasonNum) && parseInt(e.e) === parseInt(episodeNum));
            if (episode) {
                streamId = episode.id;
                streamTitle = `${title} S${seasonNum}E${episodeNum}`;
            } else return [];
        }

        const streamData = await getStreamingLinks(streamId, streamTitle, "netflix");
        return (streamData.sources || []).map(s => ({
            url: s.url,
            name: `NetMirror ${s.quality}`,
            title: `${title} - ${s.quality}`,
            quality: s.quality,
            headers: {
                "Origin": "https://net52.cc",
                "Referer": "https://net52.cc/",
                "Cookie": "hd=on; ott=nf",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        }));
    } catch (e) {
        console.error(`[NetMirror Error] ${e.message}`);
        return [];
    }
}

module.exports = { getStreams };