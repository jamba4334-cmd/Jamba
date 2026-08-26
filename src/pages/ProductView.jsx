import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase'; 
import './ProductView.css';

export default function ProductView() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [mediaList, setMediaList] = useState([]);
  const [activeMedia, setActiveMedia] = useState(null);
  
  const [selectedSize, setSelectedSize] = useState(null);
  const [sizeError, setSizeError] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const sizeRef = useRef(null); 

  const [addedToCart, setAddedToCart] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [sentiment, setSentiment] = useState("");

  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [selectedReviewImg, setSelectedReviewImg] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    async function fetchProduct() {
      setLoading(true);
      try {
        const q = query(collection(db, "products"), where("item_id", "==", id));
        const querySnapshot = await getDocs(q);

        let productData = null;

        if (!querySnapshot.empty) {
          productData = querySnapshot.docs[0].data();
          productData.id = productData.item_id || querySnapshot.docs[0].id;
        } else {
          const docRef = doc(db, "products", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            productData = docSnap.data();
            productData.id = docSnap.id;
          }
        }

        if (productData) {
          setProduct(productData);
          
          let compiledMedia = [];
          if (productData.images && productData.images.length > 0) {
            compiledMedia.push({ type: 'image', url: productData.images[0] }); 
          } else {
             compiledMedia.push({ type: 'image', url: "https://via.placeholder.com/400x500" }); 
          }
          
          if (productData.video_url) {
            compiledMedia.push({ type: 'video', url: productData.video_url }); 
          }
          
          if (productData.images && productData.images.length > 1) {
            productData.images.slice(1).forEach(img => compiledMedia.push({ type: 'image', url: img }));
          }
          
          setMediaList(compiledMedia);
          if (compiledMedia.length > 0) setActiveMedia(compiledMedia[0]);
              
          if (productData.sizing_type === 'free_size' || productData.requires_size === false || (productData.category && productData.category.toLowerCase().includes('accessories'))) {
            setSelectedSize("Free Size");
          } else {
            setSelectedSize(null);
          }

          fetchProductReviews(productData.id);
          fetchRecommendations(productData.category, productData.id);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);
 
  const fetchRecommendations = async (category, currentId) => {
    if (!category) return;
    try {
      const q = query(collection(db, "products"), where("category", "==", category));
      const querySnapshot = await getDocs(q);
      
      let recs = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        data.id = data.item_id || doc.id;
        if (data.id !== currentId && !data.isHidden) recs.push(data);
      });
      setRecommendedProducts(recs.sort(() => 0.5 - Math.random()).slice(0, 6));
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    }
  };

  const fetchProductReviews = async (productId) => {
    try {
      const q = query(collection(db, "reviews"), where("productId", "==", productId));
      const querySnapshot = await getDocs(q);
      
      let fetchedReviews = [];
      let sumRatings = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedReviews.push(data);
        sumRatings += data.rating;
      });

      if (fetchedReviews.length > 0) {
        const avg = (sumRatings / fetchedReviews.length).toFixed(1);
        setAverageRating(avg);
        setTotalReviews(fetchedReviews.length);

        if (avg < 3) setSentiment("Bad");
        else if (avg < 4.5) setSentiment("Good");
        else setSentiment("Very Good");

        fetchedReviews.sort((a, b) => {
          const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return dateB - dateA;
        });
      }
      setReviews(fetchedReviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && product) checkWishlistStatus(user.uid, product.id);
    });
    return () => unsubscribe();
  }, [product]);

  const checkWishlistStatus = async (uid, productId) => {
     try {
      const docSnap = await getDoc(doc(db, 'users', uid, 'wishlist', productId));
      if (docSnap.exists()) setInWishlist(true);
    } catch (err) { console.error("Error checking wishlist:", err); }
  };

  const toggleWishlist = async () => {
    if (!currentUser) {
      alert("Please log in to save items to your wishlist!");
      navigate(`/login?redirect=product/${product.id}`);
      return;
    }
    const wishlistDocRef = doc(db, 'users', currentUser.uid, 'wishlist', product.id);
    try {
       if (inWishlist) {
        await deleteDoc(wishlistDocRef);
        setInWishlist(false);
        } else {
        await setDoc(wishlistDocRef, { productId: product.id, addedAt: new Date() });
        setInWishlist(true);
      }
    } catch (err) { alert("Failed to update wishlist."); }
  };

  // 🔥 NEW: Native Share API Logic
  const handleShare = async () => {
    const shareData = {
      title: product?.title || 'JAMBA WEAR Product',
      text: `Check out ${product?.title} on JAMBA WEAR!`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Product link copied to clipboard!");
    }
  };
 
  const validateSizeSelection = () => {
    if (!selectedSize) {
      setSizeError(true);
      sizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setSizeError(false), 2000);
      return false;
    }
    return true;
  };

  const handleAddToCart = () => {
    if (!validateSizeSelection()) return;
    let cart = JSON.parse(localStorage.getItem('jambaCart')) || [];
    const existingItem = cart.find(i => i.id === product.id && i.size === selectedSize);
    const cartThumbnail = mediaList.find(m => m.type === 'image')?.url || "";

    if (existingItem) existingItem.quantity += 1;
    else {
      cart.push({
        id: product.id,
        title: product.title,
        price: product.selling_price,
        image: cartThumbnail,
        size: selectedSize,
        quantity: 1,
        allow_cod: product.allow_cod !== false,
        allow_online: product.allow_online !== false,
        sellerEmail: product.sellerEmail || "",
        brandName: product.brandName || "",
        sellerName: product.sellerName || ""
      });
    }

    localStorage.setItem('jambaCart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated')); 
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBuyNow = () => {
    if (!validateSizeSelection()) return;
    const cartThumbnail = mediaList.find(m => m.type === 'image')?.url || "";
    
    const itemToBuy = {
      id: product.id,
      title: product.title,
      price: product.selling_price,
      image: cartThumbnail,
      size: selectedSize,
      quantity: 1,
      allow_cod: product.allow_cod !== false,
      allow_online: product.allow_online !== false,
      sellerEmail: product.sellerEmail || "",
      brandName: product.brandName || "",
      sellerName: product.sellerName || ""
    };

    localStorage.setItem('jambaActiveCheckout', JSON.stringify([itemToBuy]));

    let mainCart = JSON.parse(localStorage.getItem('jambaCart')) || [];
    const existingItem = mainCart.find(i => i.id === itemToBuy.id && i.size === itemToBuy.size);
    if (existingItem) existingItem.quantity += 1;
    else mainCart.push(itemToBuy);
    
    localStorage.setItem('jambaCart', JSON.stringify(mainCart));
    window.dispatchEvent(new Event('cartUpdated')); 
    navigate('/cart?mode=buynow');
  };

  const { isOOS, isAccessory, displayCategory, isCODAllowed, isOnlineAllowed, discountPercent, returnPolicyText } = useMemo(() => {
    if (!product) return {};
    
    let cat = product.category || 'Apparel';
    if (cat.includes('-')) {
      const parts = cat.split('-');
      cat = `${parts[1]?.trim() || ''} ${parts[0]?.trim() || ''}`.trim();
    }

    let policy = "7-Day Return & Replacement";
    if (product.return_policy === '7_day_replacement') policy = "7-Day Replacement Only (No Refunds)";
    if (product.return_policy === 'final_sale') policy = "Final Sale (No Returns)";

    return {
      isOOS: product.isOutOfStock === true,
      isAccessory: product.category && product.category.toLowerCase().includes('accessories'),
      displayCategory: cat,
      isCODAllowed: product.allow_cod !== false,
      isOnlineAllowed: product.allow_online !== false,
      discountPercent: product.original_price > product.selling_price ? Math.round(((product.original_price - product.selling_price) / product.original_price) * 100) : 0,
      returnPolicyText: policy
    };
  }, [product]);

  if (loading) return <div className="loading-state">Loading Premium Details...</div>;
  if (error || !product) return (
    <div className="error-state"><h2>Item Not Found</h2><button className="back-link" onClick={() => navigate(-1)}>← Go Back</button></div>
  );

  return (
    <div className="jamba-pv-wrapper">
      
      {/* MOBILE STICKY BOTTOM BAR */}
      <div className="mobile-sticky-action-bar">
        <button className="mob-action-btn cart-btn" onClick={handleAddToCart} disabled={isOOS || (!isCODAllowed && !isOnlineAllowed)}>
          {isOOS ? 'OUT OF STOCK' : addedToCart ? '✓ ADDED' : 'ADD TO CART'}
        </button>
        <button className="mob-action-btn buy-btn" onClick={handleBuyNow} disabled={isOOS || (!isCODAllowed && !isOnlineAllowed)}>
          {isOOS ? 'OUT OF STOCK' : 'BUY NOW'}
        </button>
      </div>

      <div className="jamba-pv-container">
        
        {/* =========================================
            LEFT COLUMN: MULTI-MEDIA GALLERY
        ============================================= */}
        <div className="jamba-pv-left">
          <div className="sticky-image-container">
            <div className="image-gallery-layout">
              
              <div className="gallery-main-image hidden-on-mobile">
                {/* 🔥 NEW: Stacked Floating Actions for Desktop */}
                <div className="floating-actions-container float-desktop">
                  <button className={`floating-action-btn ${inWishlist ? 'active' : ''}`} onClick={toggleWishlist} title="Add to Wishlist">
                    {inWishlist ? (
                      <svg viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l4.5-4.5"></path>
                        <line x1="16" y1="19" x2="22" y2="19"></line>
                        <line x1="19" y1="16" x2="19" y2="22"></line>
                      </svg>
                    )}
                  </button>
                  <button className="floating-action-btn" onClick={handleShare} title="Share">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>

                {activeMedia?.type === 'video' ? (
                  <video src={activeMedia.url} autoPlay loop muted controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <img src={activeMedia?.url} alt={product.title} className={isOOS ? 'oos-dim' : ''} />
                )}
              </div>

              <div className="gallery-thumbnails hidden-on-mobile">
                {mediaList.map((media, idx) => (
                  <div 
                    key={idx} 
                    className={`thumb-box ${activeMedia?.url === media.url ? 'active' : ''}`}
                    onClick={() => setActiveMedia(media)}
                    onMouseEnter={() => setActiveMedia(media)}
                  >
                    {media.type === 'video' ? (
                      <>
                        <video src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div className="video-thumbnail-overlay"><i className="fa-solid fa-play"></i></div>
                      </>
                    ) : (
                      <img src={media.url} alt="thumb" />
                    )}
                  </div>
                ))}
              </div>

              {/* MOBILE SWIPER */}
              <div className="mobile-image-swiper visible-on-mobile">
                {/* 🔥 NEW: Stacked Floating Actions for Mobile */}
                <div className="floating-actions-container float-mobile">
                  <button className={`floating-action-btn ${inWishlist ? 'active' : ''}`} onClick={toggleWishlist}>
                    {inWishlist ? (
                      <svg viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l4.5-4.5"></path>
                        <line x1="16" y1="19" x2="22" y2="19"></line>
                        <line x1="19" y1="16" x2="19" y2="22"></line>
                      </svg>
                    )}
                  </button>
                  <button className="floating-action-btn" onClick={handleShare}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" style={{ width: '20px', height: '20px' }}>
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>

                <div className="swiper-track">
                  {mediaList.map((media, idx) => (
                    media.type === 'video' ? (
                      <video key={idx} src={media.url} autoPlay loop muted playsInline className="swipe-slide" />
                    ) : (
                      <img key={idx} src={media.url} alt={`${product.title} ${idx}`} className={`swipe-slide ${isOOS ? 'oos-dim' : ''}`} />
                    )
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* =========================================
            RIGHT COLUMN: REORDERED FOR NEW UI
        ============================================= */}
        <div className="jamba-pv-right">
          
          <div className="jv-brand-row">
            {product.brandName || 'JAMBA WEAR'} <span className="separator">|</span> {product.sellerName || 'JAMBA'}
          </div>
            
          <h1 className="jv-title">{product.title}</h1>
          
          <div className="jv-pricing-row">
            <span className="jv-selling-price">₹{product.selling_price}</span>
            {discountPercent > 0 && (
              <>
                <span className="jv-original-price">₹{product.original_price}</span>
                <span className="jv-discount-percent">({discountPercent}% OFF)</span>
              </>
            )}
          </div>

          <div className="jv-payment-tags">
            {!isCODAllowed && isOnlineAllowed && <span className="ptag online">💳 ONLINE ONLY</span>}
            {isCODAllowed && !isOnlineAllowed && <span className="ptag cod">📦 COD ONLY</span>}
            {isCODAllowed && isOnlineAllowed && <span className="ptag both">💳 ONLINE & 📦 COD AVAILABLE</span>}
          </div>

          {totalReviews > 0 && (
            <div className="jv-rating-summary" onClick={() => document.getElementById('reviews-section').scrollIntoView({behavior: 'smooth'})}>
              <div className="jv-stars"><span className="star-icon">★</span> {averageRating}</div>
              <span className="jv-rating-text">{totalReviews} Reviews</span>
            </div>
          )}

          {isOOS && <div className="jv-oos-tag">Currently Out of Stock</div>}

          {/* 🔥 MOVED: Size Selector now directly above Assurances */}
          {product.sizing_type === 'free_size' ? (
             <div className="jv-size-section">
                <div className="section-heading-row">
                  <h3>Product Dimensions</h3>
                </div>
                <div className="free-size-box">
                  <strong>Length:</strong> {product.dimensions?.length || 'N/A'} <br/>
                  <strong>Width:</strong> {product.dimensions?.width || 'N/A'}
                </div>
             </div>
          ) : (product.sizing_type?.startsWith('chart_') || product.available_sizes) ? (
             <div className={`jv-size-section ${sizeError ? 'size-error-shake' : ''}`} ref={sizeRef}>
                <div className="section-heading-row">
                  <h3>SELECT SIZE</h3>
                  {product.size_chart && (
                    <span className="size-chart-link" onClick={() => setShowSizeGuide(true)}>
                      <i className="fa-solid fa-pen"></i> Size Guide
                    </span>
                  )}
                </div>
                {sizeError && <span className="error-text">Please select a size to continue</span>}
                <div className="jv-size-options">
                  {(product.available_sizes || []).map(size => (
                    <button 
                      key={size}
                      className={`jv-size-btn ${selectedSize === size ? 'selected' : ''}`} 
                      onClick={() => { setSelectedSize(size); setSizeError(false); }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
             </div>
          ) : product.requires_size !== false && !isAccessory && (
             <div className={`jv-size-section ${sizeError ? 'size-error-shake' : ''}`} ref={sizeRef}>
                <div className="section-heading-row">
                  <h3>SELECT SIZE</h3>
                </div>
                {sizeError && <span className="error-text">Please select a size to continue</span>}
                <div className="jv-size-options">
                  {['S', 'M', 'L', 'XL', 'XXL'].map(size => (
                    <button 
                      key={size}
                      className={`jv-size-btn ${selectedSize === size ? 'selected' : ''}`} 
                      onClick={() => { setSelectedSize(size); setSizeError(false); }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
             </div>
          )}

          {/* 🔥 MOVED: JAMBA Assurances Box */}
          <div className="jv-assurances-box">
            <div className="assurance-item">
              <i className="fa-solid fa-truck-fast"></i>
              <span>{product.dispatch_time || 'Ships in 2-3 Days'}</span>
            </div>
            <div className="assurance-item">
              <i className="fa-solid fa-arrow-right-arrow-left"></i>
              <span>{returnPolicyText}</span>
            </div>
          </div>

          <div className="jv-description-text">
            {product.description || 'Elevate your culture with this premium piece. Crafted with care.'}
          </div>

          {/* SPECS & CARE ACCORDION */}
          <div className="jv-specs-gray-box">
            <div className="spec-row"><span className="spec-label">Color:</span><span className="spec-value">{product.color || 'N/A'}</span></div>
            <div className="spec-row"><span className="spec-label">Fabric:</span><span className="spec-value">{product.fabric || 'N/A'}</span></div>
            <div className="spec-row"><span className="spec-label">Category:</span><span className="spec-value">{displayCategory}</span></div>
            
            {product.care_instructions && product.care_instructions.length > 0 && (
              <div className="spec-row" style={{ flexDirection: 'column', gap: '6px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                <span className="spec-label" style={{ width: '100%' }}><i className="fa-solid fa-shirt"></i> Wash & Care:</span>
                <ul style={{ margin: '0 0 0 20px', padding: 0, fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                  {product.care_instructions.map((care, i) => (
                    <li key={i}>{care}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="jv-action-buttons-row hidden-on-mobile">
            <button className="jv-btn buy-now" onClick={handleBuyNow} disabled={isOOS || (!isCODAllowed && !isOnlineAllowed)}>
              BUY NOW
            </button>
            <button className="jv-btn add-to-cart" onClick={handleAddToCart} disabled={isOOS || (!isCODAllowed && !isOnlineAllowed)}>
              {addedToCart ? '✓ ADDED' : 'ADD TO CART'}
            </button>
          </div>

        </div>
      </div>

      {/* =========================================
          FULL-WIDTH BOTTOM SECTIONS
      ============================================= */}
      <div className="jv-bottom-sections">
        
        {/* RECOMMENDATIONS SECTION */}
        {recommendedProducts.length > 0 && (
          <>
            <div className="jv-divider"></div>
            <div className="jv-section recommendations-section">
              <h3>Frequently Bought Together</h3>
              <div className="recommendations-grid">
                {recommendedProducts.map(rec => (
                  <div key={rec.id} className="rec-product-card" onClick={() => navigate(`/product/${rec.id}`)}>
                    <div className="rec-img-wrapper">
                      <img src={rec.images?.[0] || rec.image || "https://via.placeholder.com/300"} alt={rec.title} />
                    </div>
                    <div className="rec-info">
                      <p className="rec-brand">{rec.brandName || "JAMBA"}</p>
                      <p className="rec-title">{rec.title}</p>
                      <p className="rec-price">₹{rec.selling_price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="jv-divider"></div>

        {/* RATINGS & REVIEWS SECTION */}
        <div className="jv-section reviews-section" id="reviews-section">
          <h3>Customer Reviews</h3>
          
          {totalReviews === 0 ? (
            <div className="jv-no-reviews">
              <p>Be the first to review this product!</p>
            </div>
          ) : (
            <div className="jv-reviews-layout">
              <div className="jv-aggregate-col">
                <div className="jv-big-rating">
                  {averageRating} <span className="star">★</span>
                </div>
                <p>Based on {totalReviews} reviews</p>
                <span className={`jv-sentiment-badge sentiment-${sentiment.replace(/\s+/g, '-').toLowerCase()}`}>
                  {sentiment} Quality
                </span>
              </div>

              <div className="jv-reviews-feed">
                {reviews.map((rev, idx) => (
                  <div key={idx} className="jv-individual-review">
                    <div className="rev-header">
                      <div className="rev-user-row">
                         <span className="rev-user">{rev.userName}</span>
                         <span className="rev-verified">✓ Verified</span>
                      </div>
                      <span className={`rev-star-badge rating-${rev.rating}`}>
                        {rev.rating} ★
                      </span>
                    </div>
                    
                    <span className="rev-text">
                      {rev.reviewText ? rev.reviewText : "Great product, highly recommended!"}
                    </span>
                    
                    {rev.images && rev.images.length > 0 && (
                      <div className="rev-images">
                        {rev.images.map((imgUrl, i) => (
                          <div 
                            className="rev-img-wrapper" 
                            key={i}
                            onClick={() => setSelectedReviewImg({
                              url: imgUrl, 
                              text: rev.reviewText ? rev.reviewText : "Great product, highly recommended!"
                            })}
                          >
                            <img src={imgUrl} alt="Customer upload" />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {rev.createdAt && (
                      <span className="rev-date">
                        {new Date(rev.createdAt.toDate()).toLocaleDateString('en-IN', {month: 'long', year:'numeric'})}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REVIEW IMAGE MODAL */}
      {selectedReviewImg && (
        <div className="review-image-modal" onClick={() => setSelectedReviewImg(null)}>
          <div className="review-modal-content" onClick={e => e.stopPropagation()}>
            <button className="review-modal-close" onClick={() => setSelectedReviewImg(null)}>&times;</button>
            <img src={selectedReviewImg.url} alt="Expanded Review" />
            <div className="review-modal-text">
              {selectedReviewImg.text}
            </div>
          </div>
        </div>
      )}

      {/* SIZE GUIDE MODAL */}
      {showSizeGuide && product.size_chart && (
        <div className="size-guide-modal" onClick={() => setShowSizeGuide(false)}>
          <div className="size-guide-content" onClick={e => e.stopPropagation()}>
            <button className="review-modal-close" onClick={() => setShowSizeGuide(false)}>&times;</button>
            <h3>Garment Measurements (Inches)</h3>
            <div className="sg-table-wrapper">
              <table className="sg-table">
                <thead>
                  <tr>
                    <th>Size</th>
                    {product.sizing_type === 'chart_top_standard' && <><th >Chest</th><th>Shoulder</th><th>Length</th><th>Sleeve</th></>}
                    {product.sizing_type === 'chart_blouse' && <><th>Bust</th><th>Waist</th><th>Shoulder</th><th>Armhole</th></>}
                    {product.sizing_type === 'chart_bottom' && <><th>Waist</th><th>Hip</th><th>Length</th></>}
                  </tr>
                </thead>
                <tbody>
                  {product.available_sizes.map(size => {
                    const rowData = product.size_chart[size];
                    return (
                      <tr key={size}>
                        <td style={{ fontWeight: '700' }}>{size}</td>
                        {product.sizing_type === 'chart_top_standard' && <><td>{rowData.chest || '-'}</td><td>{rowData.shoulder || '-'}</td><td>{rowData.length || '-'}</td><td>{rowData.sleeve || '-'}</td></>}
                        {product.sizing_type === 'chart_blouse' && <><td>{rowData.bust || '-'}</td><td>{rowData.waist || '-'}</td><td>{rowData.shoulder || '-'}</td><td>{rowData.armhole || '-'}</td></>}
                        {product.sizing_type === 'chart_bottom' && <><td>{rowData.waist || '-'}</td><td>{rowData.hip || '-'}</td><td>{rowData.length || '-'}</td></>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}