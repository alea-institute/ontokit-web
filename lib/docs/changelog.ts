export const changelogAnchorId = (version: string) =>
  `v-${version.replace(/\./g, "-")}`;
