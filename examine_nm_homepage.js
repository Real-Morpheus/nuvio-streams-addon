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
    // Fetch full homepage and save it
    const cmd = "curl -s -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 'https://net51.cc/' > /opt/nuvio-deployment/nuvio-addon/nm_homepage.html";
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            console.log('✅ Homepage saved on VPS');
            // Now cat it
            conn.exec('cat /opt/nuvio-deployment/nuvio-addon/nm_homepage.html', (err, st) => {
                if (err) throw err;
                let body = '';
                st.on('data', (d) => body += d.toString());
                st.on('close', () => {
                    // Look for search or input tags
                    console.log('--- HOMEPAGE SNIPPET ---');
                    const searchMatch = body.match(/<form[^>]*action=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/gi);
                    if (searchMatch) {
                        searchMatch.forEach(m => console.log('FORM:', m));
                    } else {
                        console.log('No form found. Looking for inputs...');
                        const inputMatch = body.match(/<input[^>]*>/gi);
                        if (inputMatch) {
                            inputMatch.forEach(m => console.log('INPUT:', m));
                        }
                    }
                    conn.end();
                });
            });
        });
    });
}).connect(sshConfig);
