const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function dumpProxiedSub() {
    const url = 'https://nuvio.stremio.click/netmirror/m3u8?url=https%3A%2F%2Fs21.freecdn4.top%2Ffiles%2F220884%2F1080p%2F1080p.m3u8%3Fin%3Dunknown%3A%3Aed&cookie=hd%3Don';
    console.log(`URL: ${url}`);
    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log('--- START RESPONSE ---');
        console.log(text);
        console.log('--- END RESPONSE ---');
    } catch (e) {
        console.error(e.message);
    }
}
dumpProxiedSub();
