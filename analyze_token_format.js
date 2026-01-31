const crypto = require('crypto');

function md5(input) {
    return crypto.createHash('md5').update(input).digest('hex');
}

const targetHash1 = 'f5e9bcadc11c14869c10bcf09f288a45';
const targetHash2 = 'e5cd63cb5eb41a487bf750bb6bea62e2';
const id = '81786449';
const tm = '1769421185';
const salt = 'ni';

const fs = require('fs');
let output = '';

output += '--- Analysis ---\n';
output += `ID: ${id}\n`;
output += `TM: ${tm}\n`;
output += `Salt: ${salt}\n`;

// Check Hash 1
output += '\nChecking Hash 1 candidates:\n';
const h1_candidates = [
    { name: 'md5(id)', val: md5(id) },
    { name: 'md5("in=" + id)', val: md5("in=" + id) },
    { name: 'md5(id + salt)', val: md5(id + salt) },
    { name: 'md5(salt + id)', val: md5(salt + id) }
];

h1_candidates.forEach(c => {
    const match = c.val === targetHash1 ? 'MATCH ✅' : 'FAIL ❌';
    output += `${c.name}: ${c.val} - ${match}\n`;
});


// Check Hash 2 (Token?)
output += '\nChecking Hash 2 candidates:\n';
const h2_candidates = [
    { name: 'md5(h1 + tm + salt)', val: md5(targetHash1 + tm + salt) },
    { name: 'md5(h1 + salt + tm)', val: md5(targetHash1 + salt + tm) },
    { name: 'md5(id + tm + salt)', val: md5(id + tm + salt) },
    // ...
];

h2_candidates.forEach(c => {
    const match = c.val === targetHash2 ? 'MATCH ✅' : 'FAIL ❌';
    output += `${c.name}: ${c.val} - ${match}\n`;
});

// Bruteforce Hash 1
output += '\nBruteforce Hash 1:\n';
const prefixes = ['', 'netmirror', 'net51', 'ni', 'ti', 'salt', 'hash', 'secret', 'video'];
const suffixes = ['', 'netmirror', 'net51', 'ni', 'ti', 'salt', 'hash', 'secret', 'video'];

for (const p of prefixes) {
    for (const s of suffixes) {
        const val = md5(p + id + s);
        if (val === targetHash1) {
            output += `MATCH ✅ found for md5('${p}' + id + '${s}')\n`;
        }
    }
}


fs.writeFileSync('analysis_results_v2.txt', output);
console.log('Results written to analysis_results_v2.txt');
