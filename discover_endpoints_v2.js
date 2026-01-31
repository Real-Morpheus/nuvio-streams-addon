const { execSync } = require('child_process');
const fs = require('fs');

const COOKIE_FILE = "/tmp/netmirror_cookies.txt";
const BASE_URL = "https://net52.cc";

function curl(url, ref = "") {
    const refArg = ref ? `-e "${ref}"` : "";
    try {
        return execSync(`curl -s -L -b "${COOKIE_FILE}" -c "${COOKIE_FILE}" ${refArg} "${url}"`, { encoding: 'utf8' });
    } catch (e) {
        return `ERROR: ${e.message}`;
    }
}

let output = "--- Test Results ---\n";

output += "\n1. Root Search (Inception):\n";
output += curl(`${BASE_URL}/search.php?q=Inception`).substring(0, 500);

output += "\n\n2. /tv/ Search (Inception):\n";
output += curl(`${BASE_URL}/tv/search.php?q=Inception`).substring(0, 500);

output += "\n\n3. /movie/ Search (Inception):\n";
output += curl(`${BASE_URL}/movie/search.php?q=Inception`).substring(0, 500);

output += "\n\n4. /tv/details.php?id=81922895:\n";
output += curl(`${BASE_URL}/tv/details.php?id=81922895`, `${BASE_URL}/tv/home`).substring(0, 500);

output += "\n\n5. /movie/details.php?id=81922895:\n";
output += curl(`${BASE_URL}/movie/details.php?id=81922895`, `${BASE_URL}/movie/home`).substring(0, 500);

output += "\n\n6. Root /details.php?id=81922895:\n";
output += curl(`${BASE_URL}/details.php?id=81922895`, `${BASE_URL}/home`).substring(0, 500);

fs.writeFileSync("/tmp/disc_results.txt", output);
console.log("Done");
