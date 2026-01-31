const { execSync } = require('child_process');
const fs = require('fs');

const COOKIE_FILE = "/tmp/netmirror_cookies.txt";
const BASE_URL = "https://net52.cc";

function log(msg) {
    console.log(`[PROBE] ${msg}`);
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

    // 1. Check Search with different params
    const queries = [
        `${BASE_URL}/search.php?q=Inception`,
        `${BASE_URL}/tv/search.php?q=Inception`,
        `${BASE_URL}/search.php?q=27205`,
        `${BASE_URL}/tv/search.php?q=27205`
    ];

    for (const q of queries) {
        const res = curl(q);
        log(`Query: ${q} -> Res Len: ${res.length}`);
        if (res.length > 0 && res.length < 2000) {
            log(`Preview: ${res.substring(0, 200)}`);
        }
    }

    // 2. Look for any details.php in the results
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
        if (res.length > 0 && res.length < 1000) {
            log(`Preview: ${res.substring(0, 200)}`);
        }
    }

    // 3. Try to get the home page and find ONE working movie link
    log("Fetching Home...");
    const home = curl(BASE_URL + "/");
    log(`Home Len: ${home.length}`);
    const detailLinks = home.match(/details\.php\?id=[0-9]+/g);
    if (detailLinks) {
        log(`Found detail links in home: ${detailLinks.slice(0, 5).join(", ")}`);
    } else {
        log("No detail links found in home HTML.");
        // Try regex for just IDs
        const ids = home.match(/\"id\":\"[0-9]+\"/g);
        if (ids) log(`Found IDs in home: ${ids.slice(0, 5).join(", ")}`);
    }
}

run();
