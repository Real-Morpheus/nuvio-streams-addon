const provider = require('./providers/netmirror');

async function test() {
    try {
        console.log('Searching for Inception...');
        const searchResults = await provider.searchContent('Inception', 'netflix');
        if (searchResults.length > 0) {
            const item = searchResults[0];
            console.log(`Found: ${item.title}`);
            const streams = await provider.getStreamingLinks(item.id, 'netflix');
            if (streams.length > 0) {
                console.log('RAW_URL: ' + streams[0].url);
            } else {
                console.log('NO_STREAMS');
            }
        } else {
            console.log('NO_RESULTS');
        }
    } catch (e) {
        console.error(e);
    }
}
test();
