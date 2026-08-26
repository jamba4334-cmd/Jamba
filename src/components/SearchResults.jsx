import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import './SearchResults.css'; 

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const navigate = useNavigate();

  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter State (Only Sort by is left!)
  const [sortOption, setSortOption] = useState('recommended');

  // 1. Fetch matching products
  useEffect(() => {
    async function fetchSearchResults() {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const matches = [];
        const searchTerm = queryParam.toLowerCase().trim();

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.isHidden) return;

          const searchableText = `${data.title || ''} ${data.brandName || ''} ${data.category || ''} ${data.color || ''} ${data.fabric || ''}`.toLowerCase();

          if (searchableText.includes(searchTerm)) {
            matches.push({ id: data.item_id || doc.id, ...data });
          }
        });

        setAllProducts(matches);
      } catch (error) {
        console.error("Error searching products:", error);
      }
      setLoading(false);
    }

    if (queryParam) {
      fetchSearchResults();
    } else {
      setAllProducts([]);
      setLoading(false);
    }
  }, [queryParam]);

  // 2. Apply Sorting whenever the option changes
  useEffect(() => {
    let result = [...allProducts];

    // Apply Sorting logic
    if (sortOption === 'price-low') {
      result.sort((a, b) => (a.selling_price || 0) - (b.selling_price || 0));
    } else if (sortOption === 'price-high') {
      result.sort((a, b) => (b.selling_price || 0) - (a.selling_price || 0));
    } else if (sortOption === 'newest') {
      result.sort((a, b) => {
        // Sorts by newest first if you have createdAt in Firebase
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.created_at || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.created_at || 0);
        return dateB - dateA;
      });
    } else if (sortOption === 'popularity') {
      // Sorts by sales or views if you track that, else falls back cleanly
      result.sort((a, b) => (b.sales || 0) - (a.sales || 0));
    }

    setFilteredProducts(result);
  }, [allProducts, sortOption]);

  // Clean Product Card Component
  const SearchProductCard = ({ product }) => {
    const price = product.selling_price || product.price || 0;
    const originalPrice = product.original_price || price; 
    const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : (product.image || "https://raw.githubusercontent.com/jamba4334-cmd/JAMBA/main/assets/JAMBA.png");

    return (
      <div className="search-product-card" onClick={() => navigate(`/product/${product.id}`)}>
        <div className="search-image-wrapper">
          <img src={imgUrl} alt={product.title} />
          {product.isOutOfStock && <div className="oos-badge">Out of Stock</div>}
        </div>
        <div className="search-product-info">
          <p className="search-brand">{product.brandName || "Brand Name"}</p>
          <p className="search-title">{product.title || "Product Name"}</p>
          
          <div className="search-price-row">
            <span className="search-current-price">Rs. {price.toLocaleString('en-IN')}</span>
            {originalPrice > price && (
              <span className="search-original-price">Rs. {originalPrice.toLocaleString('en-IN')}</span>
            )}
            {originalPrice > price && (
              <span className="search-discount">
                ({Math.round(((originalPrice - price) / originalPrice) * 100)}% OFF)
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="loading" style={{ minHeight: '60vh' }}></div>;

  return (
    <div className="search-page-container">
      
      {/* Header showing search term and item count */}
      <div className="search-header">
        <span className="search-breadcrumbs">Home / Search / <strong>{queryParam}</strong></span>
        <h1 className="search-title-main">
          {queryParam.charAt(0).toUpperCase() + queryParam.slice(1)} 
          <span className="search-count"> - {filteredProducts.length} items</span>
        </h1>
      </div>

      {allProducts.length === 0 ? (
        <div className="no-results">
          <h2>We couldn't find any matches!</h2>
          <p>Please check the spelling or try searching for something else.</p>
        </div>
      ) : (
        <div className="search-content-wrapper">
          
          {/* Top Filter Bar - Now only containing Sort By */}
          <div className="search-filter-bar">
            <div className="filter-dropdown sort-dropdown">
              <label>Sort by :</label>
              <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="newest">Newest First</option>
                <option value="popularity">Popularity</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          <div className="search-product-grid">
            {filteredProducts.map(p => <SearchProductCard key={p.id} product={p} />)}
          </div>
          
        </div>
      )}
    </div>
  );
}