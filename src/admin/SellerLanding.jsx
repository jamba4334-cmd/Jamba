import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SellerLanding.css';

// Firebase Imports
import { db } from '../firebase'; 
import { setDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

// Supabase Import
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function SellerLanding() {
    const navigate = useNavigate();

    const [showForm, setShowForm] = useState(false);
    const [formStep, setFormStep] = useState(1); // 1 = Basic Info, 2 = KYC Uploads
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [uploadingTarget, setUploadingTarget] = useState(null);
    
    // Auth & Form Errors
    const [authError, setAuthError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState("");

    const [formData, setFormData] = useState({
        ownerName: '',
        brandName: '',
        email: '',
        phone: '',
        whatsapp: '',
        // KYC Fields
        gstNumber: '',
        panNumber: '',
        accountNumber: '',
        ifscCode: '',
        gstPdfUrl: '',
        bankProofUrl: '',
        maskedAadhaarUrl: ''
    });

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setAuthError("");
    };

    const handleNextStep = (e) => {
        e.preventDefault(); 
        setFormStep(2);
    };

    // 🔥 SUPABASE KYC FILE UPLOAD HANDLER
    const handleSupabaseFileUpload = async (e, fieldName) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!formData.email) {
            alert("Please enter your business email address in Step 1 first before uploading files.");
            setFormStep(1);
            return;
        }

        setUploadingTarget(fieldName);
        try {
            const fileExt = file.name.split('.').pop();
            const safeEmail = formData.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const fileName = `${safeEmail}_${fieldName}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload directly to Supabase bucket 'seller-kyc-docs'
            const { data, error } = await supabase.storage
                .from('seller-kyc-docs')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                throw error;
            }

            // Retrieve the public URL from Supabase storage
            const { data: publicUrlData } = supabase.storage
                .from('seller-kyc-docs')
                .getPublicUrl(filePath);

            if (publicUrlData?.publicUrl) {
                setFormData(prev => ({ ...prev, [fieldName]: publicUrlData.publicUrl }));
            }
        } catch (err) {
            alert("Supabase Upload failed: " + (err.message || "Unknown error"));
        } finally {
            setUploadingTarget(null);
            e.target.value = '';
        }
    };

    // 🔥 ALL-IN-ONE REGISTRATION & KYC SUBMIT
    const handleRegistration = async (e) => {
        e.preventDefault();
        
        if (!formData.gstPdfUrl || !formData.bankProofUrl || !formData.maskedAadhaarUrl) {
            setAuthError("Please upload all required documents (GST, Bank Proof, and ID Document).");
            return;
        }

        setIsSubmitting(true);
        setAuthError("");

        try {
            const targetEmail = formData.email.toLowerCase().trim();
            
            // Save EVERYTHING to seller_applications using the email as ID
            await setDoc(doc(db, "seller_applications", targetEmail), {
                email: targetEmail,
                ownerName: formData.ownerName,
                brandName: formData.brandName,
                phone: formData.phone,
                whatsapp: formData.whatsapp,
                role: "seller",
                status: "kyc_submitted", 
                kycData: {
                    gstNumber: formData.gstNumber.toUpperCase(),
                    gstPdfUrl: formData.gstPdfUrl,
                    panNumber: formData.panNumber.toUpperCase(),
                    accountNumber: formData.accountNumber,
                    ifscCode: formData.ifscCode.toUpperCase(),
                    bankProofUrl: formData.bankProofUrl,
                    maskedAadhaarUrl: formData.maskedAadhaarUrl
                },
                createdAt: serverTimestamp(),
                submittedAt: new Date().toISOString()
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
            const userEmail = result.user.email.toLowerCase();

            const approvedRef = doc(db, "authorized_sellers", userEmail);
            const approvedSnap = await getDoc(approvedRef);

            if (approvedSnap.exists()) {
                navigate('/seller'); 
            } else {
                const appRef = doc(db, "seller_applications", userEmail);
                const appSnap = await getDoc(appRef);

                if (appSnap.exists()) {
                    const appData = appSnap.data();
                    if (appData.status === "kyc_submitted" || appData.status === "pending_kyc") {
                        navigate('/seller/kyc'); 
                    }
                } else {
                    await auth.signOut(); 
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
                        <button type="button" onClick={() => {
                            if (formStep === 2) setFormStep(1);
                            else setShowForm(false);
                        }} className="seller-back-link">
                            <i className="fa-solid fa-arrow-left"></i> {formStep === 2 ? 'Back to Basic Info' : 'Back to Info'}
                        </button>
                    )}

                    <div className="seller-form-card">
                        {!registrationSuccess ? (
                            <>
                                <div className="seller-form-header">
                                    <span className="seller-eyebrow">Jamba Wear · Seller Onboarding</span>
                                    <h2 className="seller-form-title">{formStep === 1 ? 'Create Seller Account' : 'Legal & KYC Details'}</h2>
                                    <p className="seller-form-subtitle">Step {formStep} of 2 — {formStep === 1 ? 'Basic store details' : 'Verify your identity & banking via Supabase'}</p>
                                    <div className="seller-progress">
                                        <span className="seller-progress-bar is-active"></span>
                                        <span className={`seller-progress-bar ${formStep === 2 ? 'is-active' : ''}`}></span>
                                    </div>
                                </div>

                                <div className="seller-form-body">
                                    {authError && (
                                        <div className="auth-error">
                                            <i className="fa-solid fa-circle-exclamation"></i> {authError}
                                        </div>
                                    )}

                                    {formStep === 1 ? (
                                        <form onSubmit={handleNextStep}>
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
                                                <p><strong>Next Step:</strong> You will upload your GSTIN, Business PAN, Bank Details, and ID documents securely to Supabase storage on the next page.</p>
                                            </div>

                                            <button type="submit" className="seller-btn-primary seller-btn-block">
                                                Continue to KYC <i className="fa-solid fa-arrow-right" style={{ marginLeft: '8px' }}></i>
                                            </button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleRegistration}>
                                            <div className="form-grid-row">
                                                <div className="form-group">
                                                    <label>GSTIN Number</label>
                                                    <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleInputChange} required placeholder="22AAAAA0000A1Z5" />
                                                </div>
                                                <div className="form-group">
                                                    <label>GST Certificate (PDF/IMG)</label>
                                                    {formData.gstPdfUrl ? (
                                                        <div style={{ padding: '10px 14px', background: '#e6f4ea', color: '#137333', borderRadius: '8px', fontSize: '13px', border: '1px solid #ceead6' }}><i className="fa-solid fa-check"></i> Uploaded</div>
                                                    ) : (
                                                        <input type="file" accept=".pdf,image/*" onChange={(e) => handleSupabaseFileUpload(e, 'gstPdfUrl')} required style={{ padding: '8px' }} />
                                                    )}
                                                    {uploadingTarget === 'gstPdfUrl' && <span style={{ fontSize: '11px', color: 'var(--ws-brown)' }}>Uploading to Supabase...</span>}
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label>Business PAN Number</label>
                                                <input type="text" name="panNumber" value={formData.panNumber} onChange={handleInputChange} required placeholder="ABCDE1234F" />
                                            </div>

                                            <div className="form-grid-row">
                                                <div className="form-group">
                                                    <label>Bank Account Number</label>
                                                    <input type="text" name="accountNumber" value={formData.accountNumber} onChange={handleInputChange} required placeholder="000000000000" />
                                                </div>
                                                <div className="form-group">
                                                    <label>Bank IFSC Code</label>
                                                    <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleInputChange} required placeholder="SBIN0001234" />
                                                </div>
                                            </div>

                                            <div className="form-grid-row">
                                                <div className="form-group">
                                                    <label>Cancelled Cheque / Passbook</label>
                                                    {formData.bankProofUrl ? (
                                                        <div style={{ padding: '10px 14px', background: '#e6f4ea', color: '#137333', borderRadius: '8px', fontSize: '13px', border: '1px solid #ceead6' }}><i className="fa-solid fa-check"></i> Uploaded</div>
                                                    ) : (
                                                        <input type="file" accept="image/*,.pdf" onChange={(e) => handleSupabaseFileUpload(e, 'bankProofUrl')} required style={{ padding: '8px' }} />
                                                    )}
                                                    {uploadingTarget === 'bankProofUrl' && <span style={{ fontSize: '11px', color: 'var(--ws-brown)' }}>Uploading to Supabase...</span>}
                                                </div>
                                                <div className="form-group">
                                                    <label>ID Document (Masked)</label>
                                                    {formData.maskedAadhaarUrl ? (
                                                        <div style={{ padding: '10px 14px', background: '#e6f4ea', color: '#137333', borderRadius: '8px', fontSize: '13px', border: '1px solid #ceead6' }}><i className="fa-solid fa-check"></i> Uploaded</div>
                                                    ) : (
                                                        <input type="file" accept="image/*,.pdf" onChange={(e) => handleSupabaseFileUpload(e, 'maskedAadhaarUrl')} required style={{ padding: '8px' }} />
                                                    )}
                                                    {uploadingTarget === 'maskedAadhaarUrl' && <span style={{ fontSize: '11px', color: 'var(--ws-brown)' }}>Uploading to Supabase...</span>}
                                                </div>
                                            </div>

                                            <button type="submit" disabled={isSubmitting} className="seller-btn-primary seller-btn-block" style={{ marginTop: '10px' }}>
                                                {isSubmitting ? 'Saving Application...' : 'Submit Application'}
                                            </button>

                                            <p className="seller-form-legal">
                                                <i className="fa-solid fa-lock"></i> All documents are stored securely via Supabase and used solely for platform payout routing and compliance.
                                            </p>
                                        </form>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="success-card">
                                <div className="success-medallion">
                                    <i className="fa-solid fa-file-shield" style={{ fontSize: '32px', color: 'var(--ws-brown)' }}></i>
                                </div>
                                <h2>KYC Under Review</h2>
                                <p>Your legal documents and application for <strong>{formData.brandName}</strong> have been safely uploaded and transmitted to our administrative team.</p>
                                <p style={{ fontSize: '0.85rem', color: 'var(--ws-body)', background: 'var(--ws-muted)', padding: '12px', borderRadius: '8px' }}>
                                    Verification typically takes 24-48 hours. We will notify you via email once your storefront is ready to go live.
                                </p>
                                <button className="seller-btn-ghost" style={{ marginTop: '20px' }} onClick={() => navigate('/')}>
                                    Return to Home
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
                        
                        <button onClick={handleSellerLogin} disabled={isLoggingIn} className="seller-btn-ghost">
                            {isLoggingIn ? (
                                <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Authenticating...</>
                            ) : (
                                <><i className="fa-brands fa-google" style={{ marginRight: '8px' }}></i> Login to Dashboard</>
                            )}
                        </button>
                    </div>

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
                            <p>Create an account and submit your KYC documents safely via Supabase.</p>
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