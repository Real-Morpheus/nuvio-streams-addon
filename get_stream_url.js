const axios = require('axios');

async function getUrl() {
    try {
        const url = 'https://nuvio.stremio.click/stream/movie/tt1375666.json';
        const res = await axios.get(url, { timeout: 60000 });

        console.log(`Response status: ${res.status}`);
        if (res.data.streams) {
            const netmirrorStreams = res.data.streams.filter(s => s.name && s.name.toLowerCase().includes('netmirror'));
            if (netmirrorStreams.length > 0) {
                console.log('✅ NetMirror Stream Found:');
                netmirrorStreams.forEach(s => {
                    console.log(`- ${s.name}: ${s.url.substring(0, 100)}...`);
                });
            } else {
                console.log('❌ NO NETMIRROR STREAMS found among ' + res.data.streams.length + ' results.');
                console.log('Available providers: ' + [...new Set(res.data.streams.map(s => s.name))].join(', '));
            }
        } else {
            console.log('NO_STREAMS_IN_RESPONSE');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}
getUrl();
