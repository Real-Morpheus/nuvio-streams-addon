const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testNetMirror() {
    const url = 'https://net51.cc//hls/70131314.m3u8?in=557092a48d576e430c2cbd33cb1d48af::b649e3a5b0e622207e3e1b30232ee6bc::1769443086::ed';
    const headers = {
        "Accept": "application/vnd.apple.mpegurl, video/mp4, */*",
        "Origin": "https://net51.cc",
        "Referer": "https://net51.cc/",
        "Cookie": "hd=on",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1"
    };

    try {
        const response = await fetch(url, { headers });
        const text = await response.text();
        console.log(text);
    } catch (err) {
        console.error(`Error: ${err.message}`);
    }
}

testNetMirror();
