import React from 'react';
import './ReviewsTab.css';

export default function ReviewsTab({ 
    isActive, 
    sellerReviews, 
    replyingTo, 
    setReplyingTo, 
    replyText, 
    setReplyText, 
    handlePostReply, 
    setFullscreenImage 
}) {
    if (!isActive) return null;

    return (
        <div id="reviews" className="content-section active">
            <span className="section-title" style={{ marginBottom: '8px' }}>Customer Feedback</span>
            <p className="text-helper" style={{ marginBottom: '24px' }}>Manage your reputation by responding to customer reviews.</p>

            {sellerReviews.length === 0 ? (
                <div className="card sr-empty">You do not have any reviews yet.</div>
            ) : (
                <div className="sr-grid">
                    {sellerReviews.map((rev) => (
                        <div key={rev.id} className="card sr-card">
                            <div className="sr-header">
                                <div>
                                    <div className="sr-rating">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <span key={i} style={{ color: i < rev.rating ? '#C5A059' : '#e5e7eb' }}>★</span>
                                        ))}
                                    </div>
                                    <div className="sr-customer">{rev.userName}</div>
                                </div>
                                <span className="sr-date">{new Date(rev.createdAt?.toDate ? rev.createdAt.toDate() : rev.createdAt).toLocaleDateString()}</span>
                            </div>

                            <div className="sr-product-name">Reviewed: <strong>{rev.productTitle || 'Your Product'}</strong></div>
                            <div className="sr-text">"{rev.reviewText}"</div>

                            {rev.images && rev.images.length > 0 && (
                                <div className="sr-images">
                                    {rev.images.map((img, i) => (
                                        <img 
                                            key={i} 
                                            src={img} 
                                            alt="Customer upload" 
                                            onClick={() => setFullscreenImage(img)}
                                        />
                                    ))}
                                </div>
                            )}

                            {rev.sellerReply ? (
                                <div className="sr-existing-reply">
                                    <strong>Your Reply:</strong>
                                    <p>{rev.sellerReply}</p>
                                </div>
                            ) : (
                                <div className="sr-reply-action">
                                    {replyingTo === rev.id ? (
                                        <div className="sr-reply-box">
                                            <textarea 
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Write a professional reply to the customer..."
                                            />
                                            <div className="sr-reply-buttons">
                                                <button type="button" className="sr-btn-cancel" onClick={() => setReplyingTo(null)}>Cancel</button>
                                                <button type="button" className="sr-btn-submit" onClick={() => handlePostReply(rev.id)}>Post Reply</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button type="button" className="sr-btn-reply" onClick={() => { setReplyingTo(rev.id); setReplyText(""); }}>
                                            <i className="fa-solid fa-reply"></i> Reply to Customer
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}