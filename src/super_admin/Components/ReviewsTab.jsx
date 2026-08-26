import React, { useState, useEffect } from "react";
import { collection, query, getDocs, deleteDoc, doc } from "firebase/firestore";
import "../styles/Reviews.css";

export default function ReviewsTab({ db, liveProducts }) {
    const [allReviews, setAllReviews] = useState([]);
    const [reviewFilter, setReviewFilter] = useState('all');
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // --- Lifecycle: Load Reviews ---
    useEffect(() => {
        loadAdminReviews();
    }, []);

    const loadAdminReviews = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, "reviews"));
            const querySnapshot = await getDocs(q);
            let loadedReviews = [];
            
            querySnapshot.forEach((docSnap) => {
                loadedReviews.push({ id: docSnap.id, ...docSnap.data() });
            });
            
            // Sort by newest first
            loadedReviews.sort((a, b) => {
                const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return dateB - dateA;
            });
            
            setAllReviews(loadedReviews);
        } catch (error) {
            console.error("Error loading reviews:", error);
            if(window.showToast) window.showToast("Error loading reviews");
        } finally {
            setIsLoading(false);
        }
    };

    // --- Action Handlers ---
    const handleDeleteReview = async (reviewId) => {
        if(window.confirm("Are you sure you want to delete this review? This cannot be undone.")) {
            try {
                await deleteDoc(doc(db, "reviews", reviewId));
                if(window.showToast) window.showToast("Review deleted successfully.");
                
                // Remove from local state instantly without refetching
                setAllReviews(prev => prev.filter(rev => rev.id !== reviewId));
            } catch(e) {
                alert("Error deleting review: " + e.message);
            }
        }
    };

    // --- Filtration Logic ---
    const filteredReviews = allReviews.filter(rev => {
        if (reviewFilter === 'positive') return rev.rating >= 4;
        if (reviewFilter === 'negative') return rev.rating < 4;
        return true;
    });

    return (
        <div className="content-section active reviews-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <span className="section-title" style={{ margin: 0 }}>Reputation Management</span>
                <div className="filter-group">
                    <button type="button" className={`filter-btn ${reviewFilter === 'all' ? 'active' : ''}`} onClick={() => setReviewFilter('all')}>All Reviews</button>
                    <button type="button" className={`filter-btn ${reviewFilter === 'positive' ? 'active' : ''}`} onClick={() => setReviewFilter('positive')}>Positive (4-5 ★)</button>
                    <button type="button" className={`filter-btn ${reviewFilter === 'negative' ? 'active' : ''}`} onClick={() => setReviewFilter('negative')} style={reviewFilter === 'negative' ? {color:'var(--danger)', borderColor:'var(--danger)'} : {}}>Critical (1-3 ★)</button>
                </div>
            </div>

            <div className="admin-reviews-grid">
                {isLoading ? (
                    <p style={{ color: 'var(--text-muted)' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading reviews...</p>
                ) : filteredReviews.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No reviews found for this filter.</p>
                ) : (
                    filteredReviews.map((rev) => {
                        // Match review to product to get title and thumbnail
                        const relatedProduct = (liveProducts || []).find(p => p.id === rev.productId || p.item_id === rev.productId || p.docId === rev.productId);
                        const productImg = relatedProduct?.images?.[0] || 'https://via.placeholder.com/80';
                        const productTitle = relatedProduct?.title || 'Unknown Product';
                        
                        // Handle Firestore Timestamps vs standard dates
                        const displayDate = rev.createdAt?.toDate ? rev.createdAt.toDate().toLocaleDateString() : new Date(rev.createdAt).toLocaleDateString();

                        return (
                            <div key={rev.id} className="review-admin-card">
                                <div className="review-admin-header">
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <img src={productImg} alt="product" className="review-product-thumb" />
                                        <div>
                                            <div className="r-prod-title">{productTitle}</div>
                                            <div className="r-user-info">{rev.userName || 'Anonymous'} • {displayDate}</div>
                                        </div>
                                    </div>
                                    <div className={`rev-star-badge rating-${rev.rating}`}>
                                        {rev.rating} ★
                                    </div>
                                </div>

                                <div className="review-admin-body">
                                    "{rev.reviewText || 'No text provided.'}"
                                </div>

                                {/* Clickable Images */}
                                {rev.images && rev.images.length > 0 && (
                                    <div className="review-admin-images">
                                        {rev.images.map((img, i) => (
                                            <img 
                                                key={i} 
                                                src={img} 
                                                alt="customer upload" 
                                                onClick={() => setFullscreenImage(img)}
                                                title="Click to expand"
                                            />
                                        ))}
                                    </div>
                                )}

                                <div className="review-admin-footer">
                                    <button className="action-btn" style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }} onClick={() => handleDeleteReview(rev.id)}>
                                        <i className="fa-solid fa-trash"></i> Delete Review
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* --- FULLSCREEN IMAGE LIGHTBOX OVERLAY --- */}
            {fullscreenImage && (
                <div className="image-lightbox-overlay" onClick={() => setFullscreenImage(null)}>
                    <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <button className="image-lightbox-close" onClick={() => setFullscreenImage(null)}>✕</button>
                        <img src={fullscreenImage} alt="Fullscreen Review" />
                    </div>
                </div>
            )}
        </div>
    );
}