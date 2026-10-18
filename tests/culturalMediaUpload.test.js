import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCulturalItem } from '../src/services/culturalItemMapper.js';
import {
  CULTURAL_UPLOAD_RULES,
  validateCulturalUpload,
  culturalMediaKind,
  splitCulturalMedia,
  culturalFileMetadata,
  buildCulturalAttachmentPayload,
  selectCulturalPrimaryImage,
  markCulturalPrimaryImage,
  findExistingCulturalPrimary
} from '../src/utils/culturalMediaUpload.js';

const file = (name, type, size = 1024) => ({ name, type, size });
const MiB = 1024 * 1024;

test('allows the documented image formats up to exactly 5 MiB', () => {
  for (const [extension, mime] of [['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['png', 'image/png'], ['gif', 'image/gif'], ['webp', 'image/webp']]) {
    assert.equal(validateCulturalUpload(file(`picture.${extension.toUpperCase()}`, mime, 5 * MiB), 'image'), null);
    assert.match(validateCulturalUpload(file(`picture.${extension}`, mime, 5 * MiB + 1), 'image'), /حجم/);
  }
  for (const [name, mime] of [['picture.svg', 'image/svg+xml'], ['picture.bmp', 'image/bmp'], ['fake.jpg', 'video/mp4'], ['photo.jpg.exe', 'image/jpeg']]) {
    assert.match(validateCulturalUpload(file(name, mime), 'image'), /فرمت/);
  }
});

test('accepts only MP4 videos with the same 50 MiB ceiling as the server', () => {
  assert.equal(validateCulturalUpload(file('video.MP4', 'video/mp4', 50 * MiB), 'video'), null);
  assert.equal(validateCulturalUpload(file('video.mp4', '', 50 * MiB), 'video'), null);
  assert.equal(validateCulturalUpload(file('video.mp4', 'application/octet-stream'), 'video'), null);
  assert.match(validateCulturalUpload(file('video.mp4', 'video/mp4', 50 * MiB + 1), 'video'), /حجم/);
  for (const [name, mime] of [['video.mov', 'video/quicktime'], ['video.webm', 'video/webm'], ['fake.mp4', 'text/plain']]) {
    assert.match(validateCulturalUpload(file(name, mime), 'video'), /فرمت/);
  }
});

test('preserves existing audio and document formats with a 50 MiB limit', () => {
  assert.equal(CULTURAL_UPLOAD_RULES.audio.accept, 'audio/*');
  for (const mime of ['audio/mpeg', 'audio/wav', 'audio/ogg']) {
    assert.equal(validateCulturalUpload(file('audio', mime, 50 * MiB), 'audio'), null);
    assert.match(validateCulturalUpload(file('audio', mime, 50 * MiB + 1), 'audio'), /حجم/);
  }
  for (const extension of ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx']) {
    assert.equal(validateCulturalUpload(file(`document.${extension}`, 'application/octet-stream', 50 * MiB), 'text'), null);
    assert.match(validateCulturalUpload(file(`document.${extension}`, '', 50 * MiB + 1), 'text'), /حجم/);
  }
  assert.match(validateCulturalUpload(file('archive.zip', 'application/zip'), 'text'), /فرمت/);
  assert.match(validateCulturalUpload(file('image.jpg', 'image/jpeg'), 'audio'), /فرمت/);
  assert.match(validateCulturalUpload(file('empty.mp4', 'video/mp4', 0), 'video'), /خالی/);
});

test('keeps existing videos in their own edit collection while retaining every media type', () => {
  const image = { id: 1, mime: 'image/jpeg', url: '/photos/a.jpg' };
  const video = { id: 2, type: 'video', mime: 'video/mp4', path: '/media/film.mp4', url: '/media/film.mp4', metadata: { title: 'فیلم' } };
  const audio = { id: 3, type: 'audio/mpeg', url: '/media/a.mp3' };
  const document = { id: 4, mime: 'application/pdf', url: '/media/a.pdf' };
  const result = splitCulturalMedia([image, video, audio, document, { ...video, id: 'duplicate' }]);
  assert.deepEqual(result, { images: [image], videos: [video], audio: [audio], documents: [document] });
  const payload = buildCulturalAttachmentPayload(Object.values(result).flat());
  assert.deepEqual(payload.map((entry) => entry.type), ['image', 'video', 'audio', 'file']);
  assert.equal(payload[1].metadata.title, 'فیلم');
  assert.equal(payload[1].path, '/media/film.mp4');
  assert.equal(culturalMediaKind({ mime: 'application/octet-stream', type: 'video', url: '/file' }), 'video');
  assert.equal(culturalMediaKind({ mime: 'video/mp4', url: '/wrong.jpg' }), 'video');
  assert.equal(culturalMediaKind({ url: '/movie.mp4?token=a' }), 'video');
});

test('preserves filename, titles, descriptions, translations and server metadata on save', () => {
  const media = {
    name: 'original.mp4', path: '/media/film.mp4', url: 'https://example.test/media/film.mp4', mime: 'video/mp4',
    title: 'عنوان', description: 'توضیح', originalName: 'original.mp4',
    languageTitles: { english: 'Video' }, languageDescriptions: { english: 'Description' },
    metadata: { duration: 12, custom: 'retained' }
  };
  const uploadedMetadata = { bytes: 4096, duration: 13 };
  const metadata = culturalFileMetadata(media, uploadedMetadata);
  assert.deepEqual(metadata, {
    duration: 13, custom: 'retained', bytes: 4096, title: 'عنوان', description: 'توضیح', originalName: 'original.mp4',
    languageTitles: { english: 'Video' }, languageDescriptions: { english: 'Description' }
  });
  const [attachment] = buildCulturalAttachmentPayload([{ ...media, metadata }]);
  assert.equal(attachment.name, 'original.mp4');
  assert.equal(attachment.title, 'عنوان');
  assert.equal(attachment.description, 'توضیح');
  assert.deepEqual(attachment.metadata.languageTitles, { english: 'Video' });
  assert.equal(attachment.metadata.bytes, 4096);
});

test('selects a primary image even when a video is first or marked as primary', () => {
  const video = { id: 1, mime: 'video/mp4', url: '/a.mp4', isPrimary: true };
  const first = { id: 2, mime: 'image/jpeg', url: '/a.jpg' };
  const selected = { id: 3, mime: 'image/png', url: '/b.png' };
  assert.equal(selectCulturalPrimaryImage([video, first, selected], 3), selected);
  assert.equal(selectCulturalPrimaryImage([video, first], 1), first);
  assert.equal(selectCulturalPrimaryImage([video], 1), null);
});

test('persists exactly the selected primary image in media and clears old video/image flags', () => {
  const files = [
    { id: 1, mime: 'video/mp4', url: '/video.mp4', isPrimary: true },
    { id: 2, mime: 'image/jpeg', url: '/first.jpg', isPrimary: true },
    { id: 3, mime: 'image/png', url: '/chosen.png', isPrimary: false }
  ];
  const marked = markCulturalPrimaryImage(files, 3);
  assert.deepEqual(marked.map((file) => file.isPrimary), [false, false, true]);
  assert.equal(files[0].isPrimary, true, 'does not mutate old state');
  const payload = buildCulturalAttachmentPayload(marked);
  assert.deepEqual(payload.map((file) => file.isPrimary), [false, false, true]);
  assert.equal(payload.find((file) => file.isPrimary).path, '/chosen.png');
  assert.deepEqual(markCulturalPrimaryImage([files[0]], 1).map((file) => file.isPrimary), [false]);
});

test('conflicting legacy video metadata never creates an image or a primary-image candidate', () => {
  const conflicts = [
    { id: 1, mime: 'image/jpeg', type: 'video', url: '/video' },
    { id: 2, mime: 'image/jpeg', type: 'image', url: '/film.mp4' },
    { id: 3, type: 'image', path: '/uploads/film', url: '/film.webm?token=a' },
    { id: 4, mime: 'audio/mpeg', type: 'image', url: '/sound' }
  ];
  for (const file of conflicts) assert.notEqual(culturalMediaKind(file), 'image');
  const split = splitCulturalMedia(conflicts);
  assert.equal(split.images.length, 0);
  assert.equal(split.videos.length, 3);
  assert.equal(split.audio.length, 1);
  assert.equal(selectCulturalPrimaryImage(conflicts, 1), null);
  assert.equal(culturalMediaKind({ type: 'image', mime: 'application/pdf', url: '/document.pdf' }), 'text');
});

test('a primary inferred from a path-only legacy image matches the original attachment without duplication', () => {
  const original = { type: 'image', mime: 'image/png', path: 'uploads/contents/7/images/a.png', metadata: { custom: 'retained' } };
  const item = normalizeCulturalItem({ poiId: 7, media: { fa: [original] } });
  assert.equal(item.primaryImage, '/storage/uploads/contents/7/images/a.png');
  const primary = { url: item.primaryImage };
  assert.equal(findExistingCulturalPrimary(primary, [original]), original);
  const saved = buildCulturalAttachmentPayload([findExistingCulturalPrimary(primary, [original])]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].path, 'uploads/contents/7/images/a.png');
  assert.equal(saved[0].metadata.custom, 'retained');
  assert.equal(findExistingCulturalPrimary(primary, [{ ...original, url: '/storage/uploads/contents/7/images/a.png' }]).path, original.path);
});
