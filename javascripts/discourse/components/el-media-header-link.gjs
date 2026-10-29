import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { service } from "@ember/service";
import DiscourseURL from "discourse/lib/url";
import store, { categoryUrl } from "../lib/media-store";

// "Media" in the site header, styled to sit alongside the catalogue's
// "Browse books" / "Browse collections" links.
export default class ElMediaHeaderLink extends Component {
  @service router;

  get url() {
    return categoryUrl(settings.category_slug);
  }

  get active() {
    const path = (this.router.currentURL || "").split(/[?#]/)[0];
    const onCategory = path === this.url || path.startsWith(`${this.url}/`);
    return onCategory && store.view === "media";
  }

  get label() {
    return settings.header_label;
  }

  @action
  go(event) {
    // Let ctrl/cmd/shift/middle clicks open a new tab as normal.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    store.setView("media");
    DiscourseURL.routeTo(this.url);
  }

  <template>
    <nav class="elm-header-links" aria-label="Media">
      <a
        href={{this.url}}
        class="elm-header-link {{if this.active 'is-active'}}"
        aria-current={{if this.active "page"}}
        {{on "click" this.go}}
      >{{this.label}}</a>
    </nav>
  </template>
}
