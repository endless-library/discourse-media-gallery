import Component from "@glimmer/component";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { modifier } from "ember-modifier";

const SWIPE_PX = 50;

function formatDate(iso) {
  if (!iso) {
    return "";
  }
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// Full-screen viewer for one photo or video at a time. Arrow keys, swipes and
// the on-screen arrows move through the whole gallery; Escape closes it.
// Rendered into <body> so no page layout can clip it.
export default class ElMediaLightbox extends Component {
  destination = document.body;
  pointerStart = null;
  returnFocus = null;

  setup = modifier((element) => {
    this.returnFocus = document.activeElement;
    document.documentElement.classList.add("elm-noscroll");
    element.querySelector(".elm-lb__close")?.focus();

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        this.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.prev();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("elm-noscroll");
      this.returnFocus?.focus?.();
    };
  });

  // Warm the browser cache for the neighbours so moving feels instant.
  preload = modifier((element, [index]) => {
    for (const i of [index + 1, index - 1]) {
      const item = this.args.items[i];
      if (item && item.type === "image") {
        const img = new Image();
        img.src = item.large;
      }
    }
  });

  get index() {
    return this.args.index;
  }

  get item() {
    return this.args.items[this.index];
  }

  get isVideo() {
    return this.item?.type === "video";
  }

  get hasPrev() {
    return this.index > 0;
  }

  get hasNext() {
    return this.index < this.args.items.length - 1;
  }

  get counter() {
    const total = this.args.items.length;
    const more = this.args.moreComing ? "+" : "";
    return `${this.index + 1} / ${total}${more}`;
  }

  get date() {
    return formatDate(this.item?.createdAt);
  }

  get label() {
    const title = this.item?.title || "";
    return this.isVideo ? `Video from ${title}` : this.item?.alt || `Photo from ${title}`;
  }

  @action
  close() {
    this.args.onClose();
  }

  @action
  next() {
    if (this.hasNext) {
      this.args.onIndex(this.index + 1);
    }
  }

  @action
  prev() {
    if (this.hasPrev) {
      this.args.onIndex(this.index - 1);
    }
  }

  @action
  backdropClick(event) {
    // Clicks on the dark area close; clicks on the photo or controls don't.
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  @action
  pointerDown(event) {
    if (event.pointerType === "mouse") {
      return;
    }
    this.pointerStart = { x: event.clientX, y: event.clientY };
  }

  @action
  pointerUp(event) {
    if (!this.pointerStart) {
      return;
    }
    const dx = event.clientX - this.pointerStart.x;
    const dy = event.clientY - this.pointerStart.y;
    this.pointerStart = null;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? this.next() : this.prev();
    } else if (dy > SWIPE_PX * 2 && Math.abs(dy) > Math.abs(dx)) {
      this.close(); // swipe down to dismiss
    }
  }

  @action
  pickTag(tag) {
    this.args.onTag?.(tag);
  }

  <template>
    {{#in-element this.destination insertBefore=null}}
      <div
        class="elm-lb"
        role="dialog"
        aria-modal="true"
        aria-label={{this.label}}
        {{this.setup}}
      >
        <div class="elm-lb__top">
          <span class="elm-lb__counter">{{this.counter}}</span>
          <button
            type="button"
            class="elm-lb__close"
            aria-label="Close"
            {{on "click" this.close}}
          >✕</button>
        </div>

        <div
          class="elm-lb__stage"
          {{on "click" this.backdropClick}}
          {{on "pointerdown" this.pointerDown}}
          {{on "pointerup" this.pointerUp}}
          {{this.preload this.index}}
        >
          {{#if this.isVideo}}
            <video
              class="elm-lb__media"
              src={{this.item.large}}
              poster={{this.item.thumb}}
              controls
              autoplay
              playsinline
              preload="metadata"
            ></video>
          {{else}}
            <img
              class="elm-lb__media"
              src={{this.item.large}}
              alt={{this.item.alt}}
              decoding="async"
            />
          {{/if}}

          {{#if this.hasPrev}}
            <button
              type="button"
              class="elm-lb__nav elm-lb__nav--prev"
              aria-label="Previous"
              {{on "click" this.prev}}
            >‹</button>
          {{/if}}
          {{#if this.hasNext}}
            <button
              type="button"
              class="elm-lb__nav elm-lb__nav--next"
              aria-label="Next"
              {{on "click" this.next}}
            >›</button>
          {{/if}}
        </div>

        <div class="elm-lb__caption">
          <a class="elm-lb__title" href={{this.item.url}} {{on "click" this.close}}>
            {{this.item.title}}
          </a>
          <span class="elm-lb__byline">
            {{this.item.username}}{{#if this.date}} · {{this.date}}{{/if}}
          </span>
          {{#if this.item.tags.length}}
            <span class="elm-lb__tags">
              {{#each this.item.tags as |t|}}
                <button
                  type="button"
                  class="elm-lb__tag"
                  {{on "click" (fn this.pickTag t)}}
                >{{t}}</button>
              {{/each}}
            </span>
          {{/if}}
          {{#unless this.isVideo}}
            <a
              class="elm-lb__original"
              href={{this.item.full}}
              target="_blank"
              rel="noopener noreferrer"
            >Original</a>
          {{/unless}}
        </div>
      </div>
    {{/in-element}}
  </template>
}
