const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function inspectSubPlaylist() {
    // This is a sub-playlist URL that previously failed
    const proxiedSubUrl = 'https://nuvio.stremio.click/netmirror/m3u8?url=https%3A%2F%2Fs21.freecdn4.top%2Ffiles%2F220884%2F1080p%2F1080p.m3u8%3Fin%3Dunknown%3A%3Aed&cookie=hd%3Don';

    console.log(`Fetching proxied sub-playlist: ${proxiedSubUrl}`);
    try {
        const response = await fetch(proxiedSubUrl);
        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Sub-Playlist snippet (first 500 chars):\n${text.substring(0, 500)}`);

        if (text.includes('EXTINF')) {
            console.log('✅ SUCCESS: Found EXTINF tags, this is a valid M3U8 manifest.');
        } else if (text.includes('Only Valid Users Allowed')) {
            console.log('❌ FAILED: Still getting "Only Valid Users Allowed"');
        } else {
            console.log('❓ UNKNOWN response structure.');
        }

        // Check for double colons in tokens
        const hasInvalidSuffix = /::[^n]/.test(text) || /::$/.test(text);
        if (hasInvalidSuffix) {
            console.log('⚠️ WARNING: Manifest contains non-ni suffix or empty suffix.');
            // Log the first match
            const match = text.match(/::[^&"'\n]*/);
            if (match) console.log(`First suffix match: ${match[0]}`);
        } else if (text.includes('::ni')) {
            console.log('✅ SUCCESS: Found ::ni suffixes.');
        }

    } catch (err) {
        console.error(`Error: ${err.message}`);
    }
}

inspectSubPlaylist();
