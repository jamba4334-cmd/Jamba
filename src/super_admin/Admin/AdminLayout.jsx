import React, { useEffect, useState, useRef } from "react";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit, doc, setDoc, updateDoc, serverTimestamp, onSnapshot, where } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../../apiConfig.js"; 

// Import the Master CSS
import "./AdminLayout.css";

// Import all Sub-Components
import InventoryTab from "../Components/InventoryTab.jsx";
import AddProductTab from "../Components/AddProductTab.jsx";
import CategorySettings from "../Components/CategorySettings.jsx";
import OrdersTab from "../Components/OrdersTab.jsx";
import SellersTab from "../Components/SellersTab.jsx";
import EarningsTab from "../Components/EarningsTab.jsx";
import MessagesTab from "../Components/MessagesTab.jsx";
import SiteSettings from "../Components/SiteSettings.jsx";
import CustomersTab from "../Components/CustomersTab.jsx";
import ReviewsTab from "../Components/ReviewsTab.jsx";
import MasterControlTab from "../Components/MasterControlTab.jsx";
import PromoCodesTab from "../Components/PromoCodesTab.jsx"; 

// 🔥 NEW: Import the Master Subscriptions Tab
import SubscriptionsTab from "../Components/SubscriptionsTab.jsx";

// --- Firebase Initialization ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const appName = "jambawear-admin";
const app = getApps().some((firebaseApp) => firebaseApp.name === appName)
    ? getApp(appName)
    : initializeApp(firebaseConfig, appName);

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
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
    
    // Secure lowercase master email
    const masterAdminEmail = import.meta.env.VITE_MASTER_ADMIN_EMAIL?.trim().replace(/['"]/g, '')?.toLowerCase();

    const handleLogout = async () => {
        if (auth.currentUser && auth.currentUser.email?.toLowerCase() !== masterAdminEmail) {
            const q = query(collection(db, "admin_users"), where("email", "==", auth.currentUser.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                await updateDoc(doc(db, "admin_users", querySnapshot.docs[0].id), { isOnline: false });
                
                await setDoc(doc(collection(db, "admin_audit_logs")), {
                    email: auth.currentUser.email,
                    action: "LOGOUT",
                    timestamp: serverTimestamp()
                });
            }
        }
        await signOut(auth);
        window.location.reload(); 
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (user.email?.toLowerCase() === masterAdminEmail) {
                    setIsAuthenticated(true);
                    return;
                }

                const q = query(collection(db, "admin_users"), where("email", "==", user.email));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    const adminData = querySnapshot.docs[0].data();
                    const adminId = querySnapshot.docs[0].id;
                    const adminRef = doc(db, "admin_users", adminId);

                    if (adminData.isAuthorized) {
                        setIsAuthenticated(true);
                        setSubAdminMaxDuration(adminData.maxDuration || 60);
                        
                        const nameParts = (user.displayName || "").split(" ");
                        await updateDoc(adminRef, { 
                            isOnline: true,
                            firstName: adminData.firstName === "Pending" ? (nameParts[0] || "Admin") : adminData.firstName,
                            lastName: adminData.lastName === "Registration..." ? (nameParts.slice(1).join(" ") || "") : adminData.lastName
                        });
                        
                        onSnapshot(adminRef, async (docSnap) => {
                            const data = docSnap.data();
                            
                            if (data.forceLogout || !data.isAuthorized) {
                                await handleLogout();
                                alert("Your session has been terminated.");
                            }

                            if (data.accessStartTime && data.accessEndTime) {
                                const now = new Date();
                                const currentTime = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
                                if (currentTime < data.accessStartTime || currentTime > data.accessEndTime) {
                                    await handleLogout();
                                    alert("Outside of authorized access hours.");
                                }
                            }
                        });
                    } else {
                        await signOut(auth);
                        setAuthError("Account Deauthorized.");
                    }
                } else {
                    await signOut(auth);
                    setAuthError("Unauthorized email address.");
                }
            } else {
                setIsAuthenticated(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleAdminLogin = async () => {
        try {
            setAuthError("");
            const result = await signInWithPopup(auth, provider);
            
            const email = result.user.email?.toLowerCase();
            const displayName = result.user.displayName || ""; 

            if (email !== masterAdminEmail) {
                const q = query(collection(db, "admin_users"), where("email", "==", email));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty || !querySnapshot.docs[0].data().isAuthorized) {
                    await signOut(auth);
                    setAuthError("Unauthorized email address.");
                    return;
                }

                const adminId = querySnapshot.docs[0].id;
                const nameParts = displayName.split(" ");
                const firstName = nameParts[0] || "Admin";
                const lastName = nameParts.slice(1).join(" ") || "";
                
                await updateDoc(doc(db, "admin_users", adminId), { 
                    isOnline: true,
                    forceLogout: false,
                    firstName: firstName,
                    lastName: lastName
                });

                await setDoc(doc(collection(db, "admin_audit_logs")), {
                    email: email,
                    action: "LOGIN",
                    timestamp: serverTimestamp()
                });
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

    // Use the signed-in administrator's short-lived Firebase ID token.
    const getAuthHeaders = async () => {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("Your admin session has expired. Please sign in again.");
        }

        const idToken = await user.getIdToken();
        return {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
        };
    };

    // --- STANDARD TAB DATA FETCHING ---
    useEffect(() => {
        if (!isAuthenticated) return;
        if (activeTab === "live-products" && liveProducts.length === 0) loadAdminInventory();
        
        if (activeTab === "messages" && supportTickets.length === 0) loadSupportTickets();
        if ((activeTab === "seller-access" || activeTab === "earnings") && globalSellers.length === 0) {
            loadAuthorizedSellers();
            loadGlobalPayouts();
        }
    }, [activeTab, isAuthenticated]);

    // --- NEW: REAL-TIME AUTO-SYNC FOR ORDERS ---
    useEffect(() => {
        if (!isAuthenticated) return;
        
        // 1. Fetch orders immediately when you log in
        loadAdminOrders();

        // 2. Silently ping the backend for new orders every 10 seconds
        const orderSyncInterval = setInterval(() => {
            loadAdminOrders();
        }, 10000); // 10000 milliseconds = 10 seconds

        // 3. Cleanup the timer if you log out
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
            const q = query(collection(db, "support_tickets"), limit(50));
            const querySnapshot = await getDocs(q);
            let tickets = [];
            querySnapshot.forEach((doc) => tickets.push({ id: doc.id, ...doc.data() }));
            setSupportTickets(tickets.sort((a, b) => new Date(b.date) - new Date(a.date)));
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
        } catch(e) { console.error("Error loading global payouts:", e); }
    };

    const loadAuthorizedSellers = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE_URL}/admin/sellers`, { headers });
            if (res.ok) {
                const sellersData = await res.json();
                setGlobalSellers(sellersData);
            }
        } catch (e) { console.error("Error loading sellers:", e); }
    };

    const renderActiveTab = () => {
        switch(activeTab) {
            case "live-products":
                return <InventoryTab liveProducts={liveProducts} getAuthHeaders={getAuthHeaders} refreshInventory={loadAdminInventory} onEditProduct={(product) => { setEditingProduct(product); setActiveTab("add-product"); }} />;
            case "add-product":
                return <AddProductTab getAuthHeaders={getAuthHeaders} refreshInventory={loadAdminInventory} editingProduct={editingProduct} onComplete={() => { setEditingProduct(null); setActiveTab("live-products"); }} />;
            case "tribe-settings":
                return <CategorySettings getAuthHeaders={getAuthHeaders} />;
            case "orders":
                return <OrdersTab orders={orders} liveProducts={liveProducts} getAuthHeaders={getAuthHeaders} refreshOrders={loadAdminOrders} />;
            case "seller-access":
                return <SellersTab getAuthHeaders={getAuthHeaders} globalSellers={globalSellers} liveProducts={liveProducts} orders={orders} loadAuthorizedSellers={loadAuthorizedSellers} />;
            
            // 🔥 NEW: Render Subscriptions Tab for Master Admin
            case "subscriptions":
                return <SubscriptionsTab db={db} />;
                
            case "earnings": 
                return <EarningsTab getAuthHeaders={getAuthHeaders} />;
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
                return <MasterControlTab db={db} />; 
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
                        <div className="header-avatar-placeholder">
                            {isMasterAdmin ? 'M' : 'A'}
                        </div>
                        <div className="header-brand-details">
                            <span className="header-brand-label">
                                {isMasterAdmin ? 'Master Admin' : 'Admin'}
                            </span>
                            <span className="header-brand-name">Dashboard Access</span>
                        </div>
                        <i className={`fa-solid fa-chevron-${isProfileMenuOpen ? 'up' : 'down'} header-chevron`}></i>
                    </div>

                    {isProfileMenuOpen && (
                        <div className="header-profile-dropdown">
                            <div className="dropdown-menu-item text-danger" onClick={handleLogout}>
                                <i className="fa-solid fa-arrow-right-from-bracket"></i> Secure Logout
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <div className="admin-body-container">
                <nav className="admin-tab-bar">
                    <ul className="nav-menu">
                        <li className={`nav-item ${activeTab === 'live-products' ? 'active' : ''}`} onClick={() => setActiveTab('live-products')}><i className="fa-solid fa-layer-group"></i> Inventory</li>
                        <li className={`nav-item ${activeTab === 'add-product' ? 'active' : ''}`} onClick={() => { setEditingProduct(null); setActiveTab('add-product'); }}><i className="fa-solid fa-plus"></i> Add Product</li>
                        <li className={`nav-item ${activeTab === 'tribe-settings' ? 'active' : ''}`} onClick={() => setActiveTab('tribe-settings')}><i className="fa-solid fa-sitemap"></i> Categories</li>
                        <li className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}><i className="fa-solid fa-truck"></i> Orders</li>
                        <li className={`nav-item ${activeTab === 'seller-access' ? 'active' : ''}`} onClick={() => setActiveTab('seller-access')}>
                            <i className="fa-solid fa-store"></i> Sellers
                            {globalPendingPayouts > 0 && <span className="sidebar-badge">{globalPendingPayouts}</span>}
                        </li>
                        
                        {/* 🔥 NEW: Subscriptions Navigation Button */}
                        <li className={`nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`} onClick={() => setActiveTab('subscriptions')}>
                            <i className="fa-solid fa-crown"></i> Subscriptions
                        </li>

                        <li className={`nav-item ${activeTab === 'earnings' ? 'active' : ''}`} onClick={() => setActiveTab('earnings')}><i className="fa-solid fa-wallet"></i> Earnings</li>
                        <li className={`nav-item ${activeTab === 'promocodes' ? 'active' : ''}`} onClick={() => setActiveTab('promocodes')}><i className="fa-solid fa-tags"></i> Promo Codes</li>
                        <li className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
                            <i className="fa-solid fa-envelope"></i> Inbox
                            {supportTickets.filter(t => t.status === 'open').length > 0 && <span className="sidebar-badge">{supportTickets.filter(t => t.status === 'open').length}</span>}
                        </li>
                        <li className={`nav-item ${activeTab === 'site-settings' ? 'active' : ''}`} onClick={() => setActiveTab('site-settings')}><i className="fa-solid fa-sliders"></i> Site Setup</li>
                        <li className={`nav-item ${activeTab === 'customer-details' ? 'active' : ''}`} onClick={() => setActiveTab('customer-details')}><i className="fa-solid fa-user-group"></i> Customers</li>
                        <li className={`nav-item ${activeTab === 'store-reviews' ? 'active' : ''}`} onClick={() => setActiveTab('store-reviews')}><i className="fa-solid fa-star"></i> Reviews</li>
                        
                        {isMasterAdmin && (
                            <li className={`nav-item ${activeTab === 'master-control' ? 'active' : ''}`} onClick={() => setActiveTab('master-control')}>
                                <i className="fa-solid fa-shield-halved"></i> Master Control
                            </li>
                        )}
                    </ul>
                </nav>

                <div className="main-pannel">
                    {renderActiveTab()}
                </div>
            </div>
        </div>
    );
}