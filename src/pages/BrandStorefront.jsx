import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './BrandStorefront.css';

// Global mouse-drag logic for desktop sliding (Touch devices use native CSS scroll)
let isDragging = false;
const dragEvents = {
    onMouseDown: (e) => {
        isDragging = false;
        const slider = e.currentTarget;
        slider.dataset.isDown = 'true';
        slider.dataset.startX = e.pageX - slider.offsetLeft;
        slider.dataset.scrollLeft = slider.scrollLeft;
        slider.style.cursor = 'grabbing';
        slider.style.scrollBehavior = 'auto'; // Remove smooth scroll during manual drag
        if (slider.classList.contains('snap-track')) slider.style.scrollSnapType = 'none';
    },
    onMouseLeave: (e) => {
        const slider = e.currentTarget;
        if (slider.dataset.isDown === 'true') {
            slider.dataset.isDown = 'false';
            slider.style.cursor = 'grab';
            slider.style.scrollBehavior = 'smooth';
            if (slider.classList.contains('snap-track')) slider.style.scrollSnapType = 'x mandatory';
        }
    },
    onMouseUp: (e) => {
        const slider = e.currentTarget;
        slider.dataset.isDown = 'false';
        slider.style.cursor = 'grab';
        slider.style.scrollBehavior = 'smooth';
        if (slider.classList.contains('snap-track')) slider.style.scrollSnapType = 'x mandatory';
    },
    onMouseMove: (e) => {
        const slider = e.currentTarget;
        if (slider.dataset.isDown !== 'true') return;
        isDragging = true;
        e.preventDefault();
        const startX = parseFloat(slider.dataset.startX);
        const scrollLeft = parseFloat(slider.dataset.scrollLeft);
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 1.5; // Scroll speed multiplier
        slider.scrollLeft = scrollLeft - walk;
    },
    onClickCapture: (e) => {
        // Prevent link clicks if the user was just dragging
        if (isDragging) {
            e.stopPropagation();
            e.preventDefault();
            isDragging = false;
        }
    }
};

export default function BrandStorefront() {
    const { vanityHandle, pageId } = useParams();
    
    const [storefront, setStorefront] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStorefront = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, "seller_profiles"), where("storefront.vanityHandle", "==", vanityHandle.toLowerCase()));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) setError("Brand storefront not found.");
                else setStorefront(querySnapshot.docs[0].data().storefront);
            } catch (err) { setError("Failed to load storefront."); } 
            finally { setIsLoading(false); }
        };
        if (vanityHandle) fetchStorefront();
    }, [vanityHandle]);

    const activeModules = !pageId && storefront ? (storefront.modules || []) : [];
    const customPage = pageId && storefront ? storefront.pages?.find(p => p.id === pageId) : null;

    // 🔥 NEW: Scrollable Banner Autoplay Logic
    useEffect(() => {
        if (!activeModules || activeModules.length === 0) return;
        const intervals = [];
        activeModules.forEach(mod => {
            if ((mod.type === 'main_banner' || mod.type === 'small_banner') && mod.slides?.length > 1) {
                const scrollTimeMs = (mod.scrollTime || (mod.type === 'main_banner' ? 10 : 5)) * 1000;
                
                const id = setInterval(() => {
                    const slider = document.getElementById(`banner-track-${mod.id}`);
                    // Only autoscroll if the user isn't currently dragging it
                    if (slider && slider.dataset.isDown !== 'true') {
                        const maxScroll = slider.scrollWidth - slider.clientWidth;
                        if (slider.scrollLeft >= maxScroll - 5) { 
                            slider.scrollTo({ left: 0, behavior: 'smooth' }); // Reset to start
                        } else {
                            slider.scrollBy({ left: slider.clientWidth, behavior: 'smooth' }); // Next slide
                        }
                    }
                }, scrollTimeMs);
                intervals.push(id);
            }
        });
        return () => intervals.forEach(id => clearInterval(id));
    }, [activeModules]);

    if (isLoading) return <div className="storefront-loading"><i className="fa-solid fa-spinner fa-spin"></i> Loading...</div>;
    if (error || !storefront) return <div className="storefront-error"><h2>{error || "Store Not Found"}</h2><Link to="/" className="storefront-back-btn">Return to Marketplace</Link></div>;

    const resolveLink = (link) => {
        if (!link) return "#";
        if (link.startsWith('http')) return link;
        if (link.startsWith('/pages/')) return `/shop/${vanityHandle}${link}`;
        return link; 
    };

    let isFirstCategory = true;

    const MiniProductCard = ({ prod }) => {
        const price = Number(prod.price || 0);
        const originalPrice = Number(prod.originalPrice || price * 1.2);

        return (
            <Link to={`/product/${prod.id}`} className="min-product-card">
                <div className="min-image-wrapper">
                    {/* draggable=false stops the browser from trying to drag the image file instead of scrolling */}
                    <img src={prod.image} alt={prod.name} draggable="false" onDragStart={e => e.preventDefault()} />
                </div>
                <div className="min-product-info">
                    <p className="min-title">{prod.name}</p>
                    <p className="min-brand">{storefront?.brandName || 'JAMBA'}</p>
                    <div className="min-price-row">
                        <span className="min-current-price">₹{price.toLocaleString('en-IN')}</span>
                        {originalPrice > price && (
                            <span className="min-original-price">₹{originalPrice.toLocaleString('en-IN')}</span>
                        )}
                    </div>
                </div>
            </Link>
        );
    };

    return (
        <div className="public-storefront-wrapper">
            
            {!pageId && (
                <div className="storefront-brand-header">
                    {storefront.headerType === 'banner' && storefront.headerBanner ? (
                        <div className="brand-header-banner-container">
                            <img src={storefront.headerBanner} alt={`${storefront.brandName} Banner`} draggable="false" />
                        </div>
                    ) : (
                        <h1 className="brand-header-name" style={{ color: storefront.brandColor || 'var(--ws-ink)' }}>
                            {storefront.brandName || "JAMBA"}
                        </h1>
                    )}
                    <span className="official-store-badge">OFFICIAL STORE</span>
                </div>
            )}

            {/* --- CUSTOM PAGE VIEW (Traditional Grid) --- */}
            {pageId && customPage && (
                <div className="custom-page-container">
                    <div className="custom-page-breadcrumbs">
                        <Link to={`/shop/${vanityHandle}`}>Home</Link> / <span>{customPage.title}</span>
                    </div>
                    
                    <div className="custom-page-header">
                        <h1 className="category-title">{customPage.title}</h1>
                        <span className="product-count">(Showing 1 - {customPage.products?.length || 0} products)</span>
                    </div>

                    <div className="page-fake-sort-bar">
                        <span style={{fontWeight:'bold', marginRight:'10px'}}>SORT BY</span>
                        <span className="sort-pill active">Popularity</span>
                        <span className="sort-pill">Price -- Low to High</span>
                        <span className="sort-pill">Price -- High to Low</span>
                        <span className="sort-pill">Newest First</span>
                    </div>

                    {customPage.products?.length > 0 ? (
                        <div className="page-traditional-grid">
                            {customPage.products.map((prod, pIdx) => (
                                <Link to={`/product/${prod.id}`} key={pIdx} className="traditional-product-card">
                                    <div className="trad-img-wrapper">
                                        <img src={prod.image} alt={prod.name} draggable="false" />
                                        <div className="trad-heart"><i className="fa-regular fa-heart"></i></div>
                                    </div>
                                    <div className="trad-details">
                                        <div className="trad-brand">{storefront.brandName || 'JAMBA'}</div>
                                        <div className="trad-name">{prod.name}</div>
                                        <div className="trad-price-row">
                                            <span className="trad-price">₹{Number(prod.price).toLocaleString('en-IN')}</span>
                                            <span className="trad-old-price">₹{(prod.price * 1.2).toFixed(0)}</span> 
                                            <span className="trad-discount">20% off</span>
                                        </div>
                                        <div className="trad-delivery">Delivery by 11th Aug</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ws-muted)' }}>
                            No products have been added to this collection yet.
                        </div>
                    )}
                </div>
            )}

            {pageId && !customPage && (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ws-muted)' }}>This custom page does not exist.</div>
            )}

            {/* --- MAIN STOREFRONT MODULES VIEW --- */}
            {!pageId && (
                <div className="storefront-modules-container">
                    {activeModules.map((mod) => (
                        <div key={mod.id} className="storefront-module">
                            
                            {/* MAIN BANNER (Now Drag/Swipe Scrollable) */}
                            {mod.type === 'main_banner' && mod.slides?.length > 0 && (
                                <div className="public-main-banner snap-track draggable-track" id={`banner-track-${mod.id}`} {...dragEvents}>
                                    {mod.slides.map((slide, idx) => {
                                        const MediaContent = slide.isVideo ? <video src={slide.url} autoPlay loop muted playsInline draggable="false" /> : <img src={slide.url} alt="Banner" draggable="false" onDragStart={e=>e.preventDefault()}/>;
                                        const finalLink = resolveLink(slide.link);

                                        return (
                                            <div key={idx} className="banner-slide snap-slide">
                                                {slide.link ? (
                                                    finalLink.startsWith('http') ? <a href={finalLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>{MediaContent}</a>
                                                    : <Link to={finalLink} style={{ display: 'block', width: '100%', height: '100%' }}>{MediaContent}</Link>
                                                ) : MediaContent}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* CATEGORY ROW (Draggable) */}
                            {mod.type === 'category_row' && mod.items?.length > 0 && (
                                <div className="public-category-row">
                                    {isFirstCategory && <h2 className="section-main-title">CATEGORIES</h2>}
                                    {(() => { isFirstCategory = false; return null; })()}
                                    {mod.heading && <div className="category-divider"><span className="category-pill">{mod.heading}</span></div>}
                                    <div className="category-scroll-area draggable-track" {...dragEvents}>
                                        {mod.items.map(item => {
                                            const masterCat = (mod.heading && mod.heading !== 'CUSTOM') ? mod.heading.toLowerCase().replace(/\s+/g, '-') : 'all';
                                            const subCat = item.text.toLowerCase().replace(/\s+/g, '-');
                                            const destinationUrl = `/category/${masterCat}/${subCat}?brand=${vanityHandle}`;
                                            return (
                                                <Link to={destinationUrl} key={item.id} className="category-item">
                                                    <div className="category-image circle"><img src={item.image} alt={item.text} draggable="false" onDragStart={e=>e.preventDefault()} /></div>
                                                    <span className="category-text">{item.text}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* PRODUCT VIEW & DOUBLE PRODUCT VIEW (Draggable) */}
                            {(mod.type === 'product_single' || mod.type === 'product_double') && mod.products?.length > 0 && (() => {
                                // 🔥 FALLBACK ROUTE: Always render button. If empty, routes to All Category for this brand.
                                const destination = mod.moreLink ? resolveLink(mod.moreLink) : `/category/all?brand=${vanityHandle}`;

                                return (
                                <div className="bubble-wrapper">
                                    <div className="bubble-container" style={{ backgroundColor: mod.bubbleColor || 'var(--ws-sand)' }}>
                                        <div className="bubble-header">
                                            <h2 className="bubble-title">{mod.heading || "TRENDING"}</h2>
                                            
                                            <Link to={destination} className="more-btn" aria-label={`View more ${mod.heading}`}>
                                                <i className="fa-solid fa-arrow-right"></i>
                                            </Link>
                                        </div>
                                        
                                        {mod.type === 'product_single' && (
                                            <div className="bubble-scroll draggable-track" {...dragEvents}>
                                                {mod.products.map((prod, pIdx) => <MiniProductCard key={pIdx} prod={prod} />)}
                                            </div>
                                        )}

                                        {mod.type === 'product_double' && (
                                            <div className="double-row-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                <div className="bubble-scroll draggable-track" {...dragEvents}>
                                                    {mod.products.filter((_, i) => i % 2 === 0).map((prod, pIdx) => <MiniProductCard key={pIdx} prod={prod} />)}
                                                </div>
                                                <div className="bubble-scroll draggable-track" {...dragEvents}>
                                                    {mod.products.filter((_, i) => i % 2 !== 0).map((prod, pIdx) => <MiniProductCard key={pIdx} prod={prod} />)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )})()}

                            {/* SMALL BANNER (Now Drag/Swipe Scrollable) */}
                            {mod.type === 'small_banner' && mod.slides?.length > 0 && (
                                <div className="public-small-banner-wrapper">
                                    <div className="public-small-banner snap-track draggable-track" id={`banner-track-${mod.id}`} {...dragEvents}>
                                        {mod.slides.map((slide, idx) => {
                                            const MediaContent = slide.isVideo ? <video src={slide.url} autoPlay loop muted playsInline draggable="false" /> : <img src={slide.url} alt="Banner" draggable="false" onDragStart={e=>e.preventDefault()} />;
                                            const finalLink = resolveLink(slide.link);

                                            return (
                                                <div key={idx} className="banner-slide snap-slide">
                                                    {slide.link ? (
                                                        finalLink.startsWith('http') ? <a href={finalLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>{MediaContent}</a>
                                                        : <Link to={finalLink} style={{ display: 'block', width: '100%', height: '100%' }}>{MediaContent}</Link>
                                                    ) : MediaContent}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}