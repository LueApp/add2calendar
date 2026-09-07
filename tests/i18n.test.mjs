import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const load = async locale => JSON.parse(await readFile(new URL(`../extension/_locales/${locale}/messages.json`, import.meta.url), 'utf8'));

test('English and Chinese extension catalogs stay complete and valid', async () => {
  const [en, zh] = await Promise.all([load('en'), load('zh_CN')]);
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  assert.ok(Object.keys(en).length >= 180);
  for (const [key, entry] of Object.entries(en)) {
    assert.ok(entry.message, `missing English message: ${key}`);
    assert.ok(zh[key].message, `missing Chinese message: ${key}`);
    const placeholders = [...entry.message.matchAll(/\$([A-Z][A-Z0-9_]*)\$/g)].map(match => match[1].toLowerCase()).sort();
    assert.deepEqual(Object.keys(entry.placeholders || {}).sort(), [...new Set(placeholders)], `English placeholders: ${key}`);
    const zhPlaceholders = [...zh[key].message.matchAll(/\$([A-Z][A-Z0-9_]*)\$/g)].map(match => match[1].toLowerCase()).sort();
    assert.deepEqual(Object.keys(zh[key].placeholders || {}).sort(), [...new Set(zhPlaceholders)], `Chinese placeholders: ${key}`);
  }
  for (const key of ['settingsHeading', 'addClassSchedule', 'multipleVenues', 'unavailableEvents', 'nextcloudRejected']) {
    assert.notEqual(en[key].message, zh[key].message);
    assert.match(zh[key].message, /[\u3400-\u9fff]/);
  }
  const extensionRoot = new URL('../extension/', import.meta.url);
  const files = (await readdir(extensionRoot, { recursive: true })).filter(name => /\.(?:html|js|mjs|json)$/.test(name) && !name.startsWith('_locales/'));
  const used = new Set();
  for (const name of files) {
    const source = await readFile(new URL(name, extensionRoot), 'utf8');
    for (const pattern of [/\bt\(['"]([A-Za-z0-9_]+)/g, /data-i18n(?:-placeholder|-aria-label)?="([A-Za-z0-9_]+)/g, /__MSG_([A-Za-z0-9_]+)__/g])
      for (const match of source.matchAll(pattern)) used.add(match[1]);
  }
  assert.deepEqual([...used].filter(key => !en[key]), []);
});
