const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989',
    remoteDir: '/opt/nuvio-deployment/nuvio-addon'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Connected');

    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP error: ' + err);
            conn.end();
            return;
        }

        const localFile = path.join(__dirname, 'reproduce_netmirror_stream.js');
        const remoteFile = `${config.remoteDir}/reproduce_netmirror_stream.js`;

        console.log(`Uploading ${localFile} to ${remoteFile}...`);

        sftp.fastPut(localFile, remoteFile, (err) => {
            if (err) {
                console.error(`Error uploading: ${err}`);
                conn.end();
                return;
            }
            console.log('✅ Uploaded reproduction script');

            // Now run it inside the container and redirect to file
            const command = `docker exec -w /app nuvio-streams-app node reproduce_netmirror_stream.js && docker exec -w /app nuvio-streams-app cat reproduce_log.txt`;
            console.log(`Executing: ${command}`);

            let fullOutput = '';
            conn.exec(command, (err, stream) => {
                if (err) {
                    console.error('Exec error: ' + err);
                    conn.end();
                    return;
                }

                stream.on('close', (code, signal) => {
                    console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                    fs.writeFileSync('remote_log_capture.txt', fullOutput);
                    console.log('Full output written to remote_log_capture.txt');
                    conn.end();
                }).on('data', (data) => {
                    fullOutput += data.toString();
                    process.stdout.write(data);
                }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('Connection error: ' + err);
}).connect(config);
