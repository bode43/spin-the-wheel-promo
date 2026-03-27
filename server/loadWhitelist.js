const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, 'allowed_users.txt');

let cache = { set: new Set(), mtimeMs: 0, path: DEFAULT_PATH };

function readWhitelistFile(filePath = DEFAULT_PATH) {
  const abs = path.resolve(filePath);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return new Set();
  }
  if (cache.path === abs && stat.mtimeMs === cache.mtimeMs && cache.set.size) {
    return cache.set;
  }
  const text = fs.readFileSync(abs, 'utf8');
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().toLowerCase();
    if (!t || t.startsWith('#')) continue;
    if (t.startsWith('@')) set.add(t.slice(1));
    else set.add(t);
  }
  cache = { set, mtimeMs: stat.mtimeMs, path: abs };
  return set;
}

function isWhitelisted(username, filePath) {
  const set = readWhitelistFile(filePath);
  return set.has(username);
}

module.exports = { readWhitelistFile, isWhitelisted, DEFAULT_PATH };
