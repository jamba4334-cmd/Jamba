import React, { useState, useEffect, useRef } from 'react';
import './LiveProductsTab.css'; 

export default function LiveProductsTab({ isActive, sellerProducts, loadingData, setActiveTab, editProduct }) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxMedia, setLightboxMedia] = useState([]);
    const mediaTrackRef = useRef(null);

    useEffect(() => {
        if (lightboxOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [lightboxOpen]);

    const openLightbox = (product) => {
        const formattedMedia = [];
        if (product.images && product.images.length > 0 && product.images[0]) formattedMedia.push({ type: 'image', url: product.images[0] });
        if (product.video_url) formattedMedia.push({ type: 'video', url: product.video_url });
        if (product.images && product.images.length > 1) {
            for (let i = 1; i < product.images.length; i++) {
                if (product.images[i]) formattedMedia.push({ type: 'image', url: product.images[i] });
            }
        }
        
        if (formattedMedia.length > 0) { setLightboxMedia(formattedMedia); setLightboxOpen(true); }
    };

    const scrollLightbox = (direction) => {
        if (mediaTrackRef.current) {
            const scrollAmount = mediaTrackRef.current.clientWidth;
            mediaTrackRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    const sortedProducts = [...(sellerProducts || [])].sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0);
        const dateB = new Date(b.created_at || b.createdAt || 0);
        return dateB - dateA; 
    });

    return (
        <div id="live-products" className={`content-section ${isActive ? 'active' : ''}`}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--input-border)', paddingBottom: '16px' }}>
                <span className="section-title" style={{ margin: 0 }}>Live Products</span>
                <button 
                    type="button" 
                    className="lp-add-btn-black" 
                    onClick={() => setActiveTab('add-product')}
                >
                    + Add Product
                </button>
            </div>

            <div>
                {loadingData ? (
                    <p style={{ padding: '20px', fontWeight: '500', color: 'var(--text-muted)' }}>Loading your inventory...</p>
                ) : sortedProducts.length === 0 ? (
                    <p style={{ padding: '20px', fontWeight: '500', color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
                        <i className="fa-solid fa-box-open" style={{fontSize: '40px', color: '#e5e7eb', display: 'block', marginBottom: '16px'}}></i>
                        You haven't submitted any products yet.
                    </p>
                ) : (
                    sortedProducts.map(product => {
                        const allImages = (product.images && product.images.length > 0) ? product.images : ["https://via.placeholder.com/150"];
                        const isHidden = product.isHidden || false;
                        const isOOS = product.isOutOfStock || false;
                        const dateStr = product.created_at ? new Date(product.created_at).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'Unknown Date';

                        let displayCategory = product.category || 'N/A';
                        if (displayCategory.includes('-')) {
                            const parts = displayCategory.split('-');
                            if (parts.length === 2) displayCategory = `${parts[1].trim()} ${parts[0].trim()}`;
                        }
                        
                        return (
                            <div key={product.id} className="product-card-container" style={{ border: product.approval_status === 'pending' ? '2px solid var(--accent)' : '1px solid #e5e7eb' }}>
                                
                                <div className="product-info-col">
                                    <div className="product-meta-text">
                                        ID: {product.item_id || product.id}
                                        {product.placement === 'hero' && <span className="hero-badge"><i className="fa-solid fa-star"></i> Hero</span>}
                                        {product.approval_status === 'pending' && <span className="hero-badge" style={{backgroundColor: 'var(--accent)'}}><i className="fa-solid fa-clock"></i> Pending</span>}
                                        {product.approval_status === 'rejected' && <span className="hero-badge" style={{backgroundColor: 'var(--danger)'}}><i className="fa-solid fa-xmark"></i> Rejected</span>}
                                        {product.approval_status === 'approved' && <span className="hero-badge" style={{backgroundColor: 'var(--success)'}}><i className="fa-solid fa-check-double"></i> APPROVED</span>}
                                        {isHidden && <span className="hero-badge" style={{backgroundColor: '#9CA3AF'}}><i className="fa-solid fa-eye-slash"></i> HIDDEN</span>}
                                        {isOOS && <span className="hero-badge" style={{backgroundColor: 'var(--danger)'}}><i className="fa-solid fa-ban"></i> Out Of Stock</span>}
                                    </div>
                                    <div className="product-upload-text">
                                        <i className="fa-regular fa-clock"></i> Uploaded: {dateStr} | Stock: <strong>{product.stock || 0}</strong>
                                    </div>
                                    <div className="product-title-text">{product.title}</div>
                                    
                                    <div className="seller-bottom-row">
                                        <div className="product-price-row">
                                            <span style={{ fontWeight: '600' }}>₹{product.selling_price}</span> &nbsp;<span style={{color:'#d1d5db'}}>|</span>&nbsp; {displayCategory}
                                        </div>
                                        <div className="product-action-row">
                                            <button type="button" className="action-btn" onClick={() => editProduct(product.id)}>
                                                <i className="fa-solid fa-pen"></i> Edit Details
                                            </button>
                                        </div>
                                    </div>

                                </div>

                                <div className="product-thumb-wrapper">
                                    <div className="product-thumb-scroll" onClick={() => openLightbox(product)}>
                                        {allImages.map((imgUrl, idx) => {
                                            let optImg = imgUrl;
                                            if (optImg.includes('res.cloudinary.com') && optImg.includes('/upload/')) {
                                                optImg = optImg.replace('/upload/', '/upload/w_400,c_fill,q_auto/');
                                            }
                                            return <img key={idx} src={optImg} loading="lazy" className="product-thumb-img" alt={`View ${idx+1}`} />;
                                        })}
                                    </div>
                                    <div className="video-badge"><i className="fa-solid fa-expand"></i></div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Lightbox Pop-Out */}
            {lightboxOpen && (
                <div className="media-lightbox-overlay" onClick={() => setLightboxOpen(false)}>
                    <button className="lightbox-close-btn" onClick={() => setLightboxOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                    {lightboxMedia.length > 1 && (
                        <>
                            <button className="lightbox-nav-btn left" onClick={(e) => { e.stopPropagation(); scrollLightbox('left'); }}><i className="fa-solid fa-chevron-left"></i></button>
                            <button className="lightbox-nav-btn right" onClick={(e) => { e.stopPropagation(); scrollLightbox('right'); }}><i className="fa-solid fa-chevron-right"></i></button>
                        </>
                    )}
                    <div className="lightbox-scroll-track" ref={mediaTrackRef} onClick={(e) => e.stopPropagation()}>
                        {lightboxMedia.map((media, idx) => (
                            <div key={idx} className="lightbox-scroll-item">
                                {media.type === 'image' ? (
                                    <img src={media.url} alt={`Media ${idx + 1}`} className="lightbox-media-content" />
                                ) : (
                                    <video src={media.url} controls autoPlay loop muted playsInline className="lightbox-media-content" />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="lightbox-indicator">Swipe to view {lightboxMedia.length}</div>
                </div>
            )}
        </div>
    );
}