const { getStreams } = require('./providers/netmirror');

async function run() {
    try {
        console.log('--- INTERNAL TEST START ---');
        // TMDB ID for Inception is 27205
        console.log('Testing Inception (TMDB 27205)...');
        const s1 = await getStreams('27205', 'movie');
        console.log('Inception Result Count:', s1.length);
        if (s1.length > 0) {
            console.log('Sample URL:', s1[0].url);
        } else {
            console.log('No streams found for Inception.');
        }

        // Test Solo Leveling (Series)
        // TMDB ID for Solo Leveling is 111110 (Anime)
        console.log('Testing Solo Leveling (TMDB 111110) [TV]...');
        const s2 = await getStreams('111110', 'tv', 1, 1);
        console.log('Solo Leveling Result Count:', s2.length);
        if (s2.length > 0) {
            console.log('Sample URL:', s2[0].url);
        } else {
            console.log('No streams found for Solo Leveling.');
        }

    } catch (e) {
        console.error('Test Error:', e);
    }
}
run();
