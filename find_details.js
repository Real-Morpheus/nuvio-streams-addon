const { execSync } = require('child_process');
const fs = require('fs');

const COOKIE_FILE = "/tmp/netmirror_cookies.txt";
const BASE_URL = "https://net52.cc";

function curl(url) {
    return execSync(`curl -s -L -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" "${url}"`, { encoding: 'utf8' });
}

console.log("Searching for Inception...");
const body = curl(`${BASE_URL}/search.php?q=Inception`);
const match = body.match(/\"id\":\"([0-9]+)\"/);
if (!match) {
    console.log("No ID found in search result");
    console.log("Body length:", body.length);
    console.log("Body preview:", body.substring(0, 300));
    process.exit(1);
}

const id = match[1];
console.log(`Found ID: ${id}`);

const paths = ["", "/tv", "/v", "/p", "/netflix"];
for (const p of paths) {
    const durl = `${BASE_URL}${p}/details.php?id=${id}`;
    const res = curl(durl);
    if (!res.includes("File not found") && res.length > 500) {
        console.log(`✅ WORKING DETAILS: ${durl}`);
        console.log("Preview:", res.substring(0, 300));
        break;
    } else {
        console.log(`❌ FAILED: ${durl} (Size: ${res.length})`);
    }
}
