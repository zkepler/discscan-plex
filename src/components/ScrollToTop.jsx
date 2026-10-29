import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { isTabPath } from "@/lib/tabPaths";

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);

  useEffect(() => {
    const from = previousPath.current;
    previousPath.current = pathname;

    if (navigationType === "POP") return;

    // Switching tabs keeps each view's own scroll position.
    if (from !== pathname && isTabPath(from) && isTabPath(pathname)) return;

    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => window.clearTimeout(timer);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}