// Pulls the photos and videos out of a post's cooked HTML.
//
// Pure functions with no Discourse imports, so they can be tested outside
// Discourse (see dev/parse.test.mjs).

// Anything inside these is someone else's content (link previews, quotes of
// other posts) or decoration, not a photo that was shared in this post.
const SKIP_INSIDE = [
  "aside.onebox",
  ".onebox",
  "aside.quote",
  "blockquote",
  ".lazy-video-container",
].join(", ");

// Uploaded images live under these paths (on the forum or the media domain).
const UPLOAD_PATH = /\/(original|optimized|uploads)\//;

function attr(el, name) {
  const value = el.getAttribute(name);
  return value ? value.trim() : "";
}

function num(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// The largest candidate in a srcset ("url, url2 1.5x, url3 2x").
export function largestFromSrcset(srcset) {
  if (!srcset) {
    return "";
  }
  let best = "";
  let bestScale = 0;
  for (const part of srcset.split(",")) {
    const [url, descriptor = "1x"] = part.trim().split(/\s+/);
    if (!url) {
      continue;
    }
    const scale = parseFloat(descriptor) || 1;
    if (scale >= bestScale) {
      best = url;
      bestScale = scale;
    }
  }
  return best;
}

function colour(value) {
  return /^[0-9a-f]{3,8}$/i.test(value || "") ? `#${value}` : "";
}

function imageItem(img, link) {
  const src = attr(img, "src");
  const srcset = attr(img, "srcset");
  const full = link ? attr(link, "href") : src;
  return {
    type: "image",
    key: attr(img, "data-base62-sha1") || full || src,
    thumb: src,
    srcset,
    // Shown in the lightbox: the biggest optimised copy, not the original,
    // which can be a 20MB camera file.
    large: largestFromSrcset(srcset) || full || src,
    full,
    width: num(img.getAttribute("width")),
    height: num(img.getAttribute("height")),
    alt: attr(img, "alt") || (link ? attr(link, "title") : ""),
    color: colour(attr(img, "data-dominant-color")),
  };
}

function videoItem(src, poster) {
  return {
    type: "video",
    key: src,
    thumb: poster,
    srcset: "",
    large: src,
    full: src,
    width: 0,
    height: 0,
    alt: "",
    color: "",
  };
}

function defaultParse(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

// Returns the media in a post, in the order it appears.
export function extractMedia(html, parse = defaultParse) {
  if (!html) {
    return [];
  }
  const doc = parse(html);
  const items = [];
  const seen = new Set();
  const push = (item) => {
    if (item.key && !seen.has(item.key)) {
      seen.add(item.key);
      items.push(item);
    }
  };

  const nodes = doc.querySelectorAll(
    "a.lightbox, img, .video-placeholder-container, video"
  );

  for (const el of nodes) {
    if (el.closest(SKIP_INSIDE)) {
      continue;
    }

    if (el.matches("a.lightbox")) {
      const img = el.querySelector("img");
      if (img) {
        push(imageItem(img, el));
      }
    } else if (el.matches("img")) {
      if (el.closest("a.lightbox")) {
        continue; // already taken with its link
      }
      if (el.matches(".emoji, .avatar, .site-icon")) {
        continue;
      }
      const src = attr(el, "src");
      if (!src || !(UPLOAD_PATH.test(src) || el.hasAttribute("data-base62-sha1"))) {
        continue;
      }
      push(imageItem(el, null));
    } else if (el.matches(".video-placeholder-container")) {
      const src = attr(el, "data-video-src");
      if (src) {
        push(videoItem(src, attr(el, "data-thumbnail-src")));
      }
    } else if (el.matches("video")) {
      if (el.closest(".video-placeholder-container")) {
        continue;
      }
      const source = el.querySelector("source");
      const src = attr(el, "src") || (source ? attr(source, "src") : "");
      if (src) {
        push(videoItem(src, attr(el, "poster")));
      }
    }
  }

  return items;
}

// Topic list and topic JSON give tags as plain names on older Discourse and
// as {id, name, slug} objects on newer versions.
export function tagNames(tags) {
  return (tags || [])
    .map((t) => (typeof t === "string" ? t : t && t.name))
    .filter(Boolean);
}

// Turns a topic (from /t/:id.json) and its posts into gallery items.
export function topicMedia(topic, posts, { includeReplies = true, parse } = {}) {
  const tags = tagNames(topic.tags);
  const out = [];
  const seen = new Set();
  const sorted = [...posts].sort((a, b) => a.post_number - b.post_number);

  for (const post of sorted) {
    if (!includeReplies && post.post_number !== 1) {
      continue;
    }
    // Regular, visible posts only (no whispers, small action notices, or
    // hidden/deleted posts).
    if (post.post_type !== 1 || post.hidden || post.deleted_at) {
      continue;
    }
    for (const media of extractMedia(post.cooked, parse)) {
      if (seen.has(media.key)) {
        continue;
      }
      seen.add(media.key);
      out.push({
        ...media,
        id: `${topic.id}:${media.key}`,
        topicId: topic.id,
        title: topic.title,
        url: `/t/${topic.slug}/${topic.id}/${post.post_number}`,
        username: post.username,
        createdAt: post.created_at,
        tags,
      });
    }
  }
  return out;
}
