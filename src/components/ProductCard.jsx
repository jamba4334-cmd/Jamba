import { useNavigate } from 'react-router-dom';
import './ProductCard.css';

export default function ProductCard({ product }) {
  const navigate = useNavigate(); // React Router's way to change pages
  
  const isOOS = product.isOutOfStock === true;
  const originalPrice = product.original_price || product.selling_price;
  const imgUrl = (product.images && product.images.length > 0) ? product.images[0] : "https://via.placeholder.com/300x400";
  const productId = product.item_id || product.id;

  return (
    <div className="product-card" onClick={() => navigate(`/product/${productId}`)}>
      {isOOS && <div className="oos-badge">Out of Stock</div>}
      
      <img 
        className="product-image" 
        src={imgUrl} 
        alt={product.title} 
        style={{ opacity: isOOS ? 0.5 : 1 }} 
      />
      
      <div className="product-info">
        <h3 className="product-title">{product.title}</h3>
        <p className="product-price">
          ₹{product.selling_price}
          {originalPrice > product.selling_price && (
            <span className="old-price">₹{originalPrice}</span>
          )}
        </p>
      </div>
    </div>
  );
}