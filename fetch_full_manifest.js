const { Client } = require('ssh2');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');

    // Use a fresh token from a new master manifest fetch
    const masterUrl = 'https://net51.cc/pv/hls/0KVQ8MNNEUBI4MPGFI1WSFPTYD.m3u8?q=720p&in=::d56818553c5fc64b48598ae2b8a33401::1769357270::ed';

    conn.exec(`curl -s -H "User-Agent: Mozilla/5.0" -H "Referer: https://net51.cc/" "${masterUrl}"`, (err, stream) => {
        let masterContent = '';
        stream.on('data', (d) => masterContent += d.toString());
        stream.on('close', () => {
            const lines = masterContent.split('\n');
            const subUrlLine = lines.find(l => l.trim() && !l.startsWith('#'));
            if (subUrlLine) {
                const subUrl = new URL(subUrlLine.trim(), masterUrl).toString();
                console.log(`Sub-Playlist URL: ${subUrl}`);
                conn.exec(`curl -s -H "User-Agent: Mozilla/5.0" -H "Referer: https://net51.cc/" "${subUrl}"`, (err, subStream) => {
                    let subContent = '';
                    subStream.on('data', (d) => subContent += d.toString());
                    subStream.on('close', () => {
                        console.log('--- Full Sub-Playlist Content ---');
                        console.log(subContent);

                        // Try to fetch the EXACT first segment from this manifest
                        const subLines = subContent.split('\n');
                        const firstSegment = subLines.find(l => l.trim() && !l.startsWith('#'));
                        if (firstSegment) {
                            const segUrl = new URL(firstSegment.trim(), subUrl).toString();
                            console.log(`\nTesting Fresh Segment URL: ${segUrl}`);
                            conn.exec(`curl -i -H "User-Agent: Mozilla/5.0" -H "Referer: https://net51.cc/" "${segUrl}" | head -n 20`, (err, segStream) => {
                                let segResp = '';
                                segStream.on('data', (d) => segResp += d.toString());
                                segStream.on('close', () => {
                                    console.log('--- Fresh Segment Response ---');
                                    console.log(segResp);
                                    conn.end();
                                });
                            });
                        } else {
                            conn.end();
                        }
                    });
                });
            } else {
                console.log('No sub-playlist found in master manifest');
                console.log(masterContent);
                conn.end();
            }
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
