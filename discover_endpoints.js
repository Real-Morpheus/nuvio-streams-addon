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

console.log("--- Testing Endpoints ---");

console.log("\n1. Root Search (Inception):");
const r1 = curl(`${BASE_URL}/search.php?q=Inception`);
console.log(r1.substring(0, 300));

console.log("\n2. /tv/ Search (Inception):");
const r2 = curl(`${BASE_URL}/tv/search.php?q=Inception`);
console.log(r2.substring(0, 300));

console.log("\n3. /movie/ Search (Inception):");
const r3 = curl(`${BASE_URL}/movie/search.php?q=Inception`);
console.log(r3.substring(0, 300));

console.log("\n4. Trying /tv/details.php?id=81922895:");
const r4 = curl(`${BASE_URL}/tv/details.php?id=81922895`, `${BASE_URL}/tv/home`);
console.log(r4.substring(0, 300));

console.log("\n5. Trying /movie/details.php?id=81922895:");
const r5 = curl(`${BASE_URL}/movie/details.php?id=81922895`, `${BASE_URL}/movie/home`);
console.log(r5.substring(0, 300));

console.log("\n6. Trying root /details.php?id=81922895:");
const r6 = curl(`${BASE_URL}/details.php?id=81922895`, `${BASE_URL}/home`);
console.log(r6.substring(0, 300));

console.log("\n7. Checking Home Page for endpoint hints:");
const home = curl(`${BASE_URL}/tv/home`);
console.log("Home contains 'details.php'?:", home.includes("details.php"));
console.log("Home contains 'search.php'?:", home.includes("search.php"));
const links = home.match(/href="[^"]+"/g);
if (links) {
    console.log("Some links found:", links.slice(0, 10).join(", "));
}
