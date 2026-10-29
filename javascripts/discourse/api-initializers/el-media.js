import { apiInitializer } from "discourse/lib/api";
import ElMediaHeaderLink from "../components/el-media-header-link";
import store, { categoryUrl } from "../lib/media-store";

export default apiInitializer((api) => {
  store.setView(settings.default_view);

  // A full page load of /c/archive?view=posts (e.g. a shared link) opens on
  // that tab. Read it now, before Discourse's router strips the parameter.
  const view = new URLSearchParams(window.location.search).get("view");
  if (view) {
    store.setView(view);
  }

  if (settings.show_header_link) {
    api.renderInOutlet("before-header-panel", ElMediaHeaderLink);
  }

  if (settings.show_menu_link) {
    api.addCommunitySectionLink({
      name: "media-gallery",
      href: categoryUrl(settings.category_slug),
      title: "Photos and videos from library events",
      text: settings.header_label,
      icon: "images",
    });
  }
});
