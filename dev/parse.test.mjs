// Tests for lib/media-parse.js. Not loaded by Discourse.
// Run from this folder:  npm install jsdom && node --test parse.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
  extractMedia,
  largestFromSrcset,
  tagNames,
  topicMedia,
} from "../javascripts/discourse/lib/media-parse.js";

const parse = (html) => new JSDOM(html).window.document;

// Real cooked HTML from the test post on shush.endlesslibrary.com.au (one photo).
const LIGHTBOX = `<div class="d-image-grid">
<p><div class="lightbox-wrapper"><a class="lightbox" href="https://media.endlesslibrary.com.au/original/1X/02d6f15d4d35d6b51c61e85db2abe85672814b9a.jpeg" data-download-href="/uploads/short-url/p7t0l1j9Jdfrzk32KTTkkYEpvQ.jpeg?dl=1" title="basetexture2"><img src="https://media.endlesslibrary.com.au/optimized/1X/02d6f15d4d35d6b51c61e85db2abe85672814b9a_2_500x500.jpeg" alt="basetexture2" data-base62-sha1="p7t0l1j9Jdfrzk32KTTkkYEpvQ" width="500" height="500" srcset="https://media.endlesslibrary.com.au/optimized/1X/02d6f15d4d35d6b51c61e85db2abe85672814b9a_2_500x500.jpeg, https://media.endlesslibrary.com.au/optimized/1X/02d6f15d4d35d6b51c61e85db2abe85672814b9a_2_750x750.jpeg 1.5x, https://media.endlesslibrary.com.au/optimized/1X/02d6f15d4d35d6b51c61e85db2abe85672814b9a_2_1000x1000.jpeg 2x" data-dominant-color="6E6E6D"><div class="meta"><svg class="fa d-icon d-icon-far-image svg-icon" aria-hidden="true"><use href="#far-image"></use></svg><span class="filename">basetexture2</span><span class="informations">1500×1500 399 KB</span></div></a></div></p>
<p><div class="lightbox-wrapper"><a class="lightbox" href="https://media.endlesslibrary.com.au/original/1X/8dfd4d41100d69c36d3a07b7ad40b6b00212cf6c.jpeg" title="dirty-water"><img src="https://media.endlesslibrary.com.au/optimized/1X/8dfd4d41100d69c36d3a07b7ad40b6b00212cf6c_2_690x498.jpeg" alt="dirty-water" data-base62-sha1="kg61eqgvbQXbgKL2QFBibXdUSh6" width="690" height="498" srcset="https://media.endlesslibrary.com.au/optimized/1X/8dfd_2_690x498.jpeg, https://media.endlesslibrary.com.au/optimized/1X/8dfd_2_1380x996.jpeg 2x" data-dominant-color="787D5B"></a></div></p>
</div>`;

test("lightbox photos: thumbnail, large copy, original, size, colour", () => {
  const items = extractMedia(LIGHTBOX, parse);
  assert.equal(items.length, 2);
  const [a, b] = items;
  assert.equal(a.type, "image");
  assert.equal(a.key, "p7t0l1j9Jdfrzk32KTTkkYEpvQ");
  assert.match(a.thumb, /_2_500x500\.jpeg$/);
  assert.match(a.large, /_2_1000x1000\.jpeg$/);
  assert.match(a.full, /\/original\/1X\/02d6f15d.*\.jpeg$/);
  assert.equal(a.width, 500);
  assert.equal(a.height, 500);
  assert.equal(a.alt, "basetexture2");
  assert.equal(a.color, "#6E6E6D");
  assert.match(b.large, /_2_1380x996\.jpeg$/);
});

test("skips emoji, avatars, link previews, quotes and non-upload images", () => {
  const html = `
    <p>Great day <img src="/images/emoji/twitter/tada.png?v=12" class="emoji" alt=":tada:"></p>
    <aside class="quote"><div class="title"><img class="avatar" src="/user_avatar/x/1.png"></div>
      <blockquote><div class="lightbox-wrapper"><a class="lightbox" href="https://media.endlesslibrary.com.au/original/1X/quoted.jpeg"><img src="https://media.endlesslibrary.com.au/optimized/1X/quoted_2_500x500.jpeg" data-base62-sha1="quoted"></a></div></blockquote></aside>
    <aside class="onebox"><img src="https://example.com/og-image.jpg" class="thumbnail"></aside>
    <p><img src="https://example.com/hotlinked.jpg"></p>
    <p><img src="https://media.endlesslibrary.com.au/original/1X/small.png" width="300" height="200" data-base62-sha1="small"></p>`;
  const items = extractMedia(html, parse);
  assert.deepEqual(
    items.map((i) => i.key),
    ["small"],
    "only the small uploaded photo (no lightbox because it's small) counts"
  );
  assert.equal(items[0].large, "https://media.endlesslibrary.com.au/original/1X/small.png");
});

test("videos: Discourse's placeholder, with and without a preview frame", () => {
  const html = `
    <div class="video-placeholder-container" data-video-src="/uploads/short-url/abc.mp4" data-thumbnail-src="https://media.endlesslibrary.com.au/original/1X/frame.png" data-orig-src="upload://abc.mp4"></div>
    <div class="video-placeholder-container" data-video-src="https://media.endlesslibrary.com.au/original/1X/def.mp4"></div>
    <video controls><source src="https://media.endlesslibrary.com.au/original/1X/old.webm"></video>`;
  const items = extractMedia(html, parse);
  assert.deepEqual(
    items.map((i) => [i.type, i.large, i.thumb]),
    [
      ["video", "/uploads/short-url/abc.mp4", "https://media.endlesslibrary.com.au/original/1X/frame.png"],
      ["video", "https://media.endlesslibrary.com.au/original/1X/def.mp4", ""],
      ["video", "https://media.endlesslibrary.com.au/original/1X/old.webm", ""],
    ]
  );
});

test("keeps the order media appears in, and drops repeats", () => {
  const html = `
    <div class="video-placeholder-container" data-video-src="/v1.mp4"></div>
    <p><img src="/uploads/default/original/1X/one.jpg" data-base62-sha1="one"></p>
    <p><img src="/uploads/default/original/1X/one.jpg" data-base62-sha1="one"></p>`;
  assert.deepEqual(
    extractMedia(html, parse).map((i) => i.key),
    ["/v1.mp4", "one"]
  );
});

test("empty or missing HTML", () => {
  assert.deepEqual(extractMedia("", parse), []);
  assert.deepEqual(extractMedia(null, parse), []);
});

test("srcset: picks the biggest candidate", () => {
  assert.equal(largestFromSrcset("a.jpg, b.jpg 1.5x, c.jpg 2x"), "c.jpg");
  assert.equal(largestFromSrcset("a.jpg"), "a.jpg");
  assert.equal(largestFromSrcset(""), "");
});

test("tags: names from objects (new Discourse) or strings (old)", () => {
  assert.deepEqual(
    tagNames([{ id: 11, name: "2026", slug: "11-tag" }, { id: 9, name: "photo", slug: "photo" }]),
    ["2026", "photo"]
  );
  assert.deepEqual(tagNames(["open-day"]), ["open-day"]);
  assert.deepEqual(tagNames(undefined), []);
});

test("topic: items carry post link, author, date and tags; skips hidden and non-regular posts", () => {
  const topic = {
    id: 43,
    slug: "open-day",
    title: "Open day",
    tags: [{ id: 1, name: "open-day", slug: "open-day" }],
  };
  const img = (k) =>
    `<p><img src="/uploads/default/original/1X/${k}.jpg" data-base62-sha1="${k}"></p>`;
  const posts = [
    { id: 3, post_number: 3, post_type: 1, username: "c", created_at: "2026-10-03", cooked: img("hidden"), hidden: true },
    { id: 2, post_number: 2, post_type: 1, username: "b", created_at: "2026-10-02", cooked: img("reply") + img("first") },
    { id: 1, post_number: 1, post_type: 1, username: "a", created_at: "2026-10-01", cooked: img("first") },
    { id: 4, post_number: 4, post_type: 3, username: "system", created_at: "2026-10-04", cooked: img("moderator-action") },
  ];
  const items = topicMedia(topic, posts, { parse });
  assert.deepEqual(
    items.map((i) => [i.key, i.username, i.url]),
    [
      ["first", "a", "/t/open-day/43/1"],
      ["reply", "b", "/t/open-day/43/2"],
    ],
    "post order, the reply's repeat of the first photo is dropped"
  );
  assert.deepEqual(items[0].tags, ["open-day"]);
  assert.equal(items[0].id, "43:first");

  const firstOnly = topicMedia(topic, posts, { includeReplies: false, parse });
  assert.deepEqual(firstOnly.map((i) => i.key), ["first"]);
});
