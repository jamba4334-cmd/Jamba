import { Link } from 'react-router-dom';
import { FaInstagram, FaFacebookF } from 'react-icons/fa';
import { FaThreads } from 'react-icons/fa6';
import './Footer.css';

// ----------------------------------------------------
// REPLACE THESE VALUES WITH YOUR ACTUAL URLS & PATHS
// ----------------------------------------------------

const BRAND_NAME = "JAMBA WEAR";
const COPYRIGHT_YEAR = "2026";
const COPYRIGHT_TEXT = "Authentic Traditional Fashion.";

// Now includes the 'icon' component for each platform
const SOCIAL_LINKS = [
  { 
    platform: 'Instagram', 
    url: 'https://www.instagram.com/ig_jambawear/', 
    icon: <FaInstagram /> 
  },
  { 
    platform: 'Facebook', 
    url: 'https://www.facebook.com/profile.php?id=61588143396289', 
    icon: <FaFacebookF /> 
  },
  { 
    platform: 'Threads', 
    url: 'https://www.threads.net/@ig_jambawear', 
    icon: <FaThreads /> 
  },
];

const FOOTER_NAV_LINKS = [
  { label: 'Terms & Conditions', path: '/terms' },
  { label: 'Privacy Policy', path: '/privacy' },
  { label: 'Shipping Policy', path: '/shipping' },
  { label: 'Cancellation & Refunds', path: '/refunds' },
  { label: 'Contact Us', path: '/contact' },
];

// 🔥 UPDATED: Now points to the new Landing Page funnel
const SELLER_PORTAL_LINK = { label: 'Sell on Jamba', path: '/sell-with-us' };

// ----------------------------------------------------

export default function Footer() {
  return (
    <footer className="seo-footer">
      
      {/* Brand Text (Logo removed) */}
      <p className="brand-name">
        <span className="brand-part-one">{BRAND_NAME.split(" ")[0]}</span>
        <span className="brand-part-two">{BRAND_NAME.split(" ")[1]}</span>
      </p>
      
      {/* Social Media Icon Links */}
      <div className="social-links">
        {SOCIAL_LINKS.map((social) => (
          <a 
            key={social.platform} 
            href={social.url} 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label={social.platform}
            className="social-icon-link"
          >
            {social.icon}
          </a>
        ))}
      </div>

      {/* Internal Navigation Map */}
      <div className="footer-links">
        {FOOTER_NAV_LINKS.map((link) => (
          <Link key={link.label} to={link.path}>
            {link.label}
          </Link>
        ))}
        
        {/* Seller Portal Button */}
        <Link to={SELLER_PORTAL_LINK.path} className="seller-portal-btn">
          {SELLER_PORTAL_LINK.label}
        </Link>
      </div>
      
      <p className="copyright">
        &copy; {COPYRIGHT_YEAR} {COPYRIGHT_TEXT}
      </p>
    </footer>
  );
}