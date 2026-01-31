const axios = require('axios');
const crypto = require('crypto');

const NETMIRROR_BASE = "https://net51.cc";
const BASE_HEADERS = {
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive"
};

let globalCookies = {};
const COOKIE_EXPIRY = 54e6;
let cookieTimestamp = 0;

function makeRequest(url, options = {}) {
    let headers = { ...options.headers };
    if (url.includes(NETMIRROR_BASE)) {
        headers = { ...BASE_HEADERS, ...headers };
    }

    // Simple axios wrapper
    const axiosOptions = {
        method: options.method || 'GET',
        url: url,
        headers: headers,
        timeout: 10000,
        validateStatus: () => true
    };
    if (options.body) axiosOptions.data = options.body;

    return axios(axiosOptions).then(function (response) {
        return {
            ok: response.status >= 200 && response.status < 300,
            json: () => Promise.resolve(response.data),
            text: () => Promise.resolve(typeof response.data === 'string' ? response.data : JSON.stringify(response.data)),
            headers: {
                get: (name) => {
                    const val = response.headers[name.toLowerCase()];
                    return Array.isArray(val) ? val.join(', ') : val;
                }
            }
        };
    });
}

function bypass() {
    // Simplified bypass for standalone script
    return makeRequest(`${NETMIRROR_BASE}/tv/p.php`, {
        method: "POST",
        headers: BASE_HEADERS
    }).then(function (response) {
        const setCookieHeader = response.headers.get("set-cookie");
        const newCookies = {};
        if (setCookieHeader) {
            const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
            cookieStrings.forEach(s => {
                const parts = s.split(';');
                parts.forEach(part => {
                    const match = part.trim().match(/^([^=]+)=([^;]+)/);
                    if (match) {
                        newCookies[match[1].trim()] = match[2].trim();
                    }
                });
            });
        }
        return response.text().then(function (responseText) {
            if (Object.keys(newCookies).length > 0) {
                return newCookies;
            }
            throw new Error("Failed to extract authentication cookies");
        });
    });
}

function loadContent(contentId, platform) {
    console.log(`Checking ID: ${contentId} on ${platform}...`);
    const ottMap = { "netflix": "nf", "primevideo": "pv", "disney": "hs" };
    const ott = ottMap[platform] || "nf";

    return bypass().then(function (cookies) {
        const allCookies = { ...cookies, "ott": ott, "hd": "on" };
        const cookieString = Object.entries(allCookies).map(([key, value]) => `${key}=${value}`).join("; ");

        const postEndpoints = {
            "netflix": `${NETMIRROR_BASE}/post.php`,
            "primevideo": `${NETMIRROR_BASE}/pv/post.php`,
            "disney": `${NETMIRROR_BASE}/mobile/hs/post.php`
        };
        const postUrl = postEndpoints[platform];

        return makeRequest(
            `${postUrl}?id=${contentId}&t=${Math.floor(Date.now() / 1e3)}`,
            {
                headers: { ...BASE_HEADERS, "Cookie": cookieString, "Referer": `${NETMIRROR_BASE}/tv/home` }
            }
        );
    }).then(r => r.json());
}

async function run() {
    const id = '80057281';
    try {
        // Try Netflix first
        let data = await loadContent(id, 'netflix');
        if (data.title) {
            console.log(`\nFOUND on Netflix! Title: ${data.title}`);
            console.log(`Year: ${data.year}`);
            console.log(`Desc: ${data.desc}`);
            return;
        } else {
            console.log('Not found on Netflix');
        }

        // Try Prime
        data = await loadContent(id, 'primevideo');
        if (data.title) {
            console.log(`\nFOUND on Prime! Title: ${data.title}`);
            return;
        } else {
            console.log('Not found on Prime');
        }

        // Try Disney
        data = await loadContent(id, 'disney');
        if (data.title) {
            console.log(`\nFOUND on Disney! Title: ${data.title}`);
            return;
        } else {
            console.log('Not found on Disney');
        }

    } catch (e) {
        console.error(e);
    }
}

run();
