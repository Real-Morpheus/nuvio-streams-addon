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
    const queries = ['Solo Leveling', 'Inception'];

    let completed = 0;
    queries.forEach(q => {
        const cmd = `curl -s -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 'https://net51.cc/search.php?s=${encodeURIComponent(q)}'`;
        conn.exec(cmd, (err, stream) => {
            let out = '';
            stream.on('data', (d) => out += d.toString());
            stream.on('close', () => {
                console.log(`--- [${q}] ---`);
                console.log(out);
                completed++;
                if (completed === queries.length) conn.end();
            });
        });
    });
}).connect(sshConfig);
