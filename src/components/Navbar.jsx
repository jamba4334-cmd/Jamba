import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; 
import { auth, db } from '../firebase'; 
import './Navbar.css';

import brandLogo from '../assets/JAMBA-Logo.png';

export default function Navbar() {
  const { user } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // 🔥 NEW: State to track if the user has scrolled down
  const [isScrolled, setIsScrolled] = useState(false);
  
  const [promoMessages, setPromoMessages] = useState([{ text: "Free Delivery On Orders Above ₹2000", color: "#ffffff" }]);
  const [promoMode, setPromoMode] = useState("grid");
  const [promoBgColor, setPromoBgColor] = useState("#1a1a1a");
  const [promoThread1, setPromoThread1] = useState("rgba(255, 255, 255, 0.05)");
  const [promoVideo, setPromoVideo] = useState("");

  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const [fade, setFade] = useState(true);

  const cartCount = cart.reduce((acc, item) => acc + (parseInt(item.quantity) || 0), 0);

  let displayName = "JAMBA Member";
  if (user && user.displayName) {
      displayName = user.displayName.split(' ')[0]; 
  }

  // 🔥 NEW: Scroll Listener to trigger the animation
  useEffect(() => {
    const handleScroll = () => {
      // If the user scrolls down more than 40px, collapse the search bar
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "hero_banners"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        
        if (data.promo_messages && Array.isArray(data.promo_messages)) {
            setPromoMessages(data.promo_messages);
        } else if (data.promo_text) {
            setPromoMessages([{ text: data.promo_text, color: "#ffffff" }]);
        }

        if (data.promo_mode) setPromoMode(data.promo_mode);
        if (data.promo_bg_color) setPromoBgColor(data.promo_bg_color);
        if (data.promo_thread1) setPromoThread1(data.promo_thread1);
        if (data.promo_video) setPromoVideo(data.promo_video); 
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (promoMessages.length <= 1) {
      setFade(true);
      return;
    }
    
    const interval = setInterval(() => {
      setFade(false); 
      setTimeout(() => {
        setCurrentMsgIndex((prev) => (prev + 1) % promoMessages.length);
        setFade(true); 
      }, 400); 
    }, 3500); 

    return () => clearInterval(interval);
  }, [promoMessages.length]);

  const safeIndex = currentMsgIndex >= promoMessages.length ? 0 : currentMsgIndex;
  const currentMsg = promoMessages[safeIndex] || { text: "", color: "#ffffff" };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('jambaCart');
      localStorage.removeItem('jambaActiveCheckout');
      localStorage.removeItem('jambaSavedAddresses');
      localStorage.removeItem('jambaDeliveryAddress');
      localStorage.removeItem('jamba_user_role');
      
      await signOut(auth);
      setDropdownOpen(false);
      navigate('/login'); 
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const gridStyle = promoMode === 'grid' ? {
    backgroundColor: promoBgColor,
    backgroundImage: `
      linear-gradient(45deg, ${promoThread1} 25%, transparent 25%, transparent 75%, ${promoThread1} 75%, ${promoThread1}), 
      linear-gradient(45deg, ${promoThread1} 25%, transparent 25%, transparent 75%, ${promoThread1} 75%, ${promoThread1})
    `,
    backgroundSize: '12px 12px', 
    backgroundPosition: '0 0, 6px 6px' 
  } : { backgroundColor: promoBgColor }; 

  return (
    <>
      {/* 🔥 The "scrolled" class is applied here when the user scrolls down */}
      <div className={`fixed-header-wrapper ${isScrolled ? 'scrolled' : ''}`}>
        <header className="top-bar">
          <div className="logo">
            <Link to="/">
              <img src={brandLogo} alt="JAMBA WEAR" />
            </Link>
          </div>
          
          <div className="search-container">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-button" aria-label="Search">
                <svg className="nav-icon search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </form>
          </div>
          
          <div className="right-actions">
            <Link to="/cart" className="action-item">
              <div className="icon-wrapper cart-icon-wrapper">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span className="cart-badge" style={{ display: cartCount > 0 ? 'flex' : 'none' }}>
                  {cartCount}
                </span>
              </div>
              <span className="nav-text">Cart</span>
            </Link>

            <div className="profile-wrapper" ref={dropdownRef}>
              <div className="action-item profile-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
                <div className="icon-wrapper">
                  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <span className="nav-text">Profile</span>
              </div>
              
              <div className={`dropdown-menu ${dropdownOpen ? 'show' : ''}`}>
                <div className="dropdown-header">
                  Hi, {displayName}
                </div>
                
                {!user && (
                  <Link to="/login" onClick={() => setDropdownOpen(false)}>Login / Signup</Link>
                )}

                <Link to="/orders" onClick={() => setDropdownOpen(false)}>Orders</Link>
                <Link to="/address" onClick={() => setDropdownOpen(false)}>Address</Link>
                <Link to="/wishlist" onClick={() => setDropdownOpen(false)}>Wishlist</Link>
                <Link to="/contact" onClick={() => setDropdownOpen(false)}>Contact Us</Link>
                
                {user && (
                  <span className="logout-link" onClick={handleLogout}>Logout</span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="promo-banner" style={gridStyle}>
          {promoMode === 'video' && promoVideo && (
            <video className="promo-video-bg" autoPlay loop muted playsInline>
              <source src={promoVideo} type="video/mp4" />
            </video>
          )}
          <span 
            className="promo-text-content" 
            style={{ 
              color: currentMsg.color, 
              opacity: fade ? 1 : 0, 
              transition: 'opacity 0.4s ease-in-out' 
            }}
          >
            {currentMsg.text}
          </span>
        </div>
      </div>

      <div className="header-spacer"></div>
    </>
  );
}