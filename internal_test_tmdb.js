const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const internalTestScript = `
const { getStreams } = require('./providers/netmirror');

async function test() {
    console.log('--- TESTING INTERNAL GETSTREAMS ---');
    try {
        // Test for Inception (tt1375666) -> Movie
        console.log('Fetching Inception (tt1375666)...');
        const streams = await getStreams('tt1375666', 'movie');
        console.log('Streams found:', streams.length);
        streams.forEach(s => console.log('Stream URL:', s.url));

        // Test for Solo Leveling (tt13410710) -> Series
        console.log('Fetching Solo Leveling (tt13410710)...');
        const streams2 = await getStreams('tt13410710', 'series'); // Note: calling it 'series' as per addon logic? No, types are 'movie' or 'tv'.
        // Wait, addon passes 'tv'?
        // Let's check addon.js mapping. 
        // Logic says: const tmdbTypeFromId = type === 'series' ? 'tv' : 'movie';
        // But getStreams signature: getStreams(tmdbId, mediaType = "movie", ...)
        // Let's try 'tv'
        const streams3 = await getStreams('111110', 'tv', 1, 1); // Solo Leveling TV ID is 111110 on TMDB? 
        // Wait, 13410710 is IMDb. 
        // Need to check what ID is passed.
    } catch (e) {
        console.error('Error:', e);
    }
}
// We need to know the TMDB ID for Solo Leveling if we test it directly.
// Inception TMDB ID is 27205. tt1375666 is IMDb.
// getStreams expects TMDB ID?
// Let's check the code:
// function getStreams(tmdbId, mediaType = "movie", ...){
//    const tmdbUrl = \`https://api.themoviedb.org/3/\${mediaType === "tv" ? "tv" : "movie"}/\${tmdbId}...\`;
// }
// YES! It expects TMDB ID!
// But addon.js converts it.
// If addon.js conversion fails, it returns empty?
// Wait, for Inception (tt1375666), the conversion should work.
// But verified `verify_fix.js` showed 0 streams.
// Let's check if my previous verify was using correct IDs.
// verify_fix.js called `https://nuvio.stremio.click/stream/movie/tt1375666.json`
// This uses IMDb ID. Addon must convert it.

test();
`;

// Helper script to actually run it properly inside container, requiring the right path
const runnerScript = `
const { getStreams } = require('./providers/netmirror');
async function run() {
    try {
        // TMDB ID for Inception is 27205
        console.log('Testing Inception (TMDB 27205)...');
        const s1 = await getStreams('27205', 'movie');
        console.log('Inception Result Count:', s1.length);
        if (s1.length > 0) console.log('Sample URL:', s1[0].url);

        // TMDB ID for Solo Leveling is 209867? No.
        // Let's just stick to Inception for now as it is reliable.
    } catch (e) { console.error(e); }
}
run();
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');
    conn.exec(`docker exec nuvio - streams - app node - e "${runnerScript.replace(/" / g, '\\"').replace(/\n/g, ' ')}"`, (err, stream) => {
if (err) throw err;
stream.on('data', (d) => process.stdout.write(d.toString()));
stream.on('stderr', (d) => process.stderr.write(d.toString()));
stream.on('close', () => conn.end());
    });
}).connect(sshConfig);
