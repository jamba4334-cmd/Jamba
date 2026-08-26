import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; 
import './UnifiedCategory.css'; 

export default function UnifiedCategory() {
  const { category, subcategory } = useParams(); 
  const navigate = useNavigate();
  
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sortType, setSortType] = useState('popularity');
  const [isMobileSortOpen, setIsMobileSortOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Fetch Products
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        let fetchedProducts = [];
        const targetCategory = (category || "").toLowerCase();

        querySnapshot.forEach((docSnap) => {
          const product = { id: docSnap.id, ...docSnap.data() };
          if (product.isHidden) return; 

          const prodCategory = (product.category || "").toLowerCase();
          if (prodCategory.includes(targetCategory)) {
             fetchedProducts.push(product);
          }
        });

        setAllProducts(fetchedProducts);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
      setLoading(false);
    }
    
    fetchProducts();
    window.scrollTo(0, 0); 
  }, [category]); 

  // Sorting Engine
  const displayedProducts = useMemo(() => {
    let processed = allProducts;
    if (subcategory) {
        const targetSubcat = subcategory.toLowerCase();
        processed = allProducts.filter(product => {
            const prodTitle = (product.title || "").toLowerCase();
            const prodSubcat = (product.subcategory || "").toLowerCase();
            return prodSubcat.includes(targetSubcat) || prodTitle.includes(targetSubcat);
        });
    }

    return processed.sort((a, b) => {
        const priceA = Number(a.selling_price || a.price || 0);
        const priceB = Number(b.selling_price || b.price || 0);
        
        switch (sortType) {
            case 'price-low': return priceA - priceB;
            case 'price-high': return priceB - priceA;
            case 'newest': return (b.createdAt || 0) - (a.createdAt || 0);
            case 'popularity': 
            default:
                return 0; 
        }
    });
  }, [allProducts, subcategory, sortType]);

  const sortOptions = [
      { id: 'popularity', label: 'Popularity' },
      { id: 'price-low', label: 'Price -- Low to High' },
      { id: 'price-high', label: 'Price -- High to Low' },
      { id: 'newest', label: 'Newest First' }
  ];

  if (loading) {
      return (
          <div className="uc-loading-state">
              <i className="fa-solid fa-spinner fa-spin"></i> Loading Collection...
          </div>
      );
  }

  return (
    <div className="uc-wrapper">
        
      <div className="uc-container">
          
        {/* 🛒 LEFT SIDEBAR (PC ONLY) */}
        <aside className="uc-pc-sidebar">
            <div className="uc-sidebar-header-title">Filters</div>
            <div className="uc-filter-group">
                <h4>CATEGORIES</h4>
                <div className="uc-filter-item active">Clothing and Accessories</div>
                <div className="uc-filter-item indent">{category}</div>
            </div>
            <div className="uc-filter-group">
                <h4>BRAND</h4>
                {['JAMBA', 'AD & AV', 'CITIZEN', 'SNOWIE SOFT'].map(brand => (
                    <label key={brand} className="uc-checkbox-label">
                        <input type="checkbox" /> {brand}
                    </label>
                ))}
            </div>
            <div className="uc-filter-group">
                <h4>CUSTOMER RATINGS</h4>
                <label className="uc-checkbox-label"><input type="checkbox" /> 4 ★ & above</label>
                <label className="uc-checkbox-label"><input type="checkbox" /> 3 ★ & above</label>
            </div>
        </aside>

        {/* 🛍️ RIGHT MAIN CONTENT AREA */}
        <main className="uc-main-content">
            <div className="uc-pc-header">
                <div className="uc-breadcrumb">
                    <span onClick={() => navigate('/')}>Home</span> / 
                    <span onClick={() => navigate(`/category/${category}`)}> {category}</span>
                    {subcategory && <> / <span className="active"> {subcategory}</span></>}
                </div>
                
                <div className="uc-title-area">
                    <h1 className="uc-title">{subcategory ? subcategory.toUpperCase() : category.toUpperCase()}</h1>
                    <span className="uc-count">(Showing 1 – {displayedProducts.length} products)</span>
                </div>

                <div className="uc-pc-sort-bar">
                    <span className="uc-sort-label">Sort By</span>
                    {sortOptions.map(option => (
                        <button 
                            key={option.id}
                            className={`uc-pc-sort-btn ${sortType === option.id ? 'active' : ''}`}
                            onClick={() => setSortType(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* PRODUCT GRID */}
            {displayedProducts.length > 0 ? (
            <div className="uc-grid">
                {displayedProducts.map(product => {
                const price = Number(product.selling_price || product.price || 0);
                const originalPrice = Number(product.original_price || price); 
                const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
                const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : (product.image || "https://via.placeholder.com/300");

                return (
                    <div key={product.id} className="uc-product-card" onClick={() => navigate(`/product/${product.id}`)}>
                    
                    <div className="uc-image-wrapper">
                        <img src={imgUrl} alt={product.title} />
                        <button className="uc-heart-btn" onClick={(e) => { e.stopPropagation(); }}>
                            <i className="fa-regular fa-heart"></i>
                        </button>
                        
                        {/* 🔥 FIXED: Only render the pill if a real rating exists in the database */}
                        {product.rating && (
                            <div className="uc-rating-pill">
                                {product.rating} <i className="fa-solid fa-star"></i> | {product.reviewsCount || 0}
                            </div>
                        )}
                    </div>

                    <div className="uc-product-info">
                        <h3 className="uc-brand">{product.brandName || 'JAMBA'}</h3>
                        <p className="uc-title-text">{product.title}</p>
                        
                        <div className="uc-price-row">
                            {/* 🔥 FIXED: Price is always visible, discount logic is separated */}
                            {price > 0 ? (
                                <span className="uc-current-price">₹{price.toLocaleString('en-IN')}</span>
                            ) : (
                                <span className="uc-current-price" style={{ color: '#878787' }}>TBA</span>
                            )}
                            
                            {originalPrice > price && (
                                <span className="uc-original-price">₹{originalPrice.toLocaleString('en-IN')}</span>
                            )}
                            
                            {discount > 0 && (
                                <span className="uc-discount-text">{discount}% off</span>
                            )}
                        </div>
                        
                        <div className="uc-delivery-text">Delivery by <strong>11th Aug</strong></div>
                    </div>
                    </div>
                );
                })}
            </div>
            ) : (
            <div className="uc-empty-state">
                <h2>No Products Found</h2>
                <p>We couldn't find any items matching this criteria.</p>
            </div>
            )}
        </main>
      </div>

      {/* =========================================
          📱 MOBILE: FIXED ACTION BAR
          ========================================= */}
      <div className="uc-mobile-action-bar">
          <button className="uc-action-btn" onClick={() => setIsMobileSortOpen(true)}>
              <i className="fa-solid fa-sort"></i> Sort
          </button>
          <div className="uc-action-divider"></div>
          <button className="uc-action-btn" onClick={() => setIsMobileFilterOpen(true)}>
              <i className="fa-solid fa-sliders"></i> Filter
          </button>
      </div>

      {/* =========================================
          📱 MOBILE MODALS
          ========================================= */}
      {isMobileSortOpen && (
          <div className="uc-modal-overlay" onClick={() => setIsMobileSortOpen(false)}>
              <div className="uc-bottom-sheet" onClick={e => e.stopPropagation()}>
                  <div className="uc-sheet-header"><h3>SORT BY</h3></div>
                  <div className="uc-sheet-options">
                      {sortOptions.map(option => (
                          <label key={option.id} className="uc-radio-label">
                              <span>{option.label}</span>
                              <input 
                                  type="radio" 
                                  name="sortOption" 
                                  value={option.id}
                                  checked={sortType === option.id}
                                  onChange={() => {
                                      setSortType(option.id);
                                      setIsMobileSortOpen(false);
                                  }}
                              />
                          </label>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {isMobileFilterOpen && (
          <div className="uc-modal-overlay" onClick={() => setIsMobileFilterOpen(false)}>
              <div className="uc-filter-sidebar" onClick={e => e.stopPropagation()}>
                  <div className="uc-sidebar-header">
                      <button onClick={() => setIsMobileFilterOpen(false)}><i className="fa-solid fa-arrow-left"></i></button>
                      <h3>Filters</h3>
                  </div>
                  
                  <div className="uc-sidebar-content">
                      <div className="uc-filter-tabs">
                          <div className="uc-filter-tab active">Brand</div>
                          <div className="uc-filter-tab">Gender</div>
                          <div className="uc-filter-tab">Price</div>
                      </div>
                      <div className="uc-filter-options">
                          <div className="uc-search-box">
                              <i className="fa-solid fa-magnifying-glass"></i>
                              <input type="text" placeholder="Search Brand" />
                          </div>
                          {['JAMBA', 'Arumart', 'INTEGRITI', 'KILLER', 'Wildcraft'].map(brand => (
                              <label key={brand} className="uc-checkbox-label">
                                  <input type="checkbox" /> {brand}
                              </label>
                          ))}
                      </div>
                  </div>

                  <div className="uc-sidebar-footer">
                      <div className="uc-product-count-footer">
                          <strong>{displayedProducts.length}</strong> products found
                      </div>
                      <button className="uc-apply-btn" onClick={() => setIsMobileFilterOpen(false)}>Apply</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}