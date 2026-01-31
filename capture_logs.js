const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');

    // Start log streaming in background
    conn.exec('docker logs -f nuvio-streams-app 2>&1', (err, stream) => {
        if (err) throw err;

        let logs = '';
        stream.on('data', (d) => {
            const chunk = d.toString();
            logs += chunk;
            process.stdout.write(chunk);
        });

        console.log('--- Started Log Streaming ---');

        // Trigger search via CURL on VPS after 2 seconds
        setTimeout(async () => {
            console.log('--- Triggering Search via CURL on VPS ---');
            const curlCmd = 'curl -s http://localhost:7000/stream/movie/tt0137523.json';
            conn.exec(curlCmd, (err, stream) => {
                if (err) throw err;
                let body = '';
                stream.on('data', (d) => body += d.toString());
                stream.on('close', () => {
                    console.log('--- CURL Finished ---');
                    try {
                        const data = JSON.parse(body);
                        const netmirrorStreams = (data.streams || []).filter(s => s.name.includes('NetMirror'));
                        console.log(`NetMirror Streams found: ${netmirrorStreams.length}`);
                    } catch (e) {
                        console.log('Failed to parse CURL response');
                    }

                    // Wait another 10 seconds for final logs
                    setTimeout(() => {
                        console.log('--- Log Streaming Finished ---');
                        conn.end();
                    }, 10000);
                });
            });
        }, 2000);
    });
}).connect({
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
});
