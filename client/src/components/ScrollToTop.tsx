import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

// Reset the window scroll to the top whenever the route changes, so a new
// page never opens scrolled to where the previous page was left.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
