
const { execSync } = require('child_process');

const urls = [
    "https://net52.cc/tv/api_search.php",
    "https://net52.cc/tv/search.php",
];

urls.forEach(url => {
    try {
        const cmd = `curl -s -L -o /dev/null -w "%{http_code} %{url_effective}" "${url}"`;
        const result = execSync(cmd).toString();
        console.log(`Original: ${url} -> Result: ${result}`);
    } catch (e) {
        console.log(`${url} -> Error: ${e.message}`);
    }
});
