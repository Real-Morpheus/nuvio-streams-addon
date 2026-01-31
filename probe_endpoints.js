const { execSync } = require('child_process');
const fs = require('fs');

const COOKIE_FILE = "/tmp/netmirror_cookies.txt";
const BASE_URL = "https://net52.cc";

function test(url) {
    try {
        const body = execSync(`curl -s -L -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" "${url}"`, { encoding: 'utf8' }).substring(0, 100);
        return body.includes("File not found") ? "404" : body.length > 5 ? "OK" : "Empty";
    } catch (e) {
        return "ERROR";
    }
}

const id = "81922895"; // Inception
const paths = [
    `/details.php?id=${id}`,
    `/tv/details.php?id=${id}`,
    `/movie/details.php?id=${id}`,
    `/netflix/details.php?id=${id}`,
    `/v/details.php?id=${id}`,
    `/watch.php?id=${id}`,
    `/play.php?id=${id}`,
    `/view.php?id=${id}`,
    `/p/details.php?id=${id}`,
    `/episodes.php?series=${id}`,
    `/playlist.php?id=${id}`
];

console.log("--- Probing Endpoints ---");
paths.forEach(p => {
    console.log(`${p}: ${test(BASE_URL + p)}`);
});
