const { execSync } = require('child_process');
const fs = require('fs');

const COOKIE_FILE = "/tmp/netmirror_cookies.txt";
const BASE_URL = "https://net52.cc";

function test(url) {
    try {
        const body = execSync(`curl -s -L -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" "${url}"`, { encoding: 'utf8' });
        if (body.includes("File not found")) return "404";
        if (body.length < 10) return "Empty";
        return "OK " + body.substring(0, 50);
    } catch (e) {
        return "ERROR: " + e.message;
    }
}

const id = "81922895"; // Inception
const paths = [
    `/details.php?id=${id}`,
    `/tv/details.php?id=${id}`,
    `/v/details.php?id=${id}`,
    `/watch.php?id=${id}`,
    `/play.php?id=${id}`,
    `/view.php?id=${id}`,
    `/episodes.php?series=${id}`,
    `/playlist.php?id=${id}`
];

let res = "--- Probing results ---\n";
paths.forEach(p => {
    res += `${p}: ${test(BASE_URL + p)}\n`;
});

fs.writeFileSync("/tmp/probe_results.txt", res);
console.log("Done");
