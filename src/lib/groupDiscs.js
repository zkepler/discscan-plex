// One card per movie: every copy (DVD, Blu-ray, 4K…) links automatically to the title it belongs to.
const normalize = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Editions of the same film are named slightly differently ("Blade Runner (Final Cut)").
const EDITION_NOISE =
  /\b(final cut|director s cut|directors cut|extended|extended edition|unrated|remastered|special edition|collector s edition|anniversary edition|criterion|steelbook|theatrical|4k|uhd|blu ray|bluray|dvd|digital)\b/g;

export const baseTitle = (title) =>
  normalize(
    (title || '')
      .replace(/[([][^)\]]*[)\]]/g, ' ')
      .replace(EDITION_NOISE, ' ')
  );

// Two copies that disagree only by a year (or when one has no year) are still the same movie.
const sameFilm = (group, disc) => {
  if (group.base !== baseTitle(disc.title)) return false;
  if (!group.year || !disc.year) return true;
  return Math.abs(group.year - disc.year) <= 1;
};

export const groupDiscs = (discs) => {
  const groups = [];

  discs.forEach((disc) => {
    const group = groups.find((candidate) => sameFilm(candidate, disc));
    if (group) {
      group.discs.push(disc);
      group.year = group.year || disc.year;
    } else {
      groups.push({ key: `${baseTitle(disc.title)}|${disc.year || ''}`, base: baseTitle(disc.title), year: disc.year, discs: [disc] });
    }
  });

  return groups;
};