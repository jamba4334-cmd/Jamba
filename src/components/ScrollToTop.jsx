import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  // useLocation detects whenever the URL changes (e.g., / to /cart or /order)
  const { pathname } = useLocation();

  useEffect(() => {
    // Instantly scroll the window to the very top left coordinate
    window.scrollTo(0, 0);
  }, [pathname]); // This triggers every single time the path changes

  return null; // This component doesn't need to render any HTML
};

export default ScrollToTop;