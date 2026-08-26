import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './CategoryPage.css'; 

export default function CategoryPage() {
  const { category, subcategory } = useParams(); 
  const navigate = useNavigate();
  
  // Track the current URL to highlight the correct chip dynamically
  const location = useLocation();
  const currentPath = location.pathname;
  
  const [loading, setLoading] = useState(true);
  const [tribeConfig, setTribeConfig] = useState(null);

  useEffect(() => {
    async function fetchDynamicPage() {
      setLoading(true);
      try {
        const settingsRef = doc(db, "settings", "tribe_categories");
        const settingsSnap = await getDoc(settingsRef);
        let matchedTribe = null;

        if (settingsSnap.exists()) {
          const allTribes = settingsSnap.data().tribes || [];
          const targetCategory = (category || "").toLowerCase();
          matchedTribe = allTribes.find(t => (t.name || "").toLowerCase().includes(targetCategory));
        }

        if (!matchedTribe) {
           matchedTribe = {
               name: (category || "Men").toUpperCase() + " CATEGORIES",
               blocks: []
           };
        }

        const catStr = (category || "").toLowerCase();
        matchedTribe.bgColor = catStr === 'women' ? "#fbd9db" : catStr === 'accessories' ? "#ffe4b5" : "#a7d7b5";
        
        setTribeConfig(matchedTribe);
      } catch (error) {
        console.error("Error fetching category data:", error);
      }
      setLoading(false);
    }
    
    fetchDynamicPage();
  }, [category, subcategory]);

  if (loading) return <div className="loading" style={{ minHeight: '60vh' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading...</div>;

  return (
    <div className="cat-container">
        
      {/* THE CATEGORY NAVIGATION BAR */}
      <div className="category-scroll">
        <span 
          className={`chip ${currentPath === '/' ? 'active' : ''}`} 
          onClick={() => navigate('/')}
        >
          All
        </span>
        <span 
          className={`chip ${currentPath.includes('/category/men') ? 'active' : ''}`} 
          onClick={() => navigate('/category/men')}
        >
          Men's
        </span>
        <span 
          className={`chip ${currentPath.includes('/category/women') ? 'active' : ''}`} 
          onClick={() => navigate('/category/women')}
        >
          Women's
        </span>
        <span 
          className={`chip ${currentPath.includes('/category/accessories') ? 'active' : ''}`} 
          onClick={() => navigate('/category/accessories')}
        >
          Accessories
        </span>
      </div>

      {tribeConfig?.blocks?.length > 0 ? (
          tribeConfig.blocks.map(block => {
              if (block.type === 'banner') return <StorefrontBanner key={block.id} block={block} navigate={navigate} />;
              if (block.type === 'row' && block.shape === 'circle') return <StorefrontCircleRow key={block.id} block={block} bgColor={tribeConfig.bgColor} navigate={navigate} category={category} />;
              if (block.type === 'row' && block.shape === 'rectangle') return <StorefrontRectangleRow key={block.id} block={block} navigate={navigate} category={category} />;
              return null;
          })
      ) : (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: '#666' }}>
             <h2>Coming Soon</h2>
             <p>This category is currently being updated.</p>
          </div>
      )}
    </div>
  );
}

/* =========================================================
   DYNAMIC BLOCK COMPONENTS 
   ========================================================= */

const StorefrontBanner = ({ block, navigate }) => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);

    useEffect(() => {
        if (!block.items || block.items.length <= 1) return;
        const activeMedia = block.items[currentIdx];
        if (activeMedia.isVideo) return; 
        
        const timer = setTimeout(() => {
            setCurrentIdx((prevIdx) => (prevIdx + 1) % block.items.length);
        }, 4000); 
        return () => clearTimeout(timer);
    }, [currentIdx, block.items]);

    if (!block.items || block.items.length === 0) return null;

    const activeMedia = block.items[currentIdx];
    const handleNext = () => setCurrentIdx((prev) => (prev + 1) % block.items.length);
    const handlePrev = () => setCurrentIdx((prev) => (prev === 0 ? block.items.length - 1 : prev - 1));

    const minSwipeDistance = 50;
    
    const handleDragStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.type.includes('mouse') ? e.pageX : e.touches[0].clientX);
    };
    const handleDragMove = (e) => {
        if (!touchStart) return;
        setTouchEnd(e.type.includes('mouse') ? e.pageX : e.touches[0].clientX);
    };
    const handleDragEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > minSwipeDistance) handleNext();
        if (distance < -minSwipeDistance) handlePrev();
        setTouchStart(null);
        setTouchEnd(null);
    };

    return (
        <div 
            className="cat-promo-banner" 
            onTouchStart={handleDragStart} 
            onTouchMove={handleDragMove} 
            onTouchEnd={handleDragEnd}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
        >
            <div 
                style={{ width: '100%', height: '100%', cursor: activeMedia.link ? 'pointer' : 'grab' }}
                onClick={(e) => {
                    if (touchStart && touchEnd && Math.abs(touchStart - touchEnd) > 10) return;
                    
                    let routeLink = activeMedia.link || activeMedia.item_id || activeMedia.id;
                    if (routeLink && routeLink !== 'undefined') {
                        routeLink = String(routeLink).replace(/^\/+/, '');
                        navigate(`/${routeLink}`);
                    }
                }}
            >
                {activeMedia.isVideo ? (
                    <video src={activeMedia.image} autoPlay muted playsInline onEnded={handleNext} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                ) : (
                    <img src={activeMedia.image} alt="Promo Banner" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                )}
            </div>
            
            {block.items.length > 1 && (
                <div className="cat-promo-dots">
                    {block.items.map((_, idx) => (
                        <span key={idx} className={`cat-promo-dot ${idx === currentIdx ? 'active' : ''}`} onClick={() => setCurrentIdx(idx)}></span>
                    ))}
                </div>
            )}
        </div>
    );
};

const StorefrontCircleRow = ({ block, bgColor, navigate, category }) => {
    const scrollRef = useRef(null);
    let isDown = false;
    let startX;
    let scrollLeft;
    let hasDragged = false; 

    const onMouseDown = (e) => {
        isDown = true;
        hasDragged = false; 
        startX = e.pageX - scrollRef.current.offsetLeft;
        scrollLeft = scrollRef.current.scrollLeft;
    };
    const onMouseLeave = () => { isDown = false; };
    const onMouseUp = () => { isDown = false; };
    const onMouseMove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        if (Math.abs(x - startX) > 5) hasDragged = true; 
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    if (!block.items || block.items.length === 0) return null;

    return (
        <div className="cat-section">
            {block.title && <h2 className="cat-section-title">{block.title}</h2>}
            
            <div className="cat-top-section" style={{ backgroundColor: block.bgColor || bgColor }}>
                <div 
                    className="cat-subcat-scroll"
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseLeave}
                    onMouseUp={onMouseUp}
                    onMouseMove={onMouseMove}
                >
                    {block.items.map((item, idx) => (
                        <div 
                            key={idx} 
                            className="cat-subcat-item" 
                            onClick={(e) => {
                                if (hasDragged) { 
                                    e.preventDefault(); 
                                    e.stopPropagation();
                                    return; 
                                } 
                                
                                let routeLink = item.link || item.item_id || item.id;
                                if (routeLink && routeLink !== 'undefined') {
                                    routeLink = String(routeLink).replace(/^\/+/, '');
                                    if(routeLink.includes('category') || routeLink.includes('product')) {
                                        navigate(`/${routeLink}`);
                                    } else {
                                        navigate(`/product/${routeLink}`);
                                    }
                                } else {
                                    navigate(`/category/${category}/${item.name.toLowerCase()}`);
                                }
                            }}
                        >
                            <div className="cat-subcat-box">
                                {item.image ? (
                                    <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                ) : (
                                    <span style={{ fontSize: '10px', fontWeight: 'bold' }}>IMG</span>
                                )}
                            </div>
                            <span className="cat-subcat-label">{item.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const StorefrontRectangleRow = ({ block, navigate, category }) => {
    const scrollRef = useRef(null);
    let isDown = false;
    let startX;
    let scrollLeft;
    let hasDragged = false;

    const onMouseDown = (e) => {
        isDown = true;
        hasDragged = false; 
        startX = e.pageX - scrollRef.current.offsetLeft;
        scrollLeft = scrollRef.current.scrollLeft;
    };
    const onMouseLeave = () => { isDown = false; };
    const onMouseUp = () => { isDown = false; };
    const onMouseMove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        if (Math.abs(x - startX) > 5) hasDragged = true;
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    if (!block.items || block.items.length === 0) return null;

    return (
        <div className="cat-section">
            {(block.title || block.items.length > 0) && (
                <div className="cat-section-header">
                    <h2 className="cat-section-title">{block.title || ''}</h2>
                    <button 
                        className="cat-view-more" 
                        onClick={() => navigate(`/category/${category}`)} 
                    >
                        View More <i className="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            )}
            
            <div className="cat-yellow-container" style={{ backgroundColor: block.bgColor || '#fce268' }}>
                <div 
                    className="cat-product-row-scroll"
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseLeave={onMouseLeave}
                    onMouseUp={onMouseUp}
                    onMouseMove={onMouseMove}
                >
                    {block.items.map((item, idx) => (
                        <div 
                            key={idx} 
                            className="cat-product-card" 
                            onClick={(e) => {
                                if (hasDragged) { 
                                    e.preventDefault(); 
                                    e.stopPropagation();
                                    return; 
                                } 
                                
                                let productId = item.link || item.item_id || item.id || item._id;

                                if (!productId || productId === 'undefined') {
                                    alert("Routing Error: This product is missing a valid ID. Please re-add it in the Admin Panel.");
                                    return;
                                }

                                productId = String(productId).replace(/\/product\//g, '').replace(/^\/+/, '');
                                navigate(`/product/${productId}`);
                            }}
                        >
                            <div className="cat-image-wrapper">
                                <img src={item.image || 'https://via.placeholder.com/150'} alt={item.name} />
                            </div>
                            
                            <div className="cat-product-info">
                                <p className="cat-title">{item.name}</p>
                                <p className="cat-brand">{item.brand || 'JAMBA'}</p>
                                
                                <div className="cat-price-row">
                                    <div className="cat-price-group">
                                        <span className="cat-current-price">₹{Number(item.price || 0).toLocaleString('en-IN')}</span>
                                        {item.originalPrice > item.price && (
                                            <span className="cat-original-price">₹{Number(item.originalPrice).toLocaleString('en-IN')}</span>
                                        )}
                                    </div>
                                    <button className="cat-heart-btn" onClick={(e) => {
                                        e.stopPropagation(); 
                                        if (!hasDragged) console.log("Wishlist clicked!");
                                    }}>
                                        <i className="fa-regular fa-heart"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};