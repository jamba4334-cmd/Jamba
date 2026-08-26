import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { auth, db } from '../firebase'; 
import './Orders.css';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  
  const [expandedOrders, setExpandedOrders] = useState({});
  const navigate = useNavigate();

  // --- REVIEW SYSTEM STATES ---
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [productToReview, setProductToReview] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userReviews, setUserReviews] = useState({}); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUserOrders(user);
        fetchUserReviews(user.uid); 
      } else {
        navigate('/login?redirect=orders');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchUserReviews = async (uid) => {
    try {
      const q = query(collection(db, "reviews"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const reviewsMap = {};
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Map by Order ID AND Product ID to prevent cross-order duplication
        if (data.orderId) {
            reviewsMap[`${data.orderId}_${data.productId}`] = data; 
        } else {
            // Fallback for older reviews that didn't have an orderId attached
            reviewsMap[data.productId] = data;
        }
      });
      setUserReviews(reviewsMap);
    } catch (err) {
      console.error("Error fetching user reviews:", err);
    }
  };

  const fetchUserOrders = async (user) => {
    try {
      const ordersRef = collection(db, "orders");
      let queryPromises = [];

      if (user.email) {
        queryPromises.push(getDocs(query(ordersRef, where("email", "==", user.email))));
        queryPromises.push(getDocs(query(ordersRef, where("customerContact", "==", user.email))));
      }
      if (user.uid) {
        queryPromises.push(getDocs(query(ordersRef, where("userId", "==", user.uid))));
      }

      const snapshots = await Promise.all(queryPromises);
      let ordersMap = new Map();
      
      snapshots.forEach(snapshot => {
        snapshot.forEach((doc) => {
          let data = doc.data();
          data.id = doc.id;
          ordersMap.set(doc.id, data);
        });
      });

      let ordersArray = Array.from(ordersMap.values());

      if (ordersArray.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      ordersArray.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at) : (a.createdAt ? a.createdAt.toDate() : new Date(0));
        const dateB = b.created_at ? new Date(b.created_at) : (b.createdAt ? b.createdAt.toDate() : new Date(0));
        return dateB.getTime() - dateA.getTime();
      });

      setOrders(ordersArray);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError(true);
      setLoading(false);
    }
  };

  const getOrderStatus = (order) => {
    const dbStatus = order.status ? order.status.toLowerCase() : 'pending';
    const orderTime = order.created_at ? new Date(order.created_at) : (order.createdAt ? order.createdAt.toDate() : new Date());
    const now = new Date();
    const timeDiff = now.getTime() - orderTime.getTime();
    const hoursElapsed = timeDiff / (1000 * 60 * 60);
    const daysElapsed = timeDiff / (1000 * 60 * 60 * 24);

    let status = "processing";
    let badgeText = "PROCESSING";
    let deliveryText = "Estimated Delivery: 12 - 15 Days";
    let boxStyle = { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' };
    let icon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
    );

    if (dbStatus === 'delivered') {
      status = "delivered";
      badgeText = "DELIVERED";
      deliveryText = "Delivered Successfully";
      boxStyle = { background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' };
      icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
    } else if (dbStatus === 'out_for_delivery') {
      status = "out_for_delivery";
      badgeText = "OUT FOR DELIVERY";
      deliveryText = "Out for Delivery Today!";
      boxStyle = { background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }; 
      icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"></path><path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2"></path><circle cx="7" cy="18" r="2"></circle><path d="M15 18H9"></path><circle cx="17" cy="18" r="2"></circle></svg>;
    } else if (dbStatus === 'shipped') {
      status = "shipped";
      badgeText = "SHIPPED";
      deliveryText = "Shipped & On its way";
      boxStyle = { background: '#fefce8', color: '#854d0e', borderColor: '#fef08a' };
      icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>;
    } else if (dbStatus === 'cancelled') {
      status = "cancelled";
      badgeText = "CANCELLED";
      deliveryText = "Order Cancelled";
      boxStyle = { background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca' };
      icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>;
    } else {
      if (daysElapsed >= 15) {
        status = "delivered";
        badgeText = "DELIVERED";
        deliveryText = "Delivered Successfully";
        boxStyle = { background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' };
        icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
      } else if (hoursElapsed >= 24 || order.trackingId) {
        status = "shipped";
        badgeText = "SHIPPED";
        deliveryText = "Shipped & On its way";
        boxStyle = { background: '#fefce8', color: '#854d0e', borderColor: '#fef08a' };
        icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>;
      }
    }

    return { status, badgeText, deliveryText, boxStyle, icon };
  };

  const handleCopyTracking = (trackingId) => {
    navigator.clipboard.writeText(trackingId);
    setToastMsg('Tracking ID Copied to Clipboard!');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const toggleOrderDetails = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    if (uploadedImages.length + files.length > 5) {
      alert("You can only upload a maximum of 5 images.");
      return;
    }

    setIsUploading(true);

    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      // SECURED: Cloudinary variables loaded from .env
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET); 

      try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        return data.secure_url;
      } catch (error) {
        console.error("Upload failed:", error);
        return null;
      }
    });

    const urls = await Promise.all(uploadPromises);
    const validUrls = urls.filter(url => url !== null);
    
    setUploadedImages(prev => [...prev, ...validUrls]);
    setIsUploading(false);
  };

  const submitReview = async () => {
    if (rating === 0) {
      alert("Please select a star rating!");
      return;
    }

    setIsSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      
      const reviewData = {
        productId: productToReview.id,
        orderId: productToReview.orderId, 
        sellerEmail: productToReview.sellerEmail || "", // 🔥 Correctly attached to Seller
        brandName: productToReview.brandName || "JAMBAWEAR", // 🔥 Saving Brand context
        sellerId: productToReview.sellerId || "JAMBA_DIRECT", 
        userId: currentUser.uid,
        userName: currentUser.displayName || "Jamba Customer",
        rating: rating,
        reviewText: reviewText,
        images: uploadedImages,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "reviews"), reviewData);
      
      setUserReviews(prev => ({
        ...prev,
        [`${productToReview.orderId}_${productToReview.id}`]: reviewData 
      }));

      setToastMsg('Review submitted successfully! Thank you.');
      closeReviewModal();
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeReviewModal = () => {
    setIsReviewModalOpen(false);
    setProductToReview(null);
    setRating(5);
    setReviewText('');
    setUploadedImages([]);
  };

  const removeImage = (indexToRemove) => {
    setUploadedImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  return (
    <main className="orders-container">
      <div className="orders-header-wrapper">
        <h1 className="page-title">Order History</h1>
      </div>

      {toastMsg && <div className="customer-toast">{toastMsg}</div>}
      {loading && <div className="loading-msg">Fetching your secure orders...</div>}
      {error && <div className="loading-msg">Error loading orders. Please try again later.</div>}

      {!loading && !error && orders.length === 0 && (
        <div className="empty-msg">
          <p>Your bag has been empty. Let's change that.</p>
          <Link to="/" className="shop-now-btn">Start Shopping</Link>
        </div>
      )}

      {!loading && orders.map((order) => {
        const dateObj = order.created_at ? new Date(order.created_at) : (order.createdAt ? order.createdAt.toDate() : new Date());
        const orderDate = dateObj.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        
        const { status, badgeText, deliveryText, boxStyle, icon } = getOrderStatus(order);

        const address = order.shippingAddress || order.shipping_address;
        const hasTracking = order.trackingId && order.courierName;
        const isExpanded = expandedOrders[order.id];

        const subtotal = order.items ? order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0;
        const finalTotal = order.total || order.totalAmount || order.amount || subtotal;
        const deliveryFee = finalTotal > subtotal ? finalTotal - subtotal : 0;

        const pMethod = order.payment_method || order.paymentMethod || 'Online';
        const isCOD = pMethod.toUpperCase() === 'COD';

        return (
          <div key={order.id} className="minimal-order-card">
            
            <div className="minimal-order-header">
              <div className="header-left">
                <span className="order-date">{orderDate}</span>
                <span className="order-id">#{order.jamba_order_id || order.id.substring(0, 8).toUpperCase()}</span>
              </div>
              <div className="header-badges">
                {isCOD ? (
                   <span className="minimal-payment-badge cod-badge">COD</span>
                ) : (
                   <span className="minimal-payment-badge prepaid-badge">PREPAID</span>
                )}
                <span className={`minimal-status ${status}`}>{badgeText}</span>
              </div>
            </div>

            <div className="minimal-items-tracking-container">
              <div className="minimal-order-items">
                {order.items && order.items.map((item, index) => {
                  return (
                    <div key={index} className="minimal-item-row">
                      <img src={item.image || "https://raw.githubusercontent.com/jamba4334-cmd/JAMBA/main/assets/JAMBA.png"} className="minimal-item-img" alt={item.title} />
                      
                      <div className="minimal-item-info">
                        <p className="minimal-item-title">{item.title}</p>
                        <p className="minimal-item-meta">Size: {item.size || 'Standard'} &nbsp;•&nbsp; Qty: {item.quantity}</p>
                        
                        {(item.brandName || item.sellerName) && (
                          <p className="minimal-item-seller">
                            {item.brandName && <span><strong>Brand:</strong> {item.brandName}</span>}
                            {item.brandName && item.sellerName && <span className="separator">|</span>}
                            {item.sellerName && <span><strong>Seller:</strong> {item.sellerName}</span>}
                          </p>
                        )}
                      </div>
                      
                      <div className="minimal-item-price">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="minimal-logistics-col">
                {hasTracking && (
                  <div className="minimal-tracking-box">
                    <div className="tracking-info">
                      <span className="tracking-courier">Shipped via {order.courierName}</span>
                      <span className="tracking-number">{order.trackingId}</span>
                    </div>
                    <button className="minimal-copy-btn" onClick={() => handleCopyTracking(order.trackingId)}>
                      Copy
                    </button>
                  </div>
                )}
                <div className="minimal-delivery-status" style={boxStyle}>
                  {icon} <span>{deliveryText}</span>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="expanded-details-wrapper fade-in">
                <div className="minimal-bottom-section">
                  <div className="minimal-address-col">
                    <p className="minimal-label">Delivery Address</p>
                    {address ? (
                      <p className="minimal-text">
                        <strong style={{ color: '#111827' }}>{address.name || address.fullName}</strong><br />
                        {address.address1 || address.address || address.street}<br />
                        {address.district || address.city}, {address.state} - {address.pincode || address.zip}
                        {address.phone && <span><br />📞 {address.phone}</span>}
                      </p>
                    ) : (
                      <p className="minimal-text">No address provided</p>
                    )}
                  </div>

                  <div className="minimal-price-breakdown-col">
                    <div className="breakdown-row">
                      <span>Subtotal</span>
                      <span>₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Delivery Charge</span>
                      <span style={{ color: deliveryFee === 0 ? '#166534' : 'inherit', fontWeight: deliveryFee === 0 ? '600' : 'normal' }}>
                        {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="minimal-total-row">
              <span>Total Paid</span>
              <span className="total-amount">₹{finalTotal.toLocaleString('en-IN')}</span>
            </div>

            {/* --- REVIEWS AT THE VERY BOTTOM (ONLY VISIBLE IF EXPANDED) --- */}
            {isExpanded && status === 'delivered' && (
              <div className="expanded-reviews-container fade-in" style={{ marginTop: '24px' }}>
                {order.items.map((item, index) => {
                  const myReview = userReviews[`${order.id}_${item.id}`] || (!userReviews[`${order.id}_${item.id}`] && userReviews[item.id] ? userReviews[item.id] : null);
                  
                  return (
                    <div key={`review-${index}`} style={{ marginBottom: index !== order.items.length - 1 ? '16px' : '0' }}>
                      {!myReview || (myReview && myReview.orderId && myReview.orderId !== order.id) ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <button 
                            className="write-review-trigger-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductToReview({ ...item, orderId: order.id });
                              setIsReviewModalOpen(true);
                            }}
                            style={{ 
                              padding: '10px 16px', 
                              fontSize: '12px', 
                              fontWeight: 'bold', 
                              background: '#111827', 
                              color: '#fff', 
                              border: 'none', 
                              borderRadius: '6px', 
                              cursor: 'pointer', 
                              textTransform: 'uppercase', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px' 
                            }}
                          >
                            <span style={{ fontSize: '14px', color: '#fbbf24' }}>★</span> 
                            {order.items.length > 1 ? `Write Review for ${item.title}` : 'Write a Review'}
                          </button>
                        </div>
                      ) : (
                        <div className="customer-past-review" style={{ margin: 0, width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>
                          
                          {/* Optional context if multiple items in order */}
                          {order.items.length > 1 && (
                            <p style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>
                              Review for {item.title}
                            </p>
                          )}
                          
                          <div className="past-review-stars">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} style={{ color: star <= myReview.rating ? '#fbbf24' : '#d1d5db', fontSize: '16px' }}>★</span>
                            ))}
                            <span className="past-review-badge">✓ Submitted</span>
                          </div>
                          
                          {myReview.reviewText && (
                            <p className="past-review-text">"{myReview.reviewText}"</p>
                          )}
                          
                          {myReview.images && myReview.images.length > 0 && (
                            <div className="past-review-images">
                              {myReview.images.map((img, i) => (
                                <img key={i} src={img} alt="Uploaded review photo" />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="expand-trigger-btn" onClick={() => toggleOrderDetails(order.id)}>
              {isExpanded ? (
                <>Hide Details <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></>
              ) : (
                <>View Order Details <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></>
              )}
            </div>

          </div>
        );
      })}

      {/* --- REVIEW MODAL OVERLAY --- */}
      {isReviewModalOpen && productToReview && (
        <div className="review-modal-overlay" onClick={closeReviewModal}>
          <div className="review-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="review-close-btn" onClick={closeReviewModal}>✕</button>
            
            <h2>Write a Review</h2>
            <div className="review-product-preview">
              <img src={productToReview.image} alt={productToReview.title} />
              <div>
                <p className="review-modal-title">{productToReview.title}</p>
                <p className="review-modal-meta">Rate and review your purchase</p>
              </div>
            </div>

            <div className="review-star-rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <span 
                  key={star} 
                  className={`star ${star <= rating ? 'active' : ''}`}
                  onClick={() => setRating(star)}
                >
                  ★
                </span>
              ))}
            </div>

            <textarea 
              className="review-textarea"
              placeholder="What did you like or dislike? How did it fit?"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows="4"
            />

            <div className="review-image-upload-section">
              <p>Add Photos (Max 5)</p>
              
              <div className="uploaded-images-preview">
                {uploadedImages.map((url, index) => (
                  <div key={index} className="uploaded-thumb-box">
                    <img src={url} alt={`Upload ${index}`} />
                    <button className="remove-img-btn" onClick={() => removeImage(index)}>✕</button>
                  </div>
                ))}
                
                {uploadedImages.length < 5 && (
                  <label className="upload-placeholder-box">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      disabled={isUploading}
                    />
                    {isUploading ? <span className="loader"></span> : <span>+ Add</span>}
                  </label>
                )}
              </div>
            </div>

            <button 
              className="review-submit-btn" 
              onClick={submitReview}
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      )}

    </main>
  );
}