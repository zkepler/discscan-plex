// One card per movie: copies in different formats (DVD, Blu-ray, 4K…) live together.
const normalize = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const groupDiscs = (discs) => {
  const groups = new Map();

  discs.forEach((disc) => {
    const key = `${normalize(disc.title)}|${disc.year || ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.discs.push(disc);
    } else {
      groups.set(key, { key, discs: [disc] });
    }
  });

  return Array.from(groups.values());
};