import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../apiConfig.js"; 
import "../styles/Sellers.css";

// 🔥 FIXED: Removed local db import to prevent connection collisions
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';

import SellerStorefrontEditor from '../../admin/SellerStorefrontEditor'; 

// 🔥 FIXED: Accepting 'db' as a prop directly from AdminLayout
export default function SellersTab({ db, getAuthHeaders, globalSellers = [], liveProducts = [], orders = [], loadAuthorizedSellers }) {
    const [mainViewTab, setMainViewTab] = useState("directory"); 

    const [newSellerEmail, setNewSellerEmail] = useState("");
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [sellerModalTab, setSellerModalTab] = useState("profile");
    const [sellerPayouts, setSellerPayouts] = useState([]);
    const [editProfileData, setEditProfileData] = useState({});
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Onboarding States
    const [pendingApplications, setPendingApplications] = useState([]);
    const [isLoadingApplications, setIsLoadingApplications] = useState(false);
    const [applicationError, setApplicationError] = useState("");

    // Storefront Monitor States
    const [storefronts, setStorefronts] = useState([]);
    const [isLoadingStorefronts, setIsLoadingStorefronts] = useState(false);
    const [editingSellerEmail, setEditingSellerEmail] = useState(null);

    // --- Fetch Pending Applications ---
    useEffect(() => {
        if (mainViewTab === "onboarding") {
            fetchApplications();
        }
    }, [mainViewTab]);

    const fetchApplications = async () => {
        setIsLoadingApplications(true);
        setApplicationError(""); 
        try {
            if (!db) {
                setApplicationError("Firebase DB instance is missing.");
                setIsLoadingApplications(false);
                return;
            }
            
            const querySnapshot = await getDocs(collection(db, "seller_applications"));
            
            const appsData = [];
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.status === 'kyc_submitted' || data.status === 'pending_kyc') {
                    appsData.push({ id: docSnap.id, ...data });
                }
            });
            
            setPendingApplications(appsData);
        } catch (error) {
            console.error("Error fetching pending applications:", error);
            setApplicationError(error.message || "Failed to load applications.");
        } finally {
            setIsLoadingApplications(false);
        }
    };

    // --- Fetch Live Storefronts ---
    useEffect(() => {
        if (mainViewTab === "storefronts" && !editingSellerEmail) {
            fetchStorefronts();
        }
    }, [mainViewTab, editingSellerEmail]);

    const fetchStorefronts = async () => {
        setIsLoadingStorefronts(true);
        try {
            const profilesSnap = await getDocs(collection(db, "seller_profiles"));
            const stores = [];
            profilesSnap.forEach(profileDoc => {
                const data = profileDoc.data();
                if (data.storefront) {
                    stores.push({
                        sellerEmail: profileDoc.id,
                        ...data.storefront
                    });
                }
            });
            setStorefronts(stores);
        } catch (error) {
            console.error("Error fetching storefronts:", error);
        } finally {
            setIsLoadingStorefronts(false);
        }
    };

    const toggleStoreSuspension = async (sellerEmail, currentStatus) => {
        if (!window.confirm(`Are you sure you want to ${currentStatus ? 'enable' : 'suspend'} this storefront?`)) return;
        try {
            const profileRef = doc(db, "seller_profiles", sellerEmail);
            await updateDoc(profileRef, {
                "storefront.isSuspended": !currentStatus
            });
            setStorefronts(prev => prev.map(store => 
                store.sellerEmail === sellerEmail ? { ...store, isSuspended: !currentStatus } : store
            ));
        } catch (error) {
            alert("Failed to update store status.");
        }
    };

    // --- Action Handlers: Onboarding ---
    const handleApproveApplication = async (app) => {
        if (!window.confirm(`Are you sure you want to approve ${app.brandName}?`)) return;
        
        try {
            await setDoc(doc(db, 'authorized_sellers', app.email), {
                email: app.email,
                brandName: app.brandName,
                ownerName: app.ownerName,
                phone: app.phone || '',
                approvedAt: new Date().toISOString(),
                kycData: app.kycData || null
            });
            
            await updateDoc(doc(db, "seller_applications", app.id), { status: "approved" });
            
            try {
                const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
                await fetch(`${API_BASE_URL}/admin/sellers`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({ email: app.email })
                });
            } catch (fetchError) {
                console.warn("Backend Python API sync failed (Server might be off), but Firebase approval succeeded.", fetchError);
            }

            if (window.showToast) window.showToast(`${app.brandName} approved!`);
            fetchApplications();
            if (typeof loadAuthorizedSellers === 'function') loadAuthorizedSellers(); 
        } catch (error) {
            console.error("Error approving seller:", error);
            alert(`Approval Failed: ${error.message}`);
        }
    };

    const handleRejectApplication = async (appId) => {
        const reason = window.prompt("Enter the reason for rejection (this will be shown to the seller):");
        if (reason === null) return; 

        try {
            await updateDoc(doc(db, "seller_applications", appId), { 
                status: "rejected",
                rejectionReason: reason || "Your application did not meet our platform requirements.",
                rejectedAt: new Date().toISOString()
            });
            fetchApplications();
            if (window.showToast) window.showToast("Application rejected.");
        } catch (error) {
            console.error("Error rejecting application:", error);
            alert(`Rejection Failed: ${error.message}`);
        }
    };

    // --- Action Handlers: Sellers ---
    const handleAddSeller = async (e) => {
        e.preventDefault();
        const email = newSellerEmail.trim().toLowerCase();
        if (!email) return;

        setIsAuthorizing(true);
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            await fetch(`${API_BASE_URL}/admin/sellers`, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({ email: email })
            });
            if (window.showToast) window.showToast(`${email} has been authorized!`);
            setNewSellerEmail("");
            if (typeof loadAuthorizedSellers === 'function') loadAuthorizedSellers(); 
        } catch(err) {
            alert("Error authorizing seller: " + err.message);
        } finally {
            setIsAuthorizing(false);
        }
    };

    const handleRemoveSeller = async (email) => {
        if (window.confirm(`Are you absolutely sure you want to revoke access for ${email}?`)) {
            try {
                const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
                await fetch(`${API_BASE_URL}/admin/sellers/${email}`, { method: "DELETE", headers: headers });
                if (window.showToast) window.showToast(`Access revoked for ${email}`);
                if (typeof loadAuthorizedSellers === 'function') loadAuthorizedSellers();
            } catch(e) {
                alert("Error removing seller: " + e.message);
            }
        }
    };

    // --- Action Handlers: Modal ---
    const openSellerDetails = async (seller) => {
        const myProducts = (liveProducts || []).filter(p => p.sellerEmail === seller.email || p.brandName === seller.profile?.brandName);
        
        const myOrders = (orders || []).filter(o => {
            if (!o.items) return false;
            return o.items.some(orderItem => {
                const matchesStamp = (orderItem.sellerEmail && orderItem.sellerEmail === seller.email) || 
                                     (orderItem.brandName && seller.profile?.brandName && orderItem.brandName === seller.profile?.brandName);
                const matchesLiveProduct = myProducts.some(myProduct => myProduct.docId === orderItem.id || myProduct.item_id === orderItem.item_id || myProduct.title === orderItem.title);
                return matchesStamp || matchesLiveProduct;
            });
        });

        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            
            let fetchedProfile = {};
            const profileRes = await fetch(`${API_BASE_URL}/admin/seller_profiles/${seller.email}`, { headers });
            if (profileRes.ok) {
                fetchedProfile = await profileRes.json();
            }

            let fetchedPayouts = [];
            const payoutsRes = await fetch(`${API_BASE_URL}/admin/payouts?email=${seller.email}`, { headers });
            if (payoutsRes.ok) {
                fetchedPayouts = await payoutsRes.json();
            }
            setSellerPayouts(fetchedPayouts);

            const sellerWithData = { ...seller, products: myProducts, orders: myOrders, profile: fetchedProfile };
            setSelectedSeller(sellerWithData);
            setEditProfileData(fetchedProfile); 
            setSellerModalTab("profile");
            document.body.style.overflow = "hidden"; 

        } catch(e) {
            console.error("Error loading complete seller portfolio", e);
            alert("Failed to load seller data securely. Check connection.");
        }
    };

    const closeSellerModal = () => {
        setSelectedSeller(null);
        document.body.style.overflow = "auto";
    };

    const handleProfileChange = (e) => {
        setEditProfileData({ ...editProfileData, [e.target.name]: e.target.value });
    };

    const handleSaveSellerProfile = async (e) => {
        e.preventDefault();
        setIsSavingProfile(true);

        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            await fetch(`${API_BASE_URL}/admin/seller_profiles/${selectedSeller.email}`, {
                method: "PUT",
                headers: headers,
                body: JSON.stringify(editProfileData)
            });
            
            setSelectedSeller(prev => ({...prev, profile: editProfileData}));
            if (window.showToast) window.showToast("Seller Profile Updated Securely!");
            if (typeof loadAuthorizedSellers === 'function') loadAuthorizedSellers(); 
        } catch (err) {
            alert("Error updating profile: " + err.message);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleMarkPayoutPaid = async (payoutId) => {
        const utr = window.prompt("Enter Bank Transfer UTR/Reference Number:");
        if (!utr) return;

        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            await fetch(`${API_BASE_URL}/admin/payouts/${payoutId}`, {
                method: "PUT",
                headers: headers,
                body: JSON.stringify({
                    status: 'paid',
                    utr: utr,
                    paid_at: new Date().toISOString()
                })
            });
            
            setSellerPayouts(prev => prev.map(p => p.id === payoutId ? { ...p, status: 'paid', utr: utr } : p));
            if (window.showToast) window.showToast("Payout Marked as Paid Securely!");
        } catch(e) {
            alert("Error updating payout: " + e.message);
        }
    };

    return (
        <div className="content-section active sellers-container">
            <span className="section-title" style={{ marginBottom: '16px', display: 'block' }}>Seller Directory</span>
            
            <div className="seller-sub-nav">
                <button 
                    type="button"
                    onClick={() => setMainViewTab("directory")}
                    className={`seller-sub-nav-btn ${mainViewTab === "directory" ? "active" : ""}`}
                >
                    <i className="fa-solid fa-address-book"></i> Active Sellers
                </button>
                <button 
                    type="button"
                    onClick={() => setMainViewTab("onboarding")}
                    className={`seller-sub-nav-btn ${mainViewTab === "onboarding" ? "active" : ""}`}
                >
                    <i className="fa-solid fa-user-clock"></i> Pending Applications
                    {pendingApplications.length > 0 && (
                        <span className="seller-badge">
                            {pendingApplications.length}
                        </span>
                    )}
                </button>
                <button 
                    type="button"
                    onClick={() => setMainViewTab("storefronts")}
                    className={`seller-sub-nav-btn ${mainViewTab === "storefronts" ? "active" : ""}`}
                >
                    <i className="fa-solid fa-store"></i> Live Storefronts
                </button>
            </div>

            {/* TAB 1: ACTIVE SELLERS DIRECTORY */}
            {mainViewTab === "directory" && (
                <>
                    <p className="text-helper" style={{ marginBottom: '20px' }}>Only Google Emails added to this list will be allowed to log into the JAMBAWEAR Seller Portal.</p>

                    <form className="card" style={{ marginBottom: '24px' }} onSubmit={handleAddSeller}>
                        <span className="section-subtitle">Authorize New Partner</span>
                        <div className="field-grid" style={{ alignItems: 'end' }}>
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                <span className="label">Partner's Google Email</span>
                                <input 
                                    type="email" 
                                    className="input-box" 
                                    placeholder="e.g. bodo.weavers@gmail.com" 
                                    value={newSellerEmail}
                                    onChange={(e) => setNewSellerEmail(e.target.value)}
                                    required 
                                />
                            </div>
                            <button type="submit" disabled={isAuthorizing} className="btn-submit" style={{ width: 'auto', padding: '10px 24px', margin: 0 }}>
                                {isAuthorizing ? <><i className="fa-solid fa-spinner fa-spin"></i> Authorizing...</> : "Authorize Partner"}
                            </button>
                        </div>
                    </form>

                    <span className="section-subtitle">Currently Authorized Sellers</span>
                    <div style={{ marginTop: '16px' }}>
                        {globalSellers.length === 0 ? (
                            <p style={{ padding: '20px', fontWeight: '500', color: 'var(--text-muted)' }}>No sellers currently authorized.</p>
                        ) : (
                            globalSellers.map(seller => {
                                const brandName = seller.profile?.brandName || "Profile Not Setup";
                                const sellerName = seller.profile?.sellerName || "Unknown Owner";

                                return (
                                    <div key={seller.email} className="seller-list-item">
                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                            <div className="seller-avatar-wrapper">
                                                {seller.profile?.profilePhoto ? (
                                                    <img src={seller.profile.profilePhoto} loading="lazy" alt="Avatar" />
                                                ) : (
                                                    brandName.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="seller-info-block">
                                                <strong>{brandName}</strong><br/>
                                                <span className="seller-info-meta">
                                                    <i className="fa-solid fa-user"></i> {sellerName} &nbsp;|&nbsp; 
                                                    <i className="fa-solid fa-envelope" style={{marginLeft: '6px'}}></i> {seller.email}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="seller-action-group">
                                            <button type="button" className="action-btn btn-status-active" onClick={() => openSellerDetails(seller)}>
                                                <i className="fa-solid fa-folder-open"></i> Manage Store
                                            </button>
                                            <button type="button" className="action-btn" style={{color: 'var(--danger)', borderColor: 'var(--danger-light)'}} onClick={() => handleRemoveSeller(seller.email)}>
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* TAB 2: PENDING ONBOARDING QUEUE */}
            {mainViewTab === "onboarding" && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                            <span className="section-subtitle" style={{ margin: 0, padding: 0 }}>Merchant Onboarding Requests</span>
                            <p className="text-helper" style={{ margin: '4px 0 0 0' }}>Review submitted seller details, verify documents, and approve applications.</p>
                        </div>
                        <button type="button" onClick={fetchApplications} className="btn-submit" style={{ padding: '8px 16px', width: 'auto', margin: 0, backgroundColor: '#f3f4f6', color: '#111', border: '1px solid #d1d5db' }}>
                            <i className="fa-solid fa-rotate-right"></i> Refresh
                        </button>
                    </div>
                    
                    {applicationError && (
                        <div style={{ padding: '16px', marginBottom: '20px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '14px' }}>
                            <strong><i className="fa-solid fa-shield-halved"></i> Access Denied:</strong> {applicationError}
                            <div style={{ marginTop: '8px', fontSize: '13px', color: '#b91c1c' }}>
                                Your current email does not have Master Admin rights. Log in with <strong>jamba4334@gmail.com</strong>, or add your email to the <code>admin_users</code> database collection.
                            </div>
                        </div>
                    )}

                    {isLoadingApplications ? (
                        <p style={{ color: 'var(--text-muted)', padding: '20px 0' }}>Loading applications...</p>
                    ) : pendingApplications.length === 0 && !applicationError ? (
                        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                            <p style={{ color: '#6b7280', margin: 0 }}>No pending merchant applications right now.</p>
                        </div>
                    ) : pendingApplications.length > 0 ? (
                        <div className="onboarding-table-wrapper" style={{ overflowX: 'auto' }}>
                            <table className="onboarding-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb', color: '#374151', fontSize: '12px', textTransform: 'uppercase' }}>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>Brand & Contact</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>GST Status</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>Banking & Identity</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>Legal Documents</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingApplications.map(app => (
                                        <tr key={app.id} style={{ borderBottom: '1px solid #e5e7eb', fontSize: '14px' }}>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ fontWeight: '700', color: '#111827', fontSize: '15px' }}>{app.brandName}</div>
                                                <div style={{ color: '#4b5563', fontSize: '13px', marginBottom: '6px' }}>{app.ownerName}</div>
                                                <div style={{ color: '#6b7280', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                    <i className="fa-solid fa-envelope"></i> {app.email}
                                                </div>
                                                <div style={{ color: '#6b7280', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <i className="fa-solid fa-phone"></i> {app.phone}
                                                </div>
                                            </td>

                                            <td style={{ padding: '16px' }}>
                                                <span style={{ 
                                                    background: app.kycData?.hasGst ? '#dcfce7' : '#fef3c7', 
                                                    color: app.kycData?.hasGst ? '#166534' : '#92400e', 
                                                    padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', display: 'inline-block', marginBottom: '8px'
                                                }}>
                                                    {app.kycData?.hasGst ? 'GST Registered' : 'Without GST'}
                                                </span>
                                                <div style={{ fontSize: '12px', color: '#374151' }}>
                                                    <strong>GSTIN:</strong><br/>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{app.kycData?.gstNumber || 'N/A'}</span>
                                                </div>
                                            </td>

                                            <td style={{ padding: '16px', fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
                                                <div><strong style={{ color: '#111827' }}>PAN:</strong> {app.kycData?.panNumber || 'N/A'}</div>
                                                <div><strong style={{ color: '#111827' }}>A/C:</strong> {app.kycData?.accountNumber || 'N/A'}</div>
                                                <div><strong style={{ color: '#111827' }}>IFSC:</strong> {app.kycData?.ifscCode || 'N/A'}</div>
                                            </td>

                                            <td style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {app.kycData?.gstPdfUrl && (
                                                        <a href={app.kycData.gstPdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', textDecoration: 'none', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '6px 10px', borderRadius: '6px' }}>
                                                            <i className="fa-solid fa-file-pdf"></i> GST Certificate
                                                        </a>
                                                    )}
                                                    {app.kycData?.bankProofUrl && (
                                                        <a href={app.kycData.bankProofUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', textDecoration: 'none', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', background: '#ecfdf5', padding: '6px 10px', borderRadius: '6px' }}>
                                                            <i className="fa-solid fa-image"></i> Bank Proof
                                                        </a>
                                                    )}
                                                    {app.kycData?.maskedAadhaarUrl && (
                                                        <a href={app.kycData.maskedAadhaarUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', textDecoration: 'none', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '6px', background: '#f5f3ff', padding: '6px 10px', borderRadius: '6px' }}>
                                                            <i className="fa-solid fa-id-card"></i> ID Document
                                                        </a>
                                                    )}
                                                </div>
                                            </td>

                                            <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'right' }}>
                                                <button onClick={() => handleApproveApplication(app)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', width: '100%', marginBottom: '8px', display: 'flex', justifyContent: 'center', gap: '6px', alignItems: 'center' }}>
                                                    <i className="fa-solid fa-check"></i> Approve
                                                </button>
                                                <button onClick={() => handleRejectApplication(app.id)} style={{ background: '#fff', color: '#ef4444', border: '1px solid #f87171', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', width: '100%', display: 'flex', justifyContent: 'center', gap: '6px', alignItems: 'center' }}>
                                                    <i className="fa-solid fa-xmark"></i> Reject
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                </div>
            )}

            {/* TAB 3: LIVE STOREFRONTS MONITORING */}
            {mainViewTab === "storefronts" && (
                <div className="card" style={{ padding: editingSellerEmail ? '0' : '28px', background: editingSellerEmail ? 'transparent' : 'var(--ws-cream)', border: editingSellerEmail ? 'none' : '1px solid var(--ws-line)', boxShadow: editingSellerEmail ? 'none' : 'var(--ws-shadow)' }}>
                    
                    {editingSellerEmail ? (
                        <SellerStorefrontEditor 
                            db={db}
                            adminSellerEmail={editingSellerEmail} 
                            onBackToAdmin={() => setEditingSellerEmail(null)} 
                            getAuthHeaders={getAuthHeaders} 
                        />
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <span className="section-subtitle" style={{ margin: 0, padding: 0 }}>Live Storefronts</span>
                                    <p className="text-helper" style={{ margin: '4px 0 0 0' }}>Monitor and manage custom vanity stores created by sellers.</p>
                                </div>
                                <button type="button" onClick={fetchStorefronts} className="btn-submit" style={{ padding: '8px 16px', width: 'auto', margin: 0, backgroundColor: '#f3f4f6', color: '#111', border: '1px solid #d1d5db' }}>
                                    <i className="fa-solid fa-rotate-right"></i> Refresh
                                </button>
                            </div>

                            {isLoadingStorefronts ? (
                                <p style={{ color: 'var(--ws-body)', padding: '20px 0', textAlign: 'center' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading stores...</p>
                            ) : (
                                <div className="onboarding-table-wrapper">
                                    <table className="onboarding-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '13px 18px', background: 'var(--ws-muted)', borderBottom: '1px solid var(--ws-line)', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--ws-brown)' }}>Brand</th>
                                                <th style={{ padding: '13px 18px', background: 'var(--ws-muted)', borderBottom: '1px solid var(--ws-line)', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--ws-brown)' }}>URL Handle</th>
                                                <th style={{ padding: '13px 18px', background: 'var(--ws-muted)', borderBottom: '1px solid var(--ws-line)', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--ws-brown)' }}>Status</th>
                                                <th style={{ padding: '13px 18px', background: 'var(--ws-muted)', borderBottom: '1px solid var(--ws-line)', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--ws-brown)', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {storefronts.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No custom storefronts published yet.</td>
                                                </tr>
                                            ) : (
                                                storefronts.map((store, idx) => (
                                                    <tr key={idx} style={{ background: store.isSuspended ? 'var(--ws-danger-soft)' : 'transparent' }}>
                                                        <td style={{ padding: '16px 18px', borderBottom: '1px solid var(--ws-line)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--ws-sand)', overflow: 'hidden', border: '1px solid var(--ws-line)', flexShrink: 0 }}>
                                                                    {store.brandLogo ? <img src={store.brandLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                                                                </div>
                                                                <div>
                                                                    <strong style={{ color: 'var(--ws-ink)', fontSize: '14px' }}>{store.brandName || 'Unnamed Brand'}</strong>
                                                                    <div style={{ fontSize: '12px', color: 'var(--ws-body)', marginTop: '2px' }}>{store.sellerEmail}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px 18px', borderBottom: '1px solid var(--ws-line)', verticalAlign: 'middle' }}>
                                                            <span style={{ background: 'var(--ws-sand)', color: 'var(--ws-ink)', padding: '4px 8px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px', border: '1px solid var(--ws-line)' }}>
                                                                {store.vanityHandle ? `/shop/${store.vanityHandle}` : 'Not Set'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '16px 18px', borderBottom: '1px solid var(--ws-line)', verticalAlign: 'middle' }}>
                                                            <span style={{ background: store.isSuspended ? 'var(--ws-danger-soft)' : '#dcfce7', color: store.isSuspended ? 'var(--ws-danger)' : '#166534', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                                                                {store.isSuspended ? 'Suspended' : 'Live'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '16px 18px', borderBottom: '1px solid var(--ws-line)', verticalAlign: 'middle', textAlign: 'right' }}>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                {store.vanityHandle && (
                                                                    <a href={`/shop/${store.vanityHandle}`} target="_blank" rel="noopener noreferrer" title="View Live Store" style={{ background: 'var(--ws-cream)', color: 'var(--ws-ink)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', textDecoration: 'none', border: '1px solid var(--ws-line)' }}>
                                                                        <i className="fa-solid fa-eye"></i>
                                                                    </a>
                                                                )}
                                                                <button 
                                                                    onClick={() => toggleStoreSuspension(store.sellerEmail, store.isSuspended)}
                                                                    title={store.isSuspended ? 'Re-enable Storefront' : 'Suspend Storefront'}
                                                                    style={{ background: store.isSuspended ? '#dcfce7' : 'var(--ws-danger-soft)', color: store.isSuspended ? '#16a34a' : 'var(--ws-danger)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer' }}
                                                                >
                                                                    {store.isSuspended ? <i className="fa-solid fa-check"></i> : <i className="fa-solid fa-ban"></i>}
                                                                </button>
                                                                <button 
                                                                    onClick={() => setEditingSellerEmail(store.sellerEmail)}
                                                                    title="Edit Store Layout"
                                                                    style={{ background: 'var(--ws-ink)', color: 'var(--ws-cream)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                                >
                                                                    <i className="fa-solid fa-pen-to-square"></i> Edit
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* SELLER MODAL OVERLAY */}
            {selectedSeller && (
                <div className="admin-modal-overlay" onClick={closeSellerModal}>
                    <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
                        
                        <div className="admin-modal-header">
                            <h2>
                                {selectedSeller.profile?.profilePhoto && <img src={selectedSeller.profile.profilePhoto} alt="Avatar" style={{width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginRight: '10px'}} />}
                                {selectedSeller.profile?.brandName || selectedSeller.email}
                            </h2>
                            <button type="button" className="btn-close-modal" onClick={closeSellerModal}>Close Panel</button>
                        </div>

                        <div className="admin-modal-tabs">
                            <button type="button" className={`admin-modal-tab ${sellerModalTab === 'profile' ? 'active' : ''}`} onClick={() => setSellerModalTab('profile')}>Store Profile</button>
                            <button type="button" className={`admin-modal-tab ${sellerModalTab === 'catalog' ? 'active' : ''}`} onClick={() => setSellerModalTab('catalog')}>Catalog & Stock ({selectedSeller.products.length})</button>
                            <button type="button" className={`admin-modal-tab ${sellerModalTab === 'orders' ? 'active' : ''}`} onClick={() => setSellerModalTab('orders')}>Orders ({selectedSeller.orders.length})</button>
                            <button type="button" className={`admin-modal-tab ${sellerModalTab === 'finance' ? 'active' : ''}`} onClick={() => setSellerModalTab('finance')}>
                                Financials & Payouts
                                {sellerPayouts.filter(p => p.status === 'pending').length > 0 && (
                                    <span className="tab-badge">{sellerPayouts.filter(p => p.status === 'pending').length}</span>
                                )}
                            </button>
                        </div>

                        <div className="admin-modal-body">
                            
                            {/* TAB 1: EDIT PROFILE */}
                            {sellerModalTab === 'profile' && (
                                <form onSubmit={handleSaveSellerProfile}>
                                    <div className="field-grid">
                                        <div className="form-group"><span className="label">Brand Name</span><input type="text" name="brandName" value={editProfileData.brandName || ""} onChange={handleProfileChange} className="input-box" required /></div>
                                        <div className="form-group"><span className="label">Owner Name</span><input type="text" name="sellerName" value={editProfileData.sellerName || ""} onChange={handleProfileChange} className="input-box" required /></div>
                                    </div>
                                    <div className="field-grid">
                                        <div className="form-group"><span className="label">Contact Email</span><input type="email" name="storeEmail" value={editProfileData.storeEmail || selectedSeller.email} onChange={handleProfileChange} className="input-box" required /></div>
                                        <div className="form-group"><span className="label">Contact Phone</span><input type="text" name="primaryPhone" value={editProfileData.primaryPhone || ""} onChange={handleProfileChange} className="input-box" required /></div>
                                    </div>
                                    
                                    <span className="section-subtitle" style={{marginTop: '20px'}}>Bank Details</span>
                                    <div className="field-grid">
                                        <div className="form-group"><span className="label">Account Name</span><input type="text" name="accName" value={editProfileData.accName || ""} onChange={handleProfileChange} className="input-box" required /></div>
                                        <div className="form-group"><span className="label">Account Number</span><input type="text" name="accNumber" value={editProfileData.accNumber || ""} onChange={handleProfileChange} className="input-box" required /></div>
                                        <div className="form-group"><span className="label">IFSC Code</span><input type="text" name="ifsc" value={editProfileData.ifsc || ""} onChange={handleProfileChange} className="input-box" required /></div>
                                    </div>

                                    <button type="submit" disabled={isSavingProfile} className="btn-submit" style={{width: 'auto', padding: '10px 24px'}}>
                                        {isSavingProfile ? "Saving..." : "Save Changes"}
                                    </button>
                                </form>
                            )}

                            {/* TAB 2: CATALOG */}
                            {sellerModalTab === 'catalog' && (
                                <div>
                                    {selectedSeller.products.length === 0 ? <p style={{color: 'var(--text-muted)'}}>No products uploaded by this seller.</p> : null}
                                    {selectedSeller.products.map(p => (
                                        <div key={p.docId || p.id} style={{ display: 'flex', gap: '16px', padding: '16px', borderBottom: '1px solid #eee' }}>
                                            <img src={p.images?.[0] || 'https://via.placeholder.com/80'} loading="lazy" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '6px' }} alt="Product" />
                                            <div>
                                                <strong style={{fontSize: '15px', color: 'var(--primary)'}}>{p.title}</strong>
                                                <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px'}}>
                                                    Price: ₹{p.selling_price} | Stock: <strong>{p.stock || 0}</strong> | Status: {p.approval_status === 'pending' ? '⚠️ Pending' : '✅ Live'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* TAB 3: ORDERS */}
                            {sellerModalTab === 'orders' && (
                                <div>
                                    {selectedSeller.orders.length === 0 ? <p style={{color: 'var(--text-muted)'}}>No orders to fulfill yet.</p> : null}
                                    {selectedSeller.orders.map(o => (
                                        <div key={o.id} style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
                                            <strong style={{color: 'var(--primary)'}}>Order Ref: {o.id}</strong>
                                            <div style={{fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px'}}>
                                                Status: <span style={{textTransform: 'uppercase', color: 'var(--primary)'}}>{o.status || 'Pending'}</span> | 
                                                Seller Accepted: {o.seller_accepted ? '✅ Yes' : '⏳ Waiting'}
                                            </div>
                                            {o.trackingId && <div style={{fontSize: '12px', marginTop: '6px', background: '#f9fafb', padding: '8px'}}>Tracking: {o.trackingId} ({o.courierName})</div>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* TAB 4: FINANCIALS */}
                            {sellerModalTab === 'finance' && (
                                <div>
                                    <div className="finance-summary-cards">
                                        <div className="finance-card pending">
                                            <div className="finance-card-title">Pending Payout Requests</div>
                                            <div className="finance-card-value">{sellerPayouts.filter(p => p.status === 'pending').length}</div>
                                        </div>
                                        <div className="finance-card paid">
                                            <div className="finance-card-title">Total Paid Payouts</div>
                                            <div className="finance-card-value">{sellerPayouts.filter(p => p.status === 'paid').length}</div>
                                        </div>
                                    </div>

                                    <table className="payout-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Amount</th>
                                                <th>Status</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sellerPayouts.map(p => (
                                                <tr key={p.id}>
                                                    <td>{new Date(p.date).toLocaleDateString()}</td>
                                                    <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>₹{p.amount}</td>
                                                    <td>
                                                        {p.status === 'paid' ? <span style={{color: 'var(--success)'}}>Paid ({p.utr})</span> : <span style={{color: 'var(--accent)'}}>Pending</span>}
                                                    </td>
                                                    <td>
                                                        {p.status === 'pending' && (
                                                            <button type="button" onClick={() => handleMarkPayoutPaid(p.id)} style={{background: 'var(--primary)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer'}}>Mark Paid</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {sellerPayouts.length === 0 && <tr><td colSpan="4" style={{padding: '16px 8px', color: 'var(--text-muted)'}}>No payout requests found.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}