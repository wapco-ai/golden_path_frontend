import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Source-level appearance guards, not a substitute for device/screenshot tests.
// Only update the visual baseline after explicit user approval of a UI change.
const source = readFileSync(new URL('../src/pages/Routing.jsx', import.meta.url), 'utf8');
const guideStart = source.indexOf('{/* Current Guide Display */}');
const guideEnd = source.indexOf('{isInfoModalOpen && (', guideStart);
const guide = source.slice(guideStart, guideEnd);
const blobHash = (data) => createHash('sha1')
  .update(`blob ${data.length}\0`).update(data).digest('hex');

test('RNG uses an existing release stylesheet with no added panel overrides', () => {
  // Compare canonical text, including Windows checkouts using CRLF.
  const css = Buffer.from(readFileSync(new URL('../src/styles/Routing.css', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n'), 'utf8');
  // Production retained b00bf18; main already includes the image border from 4773306.
  const existingStyles = [
    'bbe9df5b62414289eff18043cfabb8085c42cc90',
    'aeee60e52e85965181f79b8765deec186eacd763',
  ];
  assert.ok(existingStyles.includes(blobHash(css)), 'Unexpected RNG stylesheet change');
  assert.ok(!existsSync(new URL('../src/styles/RngNavigation.css', import.meta.url)));
  assert.doesNotMatch(source, /RngNavigation\.css/);
});

test('the original guide has no additional demo toolbar, exit button or counter', () => {
  assert.ok(guideStart >= 0 && guideEnd > guideStart);
  assert.doesNotMatch(guide, /rng-demo-status|rngText\.(?:demo|exit)|formatDigits\(currentStep/);
  assert.doesNotMatch(source, /const exitDemo\s*=/);
  assert.match(guide, /className="instruction-text"/);
  assert.match(guide, /className="step-time"/);
});

test('the original span icon retains demo interaction without button styling', () => {
  assert.match(guide, /<span\s+className="direction-icon-rng"/);
  assert.match(guide, /onClick=\{handleDirectionIconClick\}/);
  assert.match(guide, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(guide, /role="button"/);
  assert.match(guide, /aria-disabled=/);
  assert.match(guide, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.doesNotMatch(guide, /<button|title=|style=/);
});

test('image loading and no-match use the existing placeholder copy', () => {
  assert.match(source, /isLiveImageLoading \? <FormattedMessage id="liveLandmarkLoading" \/> : <FormattedMessage id="liveLandmarkWaiting" \/>/);
  assert.doesNotMatch(source, /rngText\.(?:waiting|error|imageError|imageAlt)/);
  assert.match(source, /onError=\{\(\) => setFailedImageUrl\(liveLandmarkImage\.image\.url\)\}/);
  assert.match(source, /useGuidanceImage\(/);
});
