import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../apiConfig.js"; 
import "../styles/Sellers.css";

// ⚠️ ADJUST THIS RELATIVE PATH IF YOUR FIREBASE FILE IS LOCATED ELSEWHERE
import { db } from '../../firebase'; 
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function SellersTab({ getAuthHeaders, globalSellers = [], liveProducts = [], orders = [], loadAuthorizedSellers }) {
    // --- State Management ---
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

    // --- Fetch Pending Applications ---
    useEffect(() => {
        if (mainViewTab === "onboarding") {
            fetchApplications();
        }
    }, [mainViewTab]);

    const fetchApplications = async () => {
        setIsLoadingApplications(true);
        try {
            if (!db) {
                console.error("Firebase DB instance is missing or not imported correctly.");
                setIsLoadingApplications(false);
                return;
            }
            const q = query(collection(db, "users"), where("kyc_status", "==", "pending_kyc"));
            const querySnapshot = await getDocs(q);
            
            const appsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            setPendingApplications(appsData);
        } catch (error) {
            console.error("Error fetching pending applications:", error);
        } finally {
            setIsLoadingApplications(false);
        }
    };

    // --- Action Handlers: Onboarding ---
    const handleApproveApplication = async (app) => {
        if (!window.confirm(`Are you sure you want to approve ${app.brandName}?`)) return;
        
        try {
            await updateDoc(doc(db, "users", app.id), { kyc_status: "approved" });
            
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            await fetch(`${API_BASE_URL}/admin/sellers`, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({ email: app.email })
            });

            if (window.showToast) window.showToast(`${app.brandName} approved!`);
            fetchApplications();
            if (typeof loadAuthorizedSellers === 'function') loadAuthorizedSellers(); 
        } catch (error) {
            console.error("Error approving seller:", error);
            alert("Failed to approve seller. Check console for details.");
        }
    };

    const handleRejectApplication = async (appId) => {
        if (!window.confirm("Are you sure you want to reject this application?")) return;
        try {
            await updateDoc(doc(db, "users", appId), { kyc_status: "rejected" });
            fetchApplications();
            if (window.showToast) window.showToast("Application rejected.");
        } catch (error) {
            console.error("Error rejecting application:", error);
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
            
            {/* 🔥 CLEANED UP SUB-NAVIGATION TABS 🔥 */}
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
                            <p className="text-helper" style={{ margin: '4px 0 0 0' }}>Review submitted seller details and approve or reject applications.</p>
                        </div>
                        <button type="button" onClick={fetchApplications} className="btn-submit" style={{ padding: '8px 16px', width: 'auto', margin: 0, backgroundColor: '#f3f4f6', color: '#111', border: '1px solid #d1d5db' }}>
                            <i className="fa-solid fa-rotate-right"></i> Refresh
                        </button>
                    </div>
                    
                    {isLoadingApplications ? (
                        <p style={{ color: 'var(--text-muted)', padding: '20px 0' }}>Loading applications...</p>
                    ) : pendingApplications.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                            <p style={{ color: '#6b7280', margin: 0 }}>No pending merchant applications right now.</p>
                        </div>
                    ) : (
                        <div className="onboarding-table-wrapper">
                            <table className="onboarding-table">
                                <thead>
                                    <tr>
                                        <th>Brand & Owner</th>
                                        <th>Contact Info</th>
                                        <th>Date Applied</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingApplications.map(app => (
                                        <tr key={app.id}>
                                            <td>
                                                <strong style={{ display: 'block', color: '#111', fontSize: '14px' }}>{app.brandName}</strong>
                                                <span style={{ fontSize: '13px', color: '#6b7280' }}>{app.ownerName}</span>
                                            </td>
                                            <td style={{ fontSize: '13px', color: '#374151' }}>
                                                <div style={{ marginBottom: '4px' }}><i className="fa-regular fa-envelope" style={{ width: '16px' }}></i> {app.email}</div>
                                                <div style={{ marginBottom: '4px' }}><i className="fa-solid fa-phone" style={{ width: '16px' }}></i> {app.phone}</div>
                                                <div style={{ color: '#059669' }}><i className="fa-brands fa-whatsapp" style={{ width: '16px' }}></i> {app.whatsapp}</div>
                                            </td>
                                            <td style={{ fontSize: '13px', color: '#6b7280' }}>
                                                {app.createdAt ? new Date(app.createdAt.toDate ? app.createdAt.toDate() : app.createdAt).toLocaleDateString() : 'N/A'}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleApproveApplication(app)}
                                                    className="btn-approve"
                                                >
                                                    Approve
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleRejectApplication(app.id)}
                                                    className="btn-reject"
                                                >
                                                    Reject
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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