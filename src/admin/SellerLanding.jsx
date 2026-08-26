import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SellerLanding.css';

// Firebase Imports
import { db } from '../firebase'; 
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function SellerLanding() {
    const navigate = useNavigate();

    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    
    // Auth & Form Errors
    const [authError, setAuthError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState("");

    const [formData, setFormData] = useState({
        ownerName: '',
        brandName: '',
        email: '',
        phone: '',
        whatsapp: ''
    });

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setAuthError("");
    };

    // 🔥 REGISTRATION LOGIC
    const handleRegistration = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setAuthError("");

        try {
            await addDoc(collection(db, "users"), {
                email: formData.email,
                ownerName: formData.ownerName,
                brandName: formData.brandName,
                phone: formData.phone,
                whatsapp: formData.whatsapp,
                role: "seller",
                kyc_status: "pending_kyc", 
                createdAt: serverTimestamp()
            });

            setIsSubmitting(false);
            setRegistrationSuccess(true);
        } catch (error) {
            setIsSubmitting(false);
            setAuthError(error?.message || "Something went wrong while connecting to the database.");
        }
    };

    // 🔥 SMART SELLER LOGIN LOGIC
    const handleSellerLogin = async () => {
        setIsLoggingIn(true);
        setLoginError("");
        const auth = getAuth();
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            const userEmail = result.user.email;

            // 1. Check if they are an officially Approved Seller
            const approvedRef = doc(db, "authorized_sellers", userEmail);
            const approvedSnap = await getDoc(approvedRef);

            if (approvedSnap.exists()) {
                navigate('/seller'); // Send to active Seller Dashboard
            } else {
                // 2. Check if they are registered but pending KYC approval
                const q = query(collection(db, "users"), where("email", "==", userEmail), where("role", "==", "seller"));
                const pendingSnap = await getDocs(q);

                if (!pendingSnap.empty) {
                    navigate('/seller/kyc'); // Send to KYC upload/status page
                } else {
                    // 3. Not found in either database
                    await auth.signOut(); // Kick them out immediately
                    setLoginError("No seller account found for this email. Please register below.");
                }
            }
        } catch (error) {
            console.error(error);
            setLoginError("Authentication failed. Please try again.");
        } finally {
            setIsLoggingIn(false);
        }
    };

    if (showForm) {
        return (
            <div className="seller-form-page">
                <div className="seller-form-shell">
                    {!registrationSuccess && (
                        <button type="button" onClick={() => setShowForm(false)} className="seller-back-link">
                            <i className="fa-solid fa-arrow-left"></i> Back to Info
                        </button>
                    )}

                    <div className="seller-form-card">
                        {!registrationSuccess ? (
                            <>
                                <div className="seller-form-header">
                                    <span className="seller-eyebrow">Jamba Wear · Seller Onboarding</span>
                                    <h2 className="seller-form-title">Create Seller Account</h2>
                                    <p className="seller-form-subtitle">Step 1 of 2 — Basic store details</p>
                                    <div className="seller-progress">
                                        <span className="seller-progress-bar is-active"></span>
                                        <span className="seller-progress-bar"></span>
                                    </div>
                                </div>

                                <div className="seller-form-body">
                                    {authError && (
                                        <div className="auth-error">
                                            <i className="fa-solid fa-circle-exclamation"></i> {authError}
                                        </div>
                                    )}

                                    <form onSubmit={handleRegistration}>
                                        <div className="form-grid-row">
                                            <div className="form-group">
                                                <label>Brand / Store Name</label>
                                                <input type="text" name="brandName" value={formData.brandName} onChange={handleInputChange} required placeholder="e.g. Bodo Weavers" />
                                            </div>
                                            <div className="form-group">
                                                <label>Owner Full Name</label>
                                                <input type="text" name="ownerName" value={formData.ownerName} onChange={handleInputChange} required placeholder="John Doe" />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>Business Email Address</label>
                                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} required placeholder="store@example.com" />
                                        </div>

                                        <div className="form-grid-row">
                                            <div className="form-group">
                                                <label>Phone Number</label>
                                                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required minLength={10} maxLength={10} placeholder="9876543210" />
                                            </div>
                                            <div className="form-group">
                                                <label>WhatsApp Number</label>
                                                <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} required minLength={10} maxLength={10} placeholder="9876543210" />
                                            </div>
                                        </div>

                                        <div className="form-notice">
                                            <i className="fa-solid fa-file-shield"></i>
                                            <p><strong>Document Prep Checklist:</strong> After submitting your details, you will need to upload your GSTIN (or Enrolment No.), Business PAN, Bank Details, and a valid Government ID.</p>
                                        </div>

                                        <button type="submit" disabled={isSubmitting} className="seller-btn-primary seller-btn-block">
                                            {isSubmitting ? 'Saving Profile...' : 'Submit & Continue to KYC'}
                                        </button>

                                        <p className="seller-form-legal">
                                            <i className="fa-solid fa-lock"></i> Your details are encrypted and reviewed only by our verification team.
                                        </p>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="success-card">
                                <div className="success-medallion">
                                    <i className="fa-solid fa-circle-check"></i>
                                </div>
                                <h2>Account Created!</h2>
                                <p>Your basic profile for <strong>{formData.brandName}</strong> has been saved. You are now ready to upload your KYC documents.</p>
                                <button className="btn-success" onClick={() => navigate('/seller/kyc')}>
                                    Proceed to Document Upload <i className="fa-solid fa-arrow-right" style={{ marginLeft: '8px' }}></i>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="seller-landing-container">
            <section className="seller-hero">
                <div className="seller-hero-inner">
                    <span className="seller-eyebrow seller-eyebrow-light">The marketplace for authentic traditional fashion</span>
                    <h1>Elevate Your Craft. <br /> Take Your Brand Global.</h1>
                    <p>
                        Join Jamba Wear, the premier marketplace for authentic traditional fashion. Reach thousands of customers across India, manage your inventory effortlessly, and grow your business today.
                    </p>
                    <div className="seller-hero-actions">
                        <button onClick={() => setShowForm(true)} className="seller-btn-primary">
                            Start Selling Today
                        </button>
                        
                        {/* Seller Dashboard Login */}
                        <button onClick={handleSellerLogin} disabled={isLoggingIn} className="seller-btn-ghost">
                            {isLoggingIn ? (
                                <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Authenticating...</>
                            ) : (
                                <><i className="fa-brands fa-google" style={{ marginRight: '8px' }}></i> Login to Dashboard</>
                            )}
                        </button>
                    </div>

                    {/* 🔥 NEW: SUPER ADMIN PORTAL LINK 🔥 */}
                    <div style={{ marginTop: '20px' }}>
                        <button 
                            onClick={() => navigate('/super-admin')} 
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--ws-brown)', 
                                fontSize: '13px', 
                                cursor: 'pointer', 
                                textDecoration: 'underline',
                                fontWeight: '500',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <i className="fa-solid fa-lock"></i> System Admin Login
                        </button>
                    </div>

                    {/* Login Error Display */}
                    {loginError && (
                        <div style={{ color: '#b4544a', fontSize: '14px', marginTop: '20px', fontWeight: '500', background: '#faf0ed', padding: '10px 16px', borderRadius: '8px', display: 'inline-block' }}>
                            <i className="fa-solid fa-circle-exclamation"></i> {loginError}
                        </div>
                    )}

                    <div className="seller-trust-strip">
                        <div className="trust-item">
                            <strong>2,400+</strong>
                            <span>Artisan sellers</span>
                        </div>
                        <div className="trust-divider" />
                        <div className="trust-item">
                            <strong>28 States</strong>
                            <span>Nationwide delivery</span>
                        </div>
                        <div className="trust-divider" />
                        <div className="trust-item">
                            <strong>Weekly</strong>
                            <span>Automated payouts</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="seller-section">
                <span className="seller-eyebrow seller-eyebrow-center">Why partner with us</span>
                <h2 className="seller-section-title">Why Sell on Jamba Wear?</h2>
                <div className="benefits-grid">
                    <div className="benefit-card">
                        <span className="benefit-badge"><i className="fa-solid fa-truck-fast"></i></span>
                        <h3>Hassle-Free Shipping</h3>
                        <p>You pack the product, we pick it up. Our integrated courier partners handle the nationwide logistics.</p>
                    </div>
                    <div className="benefit-card">
                        <span className="benefit-badge"><i className="fa-solid fa-wallet"></i></span>
                        <h3>Secure Payouts</h3>
                        <p>Track your earnings in real-time. Automated settlements are sent directly to your bank account securely.</p>
                    </div>
                    <div className="benefit-card">
                        <span className="benefit-badge"><i className="fa-solid fa-percent"></i></span>
                        <h3>Zero Upfront Fees</h3>
                        <p>No hidden listing charges. We only earn a small platform commission when you successfully make a sale.</p>
                    </div>
                </div>
            </section>

            <div className="steps-wrapper">
                <section className="seller-section">
                    <span className="seller-eyebrow seller-eyebrow-center">Three simple steps</span>
                    <h2 className="seller-section-title">How It Works</h2>
                    <div className="steps-grid">
                        <div className="step-item">
                            <div className="step-number">1</div>
                            <h4>Register &amp; Verify</h4>
                            <p>Create an account and submit your KYC documents (GSTIN, PAN, Bank Details).</p>
                        </div>
                        <div className="step-item">
                            <div className="step-number">2</div>
                            <h4>Get Approved</h4>
                            <p>Our admin team verifies your profile to ensure platform quality and legal compliance.</p>
                        </div>
                        <div className="step-item">
                            <div className="step-number">3</div>
                            <h4>Go Live &amp; Earn</h4>
                            <p>Upload your products through your dedicated portal and start receiving orders!</p>
                        </div>
                    </div>
                </section>
            </div>

            <section className="seller-cta-band">
                <div className="seller-cta-inner">
                    <h2>Ready to put your craft in front of India?</h2>
                    <p>Registration takes under three minutes. No listing fees, ever.</p>
                    <button onClick={() => setShowForm(true)} className="seller-btn-primary">
                        Start Selling Today
                    </button>
                </div>
            </section>
        </div>
    );
}