const crypto = require('crypto');
const fs = require('fs');

function md5(input) {
    return crypto.createHash('md5').update(input).digest('hex');
}

const samples = [
    {
        id: '81786449',
        tm: '1769421185',
        salt: 'ni',
        h1: 'f5e9bcadc11c14869c10bcf09f288a45',
        h2: 'e5cd63cb5eb41a487bf750bb6bea62e2',
        desc: 'Unknown'
    },
    {
        id: '80229869',
        tm: '1769423177',
        salt: 'ni',
        h1: 'af72f00e2e1889ad6f5be0b918e49636',
        h2: '90a5f2b89176c79afc62ce36b847188f',
        desc: 'Stranger Things S4E4'
    }
];

let output = '--- Multi-Sample Analysis ---\n';

samples.forEach((s, idx) => {
    output += `\nSample ${idx + 1} (${s.desc}):\nID: ${s.id}, TM: ${s.tm}, Salt: ${s.salt}\nH1: ${s.h1}\nH2: ${s.h2}\n`;
});

const secrets = ['', 'netmirror', 'net51', 'ni', 'ti', 'salt', 'hash', 'secret', 'video', 'player', 'hls', 'm3u8', 'test', '123456', 'mirror'];

// Analysis for Hash 1
output += '\n--- HASH 1 Analysis ---\n';
// Hypothesis: H1 depends on ID only, or ID + Secret? (Since H1 is different for different IDs)
// It doesn't seem to depend on TM if H1 is static for a file... but we only have 1 timestamps per ID.
// Let's assume H1 = md5(pattern(ID))

samples.forEach((s, idx) => {
    output += `\nChecking Sample ${idx + 1} H1 (${s.h1})...\n`;
    let found = false;

    // Patterns for H1
    const patterns = [
        { name: 'md5(id)', val: md5(s.id) },
        { name: 'md5("in=" + id)', val: md5("in=" + s.id) },
        { name: 'md5(id + salt)', val: md5(s.id + s.salt) },
        { name: 'md5(salt + id)', val: md5(s.salt + s.id) },
        { name: 'md5("movie_" + id)', val: md5("movie_" + s.id) },
        { name: 'md5(id + "movie")', val: md5(s.id + "movie") },
    ];

    // Bruteforce secrets
    secrets.forEach(sec => {
        patterns.push({ name: `md5('${sec}' + id)`, val: md5(sec + s.id) });
        patterns.push({ name: `md5(id + '${sec}')`, val: md5(s.id + sec) });
        patterns.push({ name: `md5('${sec}' + id + '${sec}')`, val: md5(sec + s.id + sec) });
    });

    patterns.forEach(p => {
        if (p.val === s.h1) {
            output += `MATCH ✅ ${p.name}\n`;
            found = true;
        }
    });
    if (!found) output += 'No simple matches found for H1.\n';
});


// Analysis for Hash 2
output += '\n--- HASH 2 Analysis ---\n';
// Hypothesis: H2 depends on H1 + TM + Salt?
samples.forEach((s, idx) => {
    output += `\nChecking Sample ${idx + 1} H2 (${s.h2})...\n`;
    let found = false;

    const patterns = [
        { name: 'md5(h1 + tm + salt)', val: md5(s.h1 + s.tm + s.salt) },
        { name: 'md5(h1 + salt + tm)', val: md5(s.h1 + s.salt + s.tm) },
        { name: 'md5(tm + h1 + salt)', val: md5(s.tm + s.h1 + s.salt) },
        { name: 'md5(salt + h1 + tm)', val: md5(s.salt + s.h1 + s.tm) },
        { name: 'md5(id + tm + salt)', val: md5(s.id + s.tm + s.salt) },
        { name: 'md5(id + salt + tm)', val: md5(s.id + s.salt + s.tm) },
        // Double hashing
        { name: 'md5(md5(id + tm + salt))', val: md5(md5(s.id + s.tm + s.salt)) },
        // With colons
        { name: 'md5(h1 + "::" + tm + "::" + salt)', val: md5(s.h1 + "::" + s.tm + "::" + s.salt) },
        { name: 'md5(tm + "::" + h1 + "::" + salt)', val: md5(s.tm + "::" + s.h1 + "::" + s.salt) },
    ];

    // Bruteforce secrets for H2
    secrets.forEach(sec => {
        patterns.push({ name: `md5('${sec}' + h1 + tm)`, val: md5(sec + s.h1 + s.tm) });
        patterns.push({ name: `md5(h1 + tm + '${sec}')`, val: md5(s.h1 + s.tm + sec) });
    });

    patterns.forEach(p => {
        if (p.val === s.h2) {
            output += `MATCH ✅ ${p.name}\n`;
            found = true;
        }
    });

    if (!found) output += 'No simple matches found for H2.\n';
});

fs.writeFileSync('analysis_results_multi.txt', output);
console.log('Done.');
