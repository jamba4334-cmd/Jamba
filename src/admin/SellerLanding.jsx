import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SellerLanding.css';

import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { API_BASE_URL } from '../apiConfig';
import { secureUpload } from '../utils/secureUpload';

export default function SellerLanding() {
    const navigate = useNavigate();

    const [showForm, setShowForm] = useState(false);
    const [formStep, setFormStep] = useState(1); 
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [uploadingTarget, setUploadingTarget] = useState(null);
    
    const [authError, setAuthError] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState("");

    const [formData, setFormData] = useState({
        ownerName: '', brandName: '', email: '', phone: '', whatsapp: '',
        hasGst: 'yes', gstNumber: '', panNumber: '', accountNumber: '', ifscCode: '',
        gstPdfUrl: '', bankProofUrl: '', maskedAadhaarUrl: ''
    });

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setAuthError("");
    };

    const handleNextStep = (e) => {
        e.preventDefault(); 
        setFormStep(2);
    };

    const handleSecureAuth = async () => {
        setIsLoggingIn(true);
        setLoginError("");
        const auth = getAuth();
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            const userEmail = result.user.email.toLowerCase();
            const token = await result.user.getIdToken();

            // SECURE FETCH: Check seller status via Python Backend
            const response = await fetch(`${API_BASE_URL}/api/v1/seller/onboarding`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === "approved") {
                    navigate('/seller'); 
                    return;
                } else if (data.status === "kyc_submitted" || data.status === "pending_kyc") {
                    navigate('/seller/kyc'); 
                    return;
                }
            }

            setFormData(prev => ({ ...prev, email: userEmail }));
            setShowForm(true);

        } catch (error) {
            console.error("Auth Error:", error);
            setLoginError("Google Sign-In failed or was blocked. Verification is required.");
        } finally {
            setIsLoggingIn(false);
        }
    };

    // 🔥 ZERO-TRUST UPDATE: Signed Upload via Python Proxy
    const handleSecureFileUpload = async (e, fieldName) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!formData.email) {
            alert("Security Error: Verified email is missing.");
            return;
        }

        setUploadingTarget(fieldName);
        try {
            const data = { secure_url: (await secureUpload(file, "kyc")).url };

            setFormData(prev => ({ ...prev, [fieldName]: data.secure_url }));
        } catch (err) {
            alert("Secure Upload failed: " + (err.message || "Unknown error"));
        } finally {
            setUploadingTarget(null);
            e.target.value = '';
        }
    };

    const handleRegistration = async (e) => {
        e.preventDefault();
        
        if (formData.hasGst === 'yes' && (!formData.gstPdfUrl || !formData.gstNumber)) {
            setAuthError("Please provide your GST Number and upload your GST Certificate.");
            return;
        }
        if (!formData.bankProofUrl || !formData.maskedAadhaarUrl) {
            setAuthError("Please upload all required banking and ID documents.");
            return;
        }

        setIsSubmitting(true);
        setAuthError("");

        try {
            const auth = getAuth();
            if (!auth.currentUser) throw new Error("Your secure session expired. Please log in again.");
            
            const token = await auth.currentUser.getIdToken();
            const isGstRegistered = formData.hasGst === 'yes';
            
            const payload = {
                ownerName: formData.ownerName,
                brandName: formData.brandName,
                phone: formData.phone,
                whatsapp: formData.whatsapp,
                role: "seller",
                kycData: {
                    hasGst: isGstRegistered,
                    gstNumber: isGstRegistered ? formData.gstNumber.toUpperCase() : 'UNREGISTERED',
                    gstPdfUrl: isGstRegistered ? formData.gstPdfUrl : null,
                    panNumber: formData.panNumber.toUpperCase(),
                    accountNumber: formData.accountNumber,
                    ifscCode: formData.ifscCode.toUpperCase(),
                    bankProofUrl: formData.bankProofUrl,
                    maskedAadhaarUrl: formData.maskedAadhaarUrl
                },
                submittedAt: new Date().toISOString()
            };

            // SECURE POST: Submit KYC details to Python Backend
            const response = await fetch(`${API_BASE_URL}/api/v1/seller/onboarding`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Submission rejected by server.");

            setIsSubmitting(false);
            setRegistrationSuccess(true);
        } catch (error) {
            setIsSubmitting(false);
            setAuthError(error?.message || "Permission Denied: Could not connect to the secured database.");
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
                            <i className="fa-solid fa-arrow-left"></i> {formStep === 2 ? 'Back to Basic Info' : 'Cancel Application'}
                        </button>
                    )}

                    <div className="seller-form-card">
                        {!registrationSuccess ? (
                            <>
                                <div className="seller-form-header">
                                    <span className="seller-eyebrow">Jamba Wear · Secured Onboarding</span>
                                    <h2 className="seller-form-title">{formStep === 1 ? 'Create Seller Account' : 'Legal & KYC Details'}</h2>
                                    <p className="seller-form-subtitle">Step {formStep} of 2 — {formStep === 1 ? 'Basic store details' : 'Verify your identity securely'}</p>
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
                                            <div className="form-group">
                                                <label>Business Email Address (Verified via Google)</label>
                                                <input type="email" name="email" value={formData.email} readOnly required style={{ background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed', border: '1px solid #d1d5db' }} />
                                            </div>

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
                                                <p><strong>Next Step:</strong> You will upload your GSTIN, Business PAN, Bank Details, and ID documents securely via our encrypted portal on the next page.</p>
                                            </div>

                                            <button type="submit" className="seller-btn-primary seller-btn-block">
                                                Continue to KYC <i className="fa-solid fa-arrow-right" style={{ marginLeft: '8px' }}></i>
                                            </button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleRegistration}>
                                            <div className="form-group">
                                                <label>Do you have a GSTIN?</label>
                                                <select name="hasGst" value={formData.hasGst} onChange={handleInputChange} className="input-box" required style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                                                    <option value="yes">Yes, I am GST Registered</option>
                                                    <option value="no">No, I sell Without GST (Unregistered Artisan)</option>
                                                </select>
                                            </div>

                                            {formData.hasGst === 'yes' ? (
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
                                                            <input type="file" accept=".pdf,image/*" onChange={(e) => handleSecureFileUpload(e, 'gstPdfUrl')} required style={{ padding: '8px' }} />
                                                        )}
                                                        {uploadingTarget === 'gstPdfUrl' && <span style={{ fontSize: '11px', color: 'var(--ws-brown)' }}>Encrypting & Uploading...</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="form-notice" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', marginBottom: '20px' }}>
                                                    <i className="fa-solid fa-circle-info"></i>
                                                    <p><strong>Without GST Mode:</strong> As an unregistered artisan, you will issue a statutory <strong>Bill of Supply</strong> instead of a Tax Invoice. No GST will be collected on your sales.</p>
                                                </div>
                                            )}

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
                                                        <input type="file" accept="image/*,.pdf" onChange={(e) => handleSecureFileUpload(e, 'bankProofUrl')} required style={{ padding: '8px' }} />
                                                    )}
                                                    {uploadingTarget === 'bankProofUrl' && <span style={{ fontSize: '11px', color: 'var(--ws-brown)' }}>Encrypting & Uploading...</span>}
                                                </div>
                                                <div className="form-group">
                                                    <label>ID Document (Masked)</label>
                                                    {formData.maskedAadhaarUrl ? (
                                                        <div style={{ padding: '10px 14px', background: '#e6f4ea', color: '#137333', borderRadius: '8px', fontSize: '13px', border: '1px solid #ceead6' }}><i className="fa-solid fa-check"></i> Uploaded</div>
                                                    ) : (
                                                        <input type="file" accept="image/*,.pdf" onChange={(e) => handleSecureFileUpload(e, 'maskedAadhaarUrl')} required style={{ padding: '8px' }} />
                                                    )}
                                                    {uploadingTarget === 'maskedAadhaarUrl' && <span style={{ fontSize: '11px', color: 'var(--ws-brown)' }}>Encrypting & Uploading...</span>}
                                                </div>
                                            </div>

                                            <button type="submit" disabled={isSubmitting} className="seller-btn-primary seller-btn-block" style={{ marginTop: '10px' }}>
                                                {isSubmitting ? 'Saving Application...' : 'Submit Application'}
                                            </button>

                                            <p className="seller-form-legal">
                                                <i className="fa-solid fa-lock"></i> All documents are stored securely via encrypted storage and used solely for platform payout routing and compliance.
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
                        <button onClick={handleSecureAuth} disabled={isLoggingIn} className="seller-btn-primary">
                            {isLoggingIn ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Authenticating...</> : "Start Selling Today"}
                        </button>
                        
                        <button onClick={handleSecureAuth} disabled={isLoggingIn} className="seller-btn-ghost">
                            {isLoggingIn ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Authenticating...</> : <><i className="fa-brands fa-google" style={{ marginRight: '8px' }}></i> Login to Dashboard</>}
                        </button>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                        <button onClick={() => navigate('/super-admin')} style={{ background: 'transparent', border: 'none', color: 'var(--ws-brown)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-lock"></i> System Admin Login
                        </button>
                    </div>

                    {loginError && (
                        <div style={{ color: '#b4544a', fontSize: '14px', marginTop: '20px', fontWeight: '500', background: '#faf0ed', padding: '10px 16px', borderRadius: '8px', display: 'inline-block' }}>
                            <i className="fa-solid fa-circle-exclamation"></i> {loginError}
                        </div>
                    )}

                    <div className="seller-trust-strip">
                        <div className="trust-item"><strong>2,400+</strong><span>Artisan sellers</span></div>
                        <div className="trust-divider" />
                        <div className="trust-item"><strong>28 States</strong><span>Nationwide delivery</span></div>
                        <div className="trust-divider" />
                        <div className="trust-item"><strong>Weekly</strong><span>Automated payouts</span></div>
                    </div>
                </div>
            </section>
        </div>
    );
}