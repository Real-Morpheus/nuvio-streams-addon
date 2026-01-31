const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');

async function dumpNiManifest() {
    const url_ni = 'https://net51.cc//hls/80077369.m3u8?in=34a603468efbfe2a9857bce9a5e1991b::92fe3a5d5823198df33a484fd7d8e9bf::1769446417::ni';
    const headers = {
        "Accept": "application/vnd.apple.mpegurl, video/mp4, */*",
        "Origin": "https://net51.cc",
        "Referer": "https://net51.cc/",
        "Cookie": "hd=on",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1"
    };

    try {
        const resp = await fetch(url_ni, { headers });
        const text = await resp.text();
        fs.writeFileSync('ni_manifest_full.txt', text);
        console.log("Dumped full NI manifest to ni_manifest_full.txt");
    } catch (err) {
        console.error(`Error: ${err.message}`);
    }
}

dumpNiManifest();
