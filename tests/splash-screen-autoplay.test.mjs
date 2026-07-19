import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../components/SplashScreen.js', import.meta.url), 'utf8');
const animatedSplash = new URL('../public/splashscreen.webp', import.meta.url);

function readWebpLoopCount(path) {
  const data = readFileSync(path);

  for (let offset = 12; offset + 8 <= data.length;) {
    const type = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);

    if (type === 'ANIM') {
      return data.readUInt16LE(offset + 12);
    }

    offset += 8 + size + (size % 2);
  }

  throw new Error('Animated WebP ANIM chunk not found');
}

test('splash uses an automatic animated image with no native video player', () => {
  assert.doesNotMatch(component, /<video\b/);
  assert.match(component, /import Image from ['"]next\/image['"]/);
  assert.match(component, /<Image\b/);
  assert.match(component, /src="\/splashscreen\.webp"/);
  assert.equal(existsSync(animatedSplash), true);
});

test('splash animation plays exactly once', () => {
  assert.equal(readWebpLoopCount(animatedSplash), 1);
});
