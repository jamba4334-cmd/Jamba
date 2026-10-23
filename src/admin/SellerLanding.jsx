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
    const [uploadingTarget, setUploadingTarget] = useState(null);
    
    // Lifecycle States
    const [sellerStatus, setSellerStatus] = useState(null); // 'review', 'approved', 'rejected', 'blacklisted'
    const [applicationData, setApplicationData] = useState(null);
    
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

            // SECURE FETCH: Check seller status
            const response = await fetch(`${API_BASE_URL}/api/v1/seller/onboarding`, {
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            
            if (response.ok) {
                const data = await response.json();
                setApplicationData(data.application || null);

                if (data.status === "approved") {
                    setSellerStatus("approved");
                    return;
                } else if (data.status === "kyc_submitted" || data.status === "pending_kyc") {
                    setSellerStatus("review");
                    return;
                } else if (data.status === "rejected") {
                    setSellerStatus("rejected");
                    return;
                } else if (data.status === "blacklisted") {
                    setSellerStatus("blacklisted");
                    return;
                }
            }

            setFormData(prev => ({ ...prev, email: userEmail }));
            setShowForm(true);

        } catch (error) {
            console.error("Auth Error:", error);
            setLoginError("Google Sign-In failed or was blocked.");
        } finally {
            setIsLoggingIn(false);
        }
    };

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

            const response = await fetch(`${API_BASE_URL}/api/v1/seller/onboarding`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 403) throw new Error("Account blacklisted due to multiple rejections.");
                throw new Error("Submission rejected by server.");
            }

            setIsSubmitting(false);
            setShowForm(false);
            setSellerStatus("review"); // Transition straight to the review card
            
        } catch (error) {
            setIsSubmitting(false);
            setAuthError(error?.message || "Permission Denied: Could not connect to the secured database.");
        }
    };

    // ==========================================
    // DYNAMIC STATUS CARD RENDERER
    // ==========================================
    const renderStatusCard = () => {
        let icon = "fa-file-shield";
        let iconColor = "var(--ws-brown)";
        let title = "KYC Under Review";
        let message = `Your legal documents and application for ${applicationData?.brandName || formData.brandName || "JAMBA WEAR"} have been safely uploaded.`;
        let subText = "Verification typically takes 24-48 hours. We will notify you via email once your storefront is ready to go live.";
        let buttonText = "Return to Home";
        let buttonAction = () => navigate('/');
        let buttonClass = "seller-btn-ghost";

        if (sellerStatus === "approved") {
            icon = "fa-circle-check";
            iconColor = "#166534";
            title = "Congratulations!";
            message = "You are now an official seller of JAMBA WEAR. Your storefront is ready!";
            subText = "Start uploading your products and managing your inventory.";
            buttonText = "Go to Seller Dashboard";
            buttonAction = () => navigate('/seller');
            buttonClass = "seller-btn-primary";
        } else if (sellerStatus === "rejected") {
            icon = "fa-triangle-exclamation";
            iconColor = "#991b1b";
            title = "Application Rejected";
            message = "We are sorry, you have not fulfilled the requirements to be a seller.";
            const attemptsUsed = applicationData?.rejectionCount || 1;
            subText = `You have used ${attemptsUsed} of 5 application attempts. Please correct your documents before trying again.`;
            buttonText = "Re-Submit Application";
            buttonAction = () => { setSellerStatus(null); setShowForm(true); };
            buttonClass = "seller-btn-primary";
        } else if (sellerStatus === "blacklisted") {
            icon = "fa-ban";
            iconColor = "#991b1b";
            title = "Account Blacklisted";
            message = "Your account has been permanently restricted from the seller program.";
            subText = "You have exceeded the maximum number of rejected applications (5). Contact support for further assistance.";
            buttonText = "Return to Home";
            buttonAction = () => navigate('/');
            buttonClass = "seller-btn-ghost";
        }

        return (
            <div className="seller-form-page">
                <div style={{ width: '100%', maxWidth: '540px', background: 'var(--ws-cream)', padding: '48px 40px', borderRadius: '16px', border: '1px solid var(--ws-line)', boxShadow: 'var(--ws-shadow)', textAlign: 'center', margin: '0 auto' }}>
                    
                    <div style={{ width: '80px', height: '80px', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--ws-sand)', border: '1px solid var(--ws-line)' }}>
                        <i className={`fa-solid ${icon}`} style={{ fontSize: '36px', color: iconColor }}></i>
                    </div>
                    
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '600', margin: '0 0 16px', color: 'var(--ws-ink)', letterSpacing: '-0.02em' }}>{title}</h2>
                    <p style={{ color: 'var(--ws-body)', fontSize: '1.05rem', lineHeight: '1.6', margin: '0 0 32px' }}>{message}</p>
                    
                    {sellerStatus === "rejected" && applicationData?.rejectionReason && (
                        <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '24px', textAlign: 'left' }}>
                            <p style={{ fontSize: '0.9rem', color: '#991b1b', margin: 0, fontWeight: '600' }}><strong>Admin Note:</strong> {applicationData.rejectionReason}</p>
                        </div>
                    )}
                    
                    <div style={{ background: 'var(--ws-muted)', padding: '16px', borderRadius: '8px', border: '1px solid var(--ws-line)', marginBottom: '32px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--ws-body)', margin: 0, lineHeight: '1.5' }}>
                            {(sellerStatus === "review" || sellerStatus === "rejected") && <i className="fa-solid fa-circle-info" style={{ color: 'var(--ws-brown)', marginRight: '6px' }}></i>}
                            {subText}
                        </p>
                    </div>
                    
                    <button className={buttonClass} style={{ width: '100%' }} onClick={buttonAction}>{buttonText}</button>
                </div>
            </div>
        );
    };

    if (sellerStatus) return renderStatusCard();

    // ==========================================
    // FORM RENDERER
    // ==========================================
    if (showForm) {
        return (
            <div className="seller-form-page">
                <div className="seller-form-shell">
                    <button type="button" onClick={() => {
                        if (formStep === 2) setFormStep(1);
                        else setShowForm(false);
                    }} className="seller-back-link">
                        <i className="fa-solid fa-arrow-left"></i> {formStep === 2 ? 'Back to Basic Info' : 'Cancel Application'}
                    </button>

                    <div className="seller-form-card">
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