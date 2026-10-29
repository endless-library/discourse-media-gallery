import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { htmlSafe } from "@ember/template";
import { modifier } from "ember-modifier";
import store from "../lib/media-store";
import ElMediaLightbox from "./el-media-lightbox";

const SKELETON = Array.from({ length: 12 });

const isEq = (a, b) => a === b;

// Calls `callback` when the element scrolls near the viewport (infinite
// scroll). The second argument re-arms the observer after each batch, so a
// tall screen keeps loading until it is full.
// eslint-disable-next-line no-unused-vars
const nearViewport = modifier((element, [callback, _count]) => {
  if (!("IntersectionObserver" in window)) {
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        callback();
      }
    },
    { rootMargin: "1200px 0px" }
  );
  observer.observe(element);
  return () => observer.disconnect();
});

// While the grid is showing, hide the category's own title bar and topic-list
// buttons (CSS keys off this body class).
const bodyClass = modifier(() => {
  document.body.classList.add("elm-media-active");
  return () => document.body.classList.remove("elm-media-active");
});

function list(value) {
  return (value || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default class ElMedia extends Component {
  @tracked openIndex = null;

  store = store;
  skeleton = SKELETON;

  constructor() {
    super(...arguments);
    store.configure(this.args.category, {
      includeReplies: settings.include_replies,
    });
  }

  get rootClass() {
    const shape = settings.tile_shape === "natural" ? "natural" : "square";
    return `elm elm--${shape}`;
  }

  // Filter chips: the order set in settings first, then any other tags in use,
  // minus the ones the settings hide.
  get chips() {
    const hidden = new Set(list(settings.hide_tags).map((t) => t.toLowerCase()));
    const pinned = list(settings.filter_tags);
    const seen = new Set();
    const out = [];
    for (const name of [...pinned, ...store.tagOptions]) {
      const key = name.toLowerCase();
      if (!seen.has(key) && !hidden.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
    if (store.tag && !seen.has(store.tag.toLowerCase())) {
      out.push(store.tag);
    }
    return out;
  }

  get counts() {
    let photos = 0;
    let videos = 0;
    for (const item of store.items) {
      item.type === "video" ? videos++ : photos++;
    }
    return { photos, videos };
  }

  get meta() {
    const { photos, videos } = this.counts;
    const parts = [];
    if (photos) {
      parts.push(`${photos.toLocaleString()} photo${photos === 1 ? "" : "s"}`);
    }
    if (videos) {
      parts.push(`${videos.toLocaleString()} video${videos === 1 ? "" : "s"}`);
    }
    if (!parts.length) {
      return "";
    }
    return parts.join(" · ") + (store.done ? "" : " so far");
  }

  get isEmpty() {
    return store.done && !store.items.length && !store.error;
  }

  get isFirstLoad() {
    return !store.items.length && !store.done && !store.error;
  }

  get hasMore() {
    return !store.done;
  }

  get moreComing() {
    return !store.done;
  }

  isOpen = (index) =>
    index !== null && index !== undefined && !!store.items[index];

  get shareUrl() {
    const params = new URLSearchParams({ category: this.args.category.slug });
    if (store.tag) {
      params.set("tags", store.tag);
    }
    return `/new-topic?${params}`;
  }

  get shareLabel() {
    return settings.share_label;
  }

  get showShare() {
    return store.canCreate && !!settings.share_label;
  }

  tileStyle = (item) => {
    const parts = [];
    if (item.color) {
      parts.push(`background-color: ${item.color}`);
    }
    if (settings.tile_shape === "natural" && item.width && item.height) {
      parts.push(`aspect-ratio: ${item.width} / ${item.height}`);
    }
    return htmlSafe(parts.join("; "));
  };

  tileLabel = (item) =>
    item.type === "video"
      ? `Video from ${item.title}`
      : item.alt
        ? `${item.alt}, from ${item.title}`
        : `Photo from ${item.title}`;

  @action
  pickTag(tag) {
    store.setTag(tag);
  }

  @action
  open(index) {
    this.openIndex = index;
  }

  @action
  close() {
    this.openIndex = null;
  }

  @action
  moveTo(index) {
    this.openIndex = index;
    // Fetch the next batch before the viewer runs out of photos.
    if (index >= store.items.length - 4) {
      store.loadMore();
    }
  }

  @action
  tagFromLightbox(tag) {
    this.openIndex = null;
    store.setTag(tag);
    window.scrollTo({ top: 0 });
  }

  @action
  loadMore() {
    store.loadMore();
  }

  @action
  retry() {
    store.retry();
  }

  @action
  thumbError(event) {
    event.target.closest(".elm-tile")?.classList.add("is-broken");
  }

  // Swap the colour placeholder for a neutral background once the image is
  // in. Otherwise transparent PNGs (logos, scans) show the placeholder colour
  // through, often black.
  @action
  thumbLoad(event) {
    event.target.closest(".elm-tile")?.classList.add("is-loaded");
  }

  <template>
    <section class={{this.rootClass}} aria-label="Photos and videos" {{bodyClass}}>
      <div class="elm-bar">
        <div class="elm-chips" role="group" aria-label="Filter by tag">
          <button
            type="button"
            class="elm-chip {{if (isEq this.store.tag '') 'is-active'}}"
            aria-pressed={{if (isEq this.store.tag "") "true" "false"}}
            {{on "click" (fn this.pickTag "")}}
          >All</button>
          {{#each this.chips as |t|}}
            <button
              type="button"
              class="elm-chip {{if (isEq this.store.tag t) 'is-active'}}"
              aria-pressed={{if (isEq this.store.tag t) "true" "false"}}
              {{on "click" (fn this.pickTag t)}}
            >{{t}}</button>
          {{/each}}
        </div>
        {{#if this.showShare}}
          <a class="elm-btn elm-btn--solid" href={{this.shareUrl}}>{{this.shareLabel}}</a>
        {{/if}}
      </div>

      <p class="elm-meta" aria-live="polite">{{this.meta}}</p>

      {{#if this.store.items.length}}
        <ul class="elm-grid">
          {{#each this.store.items key="id" as |item index|}}
            <li>
              <button
                type="button"
                class="elm-tile {{if (isEq item.type 'video') 'is-video'}}"
                style={{this.tileStyle item}}
                aria-label={{this.tileLabel item}}
                {{on "click" (fn this.open index)}}
              >
                {{#if item.thumb}}
                  <img
                    src={{item.thumb}}
                    srcset={{item.srcset}}
                    sizes="(max-width: 600px) 34vw, 260px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    {{on "load" this.thumbLoad}}
                    {{on "error" this.thumbError}}
                  />
                {{/if}}
                {{#if (isEq item.type "video")}}
                  <span class="elm-tile__play" aria-hidden="true">▶</span>
                {{/if}}
                <span class="elm-tile__caption" aria-hidden="true">{{item.title}}</span>
              </button>
            </li>
          {{/each}}
        </ul>
      {{/if}}

      {{#if this.store.error}}
        <div class="elm-state elm-state--error">
          <p>{{this.store.error}}</p>
          <button type="button" class="elm-btn" {{on "click" this.retry}}>Try again</button>
        </div>
      {{else if this.isFirstLoad}}
        <ul class="elm-grid elm-grid--skeleton" aria-hidden="true">
          {{#each this.skeleton}}
            <li><span class="elm-tile"></span></li>
          {{/each}}
        </ul>
      {{else if this.isEmpty}}
        <div class="elm-state">
          {{#if this.store.tag}}
            <p>Nothing tagged <em>{{this.store.tag}}</em> yet.</p>
          {{else}}
            <p>No photos yet.</p>
          {{/if}}
          {{#if this.showShare}}
            <a class="elm-btn" href={{this.shareUrl}}>{{this.shareLabel}}</a>
          {{/if}}
        </div>
      {{else if this.hasMore}}
        <div
          class="elm-more"
          {{nearViewport this.loadMore this.store.items.length}}
        >
          {{#if this.store.loading}}
            <span class="elm-more__loading">Loading…</span>
          {{else}}
            <button type="button" class="elm-btn" {{on "click" this.loadMore}}>
              Show more
            </button>
          {{/if}}
        </div>
      {{/if}}

      {{#if (this.isOpen this.openIndex)}}
        <ElMediaLightbox
          @items={{this.store.items}}
          @index={{this.openIndex}}
          @moreComing={{this.moreComing}}
          @onIndex={{this.moveTo}}
          @onClose={{this.close}}
          @onTag={{this.tagFromLightbox}}
        />
      {{/if}}
    </section>
  </template>
}
