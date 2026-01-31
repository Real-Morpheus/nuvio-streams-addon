const https = require('https');
const fs = require('fs');

const url = 'https://nuvio.stremio.click/stream/movie/tt1375666.json';

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // fs.writeFileSync('remote_response.json', data);
        console.log('Response received. Length: ' + data.length);

        try {
            const json = JSON.parse(data);
            if (json.streams && json.streams.length > 0) {
                const u = json.streams[0].url;
                fs.writeFileSync('url_output.txt', u);
                console.log('URL written to url_output.txt');
            } else {
                console.log('No streams.');
            }
        } catch (e) { console.log('Error'); }
    });
}).on('error', (e) => console.error(e));
