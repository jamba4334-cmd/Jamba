import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import './Wishlist.css'; // 🔥 Link to the new CSS file

export default function Wishlist() {
  const navigate = useNavigate();
  const { user } = useAuth(); // 🔥 FIX: Changed currentUser to user
  
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!user) {
        setWishlistItems([]);
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'users', user.uid, 'wishlist'));
        const querySnapshot = await getDocs(q);
        
        const items = [];
        for (const docSnap of querySnapshot.docs) {
          const itemData = docSnap.data();
          const productRef = doc(db, 'products', itemData.productId);
          const productSnap = await getDoc(productRef);
          
          if (productSnap.exists()) {
            items.push({ id: productSnap.id, ...productSnap.data() });
          }
        }
        setWishlistItems(items);
      } catch (error) {
        console.error("Error fetching wishlist:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
  }, [user]);

  const handleRemove = async (productId) => {
    if (!user) return;
    
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'wishlist', productId));
      setWishlistItems(prev => prev.filter(item => item.id !== productId));
    } catch (error) {
      console.error("Error removing from wishlist:", error);
    }
  };

  if (loading) return <div className="ws-loading-state">Loading Wishlist...</div>;

  if (!user) {
    return (
      <div className="ws-empty-state">
        <h2>Log in to see your Wishlist</h2>
        <button className="ws-primary-btn" onClick={() => navigate('/login')}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="wishlist-page-wrapper">
      <h1 className="wishlist-page-title">Your Wishlist</h1>
      
      {wishlistItems.length === 0 ? (
        <p className="wishlist-empty-msg">Your wishlist is empty. Discover something new.</p>
      ) : (
        <div className="wishlist-grid">
          {wishlistItems.map(item => (
            <div key={item.id} className="wishlist-card">
              <div className="wishlist-image-wrapper" onClick={() => navigate(`/product/${item.id}`)}>
                <img 
                  src={item.images?.[0] || item.image || "https://via.placeholder.com/300"} 
                  alt={item.title} 
                />
              </div>
              <div className="wishlist-info">
                <h3 className="wishlist-item-title">{item.title}</h3>
                <p className="wishlist-item-price">₹{item.selling_price?.toLocaleString('en-IN')}</p>
                <button 
                  className="wishlist-remove-btn"
                  onClick={() => handleRemove(item.id)}
                >
                  Remove Item
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}