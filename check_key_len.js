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
    const cmd = "docker exec nuvio-streams-app node -e 'console.log(\"KEY_LEN:\", process.env.TMDB_API_KEY.length, \"VAL:\", JSON.stringify(process.env.TMDB_API_KEY))'";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('stderr', (d) => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect(sshConfig);
