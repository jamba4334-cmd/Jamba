import React, { useEffect, useState, useRef } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

// Keep auth, storage, db imports so we can pass them to children that haven't been updated yet
import { auth, storage, db } from "../../firebase.js"; 
import { API_BASE_URL } from "../../apiConfig.js"; 

// Import the Master CSS
import "./AdminLayout.css";

// Import all Sub-Components
import InventoryTab from "../Components/InventoryTab.jsx";
import AddProductTab from "../Components/AddProductTab.jsx";
import CategorySettings from "../Components/CategorySettings.jsx";
import OrdersTab from "../Components/OrdersTab.jsx";
import SellersTab from "../Components/SellersTab.jsx";
import FinanceTab from "../Components/Finance/FinanceTab.jsx";
import MessagesTab from "../Components/MessagesTab.jsx";
import SiteSettings from "../Components/SiteSettings.jsx";
import CustomersTab from "../Components/CustomersTab.jsx";
import ReviewsTab from "../Components/ReviewsTab.jsx";
import MasterControlTab from "../Components/MasterControlTab.jsx";
import PromoCodesTab from "../Components/PromoCodesTab.jsx"; 
import SubscriptionsTab from "../Components/SubscriptionsTab.jsx";
import AdminProductApproval from "../Components/AdminProductApproval.jsx";

const provider = new GoogleAuthProvider();

export default function AdminLayout() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState("");
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [subAdminMaxDuration, setSubAdminMaxDuration] = useState(null);
    
    const [activeTab, setActiveTab] = useState("live-products");
    const [editingProduct, setEditingProduct] = useState(null); 

    const [liveProducts, setLiveProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [supportTickets, setSupportTickets] = useState([]);
    const [globalSellers, setGlobalSellers] = useState([]);
    const [globalPendingPayouts, setGlobalPendingPayouts] = useState(0);

    const idleTimerRef = useRef(null);
    const heartbeatRef = useRef(null);
    
    const masterAdminEmail = import.meta.env.VITE_MASTER_ADMIN_EMAIL?.trim().replace(/['"]/g, '')?.toLowerCase();

    // Secure Token Generator for API Calls
    const getAuthHeaders = async () => {
        const user = auth.currentUser;
        if (!user) throw new Error("Your admin session has expired. Please sign in again.");
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${await user.getIdToken()}`
        };
    };

    const handleLogout = async () => {
        try {
            if (auth.currentUser) {
                const headers = await getAuthHeaders();
                await fetch(`${API_BASE_URL}/api/v1/admin/session`, { method: 'DELETE', headers });
            }
        } catch (e) { console.error("Logout cleanup failed", e); }
        
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        await signOut(auth);
        window.location.reload(); 
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const headers = await getAuthHeaders();
                    // Check validity securely via Python API
                    const res = await fetch(`${API_BASE_URL}/api/v1/admin/session/status`, { headers });
                    
                    if (res.ok) {
                        setIsAuthenticated(true);
                        startHeartbeat();
                    } else {
                        await signOut(auth);
                        setAuthError("Account Deauthorized or Session Terminated.");
                    }
                } catch (e) {
                    setIsAuthenticated(false);
                }
            } else {
                setIsAuthenticated(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const startHeartbeat = () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        
        // Zero-Trust: Poll backend every 15 seconds to check for forced logouts from Master Admin
        heartbeatRef.current = setInterval(async () => {
            try {
                const headers = await getAuthHeaders();
                const res = await fetch(`${API_BASE_URL}/api/v1/admin/session/status`, { headers });
                
                // If the backend returns a 403 Forbidden, the session was revoked
                if (!res.ok) {
                    await handleLogout();
                    alert("Your session has been terminated by the Master Admin.");
                }
            } catch (e) { }
        }, 15000);
    };

    const handleAdminLogin = async () => {
        try {
            setAuthError("");
            const result = await signInWithPopup(auth, provider);
            const token = await result.user.getIdToken();
            
            // Secure Login Flow via Python BFF
            const res = await fetch(`${API_BASE_URL}/api/v1/admin/session`, {
                method: 'POST',
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ displayName: result.user.displayName })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                if (!data.isMaster) {
                    setSubAdminMaxDuration(data.maxDuration || 60);
                    const now = new Date();
                    const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
                    if (data.startTime && data.endTime && (currentTime < data.startTime || currentTime > data.endTime)) {
                        await signOut(auth);
                        setAuthError("Outside of authorized access hours.");
                        return;
                    }
                }
                setIsAuthenticated(true);
                startHeartbeat();
            } else {
                await signOut(auth);
                setAuthError(data.error || "Unauthorized email address.");
            }
        } catch (error) {
            setAuthError("Login failed: " + error.message);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) return;

        if (auth.currentUser?.email?.toLowerCase() === masterAdminEmail) {
            const handleAutoLogout = async () => {
                await handleLogout();
                alert("🔒 Secure Session Ended: Logged out due to inactivity.");
            };
            const resetIdleTimer = () => {
                if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
                idleTimerRef.current = setTimeout(handleAutoLogout, 600000); 
            };
            const activityEvents = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
            resetIdleTimer();
            activityEvents.forEach(event => window.addEventListener(event, resetIdleTimer));
            
            return () => {
                if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
                activityEvents.forEach(event => window.removeEventListener(event, resetIdleTimer));
            };
        } else {
            if (subAdminMaxDuration) {
                const durationMs = subAdminMaxDuration * 60000;
                const timeoutId = setTimeout(async () => {
                    await handleLogout();
                    alert(`⏱️ Session Expired: Your maximum session time of ${subAdminMaxDuration} minutes has been reached.`);
                }, durationMs);
                return () => clearTimeout(timeoutId);
            }
        }
    }, [isAuthenticated, subAdminMaxDuration]);

    useEffect(() => {
        if (!isAuthenticated) return;
        if (activeTab === "live-products" && liveProducts.length === 0) loadAdminInventory();
        if (activeTab === "messages" && supportTickets.length === 0) loadSupportTickets();
        if ((activeTab === "seller-access" || activeTab === "finance") && globalSellers.length === 0) {
            loadAuthorizedSellers();
            loadGlobalPayouts();
        }
    }, [activeTab, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        loadAdminOrders();
        const orderSyncInterval = setInterval(() => loadAdminOrders(), 15000); 
        return () => clearInterval(orderSyncInterval);
    }, [isAuthenticated]);

    const loadAdminInventory = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/admin/products?limit=50`, { headers });
            if (response.ok) {
                const data = await response.json();
                setLiveProducts(data.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
            }
        } catch (err) { console.error("Inventory Load Error:", err); }
    };

    const loadAdminOrders = async () => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/admin/orders?limit=50`, { headers });
            if (response.ok) {
                const data = await response.json();
                setOrders(data.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0)));
            }
        } catch (error) { console.error("Error loading orders:", error); }
    };

    const loadSupportTickets = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE_URL}/api/v1/seller/tickets`, { headers });
            if (res.ok) setSupportTickets(await res.json());
        } catch (error) { console.error("Error loading tickets:", error); }
    };

    const loadGlobalPayouts = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE_URL}/admin/payouts?status=pending`, { headers });
            if (res.ok) {
                const data = await res.json();
                setGlobalPendingPayouts(data.length || 0);
            }
        } catch(e) { console.error("Error loading payouts:", e); }
    };

    const loadAuthorizedSellers = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE_URL}/admin/sellers`, { headers });
            if (res.ok) setGlobalSellers(await res.json());
        } catch (e) { console.error("Error loading sellers:", e); }
    };

    const renderActiveTab = () => {
        switch(activeTab) {
            case "live-products":
                return <InventoryTab liveProducts={liveProducts} getAuthHeaders={getAuthHeaders} refreshInventory={loadAdminInventory} onEditProduct={(product) => { setEditingProduct(product); setActiveTab("add-product"); }} />;
            case "add-product":
                return <AddProductTab getAuthHeaders={getAuthHeaders} refreshInventory={loadAdminInventory} editingProduct={editingProduct} onComplete={() => { setEditingProduct(null); setActiveTab("live-products"); }} />;
            case "approvals":
                return <AdminProductApproval isActive={true} getAuthHeaders={getAuthHeaders} />;
            case "tribe-settings":
                return <CategorySettings getAuthHeaders={getAuthHeaders} />;
            case "orders":
                return <OrdersTab orders={orders} liveProducts={liveProducts} getAuthHeaders={getAuthHeaders} refreshOrders={loadAdminOrders} />;
            case "seller-access":
                return <SellersTab db={db} getAuthHeaders={getAuthHeaders} globalSellers={globalSellers} liveProducts={liveProducts} orders={orders} loadAuthorizedSellers={loadAuthorizedSellers} />;
            case "subscriptions":
                return <SubscriptionsTab db={db} />;
            case "finance": 
                return <FinanceTab getAuthHeaders={getAuthHeaders} />;
            case "promocodes": 
                return <PromoCodesTab getAuthHeaders={getAuthHeaders} />;
            case "messages":
                return <MessagesTab db={db} supportTickets={supportTickets} setSupportTickets={setSupportTickets} globalSellers={globalSellers} />;
            case "site-settings":
                return <SiteSettings getAuthHeaders={getAuthHeaders} storage={storage} db={db} />;
            case "customer-details":
                return <CustomersTab getAuthHeaders={getAuthHeaders} />;
            case "store-reviews":
                return <ReviewsTab db={db} liveProducts={liveProducts} />;
            case "master-control":
                return <MasterControlTab getAuthHeaders={getAuthHeaders} />; 
            default:
                return <div style={{padding: '40px'}}><h2 style={{color: 'var(--primary)'}}>Under Construction</h2></div>;
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.header-profile-container')) setIsProfileMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isAuthenticated) {
        return (
            <div className="admin-isolated-wrapper">
                <div id="login-overlay">
                    <div className="login-box" style={{ textAlign: 'center' }}>
                        <h2><span style={{ color: 'var(--accent)' }}>JAMBA</span>WEAR Admin</h2>
                        <p>Please log in with your authorized Google account.</p>
                        {authError && <div className="login-error" style={{ display: 'block', marginBottom: '15px' }}>{authError}</div>}
                        <button type="button" className="btn-submit" onClick={handleAdminLogin} style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <i className="fa-brands fa-google"></i> Sign In With Google
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const isMasterAdmin = auth.currentUser?.email?.toLowerCase() === masterAdminEmail;

    return (
        <div className={`admin-isolated-wrapper ${isMasterAdmin ? 'is-master' : ''}`}>
            <div id="toast-notification" className="toast-notification"></div>

            <header className="admin-top-header">
                <div className="logo-block">
                    <div className="logo-jamba">JAMBA</div>
                    <div className="logo-sub">ADMIN DASHBOARD</div>
                </div>

                <div className="header-profile-container">
                    <div className="header-profile-trigger" onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                        <div className="header-avatar-placeholder">{isMasterAdmin ? 'M' : 'A'}</div>
                        <div className="header-brand-details">
                            <span className="header-brand-label">{isMasterAdmin ? 'Master Admin' : 'Admin'}</span>
                            <span className="header-brand-name">Dashboard Access</span>
                        </div>
                        <i className={`fa-solid fa-chevron-${isProfileMenuOpen ? 'up' : 'down'} header-chevron`}></i>
                    </div>
                    {isProfileMenuOpen && (
                        <div className="header-profile-dropdown">
                            <div className="dropdown-menu-item text-danger" onClick={handleLogout}><i className="fa-solid fa-arrow-right-from-bracket"></i> Secure Logout</div>
                        </div>
                    )}
                </div>
            </header>

            <div className="admin-body-container">
                <nav className="admin-tab-bar">
                    <ul className="nav-menu">
                        <li className={`nav-item ${activeTab === 'live-products' ? 'active' : ''}`} onClick={() => setActiveTab('live-products')}><i className="fa-solid fa-layer-group"></i> Inventory</li>
                        <li className={`nav-item ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}><i className="fa-solid fa-clipboard-check"></i> Approvals</li>
                        <li className={`nav-item ${activeTab === 'add-product' ? 'active' : ''}`} onClick={() => { setEditingProduct(null); setActiveTab('add-product'); }}><i className="fa-solid fa-plus"></i> Add Product</li>
                        <li className={`nav-item ${activeTab === 'tribe-settings' ? 'active' : ''}`} onClick={() => setActiveTab('tribe-settings')}><i className="fa-solid fa-sitemap"></i> Categories</li>
                        <li className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}><i className="fa-solid fa-truck"></i> Orders</li>
                        <li className={`nav-item ${activeTab === 'seller-access' ? 'active' : ''}`} onClick={() => setActiveTab('seller-access')}>
                            <i className="fa-solid fa-store"></i> Sellers
                            {globalPendingPayouts > 0 && <span className="sidebar-badge">{globalPendingPayouts}</span>}
                        </li>
                        <li className={`nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`} onClick={() => setActiveTab('subscriptions')}><i className="fa-solid fa-crown"></i> Subscriptions</li>
                        <li className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}><i className="fa-solid fa-coins"></i> Finance</li>
                        <li className={`nav-item ${activeTab === 'promocodes' ? 'active' : ''}`} onClick={() => setActiveTab('promocodes')}><i className="fa-solid fa-tags"></i> Promo Codes</li>
                        <li className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
                            <i className="fa-solid fa-envelope"></i> Inbox
                            {supportTickets.filter(t => t.status === 'open').length > 0 && <span className="sidebar-badge">{supportTickets.filter(t => t.status === 'open').length}</span>}
                        </li>
                        <li className={`nav-item ${activeTab === 'site-settings' ? 'active' : ''}`} onClick={() => setActiveTab('site-settings')}><i className="fa-solid fa-sliders"></i> Site Setup</li>
                        <li className={`nav-item ${activeTab === 'customer-details' ? 'active' : ''}`} onClick={() => setActiveTab('customer-details')}><i className="fa-solid fa-user-group"></i> Customers</li>
                        <li className={`nav-item ${activeTab === 'store-reviews' ? 'active' : ''}`} onClick={() => setActiveTab('store-reviews')}><i className="fa-solid fa-star"></i> Reviews</li>
                        {isMasterAdmin && (
                            <li className={`nav-item ${activeTab === 'master-control' ? 'active' : ''}`} onClick={() => setActiveTab('master-control')}><i className="fa-solid fa-shield-halved"></i> Master Control</li>
                        )}
                    </ul>
                </nav>
                <div className="main-pannel">{renderActiveTab()}</div>
            </div>
        </div>
    );
}