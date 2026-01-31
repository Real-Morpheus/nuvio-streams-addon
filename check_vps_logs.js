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

    const hostAppDir = '/opt/nuvio-deployment/nuvio-addon';
    const containerName = 'nuvio-streams-app';
    const command = `
        docker cp ${hostAppDir}/providers/netmirror.js ${containerName}:/app/providers/netmirror.js && \
        docker cp ${hostAppDir}/reproduce_netmirror.js ${containerName}:/app/reproduce_netmirror.js && \
        docker exec -w /app ${containerName} node reproduce_netmirror.js && \
        docker cp ${containerName}:/app/reproduce_log.txt ${hostAppDir}/reproduce_log.txt && \
        docker cp ${containerName}:/app/playlist_response.json ${hostAppDir}/playlist_response.json
    `.trim().replace(/\s+/g, ' ');
    console.log(`Executing: ${command}`);

    conn.exec(command, (err, stream) => {
        if (err) {
            console.error('Exec error: ' + err);
            conn.end();
            return;
        }

        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log(data.toString());
        }).stderr.on('data', (data) => {
            console.log(data.toString());
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
