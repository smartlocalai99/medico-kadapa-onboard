import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../components/SplashScreen.js', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../styles/globals.css', import.meta.url), 'utf8');

test('splash video starts programmatically with mobile-safe muted inline playback', () => {
  assert.match(component, /video\.defaultMuted\s*=\s*true/);
  assert.match(component, /video\.muted\s*=\s*true/);
  assert.match(component, /video\.playsInline\s*=\s*true/);
  assert.match(component, /video\.play\(\)/);
  assert.match(component, /addEventListener\(['"]canplay['"],\s*startPlayback/);
});

test('splash video never exposes native playback controls', () => {
  assert.match(component, /controls=\{false\}/);
  assert.match(component, /className="splash-video /);
  assert.match(globalStyles, /\.splash-video::\-webkit-media-controls-start-playback-button/);
  assert.match(globalStyles, /display:\s*none\s*!important/);
});
