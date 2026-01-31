const axios = require('axios');
const cheerio = require('cheerio');

const moviesModBase = "https://moviesmod.city";
const cinemetaUrl = "https://v3-cinemeta.strem.io/meta";

async function getStreams(type, imdbId, season, episode) {
    try {
        console.log('[MoviesMod] Step 1: Getting metadata');
        const meta = await getMetadata(type, imdbId);
        if (!meta) return [];

        const { title, year } = meta;
        const searchQuery = `${title}`;
        console.log(`[MoviesMod] Searching for: ${searchQuery}`);

        const searchUrl = `${moviesModBase}/search/${encodeURIComponent(searchQuery)}/page/1`;
        console.log(`[MoviesMod] Step 2: Fetching search URL: ${searchUrl}`);
        const searchRes = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(searchRes.data);

        const results = [];
        console.log('[MoviesMod] Step 3: Parsing search results');
        $('div.post-cards > article').each((i, el) => {
            try {
                const link = $(el).find('a').attr('href');
                const titleAttr = $(el).find('a').attr('title');
                const resultTitle = titleAttr ? titleAttr.replace('Download ', '') : null;

                if (link && resultTitle) {
                    results.push({ title: resultTitle, link });
                }
            } catch (err) {
                console.error(`[MoviesMod] Error parsing item ${i}: ${err.message}`);
            }
        });

        const match = results.find(r => r.title.toLowerCase().includes(title.toLowerCase()));
        if (!match) {
            console.log('[MoviesMod] No matching results found.');
            return [];
        }

        console.log(`[MoviesMod] Found match: ${match.title}`);
        console.log(`[MoviesMod] Step 4: Fetching match link: ${match.link}`);
        const pageRes = await axios.get(match.link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $$ = cheerio.load(pageRes.data);

        const streams = [];

        if (type === 'series') {
            console.log('[MoviesMod] Step 5: Processing series');
            const buttons = $$('a.maxbutton-episode-links, a.maxbutton-g-drive, a.maxbutton-af-download');

            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                const seasonText = $$(btn).parent().prev().text();
                const realSeasonMatch = seasonText.match(/(?:Season |S)(\d+)/i);
                const realSeason = realSeasonMatch ? parseInt(realSeasonMatch[1]) : 0;

                if (realSeason === parseInt(season)) {
                    let link = $$(btn).attr('href');
                    if (link.includes('url=')) {
                        const base64Value = link.split('url=')[1];
                        link = Buffer.from(base64Value, 'base64').toString('utf-8');
                    }

                    const docRes = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const $$$ = cheerio.load(docRes.data);

                    const hTags = $$$('h3, h4');
                    hTags.each((j, el) => {
                        const epUrl = $$$(el).find('a').attr('href');
                        const text = $$$(el).text();
                        const epMatch = text.match(/Ep\s*(\d+)/i) || text.match(/Episode\s*(\d+)/i);

                        let currentEp = j + 1;
                        if (epMatch) {
                            currentEp = parseInt(epMatch[1]);
                        }

                        if (currentEp === parseInt(episode) && epUrl) {
                            streams.push({
                                name: 'MoviesMod',
                                title: `MoviesMod ${text}\n${match.title}`,
                                url: epUrl
                            });
                        }
                    });
                }
            }

        } else {
            console.log('[MoviesMod] Step 5: Processing movie');
            const buttons = $$('a.maxbutton-download-links');
            console.log(`[MoviesMod] Found ${buttons.length} buttons`);
            for (let i = 0; i < buttons.length; i++) {
                const btn = buttons[i];
                let link = $$(btn).attr('href');
                if (link && link.includes('url=')) {
                    const base64Value = link.split('url=')[1];
                    link = Buffer.from(base64Value, 'base64').toString('utf-8');
                }

                if (link) {
                    console.log(`[MoviesMod] Fetching download page: ${link}`);
                    const docRes = await axios.get(link, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const $$$ = cheerio.load(docRes.data);

                    const source = $$$('a.maxbutton-1, a.maxbutton-5').attr('href');
                    if (source) {
                        streams.push({
                            name: 'MoviesMod',
                            title: `MoviesMod Movie\n${match.title}`,
                            url: source
                        });
                    }
                }
            }
        }

        return streams;

    } catch (e) {
        console.error(`[MoviesMod] Error: ${e.message}`);
        console.error(e.stack); // Log stack trace
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
        console.error(`[MoviesMod] Metadata error: ${e.message}`);
    }
    return null;
}

module.exports = { getStreams };
