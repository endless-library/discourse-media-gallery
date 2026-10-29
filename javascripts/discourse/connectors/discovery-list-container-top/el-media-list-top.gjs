import Component from "@glimmer/component";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import ElMedia from "../../components/el-media";
import store, { isGalleryCategory } from "../../lib/media-store";

// `discovery-list-container-top` sits just above the topic list, inside
// #list-area. (We don't use the `discovery-list-area` wrapper outlet: only one
// component can wrap it, and the catalogue already does.)
//
// On the Archive category page we add Photos / Posts tabs. Photos shows the
// gallery, and CSS hides the topic list underneath while it's showing (keyed
// off the `elm-media-active` body class set by the gallery). Posts shows the
// normal topic list. Tag pages (/tags/c/archive/...) and every other category
// are left alone.
export default class ElMediaListTop extends Component {
  store = store;

  get category() {
    return this.args.outletArgs?.category ?? this.args.category;
  }

  get tag() {
    return this.args.outletArgs?.tag ?? this.args.tag;
  }

  get isGallery() {
    return isGalleryCategory(this.category, settings.category_slug) && !this.tag;
  }

  get isMedia() {
    return store.view === "media";
  }

  get mediaLabel() {
    return settings.media_tab_label;
  }

  get postsLabel() {
    return settings.posts_tab_label;
  }

  @action
  setView(view) {
    store.setView(view);
  }

  <template>
    {{#if this.isGallery}}
      <div class="elm-host">
        <div class="elm-tabs" role="tablist" aria-label="Archive views">
          <button
            type="button"
            role="tab"
            class="elm-tab {{if this.isMedia 'is-active'}}"
            aria-selected={{if this.isMedia "true" "false"}}
            {{on "click" (fn this.setView "media")}}
          >{{this.mediaLabel}}</button>
          <button
            type="button"
            role="tab"
            class="elm-tab {{unless this.isMedia 'is-active'}}"
            aria-selected={{if this.isMedia "false" "true"}}
            {{on "click" (fn this.setView "posts")}}
          >{{this.postsLabel}}</button>
        </div>
        {{#if this.isMedia}}
          <ElMedia @category={{this.category}} />
        {{/if}}
      </div>
    {{/if}}
  </template>
}
