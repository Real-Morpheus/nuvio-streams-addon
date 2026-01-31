const crypto = require('crypto');
const fs = require('fs');

function md5(input) {
    return crypto.createHash('md5').update(input).digest('hex');
}

const id = '80229869';
const tm = '1769423177';
const salt = 'ni';
const h1 = 'af72f00e2e1889ad6f5be0b918e49636';
const h2 = '90a5f2b89176c79afc62ce36b847188f';

console.log('Target H2:', h2);

const connectors = ['', ':', '::', '&', '|', '_', '-', '/', '+'];
const parts = [h1, tm, salt, id];
const secrets = ['', 'netmirror', 'net51', 'ni', 'ed', 'ti', 'hs', 'pv', 'nf', 'secret', 'token', 'key', 'movie', 'tv'];

function permute(arr) {
    if (arr.length === 0) return [[]];
    const first = arr[0];
    const rest = permute(arr.slice(1));
    const full = [];
    rest.forEach(r => {
        for (let i = 0; i <= r.length; i++) {
            const newArr = [...r];
            newArr.splice(i, 0, first);
            full.push(newArr);
        }
    });
    return full;
}

// 1. Try combinations of (H1, TM, Salt, ID)
const subsets = [
    [h1, tm, salt],
    [h1, tm],
    [h1, salt],
    [id, tm, salt],
    [id, h1, tm, salt]
];

// Add secrets to subsets
const subsetsWithSecrets = [];
subsets.forEach(sub => {
    subsetsWithSecrets.push(sub);
    secrets.forEach(sec => {
        if (sec) subsetsWithSecrets.push([...sub, sec]);
    });
});

let found = false;

console.log('Starting brute force...');

for (const sub of subsetsWithSecrets) {
    const perms = permute(sub);
    for (const p of perms) {
        for (const conn of connectors) {
            const str = p.join(conn);
            const hash = md5(str);
            if (hash === h2) {
                console.log(`MATCH FOUND! md5(${p.map(x => x === h1 ? 'H1' : x === tm ? 'TM' : x === salt ? 'SALT' : x === id ? 'ID' : x).join(conn ? `"${conn}"` : '+')})`);
                found = true;
            }
            // Try double hash
            if (md5(hash) === h2) {
                console.log(`MATCH FOUND! md5(md5(${str}))`);
                found = true;
            }
        }
    }
}

if (!found) console.log('No match found for H2.');

// Brute force H1
console.log('\nTarget H1:', h1);
const h1_subsets = [
    [id, salt],
    [id]
];
const h1_subsets_sec = [];
h1_subsets.forEach(sub => {
    h1_subsets_sec.push(sub);
    secrets.forEach(sec => {
        if (sec) h1_subsets_sec.push([...sub, sec]);
    });
});

for (const sub of h1_subsets_sec) {
    const perms = permute(sub);
    for (const p of perms) {
        for (const conn of connectors) {
            const str = p.join(conn);
            if (md5(str) === h1) {
                console.log(`MATCH FOUND! H1 = md5(${p.map(x => x === id ? 'ID' : x === salt ? 'SALT' : x).join(conn ? `"${conn}"` : '+')})`);
            }
        }
    }
}
