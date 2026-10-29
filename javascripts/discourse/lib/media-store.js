import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax";
import { aboutTopicId, tagNames, topicMedia } from "./media-parse";

// One shared store for the whole app: the gallery page, the header link and
// the lightbox all read from it, and topics already fetched are reused when
// you switch filters or come back to the page.
//
// How the gallery is filled: Discourse has no "every image in a category"
// endpoint, so we page through the category's topic list (newest first) and
// fetch each topic to read the photos and videos out of its posts. Topics are
// fetched a few at a time and the grid grows as each batch arrives.

const PARALLEL = 4;
const POSTS_PER_REQUEST = 20;

class MediaStore {
  @tracked view = "media"; // "media" (the grid) or "posts" (Discourse's topic list)
  @tracked items = [];
  @tracked tag = "";
  @tracked tagOptions = [];
  @tracked loading = false;
  @tracked done = false;
  @tracked error = null;
  @tracked canCreate = false;
  @tracked topicCount = 0;

  category = null;
  includeReplies = true;
  page = 0;
  generation = 0;
  topicCache = new Map(); // topic id -> gallery items
  allTags = null; // tag names seen on the unfiltered first page

  setView(view) {
    if (view === "media" || view === "posts") {
      this.view = view;
    }
  }

  // Called by the gallery page with the Archive category object.
  configure(category, { includeReplies }) {
    const changed = !this.category || this.category.id !== category.id;
    this.category = category;
    this.includeReplies = includeReplies;
    if (changed) {
      this.topicCache.clear();
      this.allTags = null;
      this.restart(this.tag);
    } else if (!this.items.length && !this.loading) {
      this.restart(this.tag);
    }
  }

  setTag(tag) {
    if (tag !== this.tag) {
      this.restart(tag);
    }
  }

  retry() {
    this.error = null;
    this.done = false;
    this.loadMore();
  }

  restart(tag) {
    this.generation++;
    this.tag = tag || "";
    this.items = [];
    this.page = 0;
    this.done = false;
    this.error = null;
    this.loading = false;
    this.topicCount = 0;
    this.loadMore();
  }

  listUrl() {
    const c = this.category;
    const params = new URLSearchParams({
      order: "created",
      ascending: "false",
      page: String(this.page),
    });
    if (this.tag) {
      params.set("tags", this.tag);
    }
    return `/c/${c.slug}/${c.id}/l/latest.json?${params}`;
  }

  async loadMore() {
    if (!this.category || this.loading || this.done) {
      return;
    }
    const generation = this.generation;
    const before = this.items.length;
    this.loading = true;
    let pages = 0;

    try {
      // A page of topics can contain no media at all (text-only posts). Keep
      // going, a few pages at most, until something new can be shown.
      do {
        await this.loadPage(generation);
        pages++;
      } while (
        generation === this.generation &&
        !this.done &&
        this.items.length === before &&
        pages < 5
      );
    } catch (e) {
      if (generation === this.generation) {
        // eslint-disable-next-line no-console
        console.error("[media gallery] could not load", e);
        this.error =
          e?.jqXHR?.status === 429
            ? "The forum is busy. Wait a moment and try again."
            : "The gallery couldn't be loaded right now.";
      }
    } finally {
      if (generation === this.generation) {
        this.loading = false;
      }
    }
  }

  async loadPage(generation) {
    const data = await ajax(this.listUrl());
    if (generation !== this.generation) {
      return; // the filter changed while this was loading
    }
    const list = data.topic_list || {};
    this.canCreate = !!list.can_create_topic;

    if (!this.tag && this.page === 0) {
      this.allTags = tagNames(list.top_tags);
      this.tagOptions = this.allTags;
    } else if (!this.allTags) {
      this.tagOptions = tagNames(list.top_tags);
    }

    // Skip the category's pinned "About the Archive" topic, and any topics
    // named in the exclude_topic_ids setting. (They still show under Posts.)
    const skip = new Set(
      (settings.exclude_topic_ids || "")
        .split("|")
        .map((id) => Number(id.trim()))
        .filter(Boolean)
    );
    skip.add(aboutTopicId(this.category));
    const topics = (list.topics || []).filter((t) => !skip.has(t.id));
    this.topicCount += topics.length;

    for (let i = 0; i < topics.length; i += PARALLEL) {
      const batch = topics.slice(i, i + PARALLEL);
      const results = await Promise.all(batch.map((t) => this.mediaFor(t)));
      if (generation !== this.generation) {
        return;
      }
      const fresh = results.flat();
      if (fresh.length) {
        this.items = [...this.items, ...fresh];
      }
    }

    this.page++;
    if (!list.more_topics_url || !(list.topics || []).length) {
      this.done = true;
    }
  }

  async mediaFor(listTopic) {
    const cached = this.topicCache.get(listTopic.id);
    // Re-fetch if the topic has new posts since we last read it.
    if (cached && cached.postsCount === listTopic.posts_count) {
      return cached.items;
    }
    try {
      const topic = await ajax(`/t/${listTopic.id}.json`);
      const stream = topic.post_stream || {};
      const posts = [...(stream.posts || [])];

      if (this.includeReplies) {
        const have = new Set(posts.map((p) => p.id));
        const missing = (stream.stream || []).filter((id) => !have.has(id));
        for (let i = 0; i < missing.length; i += POSTS_PER_REQUEST) {
          const ids = missing.slice(i, i + POSTS_PER_REQUEST);
          const query = ids.map((id) => `post_ids[]=${id}`).join("&");
          const more = await ajax(`/t/${listTopic.id}/posts.json?${query}`);
          posts.push(...(more.post_stream?.posts || []));
        }
      }

      const items = topicMedia(topic, posts, {
        includeReplies: this.includeReplies,
      });
      this.topicCache.set(listTopic.id, {
        postsCount: listTopic.posts_count,
        items,
      });
      return items;
    } catch (e) {
      // One unreadable topic (deleted, made private) shouldn't break the page.
      // eslint-disable-next-line no-console
      console.warn(`[media gallery] skipped topic ${listTopic.id}`, e);
      return [];
    }
  }
}

export default new MediaStore();

export function categoryUrl(slug) {
  return `/c/${slug}`;
}

export function isGalleryCategory(category, slug) {
  return !!category && !!slug && category.slug === slug;
}
