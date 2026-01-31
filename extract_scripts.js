const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'netmirror_home.html'), 'utf8');
const regex = /<script[^>]*src="([^"]*)"/g;
let match;
while ((match = regex.exec(html)) !== null) {
    console.log(match[1]);
}
