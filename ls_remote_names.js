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

    const command = 'docker exec nuvio-streams-app echo "hello"';
    console.log(`Executing: ${command}`);

    conn.exec(command, (err, stream) => {
        if (err) {
            console.error('Exec error: ' + err);
            conn.end();
            return;
        }

        let output = '';
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            console.log('--- Container Names ---');
            console.log(output);
            conn.end();
        }).on('data', (data) => {
            output += data.toString();
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
