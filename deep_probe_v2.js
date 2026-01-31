const { execSync } = require('child_process');
const fs = require('fs');

const COOKIE_FILE = "/tmp/netmirror_cookies.txt";
const BASE_URL = "https://net52.cc";

let results = "";
function log(msg) {
    results += `[PROBE] ${msg}\n`;
}

function curl(url, body = null) {
    const method = body ? "POST" : "GET";
    const data = body ? `--data "${body}"` : "";
    try {
        const cmd = `curl -s -L -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" -X ${method} ${data} "${url}"`;
        return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } catch (e) {
        return `ERROR: ${e.message}`;
    }
}

async function run() {
    log("Starting Deep Probe...");

    const queries = [
        `${BASE_URL}/search.php?q=Inception`,
        `${BASE_URL}/tv/search.php?q=Inception`,
        `${BASE_URL}/search.php?q=27205`,
        `${BASE_URL}/tv/search.php?q=27205`
    ];

    for (const q of queries) {
        const res = curl(q);
        log(`Query: ${q} -> Res Len: ${res.length}`);
        if (res.length > 0) {
            log(`Preview: ${res.substring(0, 500)}`);
        }
    }

    const knownId = "81922895";
    const detailsAttempts = [
        `${BASE_URL}/details.php?id=${knownId}`,
        `${BASE_URL}/tv/details.php?id=${knownId}`,
        `${BASE_URL}/playlist.php?id=${knownId}`,
        `${BASE_URL}/tv/playlist.php?id=${knownId}`
    ];

    for (const d of detailsAttempts) {
        const res = curl(d);
        log(`Details: ${d} -> Res Len: ${res.length}`);
        log(`Preview: ${res.substring(0, 500)}`);
    }

    log("Fetching Home...");
    const home = curl(BASE_URL + "/");
    log(`Home Len: ${home.length}`);
    const detailLinks = home.match(/details\.php\?id=[0-9]+/g);
    if (detailLinks) {
        log(`Found detail links in home: ${detailLinks.slice(0, 5).join(", ")}`);
    } else {
        log("No detail links found in home HTML.");
    }

    fs.writeFileSync("/tmp/deep_results.txt", results);
}

run();
