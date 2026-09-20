// The public origin. Link previews and the sitemap have to name the site in
// absolute terms - a crawler or an unfurler has no page to resolve "/og.jpg"
// against - so both read it from here rather than each hardcoding a host.
//
// It stays the real domain even on next.cwrumotorsports.com: staging is
// noindex (see public/_headers), so the only cards and sitemap entries that
// ever reach anyone are production's.
export const SITE_URL = "https://cwrumotorsports.com";

/** Used as the og:site_name, and wherever the team is named to outsiders. */
export const SITE_NAME = "CWRU Motorsports";
