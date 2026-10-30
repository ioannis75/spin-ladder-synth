// Συναρμολογεί το αυτόνομο index.html από src/ και τα αποτελέσματα των ελέγχων.
const fs = require('fs'), path = require('path'), r = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const page = r('src/page.src.html').replace('/*ENGINE*/', () => r('src/engine.js'))
  .replace('/*VERIFY*/', () => r('test/verify-results.json'))
  .replace('/*SONG*/', () => r('src/song.js'))
  .replace('/*SONGS*/', () => JSON.stringify({ simple: JSON.parse(r('songs/simple-song.json')), level1: JSON.parse(r('songs/level-1-loop.json')), live: JSON.parse(r('songs/live-set.json')) })).replace('/*OFFLINE*/', 'true');
const html = '<!doctype html>\n<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' + page + '\n</body></html>\n';
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html);
console.log('index.html', html.length, 'bytes');
