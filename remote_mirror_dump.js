const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const NETMIRROR_BASE = "https://net51.cc";
const BASE_HEADERS = {
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive"
};

let globalCookie = "";
let cookieTimestamp = 0;
const COOKIE_EXPIRY = 54e6; // 15 hours

function makeRequest(url, options = {}) {
    // Basic fetch wrapper
    const headers = { ...BASE_HEADERS, ...options.headers };
    const fetchOptions = {
        method: options.method || 'GET',
        headers: headers,
        timeout: 10000
    };
    if (options.body) fetchOptions.body = options.body;

    return fetch(url, fetchOptions).then(response => {
        if (!response.ok) {
            // NetMirror might return 404 for not found search, we handle it?
            // Upstream throws: throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            // But we might want to return empty for search.
            // Let's mimic upstream:
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
    });
}

function getUnixTime() {
    return Math.floor(Date.now() / 1e3);
}

function bypass() {
    const now = Date.now();
    if (globalCookie && cookieTimestamp && now - cookieTimestamp < COOKIE_EXPIRY) {
        console.log("[NetMirror] Using cached authentication cookie");
        return Promise.resolve(globalCookie);
    }
    console.log("[NetMirror] Bypassing authentication...");

    function attemptBypass(attempts) {
        if (attempts >= 5) {
            throw new Error("Max bypass attempts reached");
        }
        return makeRequest(`${NETMIRROR_BASE}/tv/p.php`, {
            method: "POST",
            headers: BASE_HEADERS
        }).then(response => {
            const setCookieHeader = response.headers.get("set-cookie");
            let extractedCookie = null;
            if (setCookieHeader) {
                // fetch() in Node might return a string or array?
                // node-fetch returns string usually with multiple cookies separated?
                // Or we might need to use getSetCookie() if available in Node 18+
                // Let's assume standard behavior or split manually.
                // Upstream handles both string and array.
                const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader.join("; ") : setCookieHeader;
                const cookieMatch = cookieStrings.match(/t_hash_t=([^;]+)/);
                if (cookieMatch) {
                    extractedCookie = cookieMatch[1];
                }
            }

            return response.text().then(responseText => {
                // Upstream check: responseText.includes('"r":"n"')
                if (!responseText.includes('"r":"n"')) {
                    console.log(`[NetMirror] Bypass attempt ${attempts + 1} failed, retrying...`);
                    return attemptBypass(attempts + 1);
                }
                if (extractedCookie) {
                    globalCookie = extractedCookie;
                    cookieTimestamp = Date.now();
                    console.log("[NetMirror] Authentication successful");
                    return globalCookie;
                }
                throw new Error("Failed to extract authentication cookie");
            });
        });
    }
    return attemptBypass(0);
}

function searchContent(query, platform) {
    console.log(`[NetMirror] Searching for "${query}" on ${platform}...`);
    const ottMap = { "netflix": "nf", "primevideo": "pv", "disney": "hs" };
    const ott = ottMap[platform.toLowerCase()] || "nf";

    return bypass().then(cookie => {
        const cookies = {
            "t_hash_t": cookie,
            "user_token": "233123f803cf02184bf6c67e149cdd50",
            "hd": "on",
            "ott": ott
        };
        const cookieString = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; ");

        const searchEndpoints = {
            "netflix": `${NETMIRROR_BASE}/search.php`,
            "primevideo": `${NETMIRROR_BASE}/pv/search.php`,
            "disney": `${NETMIRROR_BASE}/mobile/hs/search.php`
        };
        const searchUrl = searchEndpoints[platform.toLowerCase()] || searchEndpoints["netflix"];

        return makeRequest(`${searchUrl}?s=${encodeURIComponent(query)}&t=${getUnixTime()}`, {
            headers: {
                "Cookie": cookieString,
                "Referer": `${NETMIRROR_BASE}/tv/home`
            }
        }).then(res => res.json()).then(searchData => {
            if (searchData.searchResult && searchData.searchResult.length > 0) {
                return searchData.searchResult.map(item => ({
                    id: item.id,
                    title: item.t,
                    posterUrl: `https://imgcdn.media/poster/v/${item.id}.jpg`
                }));
            }
            return [];
        });
    });
}

function getEpisodesFromSeason(seriesId, seasonId, platform, page) {
    const ottMap = { "netflix": "nf", "primevideo": "pv", "disney": "hs" };
    const ott = ottMap[platform.toLowerCase()] || "nf";

    return bypass().then(cookie => {
        const cookies = {
            "t_hash_t": cookie,
            "user_token": "233123f803cf02184bf6c67e149cdd50",
            "ott": ott,
            "hd": "on"
        };
        const cookieString = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; ");
        const episodes = [];
        let currentPage = page || 1;

        const episodesEndpoints = {
            "netflix": `${NETMIRROR_BASE}/episodes.php`,
            "primevideo": `${NETMIRROR_BASE}/pv/episodes.php`,
            "disney": `${NETMIRROR_BASE}/mobile/hs/episodes.php`
        };
        const episodesUrl = episodesEndpoints[platform.toLowerCase()] || episodesEndpoints["netflix"];

        function fetchPage(pageNum) {
            return makeRequest(`${episodesUrl}?s=${seasonId}&series=${seriesId}&t=${getUnixTime()}&page=${pageNum}`, {
                headers: { "Cookie": cookieString, "Referer": `${NETMIRROR_BASE}/tv/home` }
            }).then(res => res.json()).then(episodeData => {
                if (episodeData.episodes) {
                    episodes.push(...episodeData.episodes);
                }
                if (episodeData.nextPageShow === 0) {
                    return episodes;
                } else {
                    return fetchPage(pageNum + 1);
                }
            }).catch(e => {
                console.log(`[NetMirror] Failed to load episodes: ${e.message}`);
                return episodes;
            });
        }
        return fetchPage(currentPage);
    });
}

function loadContent(contentId, platform) {
    console.log(`[NetMirror] Loading content details for ID: ${contentId}`);
    const ottMap = { "netflix": "nf", "primevideo": "pv", "disney": "hs" };
    const ott = ottMap[platform.toLowerCase()] || "nf";

    return bypass().then(cookie => {
        const cookies = {
            "t_hash_t": cookie,
            "user_token": "233123f803cf02184bf6c67e149cdd50",
            "ott": ott,
            "hd": "on"
        };
        const cookieString = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; ");
        const postEndpoints = {
            "netflix": `${NETMIRROR_BASE}/post.php`,
            "primevideo": `${NETMIRROR_BASE}/pv/post.php`,
            "disney": `${NETMIRROR_BASE}/mobile/hs/post.php`
        };
        const postUrl = postEndpoints[platform.toLowerCase()] || postEndpoints["netflix"];

        return makeRequest(`${postUrl}?id=${contentId}&t=${getUnixTime()}`, {
            headers: { "Cookie": cookieString, "Referer": `${NETMIRROR_BASE}/tv/home` }
        }).then(res => res.json()).then(postData => {
            console.log(`[NetMirror] Loaded: ${postData.title}`);
            let allEpisodes = postData.episodes || [];

            let episodePromise = Promise.resolve();
            if (postData.episodes && postData.episodes.length > 0 && postData.episodes[0] !== null) {
                if (postData.nextPageShow === 1 && postData.nextPageSeason) {
                    episodePromise = episodePromise.then(() =>
                        getEpisodesFromSeason(contentId, postData.nextPageSeason, platform, 2)
                            .then(eps => allEpisodes.push(...eps))
                    );
                }
                if (postData.season && postData.season.length > 1) {
                    const otherSeasons = postData.season.slice(0, -1);
                    otherSeasons.forEach(season => {
                        episodePromise = episodePromise.then(() =>
                            getEpisodesFromSeason(contentId, season.id, platform, 1)
                                .then(eps => allEpisodes.push(...eps))
                        );
                    });
                }
            }

            return episodePromise.then(() => ({
                id: contentId,
                title: postData.title,
                description: postData.desc,
                year: postData.year,
                episodes: allEpisodes,
                seasons: postData.season || [],
                isMovie: !postData.episodes || postData.episodes.length === 0 || postData.episodes[0] === null
            }));
        });
    });
}

function getStreamingLinks(contentId, title, platform) {
    const ottMap = { "netflix": "nf", "primevideo": "pv", "disney": "hs" };
    const ott = ottMap[platform.toLowerCase()] || "nf";

    return bypass().then(cookie => {
        const cookies = {
            "t_hash_t": cookie,
            "user_token": "233123f803cf02184bf6c67e149cdd50",
            "ott": ott,
            "hd": "on"
        };
        const cookieString = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; ");
        const playlistUrl = `${NETMIRROR_BASE}/tv/playlist.php`;

        return makeRequest(`${playlistUrl}?id=${contentId}&t=${encodeURIComponent(title)}&tm=${getUnixTime()}`, {
            headers: { "Cookie": cookieString, "Referer": `${NETMIRROR_BASE}/tv/home` }
        }).then(res => res.json()).then(playlist => {
            if (!Array.isArray(playlist) || playlist.length === 0) {
                console.log("[NetMirror] No streaming links found");
                return { sources: [], subtitles: [] };
            }
            const sources = [];
            const subtitles = [];

            playlist.forEach(item => {
                if (item.sources) {
                    item.sources.forEach(source => {
                        let fullUrl = source.file.replace("/tv/", "/");
                        if (!fullUrl.startsWith("/")) fullUrl = "/" + fullUrl;
                        fullUrl = NETMIRROR_BASE + fullUrl;

                        sources.push({
                            url: fullUrl,
                            quality: source.label,
                            type: source.type || "application/x-mpegURL"
                        });
                    });
                }
                if (item.tracks) {
                    item.tracks.forEach(track => {
                        if (track.kind === 'captions') {
                            let fullSubUrl = track.file;
                            if (track.file.startsWith("/") && !track.file.startsWith("//")) {
                                fullSubUrl = NETMIRROR_BASE + track.file;
                            } else if (track.file.startsWith("//")) {
                                fullSubUrl = "https:" + track.file;
                            }
                            subtitles.push({ url: fullSubUrl, language: track.label });
                        }
                    });
                }
            });
            return { sources, subtitles };
        });
    });
}

function getStreams(tmdbId, mediaType = "movie", seasonNum = null, episodeNum = null) {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    return makeRequest(tmdbUrl).then(res => res.json()).then(tmdbData => {
        const title = mediaType === "tv" ? tmdbData.name : tmdbData.title;
        const year = (mediaType === "tv" ? tmdbData.first_air_date : tmdbData.release_date)?.substring(0, 4);

        if (!title) throw new Error("Could not extract title from TMDB");

        let platforms = ["netflix", "primevideo", "disney"];
        if (title.toLowerCase().includes("boys") || title.toLowerCase().includes("prime")) {
            platforms = ["primevideo", "netflix", "disney"];
        }

        function calculateSimilarity(str1, str2) {
            const s1 = str1.toLowerCase().trim();
            const s2 = str2.toLowerCase().trim();
            if (s1 === s2) return 1;
            const words1 = s1.split(/\s+/).filter(w => w.length > 0);
            const words2 = s2.split(/\s+/).filter(w => w.length > 0);
            if (words2.length <= words1.length) {
                let exactMatches = 0;
                for (const queryWord of words2) {
                    if (words1.includes(queryWord)) exactMatches++;
                }
                if (exactMatches === words2.length) return 0.95 * (exactMatches / words1.length);
            }
            if (s1.startsWith(s2)) return 0.9;
            return 0;
        }

        function filterRelevantResults(searchResults, query) {
            return searchResults.filter(r => calculateSimilarity(r.title, query) >= 0.7)
                .sort((a, b) => calculateSimilarity(b.title, query) - calculateSimilarity(a.title, query));
        }

        function tryPlatform(platformIndex) {
            if (platformIndex >= platforms.length) {
                return [];
            }
            const platform = platforms[platformIndex];

            function trySearch(withYear) {
                const searchQuery = withYear ? `${title} ${year}` : title;
                return searchContent(searchQuery, platform).then(searchResults => {
                    if (searchResults.length === 0) {
                        if (!withYear && year) return trySearch(true);
                        return null;
                    }
                    const relevantResults = filterRelevantResults(searchResults, title);
                    if (relevantResults.length === 0) {
                        if (!withYear && year) return trySearch(true);
                        return null;
                    }

                    const selectedContent = relevantResults[0];
                    return loadContent(selectedContent.id, platform).then(contentData => {
                        let targetContentId = selectedContent.id;
                        let episodeData = null;

                        if (mediaType === "tv" && !contentData.isMovie) {
                            const validEpisodes = contentData.episodes.filter(ep => ep !== null);
                            episodeData = validEpisodes.find(ep => {
                                let epSeason, epNumber;
                                if (ep.s && ep.ep) {
                                    epSeason = parseInt(ep.s.replace("S", ""));
                                    epNumber = parseInt(ep.ep.replace("E", ""));
                                } else if (ep.season && ep.episode) {
                                    epSeason = parseInt(ep.season);
                                    epNumber = parseInt(ep.episode);
                                } else if (ep.season_number && ep.episode_number) {
                                    epSeason = parseInt(ep.season_number);
                                    epNumber = parseInt(ep.episode_number);
                                }
                                return epSeason === (seasonNum || 1) && epNumber === (episodeNum || 1);
                            });
                            if (episodeData) {
                                targetContentId = episodeData.id;
                            } else {
                                return null;
                            }
                        }

                        return getStreamingLinks(targetContentId, title, platform).then(streamData => {
                            if (!streamData.sources || streamData.sources.length === 0) return null;

                            const streams = streamData.sources.map(source => {
                                let quality = "HD";
                                // Quality parsing logic from upstream
                                const urlQualityMatch = source.url.match(/[?&]q=(\d+p)/i);
                                if (urlQualityMatch) quality = urlQualityMatch[1];
                                else if (source.quality) {
                                    const labelMatch = source.quality.match(/(\d+p)/i);
                                    if (labelMatch) quality = labelMatch[1];
                                    else {
                                        const nq = source.quality.toLowerCase();
                                        if (nq.includes("1080")) quality = "1080p";
                                        else if (nq.includes("720")) quality = "720p";
                                        else if (nq.includes("480")) quality = "480p";
                                        else quality = source.quality;
                                    }
                                } else {
                                    if (source.url.includes("720p")) quality = "720p";
                                    else if (source.url.includes("480p")) quality = "480p";
                                    else if (source.url.includes("1080p")) quality = "1080p";
                                }

                                let streamTitle = `${title} ${year ? `(${year})` : ""} ${quality}`;
                                if (mediaType === "tv") {
                                    const episodeName = episodeData && episodeData.t ? episodeData.t : "";
                                    streamTitle += ` S${seasonNum}E${episodeNum}`;
                                    if (episodeName) streamTitle += ` - ${episodeName}`;
                                }

                                const isNfOrPv = platform === "netflix" || platform === "primevideo";
                                const streamHeaders = {
                                    "Accept": "application/vnd.apple.mpegurl, video/mp4, */*",
                                    "Origin": "https://net51.cc",
                                    "Referer": isNfOrPv ? "https://net51.cc/" : "https://net51.cc/tv/home",
                                    "Cookie": "hd=on",
                                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1"
                                };

                                return {
                                    name: `NetMirror (${platform.toUpperCase()})`,
                                    title: streamTitle,
                                    url: source.url,
                                    quality: quality,
                                    type: source.type.includes("mpegURL") ? "hls" : "direct",
                                    headers: streamHeaders
                                };
                            });
                            return streams;
                        });
                    });
                }).then(result => result || tryPlatform(platformIndex + 1))
                    .catch(e => {
                        console.log(`[NetMirror] Error on ${platform}: ${e.message}`);
                        return tryPlatform(platformIndex + 1);
                    });
            }
            return trySearch(false);
        }

        return tryPlatform(0);
    }).catch(err => {
        console.error(`[NetMirror] Error: ${err.message}`);
        return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}