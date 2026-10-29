export const TAB_PATHS = ['/', '/scan', '/plex', '/history', '/settings'];

export function isTabPath(pathname) {
  return TAB_PATHS.includes(pathname);
}