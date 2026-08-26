import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import './CollectionPage.css'; 

export default function CollectionPage() {
  // Grabs the dynamic words from the URL (e.g., 'men' and 'shirt')
  const { category, subcategory } = useParams(); 
  const navigate = useNavigate();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFilteredProducts() {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        let matchedProducts = [];

        querySnapshot.forEach((docSnap) => {
          const product = { id: docSnap.id, ...docSnap.data() };
          if (product.isHidden) return; 

          const prodCategory = (product.category || "").toLowerCase();
          const prodTitle = (product.title || "").toLowerCase();
          const prodSubcat = (product.subcategory || "").toLowerCase();
          
          const targetCategory = (category || "").toLowerCase();
          const targetSubcat = (subcategory || "").toLowerCase();

          // 1. Match main category (e.g., 'men')
          if (prodCategory.includes(targetCategory)) {
             // 2. Match subcategory tag or title (e.g., 'shirt' or 'aronai')
             if (prodSubcat.includes(targetSubcat) || prodTitle.includes(targetSubcat)) {
                 matchedProducts.push(product);
             }
          }
        });

        setProducts(matchedProducts);
      } catch (error) {
        console.error("Error fetching collection products:", error);
      }
      setLoading(false);
    }
    
    fetchFilteredProducts();
    window.scrollTo(0, 0); // Scroll to top on load
  }, [category, subcategory]); // Re-runs automatically if URL changes

  if (loading) return <div className="loading" style={{ minHeight: '60vh', textAlign: 'center', marginTop: '100px' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading {subcategory}...</div>;

  return (
    <div className="cp-container">
      
      {/* Navigation Breadcrumb & Header */}
      <div className="cp-header">
        <div className="cp-breadcrumb">
            <span onClick={() => navigate('/')}>Home</span> / 
            <span onClick={() => navigate(`/category/${category}`)}> {category}</span> / 
            <span className="active"> {subcategory}</span>
        </div>
        <h1 className="cp-title">{category}'s {subcategory}s</h1>
        <p className="cp-count">{products.length} Products Found</p>
      </div>

      {/* Product Grid */}
      {products.length > 0 ? (
        <div className="cp-grid">
          {products.map(product => {
            const price = product.selling_price || product.price || 0;
            const originalPrice = product.original_price || price; 
            const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : (product.image || "https://via.placeholder.com/300");

            return (
              <div key={product.id} className="cp-product-card" onClick={() => navigate(`/product/${product.id}`)}>
                <div className="cp-image-wrapper">
                  <img src={imgUrl} alt={product.title} />
                </div>
                <div className="cp-product-info">
                  <p className="cp-title-text">{product.title}</p>
                  <p className="cp-brand">{product.brandName || 'JAMBA'}</p>
                  <div className="cp-price-row">
                    <span className="cp-current-price">₹{price.toLocaleString('en-IN')}</span>
                    {originalPrice > price && (
                      <span className="cp-original-price">₹{originalPrice.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cp-empty-state">
           <h2>No {subcategory}s Found</h2>
           <p>We are currently updating our {subcategory} collection.</p>
           <button onClick={() => navigate(`/category/${category}`)}>Back to {category}</button>
        </div>
      )}
    </div>
  );
}