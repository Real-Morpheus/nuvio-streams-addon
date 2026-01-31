const axios = require('axios');
const cheerio = require('cheerio');

const moviesDriveBase = "https://moviesdrive.forum";
const cinemetaUrl = "https://v3-cinemeta.strem.io/meta";

async function getStreams(type, imdbId, season, episode) {
    try {
        const meta = await getMetadata(type, imdbId);
        if (!meta) return [];

        const { title, year } = meta;
        const searchQuery = `${title}`;
        console.log(`[MoviesDrive] Searching for: ${searchQuery}`);

        const searchUrl = `${moviesDriveBase}/page/1/?s=${encodeURIComponent(searchQuery)}`;
        const searchRes = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(searchRes.data);

        const results = [];
        $('#moviesGridMain > a').each((i, el) => {
            const link = $(el).attr('href');
            const resultTitle = $(el).find('p').text().replace('Download ', '');
            if (link && resultTitle) {
                results.push({ title: resultTitle, link });
            }
        });

        const match = results.find(r => r.title.toLowerCase().includes(title.toLowerCase()));
        if (!match) {
            console.log('[MoviesDrive] No matching results found.');
            return [];
        }

        console.log(`[MoviesDrive] Found match: ${match.title}`);
        const pageRes = await axios.get(match.link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $$ = cheerio.load(pageRes.data);

        const streams = [];

        if (type === 'series') {
            const buttons = $$('h5 > a').filter((i, el) => !$$(el).text().toLowerCase().includes('zip'));

            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                const mainTitle = $$(btn).parent().prev().text();
                const realSeasonMatch = mainTitle.match(/(?:Season |S)(\d+)/i);
                const realSeason = realSeasonMatch ? parseInt(realSeasonMatch[1]) : 0;

                if (realSeason === parseInt(season)) {
                    const episodeLink = $$(btn).attr('href');
                    if (episodeLink) {
                        const epRes = await axios.get(episodeLink, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                        const $$$ = cheerio.load(epRes.data);

                        let elements = $$$('span:contains("Ep")');
                        if (elements.length === 0) {
                            elements = $$$('a').filter((j, el) => {
                                const t = $$$(el).text().toLowerCase();
                                return t.includes('hubcloud') || t.includes('gdflix');
                            });
                        }

                        let e = 1;
                        // This part is tricky as the structure varies.
                        // The Kotlin code iterates spans or links.
                        // Let's try to find links that match the episode number.

                        // Simplified approach: Look for text like "Ep <number>" or just iterate if structure implies order.
                        // The Kotlin code seems to handle both "span > hTag > a" and direct "a" tags.

                        // Let's try to find the specific episode link directly if possible, or collect all.
                        const episodeLinks = [];

                        // Strategy: Find all HubCloud/GDFlix links and try to map them to episodes.
                        // If we find "Ep X" headers, use them.

                        $$$('h3, h4, h5, p').each((j, el) => {
                            const text = $$$(el).text();
                            const epMatch = text.match(/Ep\s*(\d+)/i) || text.match(/Episode\s*(\d+)/i);
                            if (epMatch) {
                                const currentEp = parseInt(epMatch[1]);
                                if (currentEp === parseInt(episode)) {
                                    // Look for links in this element or next siblings
                                    let next = $$$(el).next();
                                    while (next.length > 0 && !next.text().match(/Ep\s*\d+/i)) {
                                        const links = next.find('a');
                                        links.each((k, linkEl) => {
                                            const href = $$$(linkEl).attr('href');
                                            const linkText = $$$(linkEl).text().toLowerCase();
                                            if (href && (linkText.includes('hubcloud') || linkText.includes('gdflix') || linkText.includes('gdlink'))) {
                                                streams.push({
                                                    name: 'MoviesDrive',
                                                    title: `MoviesDrive ${linkText}\n${match.title}`,
                                                    url: href
                                                });
                                            }
                                        });
                                        if (next.is('a')) {
                                            const href = next.attr('href');
                                            const linkText = next.text().toLowerCase();
                                            if (href && (linkText.includes('hubcloud') || linkText.includes('gdflix') || linkText.includes('gdlink'))) {
                                                streams.push({
                                                    name: 'MoviesDrive',
                                                    title: `MoviesDrive ${linkText}\n${match.title}`,
                                                    url: href
                                                });
                                            }
                                        }
                                        next = next.next();
                                    }
                                }
                            }
                        });

                        // Fallback: if no Ep markers, assume order? Or just search for all links.
                        if (streams.length === 0) {
                            $$$('a').each((j, el) => {
                                const href = $$$(el).attr('href');
                                const text = $$$(el).text().toLowerCase();
                                if (href && (text.includes('hubcloud') || text.includes('gdflix') || text.includes('gdlink'))) {
                                    // We don't know the episode, so maybe return all? 
                                    // Or just skip.
                                }
                            });
                        }
                    }
                }
            }

        } else {
            // Movie logic
            const buttons = $$('h5 > a');
            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                const link = $$(btn).attr('href');
                if (link) {
                    const docRes = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const $$$ = cheerio.load(docRes.data);

                    $$$('a').each((j, el) => {
                        const href = $$$(el).attr('href');
                        const text = $$$(el).text().toLowerCase();
                        if (href && (text.includes('hubcloud') || text.includes('gdflix') || text.includes('gdlink'))) {
                            streams.push({
                                name: 'MoviesDrive',
                                title: `MoviesDrive ${text}\n${match.title}`,
                                url: href
                            });
                        }
                    });
                }
            }
        }

        return streams;

    } catch (e) {
        console.error(`[MoviesDrive] Error: ${e.message}`);
        return [];
    }
}

async function getMetadata(type, id) {
    try {
        const metaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
        const { data } = await axios.get(metaUrl);
        if (data && data.meta) {
            return {
                title: data.meta.name,
                year: data.meta.year ? data.meta.year.split('-')[0] : ''
            };
        }
    } catch (e) {
        console.error(`[MoviesDrive] Metadata error: ${e.message}`);
    }
    return null;
}

module.exports = { getStreams };