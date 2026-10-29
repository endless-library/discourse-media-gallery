# Endless Library Media Gallery — Discourse theme component

Turns the Archive category into a photo gallery: every photo and video posted
in Archive topics, in one clean grid, filterable by tag.

What visitors get:

- **Photos / Posts tabs** on the Archive category page. *Photos* is the
  gallery; *Posts* is Discourse's normal topic list (with Topic List
  Thumbnails' masonry view if that's installed).
- **One grid of everything**: every photo and video from every Archive topic,
  newest first, including photos posted as replies. The grid keeps loading as
  you scroll. Square tiles by default, or each photo at its own shape
  (`tile_shape`).
- **Tag filters** along the top (All, 2026, open-day, …).
- **A full-screen viewer**: arrow keys or swipe to move through the whole
  gallery, swipe down or Esc to close. The caption links to the post, shows
  who posted it and when, and its tags are clickable filters.
- **Share photos** button for people allowed to post in the category. It
  opens a new topic in Archive, pre-tagged with the current filter.
- A **Media** link in the header next to the catalogue links, and in the menu.
- Inside Archive topics, photos lose Discourse's grey file name / size bar and
  sit closer together.

## Install

1. Push this folder to `github.com/endless-library/discourse-media-gallery`
   (public).
2. Admin → Appearance → Themes & components → **Components** → **Install** →
   *From a git repository* → paste the repo URL.
3. Open the component and, under *Include component on these themes*, add the
   site's active theme.
4. Check the settings (below). The defaults assume the category slug is
   `archive`.

Updating later: push changes to GitHub, then **Check for updates** on the
component page.

## Settings

| Setting | What it does |
|---|---|
| `category_slug` | Category the gallery reads from (default `archive`). |
| `default_view` | Which tab the category opens on: `media` (grid) or `posts`. |
| `media_tab_label`, `posts_tab_label` | Tab wording. |
| `tile_shape` | `square` (even grid) or `natural` (each photo's own shape, in columns). |
| `include_replies` | Include photos posted as replies, not only first posts. |
| `filter_tags` | Tags to show first in the filter bar, in order. Others in use follow. |
| `hide_tags` | Tags to leave out of the filter bar. |
| `share_label` | The new-topic button. Empty hides it. |
| `show_header_link`, `header_label` | The header link (hidden on screens under 420px; the menu link covers phones). |
| `show_menu_link` | Menu link in the Community section. |

## How it works

Discourse has no "every image in a category" API, so the gallery reads the
same public JSON the forum itself uses:

1. `/c/archive/<id>/l/latest.json?order=created` for the topic list, one page
   (30 topics) at a time, with `&tags=<name>` when a filter is chosen.
2. `/t/<id>.json` for each topic (4 at a time), plus
   `/t/<id>/posts.json` for topics with more than 20 posts.
3. The photos and videos are read out of each post's HTML: uploaded images
   (lightbox links and small inline images) and video uploads. Emoji,
   avatars, link previews and quoted posts are skipped.

Everything respects permissions: visitors only see topics they could open
anyway. Topics already read are cached for the visit, so switching filters
and coming back is instant.

Cost: one request per topic the first time it's shown. That's fine for
hundreds of topics. Because the grid loads as you scroll, a large archive
doesn't load all at once.

## How it hooks into Discourse

- `connectors/discovery-list-container-top/` renders the tabs and grid just
  above the topic list on the Archive category page. While *Photos* is
  showing, `common.scss` hides the topic list and the category's title bar
  (via the `body.elm-media-active` class).
- It deliberately doesn't use the `discovery-list-area` outlet: that one wraps
  the list, only one component can use it, and the catalogue already does.
- The header link shares the `before-header-panel` outlet with the
  catalogue's links; `common.scss` lays that outlet out as a row.

## Files

```
about.json, settings.yml
common/common.scss                              styles (gallery, viewer, Archive topics)
javascripts/discourse/
  api-initializers/el-media.js                  header link, menu link, starting tab
  connectors/discovery-list-container-top/      Photos / Posts tabs and the grid, above the topic list
  components/el-media.gjs                        the grid, filters, infinite scroll
  components/el-media-lightbox.gjs              full-screen viewer
  components/el-media-header-link.gjs           header link
  lib/media-store.js                            loading, paging, caching
  lib/media-parse.js                            finds photos and videos in post HTML
dev/parse.test.mjs                              tests for media-parse.js (not loaded by Discourse)
```

To run the tests: `cd dev && npm install jsdom && node --test parse.test.mjs`.
