import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../components/SplashScreen.js', import.meta.url), 'utf8');
const animatedSplash = new URL('../public/splashscreen.webp', import.meta.url);

test('splash uses an automatic animated image with no native video player', () => {
  assert.doesNotMatch(component, /<video\b/);
  assert.match(component, /import Image from ['"]next\/image['"]/);
  assert.match(component, /<Image\b/);
  assert.match(component, /src="\/splashscreen\.webp"/);
  assert.equal(existsSync(animatedSplash), true);
});
