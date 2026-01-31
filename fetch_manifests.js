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

    // Test URL from vps_playlist_response.json
    const masterUrl = 'https://net51.cc/pv/hls/0KVQ8MNNEUBI4MPGFI1WSFPTYD.m3u8?q=720p&in=::d56818553c5fc64b48598ae2b8a33401::1769357270::ed';

    let command = `curl -s -H "User-Agent: Mozilla/5.0" -H "Referer: https://net51.cc/" "${masterUrl}"`;

    conn.exec(command, (err, stream) => {
        let masterContent = '';
        stream.on('data', (d) => masterContent += d.toString());
        stream.on('close', () => {
            console.log('--- Master Manifest ---');
            console.log(masterContent);

            // Try to fetch the first sub-playlist if found
            const lines = masterContent.split('\n');
            const subUrlLine = lines.find(l => l.trim() && !l.startsWith('#'));
            if (subUrlLine) {
                const subUrl = new URL(subUrlLine.trim(), masterUrl).toString();
                console.log(`\nFetching Sub-Playlist: ${subUrl}`);
                conn.exec(`curl -s -H "User-Agent: Mozilla/5.0" -H "Referer: https://net51.cc/" "${subUrl}"`, (err, subStream) => {
                    let subContent = '';
                    subStream.on('data', (d) => subContent += d.toString());
                    subStream.on('close', () => {
                        console.log('--- Sub-Playlist ---');
                        console.log(subContent.substring(0, 500));
                        conn.end();
                    });
                });
            } else {
                conn.end();
            }
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
