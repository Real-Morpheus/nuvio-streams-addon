const https = require('https');
const fs = require('fs');
const path = require('path');

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://net51.cc/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
};

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, { headers }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                console.log(`Redirecting to ${response.headers.location}`);
                download(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function run() {
    try {
        console.log('Downloading homepage...');
        await download('https://net51.cc/tv/home', 'netmirror_home.html');
        console.log('Homepage saved.');

        const html = fs.readFileSync('netmirror_home.html', 'utf8');
        const scriptRegex = /src="([^"]+\.js[^"]*)"/g;
        let match;
        const scripts = [];

        while ((match = scriptRegex.exec(html)) !== null) {
            let scriptUrl = match[1];
            if (scriptUrl.startsWith('/')) {
                scriptUrl = 'https://net51.cc' + scriptUrl;
            } else if (!scriptUrl.startsWith('http')) {
                scriptUrl = 'https://net51.cc/' + scriptUrl;
            }
            scripts.push(scriptUrl);
        }

        console.log(`Found ${scripts.length} scripts:`);
        scripts.forEach(s => console.log(s));

        fs.writeFileSync('netmirror_scripts_list.txt', scripts.join('\n'));

    } catch (error) {
        console.error('Error:', error.message);
    }
}

run();
