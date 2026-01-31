const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const verboseDebugScript = `
const { getStreams } = require('./providers/netmirror');
const axios = require('axios');

async function debug() {
    console.log('--- VERBOSE DEBUG START ---');
    try {
        // We'll hook into console.log to see all NetMirror internal logs
        const originalLog = console.log;
        console.log = (...args) => {
            originalLog('[NM-INTERNAL]', ...args);
        };

        const streams = await getStreams({ type: 'series', id: 'tt13410710', config: {} });
        console.log('--- FINAL RESULTS ---');
        console.log('Streams found:', streams.length);
        if (streams.length > 0) {
            streams.forEach((s, i) => console.log(\`[\${i}] \${s.name} - \${s.url.substring(0, 100)}...\`));
        }
    } catch (e) {
        console.error('CRITICAL ERROR:', e);
    }
}
debug();
`;

async function runVerbose() {
    const conn = new Client();
    conn.on('ready', () => {
        console.log('✅ SSH Connected');
        conn.sftp((err, sftp) => {
            if (err) throw err;
            sftp.createWriteStream('/opt/nuvio-deployment/nuvio-addon/verbose_nm_debug.js').end(verboseDebugScript);

            setTimeout(() => {
                const cmd = 'docker cp /opt/nuvio-deployment/nuvio-addon/verbose_nm_debug.js nuvio-streams-app:/app/verbose_nm_debug.js && docker exec nuvio-streams-app node verbose_nm_debug.js';
                conn.exec(cmd, (err, stream) => {
                    if (err) throw err;
                    stream.on('data', (d) => process.stdout.write(d.toString()));
                    stream.on('stderr', (d) => process.stderr.write(d.toString()));
                    stream.on('close', () => {
                        console.log('✅ Verbose Debug Finished');
                        conn.end();
                    });
                });
            }, 1000);
        });
    }).connect(sshConfig);
}

runVerbose();
