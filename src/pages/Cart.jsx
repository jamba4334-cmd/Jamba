// src/pages/Cart.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase'; 
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig.js'; 
import './Cart.css'; 

export default function Cart() {
    const navigate = useNavigate();
    const location = useLocation();
    
    const { user } = useAuth();
    const prevUserRef = useRef(user);

    const queryParams = new URLSearchParams(location.search);
    const isBuyNow = queryParams.get('mode') === 'buynow';

    const [cart, setCart] = useState(() => {
        if (isBuyNow) {
            const activeData = localStorage.getItem('jambaActiveCheckout');
            return activeData ? JSON.parse(activeData) : [];
        } else {
            const savedData = localStorage.getItem('jambaCart');
            return savedData ? JSON.parse(savedData) : [];
        }
    });
    
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);
    
    // --- PROMO CODE STATE ---
    const [promoCode, setPromoCode] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null);
    const [promoMessage, setPromoMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const syncCartWithAuth = async () => {
            if (isBuyNow) return;

            const wasLoggedIn = prevUserRef.current !== null && prevUserRef.current !== undefined;
            const isLoggedOutNow = !user;

            if (wasLoggedIn && isLoggedOutNow) {
                setCart([]);
                localStorage.removeItem('jambaCart');
            } 
            else if (user) {
                try {
                    const cartRef = doc(db, 'carts', user.uid);
                    const cartSnap = await getDoc(cartRef);
                    
                    let firebaseCart = [];
                    if (cartSnap.exists()) {
                        firebaseCart = cartSnap.data().items || [];
                    }
                    
                    const localCart = JSON.parse(localStorage.getItem('jambaCart') || '[]');
                    
                    const mergedCart = [...firebaseCart];
                    localCart.forEach(localItem => {
                        const exists = mergedCart.find(item => item.id === localItem.id && item.size === localItem.size);
                        if (!exists) {
                            mergedCart.push(localItem);
                        }
                    });

                    setCart(mergedCart);
                    localStorage.setItem('jambaCart', JSON.stringify(mergedCart));
                    await setDoc(cartRef, { items: mergedCart }, { merge: true });
                } catch (error) {
                    console.error("Error syncing cart:", error);
                }
            }
            prevUserRef.current = user;
        };

        syncCartWithAuth();
    }, [user, isBuyNow]);

    useEffect(() => {
        const multipleAddresses = localStorage.getItem('jambaSavedAddresses'); 
        if (multipleAddresses) {
            const parsedAddresses = JSON.parse(multipleAddresses);
            if (parsedAddresses.length > 0) {
                setSavedAddresses(parsedAddresses);
            }
        } else {
            const singleAddress = localStorage.getItem('jambaDeliveryAddress');
            if (singleAddress) {
                setSavedAddresses([JSON.parse(singleAddress)]);
            }
        }
    }, []);

    const saveCartState = async (newCart) => {
        setCart(newCart);
        if (isBuyNow) {
            localStorage.setItem('jambaActiveCheckout', JSON.stringify(newCart));
        } else {
            localStorage.setItem('jambaCart', JSON.stringify(newCart));
            if (user) {
                try {
                    const cartRef = doc(db, 'carts', user.uid);
                    await setDoc(cartRef, { items: newCart }, { merge: true });
                } catch (error) {
                    console.error("Error saving cart to Firebase:", error);
                }
            }
        }
    };

    const updateQty = (index, change) => {
        const newCart = [...cart];
        let currentQty = parseInt(newCart[index].quantity) || 1;
        let newQty = currentQty + change;
        if (newQty < 1) return; 
        newCart[index].quantity = newQty;
        saveCartState(newCart); 
    };

    const setQty = (index, value) => {
        const newCart = [...cart];
        let newQty = parseInt(value);
        if (isNaN(newQty) || newQty < 1) newQty = 1; 
        newCart[index].quantity = newQty;
        saveCartState(newCart); 
    };

    const removeItem = (index) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        saveCartState(newCart); 
    };

    const validateAndApplyPromo = async () => {
        if (!promoCode.trim()) {
            setPromoMessage({ type: 'error', text: 'Please enter a promo code.' });
            return;
        }

        setPromoMessage({ type: 'info', text: 'Validating...' });

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/promocodes/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    code: promoCode, 
                    email: user ? user.email : "guest@jambawear.com" 
                })
            });

            const data = await response.json();

            if (response.ok) {
                setAppliedPromo({
                    code: promoCode.toUpperCase(),
                    type: data.type,
                    value: data.value,
                    creator_role: data.creator_role,
                    seller_email: data.seller_email
                });
                setPromoMessage({ type: 'success', text: `Promo code applied successfully!` });
            } else {
                setAppliedPromo(null);
                setPromoMessage({ type: 'error', text: data.error || 'Invalid code.' });
            }
        } catch (error) {
            setPromoMessage({ type: 'error', text: 'Failed to validate promo code.' });
        }
    };

    const removePromo = () => {
        setAppliedPromo(null);
        setPromoCode('');
        setPromoMessage({ type: '', text: '' });
    };

    const calculateTotals = () => {
        let subtotal = 0;
        let sellerEligibleSubtotal = 0;

        cart.forEach(item => {
            const itemTotal = Number(item.price) * Number(item.quantity);
            subtotal += itemTotal;

            if (appliedPromo && appliedPromo.creator_role === 'seller') {
                if (item.sellerEmail === appliedPromo.seller_email) {
                    sellerEligibleSubtotal += itemTotal;
                }
            }
        });

        let totalDiscount = 0;
        if (appliedPromo) {
            const discountValue = parseFloat(appliedPromo.value);
            
            if (appliedPromo.creator_role === 'admin') {
                totalDiscount = appliedPromo.type === 'percentage' 
                    ? subtotal * (discountValue / 100)
                    : Math.min(discountValue, subtotal);
            } else if (appliedPromo.creator_role === 'seller') {
                totalDiscount = appliedPromo.type === 'percentage' 
                    ? sellerEligibleSubtotal * (discountValue / 100)
                    : Math.min(discountValue, sellerEligibleSubtotal);
            }
        }

        const shippingFee = subtotal < 1999 ? 149 : 0;
        const finalTotal = Math.max((subtotal - totalDiscount) + shippingFee, 0);

        return { subtotal, totalDiscount, shippingFee, finalTotal };
    };

    const { subtotal, totalDiscount, shippingFee, finalTotal } = calculateTotals();

    const handleProceedToPayment = () => {
        if (!user) {
            alert("Please sign in or create an account to proceed to checkout.");
            navigate('/login');
            return;
        }

        const chosenAddress = savedAddresses[selectedAddressIndex];

        if (!chosenAddress || !chosenAddress.address1) {
            alert("Please select or add a delivery address first!");
            return;
        }

        // Just pass the appliedPromoCode, the backend will do the rest!
        navigate('/payment', {
            state: {
                cartItems: cart,
                shippingAddress: chosenAddress, 
                subtotal: subtotal,
                discount: totalDiscount,
                shippingFee: shippingFee,
                finalTotal: finalTotal,
                appliedPromoCode: appliedPromo ? appliedPromo.code : null,
                isBuyNow: isBuyNow 
            }
        });
    };

    return (
        <div className="cart-page-wrapper">
            <div className="cart-container">
                <h1 className="page-title">{isBuyNow ? "Quick Checkout" : "Your Cart"}</h1>

                {cart.length === 0 ? (
                    <div id="empty-cart-msg" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px 20px' }}>
                        <p>Your cart is currently empty.</p>
                        <button className="browse-link-btn" onClick={() => navigate('/')}>Browse Collections</button>
                    </div>
                ) : (
                    <>
                        {/* LEFT COLUMN: PRODUCTS */}
                        <div id="cart-items-container">
                            {cart.map((item, index) => (
                                <div className="cart-item" key={index}>
                                    <img 
                                        src={item.image || item.imageUrl} 
                                        className="item-img" 
                                        alt={item.title || item.name} 
                                        onClick={() => navigate(`/product/${item.id}`)}
                                        style={{ cursor: 'pointer' }}
                                        title="View Product"
                                    />
                                    <div className="item-info">
                                        <p 
                                            className="item-title"
                                            onClick={() => navigate(`/product/${item.id}`)}
                                            style={{ cursor: 'pointer' }}
                                            title="View Product"
                                        >
                                            {item.title || item.name}
                                        </p>
                                        <div className="item-meta">
                                            <span>Size: {item.size}</span>
                                            <div className="qty-wrapper">
                                                <button className="qty-btn" onClick={() => updateQty(index, -1)}>-</button>
                                                <input 
                                                    type="number" 
                                                    className="qty-input" 
                                                    value={item.quantity} 
                                                    min="1" 
                                                    onChange={(e) => setQty(index, e.target.value)} 
                                                />
                                                <button className="qty-btn" onClick={() => updateQty(index, 1)}>+</button>
                                            </div>
                                        </div>
                                        <p className="item-price">₹{(Number(item.price) * item.quantity).toLocaleString('en-IN')}</p>
                                    </div>
                                    <button className="remove-btn" onClick={() => removeItem(index)} title="Remove Item">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                            <line x1="14" y1="11" x2="14" y2="17"></line>
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* RIGHT COLUMN: ADDRESS */}
                        <div className="address-box" id="address-preview">
                            <div className="address-header">
                                <span>Select Delivery Address:</span>
                                <button className="shipping-change" style={{background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => navigate('/address')}>Manage</button>
                            </div>
                            <div id="address-content" className="address-text">
                                {savedAddresses.length > 0 ? (
                                    <div className="address-selection-list">
                                        {savedAddresses.map((addr, idx) => (
                                            <label key={idx} style={{ display: 'flex', gap: '12px', marginBottom: '15px', cursor: 'pointer', padding: '10px', border: selectedAddressIndex === idx ? '1px solid var(--accent)' : '1px solid transparent', borderRadius: '6px', background: selectedAddressIndex === idx ? '#fdfbf7' : 'transparent' }}>
                                                <input 
                                                    type="radio" 
                                                    name="delivery_address" 
                                                    checked={selectedAddressIndex === idx}
                                                    onChange={() => setSelectedAddressIndex(idx)}
                                                    style={{ marginTop: '4px', cursor: 'pointer' }}
                                                />
                                                <div style={{ lineHeight: '1.4' }}>
                                                    <strong style={{ color: 'var(--primary)' }}>{addr.name}</strong><br />
                                                    {addr.address1}, {addr.landmark && `${addr.landmark}`}<br />
                                                    {addr.district}, {addr.state} - {addr.pincode}<br />
                                                    <span style={{ color: 'var(--text-muted)' }}>Phone: {addr.phone}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="no-address">
                                        No delivery address found! <span onClick={() => navigate('/address')} style={{ color: 'red', cursor: 'pointer', textDecoration: 'underline' }}>Add details</span> before paying.
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: PROMO CODE */}
                        <div className="promo-code-box">
                            <div className="promo-header">Have a promo code?</div>
                            <div className="promo-input-group" style={{ display: 'flex', gap: '10px' }}>
                                <input 
                                    type="text" 
                                    className="promo-input" 
                                    placeholder="Enter code here" 
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                    disabled={appliedPromo !== null}
                                    style={{ flex: 1, textTransform: 'uppercase' }}
                                />
                                {appliedPromo ? (
                                    <button 
                                        className="promo-apply-btn" 
                                        onClick={removePromo}
                                        style={{ background: '#dc2626' }}
                                    >
                                        Remove
                                    </button>
                                ) : (
                                    <button 
                                        className="promo-apply-btn" 
                                        onClick={validateAndApplyPromo}
                                    >
                                        Apply
                                    </button>
                                )}
                            </div>
                            {promoMessage.text && (
                                <p style={{ 
                                    marginTop: '10px', fontSize: '13px', 
                                    color: promoMessage.type === 'success' ? '#059669' : promoMessage.type === 'error' ? '#dc2626' : '#6b7280' 
                                }}>
                                    {promoMessage.text}
                                </p>
                            )}
                        </div>

                        {/* RIGHT COLUMN: SUMMARY */}
                        <div className="summary-box" id="cart-summary">
                            <div className="summary-row">
                                <span>Subtotal</span>
                                <span>₹{subtotal.toLocaleString('en-IN')}</span>
                            </div>
                            
                            {totalDiscount > 0 && (
                                <div className="summary-row" style={{ color: '#059669', fontWeight: 'bold' }}>
                                    <span>Discount ({appliedPromo.code})</span>
                                    <span>- ₹{totalDiscount.toLocaleString('en-IN')}</span>
                                </div>
                            )}

                            <div className="summary-row">
                                <span>Delivery</span>
                                <span>{shippingFee === 0 ? 'FREE' : `₹${shippingFee.toLocaleString('en-IN')}`}</span>
                            </div>
                            
                            <div className="summary-row total-row">
                                <span>Order Total</span>
                                <span id="grand-total">₹{finalTotal.toLocaleString('en-IN')}</span>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: CHECKOUT BUTTON */}
                        <button 
                            className="proceed-btn" 
                            id="pay-btn" 
                            onClick={handleProceedToPayment}
                        >
                            PROCEED TO PAYMENT
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}