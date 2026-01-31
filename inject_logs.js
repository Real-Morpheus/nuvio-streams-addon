const { Client } = require('ssh2');

const sshConfig = {
    host: '46.38.235.254',
    port: 22,
    username: 'root',
    password: 'Bijju@1989'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connected');
    // Inject logging into showbox.js using sed
    // We want to log 'findApiUrl' and 'findResults'
    // Log line 180: console.log(`    Fetching from TMDB find API: ${findApiUrl}`);
    // We add more detailed logs before that or after.

    const cmd = `sed -i '/Fetching from TMDB find API/a console.log("DEBUG_URL:", findApiUrl);' /opt/nuvio-deployment/nuvio-addon/providers/showbox.js && \
                 sed -i '/const findResults = await response.json();/a console.log("DEBUG_RES:", JSON.stringify(findResults));' /opt/nuvio-deployment/nuvio-addon/providers/showbox.js && \
                 cd /opt/nuvio-deployment/nuvio-addon && docker compose restart app`;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('stderr', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect(sshConfig);
