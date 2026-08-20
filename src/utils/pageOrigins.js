const ALL_PAGES_PATTERN_SUFFIX = "://*/*";

export const PAGE_ORIGINS = ["http", "https"].map(
  (scheme) => `${scheme}${ALL_PAGES_PATTERN_SUFFIX}`
);
