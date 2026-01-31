const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const deepTraceScript = `
const { getStreams } = require('./providers/netmirror');
const fs = require('fs');

async function debug() {
    console.log('--- DEEP TRACE START ---');
    
    // Inject logging into providers/netmirror.js dynamically? No, too hard.
    // We'll use a modified version of the file for testing.
    // I will read the file, inject logs, and run it.
    
    try {
        let content = fs.readFileSync('./providers/netmirror.js', 'utf8');
        
        // Inject logs into searchContent
        content = content.replace(
            'return bypass().then(function (cookie) {',
            'return bypass().then(function (cookie) { console.log("[TRACE] searchContent: cookie=" + cookie);'
        );
        content = content.replace(
            'return response.json();',
            'return response.json().then(j => { console.log("[TRACE] searchContent: raw results=" + JSON.stringify(j).substring(0, 200)); return j; });'
        );
        
        // Inject logs into loadContent
        content = content.replace(
            'function loadContent(id, platform) {',
            'function loadContent(id, platform) { console.log("[TRACE] loadContent: id=" + id + ", platform=" + platform);'
        );

        fs.writeFileSync('./providers/netmirror_debug.js', content);
        
        const { getStreams: getStreamsDebug } = require('./providers/netmirror_debug');
        
        console.log('--- STARTING PROVIDER FLOW ---');
        const streams = await getStreamsDebug('tt1375666', 'movie');
        console.log('--- FINAL RESULTS ---');
        console.log('Streams count:', streams.length);
    } catch (e) {
        console.error('TRACE ERROR:', e);
    }
}
debug();
`;

async function runDeepTrace() {
    const conn = new Client();
    conn.on('ready', () => {
        console.log('✅ SSH Connected');
        conn.sftp((err, sftp) => {
            if (err) throw err;
            sftp.createWriteStream('/opt/nuvio-deployment/nuvio-addon/deep_trace.js').end(deepTraceScript);

            setTimeout(() => {
                const cmd = 'docker exec nuvio-streams-app node -e "' + deepTraceScript.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';
                conn.exec(cmd, (err, stream) => {
                    if (err) throw err;
                    stream.on('data', (d) => process.stdout.write(d.toString()));
                    stream.on('stderr', (d) => process.stderr.write(d.toString()));
                    stream.on('close', () => {
                        console.log('✅ Deep Trace Finished');
                        conn.end();
                    });
                });
            }, 1000);
        });
    }).connect(sshConfig);
}

runDeepTrace();
