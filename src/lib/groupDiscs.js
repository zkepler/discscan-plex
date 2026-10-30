// One card per movie: every copy (DVD, Blu-ray, 4K…) links automatically to the title it belongs to.
const normalize = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Editions of the same film are named slightly differently ("Blade Runner (Final Cut)").
const EDITION_NOISE =
  /\b(final cut|director s cut|directors cut|extended|extended edition|unrated|remastered|special edition|collector s edition|anniversary edition|criterion|steelbook|theatrical|4k|uhd|blu ray|bluray|dvd|digital)\b/g;

const SEASON_WORDS = {
  one: 1,
  first: 1,
  two: 2,
  second: 2,
  three: 3,
  third: 3,
  four: 4,
  fourth: 4,
  five: 5,
  fifth: 5,
  six: 6,
  sixth: 6,
  seven: 7,
  seventh: 7,
  eight: 8,
  eighth: 8,
  nine: 9,
  ninth: 9,
  ten: 10,
  tenth: 10,
  eleven: 11,
  eleventh: 11,
  twelve: 12,
  twelfth: 12,
};

// "Season 2", "Season Two", "The Complete Third Season", "Series 3".
const SEASON_PATTERN =
  '\\b(?:the\\s+)?complete\\s+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\\s+season\\b|\\b(?:season|series)\\s*(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\b';

const seasonRegex = () => new RegExp(SEASON_PATTERN, 'gi');

// The season a TV release covers, when its title says so.
export const seasonNumber = (title) => {
  const matcher = seasonRegex();
  let match;
  while ((match = matcher.exec(String(title || '')))) {
    const raw = (match[1] || match[2] || '').toLowerCase();
    if (/^\d+$/.test(raw)) return Number(raw);
    if (SEASON_WORDS[raw]) return SEASON_WORDS[raw];
  }
  return null;
};

// "Breaking Bad: The Complete Second Season" reads as the show it belongs to.
export const showName = (title) => {
  const cleaned = String(title || '')
    .replace(seasonRegex(), ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:–—,/-]+|[\s:–—,/-]+$/g, '')
    .trim();
  return cleaned || String(title || '').trim();
};

export const baseTitle = (title) =>
  normalize(
    (title || '')
      .replace(/[([][^)\]]*[)\]]/g, ' ')
      .replace(EDITION_NOISE, ' ')
  );

// Every season of one show shares a base, so they can share a card.
export const showBase = (title) => baseTitle(showName(title));

// Copies matched to the same Plex title are the same film, whatever their titles say.
// Otherwise two copies that disagree only by a year (or when one has no year) still link.
export const sameFilm = (group, disc) => {
  if (group.plexKey && disc.plex_rating_key) return group.plexKey === disc.plex_rating_key;
  // A TV show's card takes in every season, however far apart their release years sit.
  if (group.show && showBase(disc.title) === group.show) return true;
  // A season joins the plain show already on the shelf, so the first disc does not split off.
  if (seasonNumber(disc.title) !== null && group.base === showBase(disc.title)) return true;
  if (group.base !== baseTitle(disc.title)) return false;
  if (!group.year || !disc.year) return true;
  return Math.abs(group.year - disc.year) <= 1;
};

export const groupDiscs = (discs) => {
  const groups = [];

  discs.forEach((disc) => {
    const group = groups.find((candidate) => sameFilm(candidate, disc));
    const base = baseTitle(disc.title);
    const season = seasonNumber(disc.title);

    if (group) {
      group.discs.push(disc);
      group.year = group.year || disc.year;
      group.plexKey = group.plexKey || disc.plex_rating_key || '';
      if (season !== null) {
        group.show = group.show || showBase(disc.title);
        group.showTitle = group.showTitle || showName(disc.title);
        group.seasons.push(season);
      }
    } else {
      groups.push({
        key: `${disc.plex_rating_key || base}|${disc.year || ''}`,
        base,
        show: season !== null ? showBase(disc.title) : '',
        showTitle: season !== null ? showName(disc.title) : '',
        seasons: season !== null ? [season] : [],
        year: disc.year,
        plexKey: disc.plex_rating_key || '',
        discs: [disc],
      });
    }
  });

  groups.forEach((group) => {
    group.seasons = [...new Set(group.seasons)].sort((a, b) => a - b);
  });

  return groups;
};