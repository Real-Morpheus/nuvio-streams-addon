/**
 * StreamFlix Provider for Nuvio
 * Ported from yoruix/nuvio-providers
 */

const axios = require('axios');
const cheerio = require('cheerio');
const WebSocket = require('ws');

// Constants
const TMDB_API_KEY = process.env.TMDB_API_KEY || "439c478a771f35c05022f9feabcca01c";
const STREAMFLIX_API_BASE = "https://api.streamflix.app";
const CONFIG_URL = `${STREAMFLIX_API_BASE}/config/config-streamflixapp.json`;
const DATA_URL = `${STREAMFLIX_API_BASE}/data.json`;

// Global cache
let cache = {
  config: null,
  configTimestamp: 0,
  data: null,
  dataTimestamp: 0,
};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Helper function for HTTP requests using axios
async function makeRequest(url, options = {}) {
  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive'
  };

  const config = {
    method: options.method || 'GET',
    url: url,
    headers: {
      ...defaultHeaders,
      ...options.headers
    },
    timeout: 15000
  };

  if (options.body) {
    config.data = options.body;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`[StreamFlix] Request failed for ${url}: ${error.message}`);
    throw error;
  }
}

// Get config data with caching
async function getConfig() {
  const now = Date.now();
  if (cache.config && now - cache.configTimestamp < CACHE_TTL) {
    return cache.config;
  }

  console.log('[StreamFlix] Fetching config data...');
  try {
    const json = await makeRequest(CONFIG_URL);
    cache.config = json;
    cache.configTimestamp = now;
    console.log('[StreamFlix] Config data cached successfully');
    return json;
  } catch (error) {
    console.error('[StreamFlix] Failed to fetch config:', error.message);
    throw error;
  }
}

// Get data with caching
async function getData() {
  const now = Date.now();
  if (cache.data && now - cache.dataTimestamp < CACHE_TTL) {
    return cache.data;
  }

  console.log('[StreamFlix] Fetching data...');
  try {
    const json = await makeRequest(DATA_URL);
    cache.data = json;
    cache.dataTimestamp = now;
    console.log('[StreamFlix] Data cached successfully');
    return json;
  } catch (error) {
    console.error('[StreamFlix] Failed to fetch data:', error.message);
    throw error;
  }
}

// Search for content by title
async function searchContent(title, year, mediaType) {
  console.log(`[StreamFlix] Searching for: "${title}" (${year})`);

  try {
    const data = await getData();
    if (!data || !data.data) {
      throw new Error('Invalid data structure received');
    }

    const searchQuery = title.toLowerCase();
    const results = data.data.filter(item => {
      if (!item.moviename) return false;

      const itemTitle = item.moviename.toLowerCase();
      const titleWords = searchQuery.split(/\s+/);

      // Check if all words from search query are present in the item title
      return titleWords.every(word => itemTitle.includes(word));
    });

    console.log(`[StreamFlix] Found ${results.length} search results`);
    return results;
  } catch (error) {
    console.error(`[StreamFlix] Search failed: ${error.message}`);
    return [];
  }
}

// Calculate string similarity
function calculateSimilarity(str1, str2) {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);

  let matches = 0;
  for (const word of words1) {
    if (word.length > 2 && words2.some(w => w.includes(word) || word.includes(w))) {
      matches++;
    }
  }

  return matches / Math.max(words1.length, words2.length);
}

// Find best match from search results
function findBestMatch(targetTitle, results) {
  if (!results || results.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const result of results) {
    const score = calculateSimilarity(
      targetTitle.toLowerCase(),
      result.moviename.toLowerCase()
    );

    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }

  if (bestMatch) {
    console.log(`[StreamFlix] Best match: "${bestMatch.moviename}" (score: ${bestScore.toFixed(2)})`);
  }
  return bestMatch;
}

// WebSocket-based episode fetching
function getEpisodesFromWebSocket(movieKey, totalSeasons = 1) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      'wss://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/.ws?ns=chilflix-410be-default-rtdb&v=5'
    );

    const seasonsData = {};
    let currentSeason = 1;
    let completedSeasons = 0;
    let messageBuffer = '';

    const overallTimeout = setTimeout(() => {
      try { ws.close(); } catch { }
      reject(new Error('WebSocket timeout'));
    }, 30000);

    function sendSeasonRequest(season) {
      const payload = {
        t: 'd',
        d: { a: 'q', r: season, b: { p: `Data/${movieKey}/seasons/${season}/episodes`, h: '' } }
      };
      try {
        ws.send(JSON.stringify(payload));
      } catch (e) {
        // Ignore send errors
      }
    }

    ws.on('open', function open() {
      sendSeasonRequest(currentSeason);
    });

    ws.on('message', function incoming(data) {
      try {
        const message = data.toString();

        if (/^\d+$/.test(message.trim())) {
          return;
        }

        messageBuffer += message;

        try {
          const parsed = JSON.parse(messageBuffer);
          messageBuffer = '';

          if (parsed.t === 'c') return;

          if (parsed.t === 'd') {
            const d_data = parsed.d || {};
            const b_data = d_data.b || {};

            if (d_data.r === currentSeason && b_data.s === 'ok') {
              completedSeasons++;
              if (completedSeasons < totalSeasons) {
                currentSeason++;
                sendSeasonRequest(currentSeason);
              } else {
                clearTimeout(overallTimeout);
                try { ws.close(); } catch { }
                resolve(seasonsData);
              }
              return;
            }

            if (b_data.d) {
              const episodes = b_data.d;
              const seasonEpisodes = seasonsData[currentSeason] || {};
              for (const [epKey, epData] of Object.entries(episodes)) {
                if (epData && typeof epData === 'object') {
                  seasonEpisodes[parseInt(epKey, 10)] = {
                    key: epData.key,
                    link: epData.link,
                    name: epData.name,
                    runtime: epData.runtime
                  };
                }
              }
              seasonsData[currentSeason] = seasonEpisodes;
            }
          }
        } catch (e) {
          // Incomplete JSON
        }
      } catch (err) {
        // Ignore
      }
    });

    ws.on('error', function error(err) {
      clearTimeout(overallTimeout);
      reject(new Error('WebSocket error'));
    });

    ws.on('close', function close() {
      clearTimeout(overallTimeout);
    });
  });
}

// Process movie streams
function processMovieStreams(movieData, config) {
  console.log(`[StreamFlix] Processing movie streams for: ${movieData.moviename}`);

  const streams = [];

  // Premium streams
  if (config.premium && movieData.movielink) {
    config.premium.forEach((baseUrl) => {
      const streamUrl = `${baseUrl}${movieData.movielink}`;
      streams.push({
        name: "StreamFlix",
        title: `${movieData.moviename} - Premium Quality`,
        url: streamUrl,
        quality: "1080p",
        size: movieData.movieduration || "Unknown",
        type: 'direct',
        headers: {
          'Referer': 'https://api.streamflix.app',
          'User-Agent': 'Mozilla/5.0'
        }
      });
    });
  }

  // Regular movie streams
  if (config.movies && movieData.movielink) {
    config.movies.forEach((baseUrl) => {
      const streamUrl = `${baseUrl}${movieData.movielink}`;
      streams.push({
        name: "StreamFlix",
        title: `${movieData.moviename} - Standard Quality`,
        url: streamUrl,
        quality: "720p",
        size: movieData.movieduration || "Unknown",
        type: 'direct',
        headers: {
          'Referer': 'https://api.streamflix.app',
          'User-Agent': 'Mozilla/5.0'
        }
      });
    });
  }

  return streams;
}

// Process TV show streams
async function processTVStreams(tvData, config, seasonNum, episodeNum) {
  console.log(`[StreamFlix] Processing TV streams for: ${tvData.moviename}`);

  const seasonMatch = tvData.movieduration?.match(/(\d+)\s+Season/);
  const totalSeasons = seasonMatch ? parseInt(seasonMatch[1]) : 1;

  try {
    const seasonsData = await getEpisodesFromWebSocket(tvData.moviekey, totalSeasons);
    const streams = [];

    if (seasonNum !== null && episodeNum !== null) {
      const seasonData = seasonsData[seasonNum];
      if (seasonData) {
        const episodeData = seasonData[episodeNum - 1];
        if (episodeData && config.premium) {
          config.premium.forEach(baseUrl => {
            const streamUrl = `${baseUrl}${episodeData.link}`;
            streams.push({
              name: "StreamFlix",
              title: `${tvData.moviename} S${seasonNum}E${episodeNum} - ${episodeData.name}`,
              url: streamUrl,
              quality: "1080p",
              size: episodeData.runtime ? `${episodeData.runtime}min` : "Unknown",
              type: 'direct',
              headers: {
                'Referer': 'https://api.streamflix.app',
                'User-Agent': 'Mozilla/5.0'
              }
            });
          });
        }
      }
    }

    if (streams.length === 0 && config.premium && seasonNum !== null && episodeNum !== null) {
      const fallbackUrl = `${config.premium[0]}tv/${tvData.moviekey}/s${seasonNum}/episode${episodeNum}.mkv`;
      streams.push({
        name: "StreamFlix",
        title: `${tvData.moviename} S${seasonNum}E${episodeNum} (Fallback)`,
        url: fallbackUrl,
        quality: "720p",
        size: "Unknown",
        type: 'direct',
        headers: {
          'Referer': 'https://api.streamflix.app',
          'User-Agent': 'Mozilla/5.0'
        }
      });
    }

    return streams;
  } catch (error) {
    console.error('[StreamFlix] WebSocket failed, using fallback:', error.message);
    if (config.premium && seasonNum !== null && episodeNum !== null) {
      const fallbackUrl = `${config.premium[0]}tv/${tvData.moviekey}/s${seasonNum}/episode${episodeNum}.mkv`;
      return [{
        name: "StreamFlix",
        title: `${tvData.moviename} S${seasonNum}E${episodeNum} (Fallback)`,
        url: fallbackUrl,
        quality: "720p",
        size: "Unknown",
        type: 'direct',
        headers: {
          'Referer': 'https://api.streamflix.app',
          'User-Agent': 'Mozilla/5.0'
        }
      }];
    }
    return [];
  }
}

// Main function
async function getStreamFlixStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
  console.log(`[StreamFlix] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

  try {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const tmdbData = await makeRequest(tmdbUrl);

    const title = mediaType === 'tv' ? tmdbData.name : tmdbData.title;
    const year = mediaType === 'tv'
      ? tmdbData.first_air_date?.substring(0, 4)
      : tmdbData.release_date?.substring(0, 4);

    if (!title) {
      throw new Error('Could not extract title from TMDB response');
    }

    console.log(`[StreamFlix] TMDB Info: "${title}" (${year})`);

    const searchResults = await searchContent(title, year, mediaType);
    if (searchResults.length === 0) {
      console.log('[StreamFlix] No search results found');
      return [];
    }

    const selectedResult = findBestMatch(title, searchResults);
    if (!selectedResult) {
      console.log('[StreamFlix] No suitable match found');
      return [];
    }

    const config = await getConfig();
    if (mediaType === 'movie') {
      return processMovieStreams(selectedResult, config);
    } else {
      return await processTVStreams(selectedResult, config, seasonNum, episodeNum);
    }
  } catch (error) {
    console.error(`[StreamFlix] Error in getStreamFlixStreams: ${error.message}`);
    return [];
  }
}

module.exports = {
  getStreamFlixStreams,
  getStreams: getStreamFlixStreams
};
