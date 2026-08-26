import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './OrderSuccess.css';

export default function OrderSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract the order ID passed from Payment.jsx
  const orderId = location.state?.orderId;

  // Optional: Redirect back to home if they somehow land here without checking out
  useEffect(() => {
    if (!orderId && !location.state) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [orderId, location.state, navigate]);

  return (
    <div className="success-page-wrapper">
      <div className="success-card">
        
        {/* Animated Checkmark SVG */}
        <div className="success-animation-container">
          <svg className="animated-check" viewBox="0 0 52 52">
            <circle className="animated-check-circle" cx="26" cy="26" r="25" fill="none" />
            <path className="animated-check-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
        </div>

        <div className="success-text-content">
          <h1 className="success-title">Order Confirmed!</h1>
          <p className="success-subtitle">Thank you for shopping with JAMBA. Your premium wear is being processed.</p>
          
          {orderId && (
            <div className="order-id-box">
              <span>Order ID:</span>
              <strong>{orderId}</strong>
            </div>
          )}
        </div>

        <div className="success-actions">
          <Link to="/orders" className="view-orders-btn">View My Orders</Link>
          <Link to="/" className="shop-more-link">Continue Shopping</Link>
        </div>

      </div>
    </div>
  );
}