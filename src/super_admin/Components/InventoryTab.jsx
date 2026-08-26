import React, { useState, useEffect, useRef } from "react";
// FIXED PATH: Exactly 2 dots
import { API_BASE_URL } from "../../apiConfig.js"; 
import "../styles/Inventory.css";

export default function InventoryTab({ liveProducts, getAuthHeaders, refreshInventory, onEditProduct }) {
    const [mainFilter, setMainFilter] = useState('all'); 
    const [subFilter, setSubFilter] = useState('all'); 

    // --- Lightbox State ---
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxMedia, setLightboxMedia] = useState([]);
    const mediaTrackRef = useRef(null);

    // Prevent background scrolling when lightbox is open
    useEffect(() => {
        if (lightboxOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [lightboxOpen]);

    // --- Action Handlers ---
    const handleApprove = async (productId) => {
        if(window.confirm("Approve this product and make it live on the store?")) {
            try {
                const headers = await getAuthHeaders();
                await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
                    method: "PUT",
                    headers: headers,
                    body: JSON.stringify({ approval_status: 'approved', isHidden: false })
                });
                if(window.showToast) window.showToast("Product Approved & Published!");
                refreshInventory();
            } catch (e) { alert("Error approving product: " + e.message); }
        }
    };

    const handleReject = async (productId) => {
        if(window.confirm("Reject this product? The seller will be notified in their dashboard.")) {
            try {
                const headers = await getAuthHeaders();
                await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
                    method: "PUT",
                    headers: headers,
                    body: JSON.stringify({ approval_status: 'rejected', isHidden: true })
                });
                if(window.showToast) window.showToast("Product Rejected.");
                refreshInventory();
            } catch (e) { alert("Error rejecting product: " + e.message); }
        }
    };

    const toggleVisibility = async (productId, currentState) => {
        try {
            const headers = await getAuthHeaders();
            await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
                method: "PUT",
                headers: headers,
                body: JSON.stringify({ isHidden: !currentState })
            });
            refreshInventory();
        } catch (e) { alert("Error updating visibility: " + e.message); }
    };

    const toggleStock = async (productId, currentState) => {
        try {
            const headers = await getAuthHeaders();
            await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
                method: "PUT",
                headers: headers,
                body: JSON.stringify({ isOutOfStock: !currentState })
            });
            refreshInventory();
        } catch (e) { alert("Error updating stock: " + e.message); }
    };

    const handleDelete = async (productId) => {
        if(window.confirm("Are you sure you want to completely delete this product?")) {
            try {
                const headers = await getAuthHeaders();
                await fetch(`${API_BASE_URL}/admin/products/${productId}`, { method: "DELETE", headers: headers });
                if(window.showToast) window.showToast("Product Deleted.");
                refreshInventory();
            } catch (e) { alert("Error deleting product: " + e.message); }
        }
    };

    // --- Lightbox Trigger (Works on ALL devices) ---
    const openLightbox = (product) => {
        const formattedMedia = [];
        if (product.images && product.images.length > 0 && product.images[0]) formattedMedia.push({ type: 'image', url: product.images[0] });
        if (product.video_url) formattedMedia.push({ type: 'video', url: product.video_url });
        if (product.images && product.images.length > 1) {
            for (let i = 1; i < product.images.length; i++) {
                if (product.images[i]) formattedMedia.push({ type: 'image', url: product.images[i] });
            }
        }
        if (formattedMedia.length > 0) {
            setLightboxMedia(formattedMedia);
            setLightboxOpen(true);
        }
    };

    const scrollLightbox = (direction) => {
        if (mediaTrackRef.current) {
            const scrollAmount = mediaTrackRef.current.clientWidth;
            mediaTrackRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
        }
    };

    // --- Filtration Logic ---
    let filteredProducts = liveProducts || [];

    if (mainFilter === 'pending') {
        filteredProducts = filteredProducts.filter(p => p.approval_status === 'pending');
    } else if (mainFilter === 'hero') {
        filteredProducts = filteredProducts.filter(p => p.placement === 'hero');
    } else if (mainFilter === 'regular') {
        filteredProducts = filteredProducts.filter(p => (p.placement || 'regular') === 'regular');
        if (subFilter !== 'all') {
            filteredProducts = filteredProducts.filter(p => p.category && p.category.toLowerCase().includes(subFilter.toLowerCase()));
        }
    }

    return (
        <div className="content-section active inventory-section">
            <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--input-border)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <span className="section-title" style={{ margin: 0 }}>Current Inventory</span>
                    <div className="filter-group">
                        <button type="button" className={`filter-btn ${mainFilter === 'all' ? 'active' : ''}`} onClick={() => { setMainFilter('all'); setSubFilter('all'); }}>All</button>
                        <button type="button" className={`filter-btn ${mainFilter === 'pending' ? 'active' : ''}`} onClick={() => { setMainFilter('pending'); setSubFilter('all'); }} style={mainFilter !== 'pending' ? {color: 'var(--accent)'} : {}}>⚠️ Needs Approval</button>
                        <button type="button" className={`filter-btn ${mainFilter === 'hero' ? 'active' : ''}`} onClick={() => { setMainFilter('hero'); setSubFilter('all'); }}>Homepage Hero</button>
                        <button type="button" className={`filter-btn ${mainFilter === 'regular' ? 'active' : ''}`} onClick={() => setMainFilter('regular')}>Regular Collection</button>
                    </div>
                </div>

                {mainFilter === 'regular' && (
                    <div className="inventory-sub-filters">
                        <span className="label">Filter Regular:</span>
                        <button type="button" className={`filter-btn ${subFilter === 'all' ? 'active' : ''}`} style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => setSubFilter('all')}>All Categories</button>
                        <button type="button" className={`filter-btn ${subFilter === 'Men' ? 'active' : ''}`} style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => setSubFilter('Men')}>Men Only</button>
                        <button type="button" className={`filter-btn ${subFilter === 'Women' ? 'active' : ''}`} style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => setSubFilter('Women')}>Women Only</button>
                        <button type="button" className={`filter-btn ${subFilter === 'Accessories' ? 'active' : ''}`} style={{ fontSize: '12px', padding: '4px 12px' }} onClick={() => setSubFilter('Accessories')}>Accessories Only</button>
                    </div>
                )}
            </div>

            <div>
                {filteredProducts.length === 0 ? (
                    <p style={{ padding: '20px', fontWeight: '500', color: 'var(--text-muted)' }}>No matching products found.</p>
                ) : (
                    filteredProducts.map(product => {
                        let mainImgUrl = (product.images && product.images.length > 0) ? product.images[0] : "https://via.placeholder.com/150";
                        if (mainImgUrl.includes('res.cloudinary.com') && mainImgUrl.includes('/upload/')) {
                            mainImgUrl = mainImgUrl.replace('/upload/', '/upload/w_150,c_fill,q_auto/');
                        }

                        const isHidden = product.isHidden || false;
                        const isOOS = product.isOutOfStock || false;
                        const dateStr = product.created_at ? new Date(product.created_at).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'Unknown Date';

                        let displayCategory = product.category || 'N/A';
                        if (displayCategory.includes('-')) {
                            const parts = displayCategory.split('-');
                            if (parts.length === 2) displayCategory = `${parts[0].trim()} ${parts[1].trim()}`;
                        }

                        return (
                            <div key={product.docId} className="product-card-container" style={{ border: product.approval_status === 'pending' ? '2px solid var(--accent)' : '1px solid #e5e7eb' }}>
                                <div className="product-info-col">
                                    <div className="product-meta-text">
                                        ID: {product.item_id || product.docId}
                                        {product.placement === 'hero' && <span className="hero-badge"><i className="fa-solid fa-star"></i> Hero</span>}
                                        {product.approval_status === 'pending' && <span className="hero-badge" style={{backgroundColor: 'var(--accent)'}}><i className="fa-solid fa-clock"></i> Pending Approval</span>}
                                        {product.approval_status === 'rejected' && <span className="hero-badge" style={{backgroundColor: 'var(--danger)'}}><i className="fa-solid fa-xmark"></i> Rejected</span>}
                                        {product.approval_status === 'approved' && <span className="hero-badge" style={{backgroundColor: 'var(--success)'}}><i className="fa-solid fa-check-double"></i> Approved</span>}
                                        {isHidden && <span className="hero-badge" style={{backgroundColor: '#9CA3AF'}}><i className="fa-solid fa-eye-slash"></i> Hidden</span>}
                                        {isOOS && <span className="hero-badge" style={{backgroundColor: 'var(--danger)'}}><i className="fa-solid fa-ban"></i> Out Of Stock</span>}
                                    </div>
                                    <div className="product-upload-text">
                                        <i className="fa-regular fa-clock"></i> Uploaded: {dateStr} | By: {product.sellerEmail || 'Admin'}
                                    </div>
                                    <div className="product-title-text">{product.title}</div>
                                    <div className="product-price-row">
                                        <span style={{ fontWeight: '600' }}>₹{product.selling_price}</span> &nbsp;<span style={{color:'#d1d5db'}}>|</span>&nbsp; {displayCategory}
                                    </div>
                                    
                                    <div className="product-action-row">
                                        {product.approval_status === 'pending' ? (
                                            <>
                                                <button type="button" className="action-btn" style={{background: 'var(--success)', color: 'white'}} onClick={() => handleApprove(product.docId)}><i className="fa-solid fa-check"></i> Approve & Publish</button>
                                                <button type="button" className="action-btn" style={{background: 'var(--danger)', color: 'white'}} onClick={() => handleReject(product.docId)}><i className="fa-solid fa-xmark"></i> Reject</button>
                                                <div style={{ flexGrow: 1 }}></div>
                                                <button type="button" className="action-btn" onClick={() => onEditProduct(product)}><i className="fa-solid fa-pen"></i> Review Details</button>
                                            </>
                                        ) : (
                                            <>
                                                <button type="button" className="action-btn" onClick={() => onEditProduct(product)}><i className="fa-solid fa-pen"></i> Edit Details</button>
                                                <div style={{ width: '1px', height: '16px', background: '#e5e7eb', margin: '0 4px' }}></div>
                                                <button type="button" className={`action-btn ${isHidden ? 'btn-status-hidden' : 'btn-status-active'}`} onClick={() => toggleVisibility(product.docId, isHidden)}>
                                                    {isHidden ? <><i className="fa-solid fa-eye-slash"></i> Hidden</> : <><i className="fa-solid fa-eye"></i> Visible</>}
                                                </button>
                                                <button type="button" className={`action-btn ${isOOS ? 'btn-status-inactive' : 'btn-status-active'}`} onClick={() => toggleStock(product.docId, isOOS)}>
                                                    {isOOS ? <><i className="fa-solid fa-ban"></i> Out of Stock</> : <><i className="fa-solid fa-box"></i> In Stock</>}
                                                </button>
                                                <div style={{ flexGrow: 1 }}></div>
                                                <button type="button" className="action-btn" style={{color: 'var(--danger)', borderColor: 'var(--danger-light)'}} onClick={() => handleDelete(product.docId)}><i className="fa-solid fa-trash"></i></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                {/* 🔥 Clickable Image Wrapper for Lightbox */}
                                <div className="product-thumb-wrapper" onClick={() => openLightbox(product)}>
                                    <img src={mainImgUrl} loading="lazy" className="product-thumb-img" alt="Product" />
                                    <div className="product-thumb-overlay"><i className="fa-solid fa-expand"></i></div>
                                    {product.video_url && <div className="video-badge"><i className="fa-solid fa-video"></i></div>}
                                </div>

                            </div>
                        );
                    })
                )}
            </div>

            {/* 🔥 Full Screen Swipeable Media Lightbox */}
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
                    
                    <div className="lightbox-indicator">
                        Swipe to view {lightboxMedia.length} {lightboxMedia.length > 1 ? 'items' : 'item'}
                    </div>
                </div>
            )}
        </div>
    );
}