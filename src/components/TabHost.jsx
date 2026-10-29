import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Collection from '@/pages/Collection';
import Scan from '@/pages/Scan';
import PlexLibrary from '@/pages/PlexLibrary';
import History from '@/pages/History';
import SettingsPage from '@/pages/SettingsPage';
import { TabActiveContext } from '@/lib/tabActive';

const TABS = [
  { path: '/', Component: Collection },
  { path: '/scan', Component: Scan },
  { path: '/plex', Component: PlexLibrary },
  { path: '/history', Component: History },
  { path: '/settings', Component: SettingsPage },
];

// Every tab stays mounted; only the active one is visible, so scroll position
// and typed input survive switching tabs.
export default function TabHost() {
  const { pathname } = useLocation();
  const [visited, setVisited] = useState(() => new Set([pathname]));
  const positions = useRef({});
  const last = useRef(pathname);

  useEffect(() => {
    setVisited((prev) => (prev.has(pathname) ? prev : new Set(prev).add(pathname)));
  }, [pathname]);

  useEffect(() => {
    const remember = () => {
      positions.current[pathname] = window.scrollY;
    };
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, [pathname]);

  useLayoutEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    window.scrollTo({ top: positions.current[pathname] || 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return (
    <div>
      {TABS.filter(({ path }) => visited.has(path)).map(({ path, Component }) => {
        const isActive = path === pathname;
        return (
          <motion.div
            key={path}
            initial={false}
            animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              display: isActive ? 'block' : 'none',
              pointerEvents: isActive ? 'auto' : 'none',
              willChange: 'opacity, transform',
            }}
            aria-hidden={!isActive}
          >
            <TabActiveContext.Provider value={isActive}>
              <Component />
            </TabActiveContext.Provider>
          </motion.div>
        );
      })}
    </div>
  );
}