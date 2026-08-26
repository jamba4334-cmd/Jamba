import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { API_BASE_URL } from '../apiConfig';
// Importing the styling file we just created!
import './SellerSubscription.css';

export default function SellerSubscription() {
    const navigate = useNavigate();
    const auth = getAuth();
    const user = auth.currentUser;

    // Toggle for Monthly vs Annual billing
    const [billingCycle, setBillingCycle] = useState('annual');
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Sample trial status
    const [trialInfo] = useState({
        isTrialActive: true,
        daysRemaining: 48,
        trialEndDate: 'Nov 15, 2026'
    });

    const handleSubscribe = async () => {
        if (!user) {
            alert('Please login to subscribe.');
            return;
        }

        setIsProcessing(true);

        try {
            // This will call the Razorpay Python backend later!
            const response = await fetch(`${API_BASE_URL}/api/v1/seller/subscription/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    plan: billingCycle === 'annual' ? 'annual_799' : 'monthly_999'
                })
            });

            const data = await response.json();

            if (response.ok && data.subscription_id) {
                const options = {
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                    subscription_id: data.subscription_id,
                    name: "JAMBA WEAR",
                    description: `${billingCycle === 'annual' ? 'Annual (₹799/mo)' : 'Monthly (₹999/mo)'} Flagship Storefront`,
                    handler: function (razorpayResponse) {
                        alert("Subscription activated successfully!");
                        navigate('/admin');
                    },
                    prefill: { email: user.email || "" },
                    theme: { color: "#2d2a26" }
                };

                const rzp = new window.Razorpay(options);
                rzp.open();
            } else {
                alert(data.error || 'Failed to initialize subscription checkout. Is the backend running?');
            }
        } catch (error) {
            console.error('Subscription error:', error);
            alert('Error connecting to subscription server.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="sub-page-wrapper">
            <div className="sub-container">
                <div className="sub-header">
                    <span className="sub-eyebrow">Seller Plans &amp; Storefronts</span>
                    <h1 className="sub-title">Scale Your Craft With a Flagship Store</h1>
                    <p className="sub-subtitle">Start with 3 months free. Build a branded destination with custom URLs, video banners, and advanced sales analytics.</p>

                    {trialInfo.isTrialActive && (
                        <div className="trial-badge-banner">
                            <i className="fa-solid fa-clock-rotate-left"></i>
                            <span>You are currently on the <strong>3-Month Free Trial</strong> ({trialInfo.daysRemaining} days remaining until {trialInfo.trialEndDate}).</span>
                        </div>
                    )}

                    <div className="billing-toggle-wrapper">
                        <span className={billingCycle === 'monthly' ? 'toggle-label active' : 'toggle-label'}>Monthly</span>
                        <button 
                            type="button"
                            className={`toggle-switch ${billingCycle === 'annual' ? 'annual-active' : ''}`}
                            onClick={() => setBillingCycle(billingCycle === 'annual' ? 'monthly' : 'annual')}
                        >
                            <span className="toggle-slider"></span>
                        </button>
                        <span className={billingCycle === 'annual' ? 'toggle-label active' : 'toggle-label'}>
                            Annual <span className="save-pill">Save 20%</span>
                        </span>
                    </div>
                </div>

                <div className="pricing-grid">
                    {/* Free Plan Card */}
                    <div className="pricing-card">
                        <div className="card-header">
                            <h3 className="plan-name">Artisan Starter</h3>
                            <p className="plan-desc">Essential marketplace listing for emerging weavers and artisans.</p>
                            <div className="price-box">
                                <span className="price-amount">₹0</span>
                                <span className="price-period">/ 3 Months Free</span>
                            </div>
                        </div>
                        <div className="card-features">
                            <ul>
                                <li><i className="fa-solid fa-check"></i> Standard marketplace catalog listing</li>
                                <li><i className="fa-solid fa-check"></i> Up to 30 active product listings</li>
                                <li className="feature-disabled"><i className="fa-solid fa-xmark"></i> Custom video &amp; texture hero banners</li>
                                <li className="feature-disabled"><i className="fa-solid fa-xmark"></i> Vanity store handle (<code>/shop/YourBrand</code>)</li>
                            </ul>
                        </div>
                        <div className="card-footer">
                            <button className="sub-btn-secondary" disabled>Current Free Plan</button>
                        </div>
                    </div>

                    {/* Pro Plan Card */}
                    <div className="pricing-card featured">
                        <div className="featured-badge">MOST POPULAR</div>
                        <div className="card-header">
                            <h3 className="plan-name">Flagship Storefront</h3>
                            <p className="plan-desc">Full brand autonomy, vanity URLs, custom aesthetics, and dedicated growth tools.</p>
                            <div className="price-box">
                                <span className="price-amount">₹{billingCycle === 'annual' ? '799' : '999'}</span>
                                <span className="price-period">/ month</span>
                            </div>
                        </div>
                        <div className="card-features">
                            <ul>
                                <li><i className="fa-solid fa-check"></i> <strong>Dedicated Brand Storefront Builder</strong></li>
                                <li><i className="fa-solid fa-check"></i> <strong>Vanity URL:</strong> <code>jambawear.com/shop/YourBrand</code></li>
                                <li><i className="fa-solid fa-check"></i> Custom high-res video &amp; woven texture banners</li>
                                <li><i className="fa-solid fa-check"></i> <strong>Unlimited</strong> product inventory uploads</li>
                            </ul>
                        </div>
                        <div className="card-footer">
                            <button className="sub-btn-primary" onClick={handleSubscribe} disabled={isProcessing}>
                                {isProcessing ? 'Connecting...' : `Upgrade to Flagship • ₹${billingCycle === 'annual' ? '799' : '999'}/mo`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}