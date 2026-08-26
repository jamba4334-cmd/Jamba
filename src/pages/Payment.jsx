import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
import { API_BASE_URL } from '../apiConfig'; 
import './Payment.css';

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { user } = useAuth(); 
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('COD'); 

  const { 
    cartItems = [], 
    shippingAddress = {}, 
    subtotal = 0,          
    discount = 0,          
    shippingFee = 0,       
    finalTotal = 0,
    appliedPromoCode = null, 
    isBuyNow = false
  } = location.state || {};

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate('/cart');
    }
  }, [cartItems, navigate]);

  const canUseCOD = cartItems.length > 0 && cartItems.every(item => item.allow_cod !== false);
  const canUseOnline = cartItems.length > 0 && cartItems.every(item => item.allow_online !== false);

  useEffect(() => {
    if (!canUseCOD && paymentMethod === 'COD') {
      setPaymentMethod('Razorpay');
    } else if (!canUseOnline && paymentMethod === 'Razorpay') {
      setPaymentMethod('COD');
    }
  }, [canUseCOD, canUseOnline, paymentMethod]);


  const handleSuccessCleanup = () => {
    if (isBuyNow) {
        let mainCart = JSON.parse(localStorage.getItem('jambaCart')) || [];
        cartItems.forEach(purchasedItem => {
            mainCart = mainCart.filter(mItem => !(mItem.id === purchasedItem.id && mItem.size === purchasedItem.size));
        });
        localStorage.setItem('jambaCart', JSON.stringify(mainCart));
        localStorage.removeItem('jambaActiveCheckout');
    } else {
        localStorage.removeItem('jambaCart'); 
    }
  };

  const verifyPayment = async (razorpayResponse) => {
    try {
      const response = await fetch(`${API_BASE_URL}/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(razorpayResponse)
      });
      const data = await response.json();
      
      if (response.ok) {
        handleSuccessCleanup();
        navigate('/order-success', { state: { orderId: razorpayResponse.razorpay_order_id } });
      } else {
        alert("Payment verification failed: " + data.error);
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
      alert("Something went wrong verifying your payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalCheckout = async () => {
    setIsProcessing(true);

    try {
      // ==========================================
      // 🔥 THE UNIFIED PIPELINE (COD & ONLINE)
      // Both methods now go securely to the Python backend!
      // ==========================================
      const response = await fetch(`${API_BASE_URL}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: cartItems,
          customer: user?.email || "guest@jambawear.com",
          shippingAddress: shippingAddress,
          payment_method: paymentMethod,
          
          subtotal: subtotal,
          discount_applied: discount,
          shipping_fee: shippingFee,
          promo_used: appliedPromoCode, // Safely sends the code to the backend!
          total: finalTotal
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create order");

      // 1. COD SUCCESS HANDLER
      // If the backend processed it as COD, it immediately returns an order_id
      if (data.payment_method === "COD") {
        handleSuccessCleanup();
        setIsProcessing(false);
        navigate('/order-success', { state: { orderId: data.order_id } });
        return;
      }

      // 2. RAZORPAY SUCCESS HANDLER
      // If the backend returns a Razorpay ID, open the payment modal
      if (data.id) {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID, 
          amount: data.amount,
          currency: "INR",
          name: "JAMBA WEAR",
          description: "Premium Clothing Order",
          order_id: data.id,
          handler: function (response) { verifyPayment(response); },
          prefill: {
            name: shippingAddress.name,
            email: user?.email || "",
            contact: shippingAddress.phone
          },
          theme: { color: "#1a1a1a" },
          modal: { ondismiss: function() { setIsProcessing(false); } }
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response){
           alert("Payment Failed. Reason: " + response.error.description);
           setIsProcessing(false);
        });
        rzp.open();
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Error placing order: Make sure your server is running!");
      setIsProcessing(false);
    }
  };

  if (cartItems.length === 0) return null;

  return (
    <div className="payment-page-wrapper">
      <div className="payment-container">
        
        <div className="payment-header">
          <h2 className="payment-title">Checkout</h2>
          <div className="secure-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Secure Payment</span>
          </div>
        </div>

        {/* 1. Address Confirmation */}
        <div className="payment-section">
          <h3 className="section-subtitle">Shipping Destination</h3>
          <div className="address-card">
            <div className="address-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <div className="payment-details-text">
              <strong className="address-name">{shippingAddress.name}</strong>
              <p>{shippingAddress.address1}{shippingAddress.landmark ? `, ${shippingAddress.landmark}` : ''}</p>
              <p>{shippingAddress.district}, {shippingAddress.state} - {shippingAddress.pincode}</p>
              <p className="address-phone">Phone: {shippingAddress.phone}</p>
            </div>
          </div>
        </div>

        {/* 2. CHOOSE PAYMENT METHOD */}
        <div className="payment-section">
          <h3 className="section-subtitle">Payment Method</h3>
          <div className="payment-methods-grid">
            
            <label 
              className={`payment-method-card ${paymentMethod === 'Razorpay' ? 'active' : ''}`}
              style={{ opacity: canUseOnline ? 1 : 0.5, cursor: canUseOnline ? 'pointer' : 'not-allowed' }}
            >
              <input 
                type="radio" 
                name="paymentMethod" 
                value="Razorpay" 
                checked={paymentMethod === 'Razorpay'} 
                onChange={(e) => setPaymentMethod(e.target.value)} 
                disabled={!canUseOnline}
                className="hidden-radio"
              />
              <div className="card-content">
                <svg className="method-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                <div className="method-text">
                  <span className="method-title">Pay Online</span>
                  <span className="method-desc">UPI, Cards, Wallets via Razorpay</span>
                  {!canUseOnline && (
                    <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 'bold', marginTop: '4px', display: 'block' }}>
                      ⛔ Unavailable for items in your cart
                    </span>
                  )}
                </div>
                {canUseOnline && <div className="custom-radio"></div>}
              </div>
            </label>
            
            <label 
              className={`payment-method-card ${paymentMethod === 'COD' ? 'active' : ''}`}
              style={{ opacity: canUseCOD ? 1 : 0.5, cursor: canUseCOD ? 'pointer' : 'not-allowed' }}
            >
              <input 
                type="radio" 
                name="paymentMethod" 
                value="COD" 
                checked={paymentMethod === 'COD'} 
                onChange={(e) => setPaymentMethod(e.target.value)} 
                disabled={!canUseCOD}
                className="hidden-radio"
              />
              <div className="card-content">
                <svg className="method-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
                <div className="method-text">
                  <span className="method-title">Cash on Delivery</span>
                  <span className="method-desc">Pay at your doorstep</span>
                  {!canUseCOD && (
                    <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 'bold', marginTop: '4px', display: 'block' }}>
                      ⛔ Requires Prepaid Order
                    </span>
                  )}
                </div>
                {canUseCOD && <div className="custom-radio"></div>}
              </div>
            </label>

          </div>
        </div>

        {/* 3. Final Total & Action */}
        <div className="payment-summary-box">
          <div className="payment-total-row">
            <span>Total to Pay</span>
            <span className="total-amount">₹{finalTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <button 
          onClick={handleFinalCheckout} 
          disabled={isProcessing || (!canUseCOD && !canUseOnline)} 
          className={`payment-proceed-btn ${isProcessing ? 'processing' : ''}`}
        >
          {isProcessing ? (
            <span className="btn-loader"></span>
          ) : (
            (!canUseCOD && !canUseOnline) ? 'Checkout Unavailable' : `Place Order • ₹${finalTotal.toLocaleString('en-IN')}`
          )}
        </button>

        <div className="return-action">
           <button onClick={() => navigate('/cart')} className="payment-back-btn">
             Return to Cart
           </button>
        </div>

      </div>
    </div>
  );
};

export default Payment;