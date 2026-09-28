import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './BrandStorefront.css';

export default function BrandStorefront() {
    const { vanityHandle } = useParams();
    const [storefront, setStorefront] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeBannerSlides, setActiveBannerSlides] = useState({});

    useEffect(() => {
        const fetchStorefront = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, "seller_profiles"), where("storefront.vanityHandle", "==", vanityHandle.toLowerCase()));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) {
                    setError("Brand storefront not found.");
                } else {
                    setStorefront(querySnapshot.docs[0].data().storefront);
                }
            } catch (err) {
                setError("Failed to load storefront.");
            } finally {
                setIsLoading(false);
            }
        };
        if (vanityHandle) fetchStorefront();
    }, [vanityHandle]);

    useEffect(() => {
        if (!storefront || !storefront.modules) return;
        const intervals = [];
        storefront.modules.forEach(mod => {
            if (mod.type === 'main_banner' && mod.slides?.length > 1) {
                const scrollTimeMs = (mod.scrollTime || 10) * 1000;
                const id = setInterval(() => {
                    setActiveBannerSlides(prev => {
                        const current = prev[mod.id] || 0;
                        return { ...prev, [mod.id]: (current + 1) % mod.slides.length };
                    });
                }, scrollTimeMs);
                intervals.push(id);
            }
        });
        return () => intervals.forEach(id => clearInterval(id));
    }, [storefront]);

    if (isLoading) return <div className="storefront-loading"><i className="fa-solid fa-spinner fa-spin"></i> Loading...</div>;
    if (error || !storefront) return <div className="storefront-error"><h2>{error || "Store Not Found"}</h2><Link to="/" className="storefront-back-btn">Return to Marketplace</Link></div>;

    let isFirstCategory = true;
    let isFirstTrending = true;

    return (
        <div className="public-storefront-wrapper">
            
            <div className="storefront-brand-header">
                <h1 className="brand-header-name">{storefront.brandName || "JAMBA"}</h1>
                <span className="brand-header-badge">OFFICIAL STORE</span>
            </div>

            <div className="storefront-modules-container">
                {storefront.modules?.map((mod) => (
                    <div key={mod.id} className="storefront-module">
                        
                        {/* --- MAIN BANNER (NOW CLICKABLE) --- */}
                        {mod.type === 'main_banner' && mod.slides?.length > 0 && (
                            <div className="public-main-banner">
                                {mod.slides.map((slide, idx) => {
                                    const isActive = (activeBannerSlides[mod.id] || 0) === idx;
                                    
                                    // Helper to render the media
                                    const MediaContent = slide.isVideo ? (
                                        <video src={slide.url} autoPlay loop muted playsInline />
                                    ) : (
                                        <img src={slide.url} alt="Brand Banner" />
                                    );

                                    return (
                                        <div key={idx} className={`banner-slide ${isActive ? 'active' : ''}`}>
                                            {slide.link ? (
                                                slide.link.startsWith('http') ? (
                                                    <a href={slide.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                                                        {MediaContent}
                                                    </a>
                                                ) : (
                                                    <Link to={slide.link} style={{ display: 'block', width: '100%', height: '100%' }}>
                                                        {MediaContent}
                                                    </Link>
                                                )
                                            ) : (
                                                MediaContent
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* --- CATEGORY ROW --- */}
                        {mod.type === 'category_row' && mod.items?.length > 0 && (
                            <div className="public-category-row">
                                {isFirstCategory && <h2 className="section-main-title">CATEGORIES</h2>}
                                {(() => { isFirstCategory = false; return null; })()}
                                
                                {mod.heading && (
                                    <div className="category-divider">
                                        <span className="category-pill">{mod.heading}</span>
                                    </div>
                                )}
                                
                                <div className="category-scroll-area">
                                    {mod.items.map(item => {
                                        const masterCat = (mod.heading && mod.heading !== 'CUSTOM') 
                                            ? mod.heading.toLowerCase().replace(/\s+/g, '-') 
                                            : 'all';
                                        const subCat = item.text.toLowerCase().replace(/\s+/g, '-');
                                        const destinationUrl = `/category/${masterCat}/${subCat}?brand=${vanityHandle}`;

                                        return (
                                            <Link to={destinationUrl} key={item.id} className="category-item">
                                                <div className="category-image circle">
                                                    <img src={item.image} alt={item.text} />
                                                </div>
                                                <span className="category-text">{item.text}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* --- PRODUCT VIEW (ALREADY ROUTING TO PRODUCT PAGE) --- */}
                        {(mod.type === 'product_single' || mod.type === 'product_double') && mod.products?.length > 0 && (
                            <div className="public-product-view">
                                {isFirstTrending && <h2 className="section-main-title">{mod.heading || "TRENDING"}</h2>}
                                {(() => { isFirstTrending = false; return null; })()}

                                <div className={`product-view-grid ${mod.type === 'product_double' ? 'double' : 'single'}`}>
                                    {mod.products.map((prod, pIdx) => (
                                        <Link to={`/product/${prod.id}`} key={pIdx} className="storefront-product-card">
                                            <div className="product-card-image">
                                                <img src={prod.image} alt={prod.name} />
                                            </div>
                                            <div className="product-card-details">
                                                <h4 className="product-name">{prod.name}</h4>
                                                <div className="product-price-pill">₹{Number(prod.price).toLocaleString()}</div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* --- SMALL BANNER (NOW CLICKABLE) --- */}
                        {mod.type === 'small_banner' && mod.imageUrl && (
                            <div className="public-small-banner">
                                {mod.link ? (
                                    mod.link.startsWith('http') ? (
                                        <a href={mod.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                            <img src={mod.imageUrl} alt="Promotional Banner" />
                                        </a>
                                    ) : (
                                        <Link to={mod.link} style={{ display: 'block' }}>
                                            <img src={mod.imageUrl} alt="Promotional Banner" />
                                        </Link>
                                    )
                                ) : (
                                    <img src={mod.imageUrl} alt="Promotional Banner" />
                                )}
                            </div>
                        )}

                    </div>
                ))}
            </div>
            
        </div>
    );
}