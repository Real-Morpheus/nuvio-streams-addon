const { Client } = require('ssh2');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SSH Connected');

    // Inspect container environment
    const cmd = 'docker inspect nuvio-streams-app --format="{{json .Config.Env}}"';

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        let output = '';
        stream.on('data', (d) => output += d.toString());
        stream.on('stderr', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => {
            console.log('--- Container Env ---');
            try {
                const env = JSON.parse(output);
                env.sort().forEach(e => console.log(e));
            } catch (e) {
                console.log(output);
            }
            console.log('--- end ---');
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('❌ Connection error:', err);
}).connect(config);
