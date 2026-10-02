import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import BannerLink from '../components/BannerLink';
import './Home.css';

const PromoCarousel = ({ block }) => {
    const slides = block.slides || [];
    const [currentIndex, setCurrentIndex] = useState(0);
    const [startX, setStartX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const [dragDistance, setDragDistance] = useState(0);
    const autoplayRef = useRef(null);

    useEffect(() => {
        if (slides.length <= 1) return;
        startAutoplay();
        return () => stopAutoplay();
    }, [currentIndex, slides.length]);

    const startAutoplay = () => {
        stopAutoplay();
        autoplayRef.current = setInterval(() => {
            setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
        }, 10000); 
    };

    const stopAutoplay = () => {
        if (autoplayRef.current) clearInterval(autoplayRef.current);
    };

    const handleTouchStart = (e) => {
        setIsSwiping(true);
        setStartX(e.touches[0].clientX);
        setDragDistance(0);
        stopAutoplay(); 
    };

    const handleTouchEnd = (e) => {
        if (!isSwiping) return;
        
        const endX = e.changedTouches[0].clientX;
        const diffX = startX - endX;
        setDragDistance(Math.abs(diffX));

        if (diffX > 50) {
            setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
        } else if (diffX < -50) {
            setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
        }

        setIsSwiping(false);
        startAutoplay(); 
    };

    const preventDragClick = (e) => {
        if (dragDistance > 10) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    if (slides.length === 0) return null;

    return (
        <section className="promo-carousel-section">
            <div 
                className="promo-carousel-stage"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClickCapture={preventDragClick}
            >
                <div 
                    className="promo-carousel-track" 
                    style={{ transform: `translateX(-${currentIndex * 100}%)`, display: 'flex', transition: 'transform 0.5s ease' }}
                >
                    {slides.map((slide, idx) => (
                        <BannerLink 
                            key={idx} 
                            link={slide.link} 
                            openInNewTab={slide.openInNewTab} 
                            className="promo-slide-wrapper"
                            style={{ minWidth: '100%', flexShrink: 0 }}
                        >
                            {slide.isVideo ? (
                                <video autoPlay loop muted playsInline src={slide.image}></video>
                            ) : (
                                <img src={slide.image} alt={`Promo Banner ${idx + 1}`} draggable="false" />
                            )}
                        </BannerLink>
                    ))}
                </div>
            </div>
            
            {slides.length > 1 && (
                <div className="promo-dots">
                    {slides.map((_, idx) => (
                        <button 
                            key={idx} 
                            className={`promo-dot ${currentIndex === idx ? 'active' : ''}`}
                            onClick={() => setCurrentIndex(idx)}
                            aria-label={`Go to slide ${idx + 1}`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};

export default function Home() {
  const navigate = useNavigate();
   
  const [homeBlocks, setHomeBlocks] = useState([]);
  const [brandProfiles, setBrandProfiles] = useState({}); // 🔥 NEW: Store live brand logos
  const [loading, setLoading] = useState(true);

  // --- Network State ---
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
        setIsOffline(false);
        window.location.reload(); 
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  // ---------------------------

  useEffect(() => {
    async function fetchDynamicLayout() {
      if (isOffline) {
          setLoading(false);
          return;
      }
      try {
        const settingsRef = doc(db, "settings", "home_layout"); 
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.blocks) {
             setHomeBlocks(data.blocks);
          }
        }

        // 🔥 NEW: Fetch seller profiles to override static homepage images with live Storefront logos
        const profilesSnap = await getDocs(collection(db, "seller_profiles"));
        const profilesMap = {};
        profilesSnap.forEach(profileDoc => {
            const pData = profileDoc.data();
            if (pData.storefront && pData.storefront.vanityHandle) {
                profilesMap[pData.storefront.vanityHandle.toLowerCase()] = pData.storefront;
            }
        });
        setBrandProfiles(profilesMap);

      } catch (error) {
        console.error("Error fetching homepage layout:", error);
        setFetchError(true); // Flag if internet drops mid-fetch
      } finally {
        setLoading(false);
      }
    }
    
    fetchDynamicLayout();
  }, [isOffline]);

  if (loading) {
    return (
      <div className="home-loader" role="status" aria-live="polite">
        <div className="loader-mark">
          <div className="loader-wordmark">
            <span className="lw-amber">JAMBA</span>
            <span className="lw-thin">WEAR</span>
          </div>
          <p className="loader-tagline">Elevate your culture</p>
        </div>

        <div className="loader-bar" aria-hidden="true">
          <span></span>
        </div>

        <p className="loader-caption">Loading storefront</p>
      </div>
    );
  }

  // --- Offline View ---
  if (isOffline || fetchError) {
      return (
          <div className="home-container">
            <div className="offline-state-wrapper">
              <div className="offline-icon-circle">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                  <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                  <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                  <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                  <line x1="12" y1="20" x2="12.01" y2="20"></line>
                </svg>
              </div>
              <h2 className="offline-title">Connection Lost</h2>
              <p className="offline-desc">Please check your network settings and try again.</p>
              <button className="offline-retry-btn" onClick={() => window.location.reload()}>
                Try Again
              </button>
            </div>
          </div>
      );
  }
  // ---------------------------

  return (
     <div className="home-container">

      <div className="category-scroll">
        <span className="chip active">All</span>
        <span className="chip" onClick={() => navigate('/category/men')}>Men's</span>
        <span className="chip" onClick={() => navigate('/category/women')}>Women's</span>
        <span className="chip" onClick={() => navigate('/category/accessories')}>Accessories</span>
      </div>

      {homeBlocks.length > 0 ? homeBlocks.map((block) => {
          
          // Render Promo Banner
          if (block.type === 'promo-banner') {
              return <PromoCarousel key={block.id} block={block} />;
          }
          
          // Render Circle Row (Featured Brands)
          if (block.type === 'row' && block.shape === 'circle') {
              return (
                  <div key={block.id} className="circle-row-wrapper" style={{ backgroundColor: block.bgColor || 'transparent' }}>
                      
                      {block.title && (
                          <div className="circle-header">
                              <h2 className="circle-title">{block.title}</h2>
                          </div>
                      )}

                      <div className="circle-scroll">
                          {block.items.map((item, idx) => {
                              const isBrandShop = item.link && item.link.startsWith('/shop/');
                              
                              let displayImage = item.image;
                              let displayName = item.name;

                              // 🔥 NEW LOGIC: Override with live Brand Logo from Storefront Editor settings
                              if (isBrandShop) {
                                  const handle = item.link.replace('/shop/', '').toLowerCase();
                                  const brandData = brandProfiles[handle];
                                  if (brandData) {
                                      displayImage = brandData.brandLogo || item.image;
                                      displayName = brandData.brandName || item.name;
                                  }
                              }

                              const handleClick = () => {
                                  if (!item.link) {
                                      navigate('/category/all');
                                  } else if (isBrandShop) {
                                      navigate(item.link);
                                  } else {
                                      navigate(`/${item.link.replace(/^\/+/, '')}`);
                                  }
                              };

                              return (
                                  <div key={idx} className="circle-item" onClick={handleClick}>
                                      <div className="circle-img-wrapper">
                                          <img src={displayImage} alt={displayName} />
                                      </div>
                                      <p className="circle-name">{displayName}</p>
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              );
          }

          // Render Product Cards (Rectangle Row)
          if (block.type === 'row' && block.shape === 'rectangle') {
              return (
                  <div key={block.id} className="bubble-wrapper">
                      <div className="bubble-container" style={{ backgroundColor: block.bgColor || 'var(--ws-sand)' }}>
                          <div className="bubble-header">
                              <h2 className="bubble-title">{block.title}</h2>
                              <button className="more-btn" onClick={() => navigate(block.routeLink || '/category/all')} aria-label={`View more ${block.title}`}>
                                  <i className="fa-solid fa-arrow-right"></i>
                              </button>
                          </div>
                          
                          <div className="bubble-scroll">
                              {block.items.map((item, idx) => {
                                  const price = Number(item.price || 0);
                                  const originalPrice = Number(item.originalPrice || 0);
                                  
                                  return (
                                      <div key={idx} className="min-product-card" onClick={() => navigate(`/product/${item.link}`)}>
                                          <div className="min-image-wrapper">
                                              <img src={item.image} alt={item.name} />
                                          </div>
                                          <div className="min-product-info">
                                              <p className="min-title">{item.name}</p>
                                              <p className="min-brand">{item.brand || 'JAMBA'}</p>
                                              
                                              <div className="min-price-row">
                                                  <span className="min-current-price">₹{price.toLocaleString('en-IN')}</span>
                                                  {originalPrice > price && (
                                                      <span className="min-original-price">₹{originalPrice.toLocaleString('en-IN')}</span>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  </div>
              );
          }

          return null; 
      }) : (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--ws-muted)' }}>
              <h2>Welcome to JAMBA</h2>
              <p>Please configure your homepage layout in the Admin Panel.</p>
          </div>
      )}

    </div>
  );
}