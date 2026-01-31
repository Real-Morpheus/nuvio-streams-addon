const https = require('https');
const fs = require('fs');

const url = 'https://net51.cc/';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

https.get(url, { headers }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        fs.writeFileSync('netmirror_home.html', data);
        console.log('Downloaded ' + data.length + ' bytes');
    });
}).on('error', err => console.error(err));
