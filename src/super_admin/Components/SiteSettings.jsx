import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../apiConfig.js";
import "../styles/SiteSettings.css";

import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function SiteSettings({ getAuthHeaders, storage, db }) {
    const [setupTab, setSetupTab] = useState("homepage"); 

    const [storeLogoUrl, setStoreLogoUrl] = useState("");
    
    // Login Config States
    const [loginMediaItems, setLoginMediaItems] = useState([]);
    const [loginSlideDuration, setLoginSlideDuration] = useState(5); 
    const [activeLoginSlide, setActiveLoginSlide] = useState(0);
    const [loginTitle, setLoginTitle] = useState("Authentic Traditional Fashion.");
    const [loginSubtitle, setLoginSubtitle] = useState("Elevate your everyday wardrobe with premium fabrics and modern cuts.");

    const [promoMessages, setPromoMessages] = useState([{ text: "", color: "#ffffff" }]);
    const [promoMode, setPromoMode] = useState("grid");
    const [promoBgColor, setPromoBgColor] = useState("#1a1a1a");
    const [promoThread1, setPromoThread1] = useState("rgba(255, 255, 255, 0.05)");
    const [promoVideoFile, setPromoVideoFile] = useState(null);
    const [activePromoVideoUrl, setActivePromoVideoUrl] = useState("");

    const [homeBlocks, setHomeBlocks] = useState([]);
    const [showAddMenu, setShowAddMenu] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const [activeBannerSlides, setActiveBannerSlides] = useState({});
    
    // 🔥 FIX: Track exact component ID that is uploading
    const [uploadingId, setUploadingId] = useState(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeBlockForModal, setActiveBlockForModal] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

    const [allProducts, setAllProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);

    const [storeCategories, setStoreCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState("");

    useEffect(() => {
        loadSiteSettings();
        fetchStoreProducts(); 
        fetchCategories(); 
        fetchLoginConfig(); 
    }, []);

    const loadSiteSettings = async () => {
        try {
            const headers = await getAuthHeaders();
            const resTop = await fetch(`${API_BASE_URL}/admin/settings/hero_banners`, { headers });
            const dataTop = await resTop.json();
            if (dataTop) {
                if (dataTop.store_logo_url) setStoreLogoUrl(dataTop.store_logo_url);
                if (dataTop.promo_messages) setPromoMessages(dataTop.promo_messages);
                if (dataTop.promo_mode) setPromoMode(dataTop.promo_mode);
                if (dataTop.promo_bg_color) setPromoBgColor(dataTop.promo_bg_color);
                if (dataTop.promo_thread1) setPromoThread1(dataTop.promo_thread1);
                if (dataTop.promo_video) setActivePromoVideoUrl(dataTop.promo_video);
            }

            const resHome = await fetch(`${API_BASE_URL}/admin/settings/home_layout`, { headers });
            const dataHome = await resHome.json();
            if (dataHome && dataHome.blocks) setHomeBlocks(dataHome.blocks);
        } catch (error) { console.error("Error loading settings:", error); }
    };

    const fetchLoginConfig = async () => {
        try {
            const docRef = doc(db, "settings", "login_config");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.mediaItems) setLoginMediaItems(data.mediaItems);
                if (data.slideDuration) setLoginSlideDuration(data.slideDuration);
                if (data.title) setLoginTitle(data.title);
                if (data.subtitle) setLoginSubtitle(data.subtitle);
            }
        } catch (error) {
            console.error("Error fetching login config:", error);
        }
    };

    const fetchStoreProducts = async () => {
        setIsLoadingProducts(true);
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            const productsList = [];
            querySnapshot.forEach((docSnap) => productsList.push({ id: docSnap.id, ...docSnap.data() }));
            setAllProducts(productsList);
        } catch (error) {
            console.error("Error fetching products:", error);
        } finally {
            setIsLoadingProducts(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const snap = await getDocs(collection(db, "categories"));
            const cats = [];
            snap.forEach(d => cats.push({ id: d.id, ...d.data() }));
            setStoreCategories(cats);
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const handleAddMainCategory = async () => {
        if (!newCategoryName.trim()) return;
        const slug = newCategoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        try {
            await setDoc(doc(db, "categories", slug), { 
                name: newCategoryName.trim(), 
                subcategories: [] 
            });
            setNewCategoryName("");
            fetchCategories();
        } catch (error) {
            alert("Error adding category.");
        }
    };

    const handleDeleteMainCategory = async (slug) => {
        if (window.confirm("Delete this category? This might affect existing storefront routing.")) {
            await deleteDoc(doc(db, "categories", slug));
            fetchCategories();
        }
    };

    const handleAddSubcategory = async (catSlug, currentSubs, newSub) => {
        const trimmed = newSub.trim().toLowerCase();
        if (!trimmed || currentSubs.includes(trimmed)) return;
        const updatedSubs = [...currentSubs, trimmed];
        await setDoc(doc(db, "categories", catSlug), { subcategories: updatedSubs }, { merge: true });
        fetchCategories();
    };

    const handleDeleteSubcategory = async (catSlug, currentSubs, subToRemove) => {
        const updatedSubs = currentSubs.filter(s => s !== subToRemove);
        await setDoc(doc(db, "categories", catSlug), { subcategories: updatedSubs }, { merge: true });
        fetchCategories();
    };

    const uploadToCloudinary = async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        const resourceType = file.type.startsWith("video/") ? "video" : "auto";
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, { method: "POST", body: formData });
        const data = await response.json();
        return { url: data.secure_url, isVideo: data.resource_type === "video" };
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        try {
            const headers = await getAuthHeaders();

            let finalVideoUrl = activePromoVideoUrl;
            if (promoMode === "video" && promoVideoFile) {
                const uploadRes = await uploadToCloudinary(promoVideoFile);
                finalVideoUrl = uploadRes.url;
            }

            await fetch(`${API_BASE_URL}/admin/settings/hero_banners`, {
                method: "PUT", headers,
                body: JSON.stringify({
                    store_logo_url: storeLogoUrl,
                    promo_messages: promoMessages,
                    promo_mode: promoMode,
                    promo_bg_color: promoBgColor,
                    promo_thread1: promoThread1,
                    promo_video: finalVideoUrl
                })
            });

            await fetch(`${API_BASE_URL}/admin/settings/home_layout`, {
                method: "PUT", headers,
                body: JSON.stringify({ blocks: homeBlocks })
            });

            await setDoc(doc(db, "settings", "login_config"), {
                mediaItems: loginMediaItems,
                slideDuration: Number(loginSlideDuration),
                title: loginTitle,
                subtitle: loginSubtitle,
                lastUpdated: new Date()
            }, { merge: true });

            setActivePromoVideoUrl(finalVideoUrl);
            setPromoVideoFile(null);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error("Full Save Error Details:", error);
            alert("Error saving: " + (error.message || "Check the browser console for details."));
        } finally {
            setIsSaving(false);
        }
    };

    const addBlock = (type, shape = null) => {
        setHomeBlocks(prev => [...prev, {
            id: Date.now(), type, shape, title: type === "row" ? "NEW SECTION" : "",
            bgColor: shape === "rectangle" ? "#ffffff" : "#f9fafb",
            routeLink: "",
            items: [], slides: []
        }]);
        setShowAddMenu(false);
    };

    const updateBlock = (id, patch) =>
        setHomeBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));

    const loadWireframeTemplate = () => {
        if (window.confirm("This will replace your current homepage layout with the structure from your sketch. Continue?")) {
            setHomeBlocks([
                { id: Date.now() + 1, type: "row", shape: "rectangle", title: "WOMEN COLLECTION", routeLink: "/category/women", bgColor: "#ffffff", items: [] },
                { id: Date.now() + 2, type: "row", shape: "circle", title: "FEATURED BRAND", routeLink: "/category/all", bgColor: "#f9fafb", items: [] }
            ]);
            setShowAddMenu(false);
        }
    };

    const handlePromoSlideUpload = async (blockId, e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingId(blockId);
        try {
            const { url, isVideo } = await uploadToCloudinary(file);
            setHomeBlocks(prev => prev.map(b =>
                b.id === blockId
                    ? { ...b, slides: [...(b.slides || []), { image: url, isVideo, link: "", openInNewTab: false }] }
                    : b
            ));
        } catch (error) { alert("Upload Error: " + error.message); }
        finally { setUploadingId(null); e.target.value = ""; }
    };

    const handleLoginMediaUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setUploadingId("login");
        try {
            const uploadedItems = [];
            for (const file of files) {
                const { url, isVideo } = await uploadToCloudinary(file);
                uploadedItems.push({ type: isVideo ? 'video' : 'image', url: url });
            }
            setLoginMediaItems(prev => [...prev, ...uploadedItems]);
        } catch (error) { 
            alert("Upload Error: " + error.message); 
        } finally { 
            setUploadingId(null); 
            e.target.value = ""; 
        }
    };

    const LinkEditor = ({ media, onChange, label }) => (
        <div className="promo-banner-meta">
            <label>{label}</label>
            <input
                type="text"
                className="admin-custom-input"
                placeholder="/collections/new-arrivals  or  https://example.com"
                value={media.link || ""}
                onChange={(e) => onChange({ link: e.target.value })}
            />
            <p className="promo-banner-hint">
                Use an internal path like <code>/collections/new-arrivals</code>, or a full URL starting with <code>https://</code>.
            </p>
            <div className="promo-banner-meta-row">
                <label className="promo-banner-check">
                    <input
                        type="checkbox"
                        checked={!!media.openInNewTab}
                        onChange={(e) => onChange({ openInNewTab: e.target.checked })}
                    />
                    Open in new tab
                </label>
                {media.link && (
                    <a className="promo-banner-testlink" href={media.link} target="_blank" rel="noopener noreferrer">
                        <i className="fa-solid fa-arrow-up-right-from-square"></i> Preview link
                    </a>
                )}
            </div>
        </div>
    );

    return (
        <div className="content-section active site-settings-container">

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <span className="section-title">Site Setup</span>
                <div style={{ display: "flex", gap: "12px" }}>
                    <button className="option-btn" style={{ margin: 0, height: "44px" }} onClick={() => window.open("http://localhost:5173/", "_blank")}>
                        <i className="fa-solid fa-arrow-up-right-from-square"></i> View Live
                    </button>
                    <button
                        className="btn-submit"
                        disabled={isSaving}
                        style={{
                            width: "auto", marginTop: 0, padding: "0 24px", height: "44px",
                            backgroundColor: saveSuccess ? "#10b981" : "#111", transition: "background-color 0.3s"
                        }}
                        onClick={handleSaveAll}
                    >
                        {isSaving ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : saveSuccess ? <><i className="fa-solid fa-check"></i> Saved!</> : "Save Layout"}
                    </button>
                </div>
            </div>

            <div className="setup-tab-track">
                <button type="button" className={`setup-tab ${setupTab === "homepage" ? "is-active" : ""}`} onClick={() => setSetupTab("homepage")}>Homepage</button>
                <button type="button" className={`setup-tab ${setupTab === "storefront" ? "is-active" : ""}`} onClick={() => setSetupTab("storefront")}>Storefront</button>
                <button type="button" className={`setup-tab ${setupTab === "categories" ? "is-active" : ""}`} onClick={() => setSetupTab("categories")}>Categories</button>
                <button type="button" className={`setup-tab ${setupTab === "login" ? "is-active" : ""}`} onClick={() => setSetupTab("login")}>Login Page</button>
            </div>

            {/* ================= LOGIN PAGE MEDIA BUILDER TAB ================= */}
            {setupTab === "login" && (
                <div className="builder-block">
                    <h3><i className="fa-solid fa-right-to-bracket"></i> Login Page Media Gallery</h3>
                    <p style={{ fontSize: "12px", color: "var(--ws-muted)", marginBottom: "24px" }}>
                        Manage the auto-scrolling images, videos, and overlay text displayed on the customer login screen.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '30px' }}>
                        
                        {/* LEFT COL: Editor Controls */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            <div>
                                <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>Main Overlay Title</label>
                                <input 
                                    type="text" 
                                    className="admin-custom-input" 
                                    value={loginTitle} 
                                    onChange={e => setLoginTitle(e.target.value)} 
                                    placeholder="Authentic Traditional Fashion."
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>Overlay Subtitle</label>
                                <textarea 
                                    className="admin-custom-input" 
                                    rows="3" 
                                    value={loginSubtitle} 
                                    onChange={e => setLoginSubtitle(e.target.value)} 
                                    placeholder="Elevate your everyday wardrobe..."
                                />
                            </div>
                            <div style={{ borderTop: "1px dashed var(--ws-line)", paddingTop: "20px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                    <label style={{ fontSize: "12px", fontWeight: "600", margin: 0 }}>Media Gallery</label>
                                    <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--ws-cocoa)" }}>
                                        Scroll every: 
                                        <input 
                                            type="number" 
                                            className="admin-custom-input" 
                                            style={{ width: "60px", padding: "4px 8px", marginLeft: "6px", display: "inline-block", textAlign: "center" }} 
                                            value={loginSlideDuration} 
                                            onChange={(e) => setLoginSlideDuration(Number(e.target.value))}
                                        /> sec
                                    </div>
                                </div>

                                <div className="login-gallery-manager" style={{ padding: 0, border: 'none' }}>
                                    <div className="banner-carousel" style={{ height: "220px", width: "100%", borderRadius: "10px" }}>
                                        {uploadingId === "login" ? (<div className="upload-overlay"><i className="fa-solid fa-spinner fa-spin"></i></div>) : loginMediaItems.length === 0 ? (
                                            <span style={{ color: "#b3aa9e" }}><i className="fa-solid fa-image" style={{ fontSize: "24px" }}></i></span>
                                        ) : (loginMediaItems[activeLoginSlide]?.type === 'video' || loginMediaItems[activeLoginSlide]?.isVideo) ? (
                                            <video src={loginMediaItems[activeLoginSlide]?.url || loginMediaItems[activeLoginSlide]?.image} autoPlay loop muted playsInline />
                                        ) : (<img src={loginMediaItems[activeLoginSlide]?.url || loginMediaItems[activeLoginSlide]?.image} alt="Login media" />)}
                                        
                                        <div className="carousel-dots">
                                            {loginMediaItems.map((_, idx) => (
                                                <div key={idx} className={`carousel-dot ${activeLoginSlide === idx ? "active" : ""}`} onClick={() => setActiveLoginSlide(idx)} />
                                            ))}
                                        </div>
                                        
                                        {loginMediaItems.length > 0 && (
                                            <button 
                                                type="button" 
                                                className="promo-banner-slide-delete" 
                                                onClick={() => {
                                                    setLoginMediaItems(prev => prev.filter((_, i) => i !== activeLoginSlide));
                                                    setActiveLoginSlide(0);
                                                }}
                                                style={{ top: "10px", right: "10px" }}
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                    
                                    <label className="banner-add-slide-btn" style={{ width: "100%", justifyContent: "center", marginTop: "12px" }}>
                                        <i className="fa-solid fa-cloud-arrow-up"></i> Upload Images / Videos
                                        <input type="file" multiple accept="image/*,video/*" style={{ display: "none" }} onChange={handleLoginMediaUpload} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COL: Live Split-Screen Mockup */}
                        <div style={{ backgroundColor: "var(--ws-cream)", borderRadius: "12px", border: "1px solid var(--ws-line)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                            <div style={{ background: "var(--ws-sand)", padding: "8px 12px", fontSize: "11px", fontWeight: "700", color: "var(--ws-cocoa)", textTransform: "uppercase", borderBottom: "1px solid var(--ws-line)", display: "flex", alignItems: "center", gap: "6px" }}>
                                <i className="fa-solid fa-eye"></i> Live Preview
                            </div>
                            <div style={{ display: "flex", height: "400px" }}>
                                
                                {/* Left Side of Preview (Media + Gradient Overlay) */}
                                <div style={{ flex: 1.2, position: "relative", backgroundColor: "var(--ws-ink)" }}>
                                    {(loginMediaItems[activeLoginSlide]?.type === 'video' || loginMediaItems[activeLoginSlide]?.isVideo) ? (
                                        <video src={loginMediaItems[activeLoginSlide]?.url || loginMediaItems[activeLoginSlide]?.image} autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                        <img src={loginMediaItems[activeLoginSlide]?.url || loginMediaItems[activeLoginSlide]?.image || "https://images.unsplash.com/photo-1550614000-4b95d466bcbe?q=80&w=2070&auto=format&fit=crop"} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: loginMediaItems.length ? 1 : 0.3 }} />
                                    )}
                                    
                                    <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", padding: "30px", background: "linear-gradient(to top, rgba(45,42,38,0.95), rgba(45,42,38,0.4) 60%, transparent)", color: "var(--ws-cream)" }}>
                                        <h2 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 8px", letterSpacing: "-0.02em" }}>{loginTitle || "Authentic Traditional Fashion."}</h2>
                                        <p style={{ fontSize: "11px", opacity: 0.9, margin: 0, lineHeight: 1.5 }}>{loginSubtitle || "Elevate your everyday wardrobe with premium fabrics and modern cuts."}</p>
                                    </div>
                                </div>

                                {/* Right Side of Preview (Form Mockup) */}
                                <div style={{ flex: 1, backgroundColor: "var(--ws-cream)", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--ws-brown)", marginBottom: "20px" }}>JAMBA<span style={{ color: "var(--ws-ink)", fontWeight: 400 }}>WEAR</span></div>
                                    <h3 style={{ fontSize: "14px", margin: "0 0 6px", color: "var(--ws-ink)" }}>Welcome Back</h3>
                                    <p style={{ fontSize: "9px", color: "var(--ws-body)", textAlign: "center", marginBottom: "20px" }}>Sign in to access your orders.</p>
                                    
                                    <div style={{ width: "100%", height: "36px", border: "1px solid var(--ws-line)", borderRadius: "999px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ fontSize: "10px", fontWeight: "600" }}><i className="fa-brands fa-google"></i> Google</span>
                                    </div>
                                    <div style={{ width: "100%", height: "36px", background: "var(--ws-ink)", borderRadius: "999px" }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= CATEGORIES MANAGER TAB ================= */}
            {setupTab === "categories" && (
                <div className="builder-block">
                    <h3><i className="fa-solid fa-tags"></i> Master Category List</h3>
                    <p style={{ fontSize: "12px", color: "var(--ws-muted)", marginBottom: "24px" }}>
                        Manage the central categories for your storefront. These drive your homepage routing and product tagging.
                    </p>

                    <div style={{ display: "flex", gap: "10px", marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px dashed var(--ws-line)" }}>
                        <input 
                            type="text" 
                            className="admin-custom-input" 
                            placeholder="New Main Category (e.g., Men's)" 
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            style={{ margin: 0, maxWidth: "300px" }}
                        />
                        <button className="btn-submit" style={{ width: "auto", margin: 0, padding: "0 24px" }} onClick={handleAddMainCategory}>
                            + Add Category
                        </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {storeCategories.map(cat => (
                            <div key={cat.id} style={{ background: "#f9fafb", padding: "20px", borderRadius: "12px", border: "1px solid var(--ws-line)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h4 style={{ margin: 0, color: "var(--ws-ink)" }}>{cat.name} <span style={{ fontSize: "11px", color: "var(--ws-muted)", fontWeight: "normal", marginLeft: "4px" }}>(/{cat.id})</span></h4>
                                    <button onClick={() => handleDeleteMainCategory(cat.id)} style={{ background: "transparent", border: "none", color: "#b4544a", cursor: "pointer", padding: "4px 8px" }}><i className="fa-solid fa-trash"></i></button>
                                </div>
                                
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                                    {(cat.subcategories || []).map(sub => (
                                        <span key={sub} style={{ background: "#ffffff", border: "1px solid var(--ws-line)", padding: "6px 14px", borderRadius: "999px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "8px", color: "var(--ws-ink)", fontWeight: "500" }}>
                                            {sub.charAt(0).toUpperCase() + sub.slice(1)}
                                            <i className="fa-solid fa-xmark" style={{ cursor: "pointer", color: "var(--ws-muted)" }} onClick={() => handleDeleteSubcategory(cat.id, cat.subcategories, sub)}></i>
                                        </span>
                                    ))}
                                </div>

                                <div style={{ display: "flex", gap: "8px" }}>
                                    <input 
                                        type="text" 
                                        className="admin-custom-input" 
                                        placeholder="Add subcategory (e.g., Shirts)" 
                                        id={`sub-input-${cat.id}`}
                                        style={{ margin: 0, maxWidth: "250px", padding: "8px 12px", fontSize: "12px" }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddSubcategory(cat.id, cat.subcategories || [], e.target.value);
                                                e.target.value = "";
                                            }
                                        }}
                                    />
                                    <button 
                                        className="option-btn" 
                                        style={{ margin: 0, padding: "0 20px", height: "auto" }}
                                        onClick={() => {
                                            const input = document.getElementById(`sub-input-${cat.id}`);
                                            handleAddSubcategory(cat.id, cat.subcategories || [], input.value);
                                            input.value = "";
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        ))}
                        {storeCategories.length === 0 && <p style={{ color: "var(--ws-muted)", fontSize: "13px", fontStyle: "italic" }}>No categories created yet. Add one above to get started.</p>}
                    </div>
                </div>
            )}

            {/* ================= STOREFRONT HEADER TAB ================= */}
            {setupTab === "storefront" && (
                <div className="builder-block">
                    <div style={{ position: "absolute", top: "16px", right: "16px" }}>GLOBAL HEADER SETTINGS</div>

                    <h3><i className="fa-solid fa-pen-to-square"></i> Editable Logo</h3>

                    <div className="form-group" style={{ margin: 0, maxWidth: "400px" }}>
                        <label style={{ fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "6px" }}>Store Logo Image Link</label>
                        <input type="text" value={storeLogoUrl} onChange={(e) => setStoreLogoUrl(e.target.value)} className="admin-custom-input" placeholder="Paste Logo Image Link here..." />
                        {storeLogoUrl && <div className="image-preview-box" style={{ backgroundImage: `url(${storeLogoUrl})`, height: "60px", marginTop: "10px" }}></div>}
                    </div>

                    <div style={{ marginTop: "30px", borderTop: "1px dashed #e6dfd4", paddingTop: "20px" }}>
                        <h4>Editable Scrolling Text</h4>

                        {promoMessages.map((msg, index) => (
                            <div key={index} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
                                <input type="text" value={msg.text} onChange={(e) => { const m = [...promoMessages]; m[index].text = e.target.value; setPromoMessages(m); }} className="admin-custom-input" placeholder={`Message ${index + 1}`} style={{ flex: 1, margin: 0 }} />
                                <input type="color" value={msg.color} onChange={(e) => { const m = [...promoMessages]; m[index].color = e.target.value; setPromoMessages(m); }} title="Text Color" />
                                {promoMessages.length > 1 && <button type="button" onClick={() => setPromoMessages(promoMessages.filter((_, i) => i !== index))} style={{ background: "transparent", border: "none", color: "#b4544a", cursor: "pointer", padding: "8px" }}><i className="fa-solid fa-trash"></i></button>}
                            </div>
                        ))}
                        {promoMessages.length < 4 && <button type="button" className="banner-add-slide-btn" onClick={() => setPromoMessages([...promoMessages, { text: "", color: "#fff" }])}>+ Add Message</button>}
                    </div>
                </div>
            )}

            {/* ================= HOMEPAGE LAYOUT TAB ================= */}
            {setupTab === "homepage" && (
                <>
                    <div className="blocks-container">
                        {homeBlocks.length === 0 ? (
                            <p style={{ textAlign: "center", padding: "40px 0", color: "#8a8178" }}>No dynamic sections added yet. Click + below to start building.</p>
                        ) : (
                            homeBlocks.map(block => (
                                <div key={block.id} className="builder-block">
                                    <button className="block-delete-btn" onClick={() => setHomeBlocks(prev => prev.filter(b => b.id !== block.id))}>Remove Section</button>

                                    {block.type === "row" && (
                                        <>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px", paddingRight: "140px" }}>
                                                
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                                    <input type="text" className="block-title-input" value={block.title} onChange={(e) => updateBlock(block.id, { title: e.target.value })} placeholder="SECTION TITLE" style={{ width: "100%" }} />
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#fff", padding: "6px 12px", borderRadius: "999px", border: "1px solid #e6dfd4", flexShrink: 0 }}>
                                                        <label style={{ fontSize: "12px", fontWeight: "600" }}>Background</label>
                                                        <input type="color" value={block.bgColor || "#ffffff"} onChange={(e) => updateBlock(block.id, { bgColor: e.target.value })} style={{ width: "28px", height: "28px" }} />
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                    <label style={{ fontSize: "11px", fontWeight: "700", color: "#8a8178", textTransform: "uppercase" }}>View More Route:</label>
                                                    
                                                    {(() => {
                                                        const routeStr = (block.routeLink || "").replace(/^\/category\/?/, "");
                                                        const parts = routeStr ? routeStr.split("/") : [];
                                                        const currentCatSlug = parts[0] ? parts[0].toLowerCase() : "";
                                                        const currentSub = parts[1] ? parts[1].toLowerCase() : "";

                                                        const selectedCategoryObj = storeCategories.find(c => c.id === currentCatSlug);
                                                        const availableSubcats = selectedCategoryObj ? (selectedCategoryObj.subcategories || []) : [];

                                                        return (
                                                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                                                
                                                                <select 
                                                                    className="admin-custom-input"
                                                                    style={{ width: "150px", padding: "8px 12px", margin: 0, cursor: "pointer", textTransform: "capitalize" }}
                                                                    value={currentCatSlug}
                                                                    onChange={(e) => {
                                                                        const newCat = e.target.value;
                                                                        if (!newCat) {
                                                                            updateBlock(block.id, { routeLink: "/category/all" });
                                                                        } else {
                                                                            updateBlock(block.id, { routeLink: `/category/${newCat}` });
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">All Categories</option>
                                                                    {storeCategories.map(cat => (
                                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                                    ))}
                                                                </select>

                                                                {currentCatSlug && availableSubcats.length > 0 && (
                                                                    <select 
                                                                        className="admin-custom-input"
                                                                        style={{ width: "160px", padding: "8px 12px", margin: 0, cursor: "pointer", textTransform: "capitalize" }}
                                                                        value={currentSub}
                                                                        onChange={(e) => {
                                                                            const newSub = e.target.value;
                                                                            if (!newSub) {
                                                                                updateBlock(block.id, { routeLink: `/category/${currentCatSlug}` });
                                                                            } else {
                                                                                updateBlock(block.id, { routeLink: `/category/${currentCatSlug}/${newSub}` });
                                                                            }
                                                                        }}
                                                                    >
                                                                        <option value="">All {selectedCategoryObj?.name}...</option>
                                                                        {availableSubcats.map(sub => (
                                                                            <option key={sub} value={sub}>{sub}</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                                
                                                                <span style={{ fontSize: "11px", color: "var(--ws-cocoa)", marginLeft: "8px", fontWeight: "600", letterSpacing: "0.05em" }}>
                                                                    {block.routeLink || "/category/all"}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                            </div>

                                            <div className="row-scroll-area" style={{ backgroundColor: block.bgColor || "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #f0ebe3" }}>
                                                {block.items.map((item, idx) => (
                                                    <div key={idx} className="row-item">
                                                        <button className="item-delete-btn" onClick={() => updateBlock(block.id, { items: block.items.filter((_, i) => i !== idx) })}><i className="fa-solid fa-xmark"></i></button>

                                                        {block.shape === "circle" ? (
                                                            <>
                                                                <div className="upload-box circle"><img src={item.image || "https://via.placeholder.com/150"} alt="" /></div>
                                                                <input type="text" className="item-name-input" value={item.name} onChange={(e) => { const i = [...block.items]; i[idx].name = e.target.value; updateBlock(block.id, { items: i }); }} placeholder="Brand Name" />
                                                                <input type="text" className="item-name-input" value={item.link || ""} onChange={(e) => { const i = [...block.items]; i[idx].link = e.target.value; updateBlock(block.id, { items: i }); }} placeholder="Routing Link" style={{ fontSize: "10px", color: "#8a8178" }} />
                                                            </>
                                                        ) : (
                                                            <div style={{ width: "150px", background: "#fff", padding: "6px", borderRadius: "12px", textAlign: "left", border: "1px solid #e6dfd4" }}>
                                                                <img src={item.image} alt="" style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "8px" }} />
                                                                <p style={{ margin: "8px 0 2px", fontSize: "12px", fontWeight: "bold" }}>{item.name}</p>
                                                                <p style={{ margin: 0, fontSize: "11px", color: "#8a8178" }}>Routing Auto <i className="fa-solid fa-link" style={{ fontSize: "10px" }}></i></p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}

                                                <div className="row-item" style={{ justifyContent: "center" }}>
                                                    {block.shape === "circle" ? (
                                                        <label className="upload-box circle" style={{ borderStyle: "solid", background: "transparent" }}><i className="fa-solid fa-plus" style={{ fontSize: "24px" }}></i>
                                                            <input type="file" style={{ display: "none" }} onChange={async (e) => { const { url } = await uploadToCloudinary(e.target.files[0]); updateBlock(block.id, { items: [...block.items, { image: url, name: "", link: "" }] }); }} />
                                                        </label>
                                                    ) : (
                                                        <div className="upload-box rectangle" style={{ borderStyle: "solid", background: "transparent", height: "100%", minHeight: "160px" }} onClick={() => { setActiveBlockForModal(block.id); setIsModalOpen(true); }}><i className="fa-solid fa-plus" style={{ fontSize: "24px" }}></i></div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {block.type === "promo-banner" && (() => {
                                        const slides = block.slides || [];
                                        const key = `${block.id}-promo`;
                                        const activeIdx = Math.min(activeBannerSlides[key] || 0, Math.max(slides.length - 1, 0));
                                        const slide = slides[activeIdx];
                                        const go = (dir) => setActiveBannerSlides(prev => ({ ...prev, [key]: (activeIdx + dir + slides.length) % slides.length }));
                                        return (
                                            <>
                                                <h3><i className="fa-solid fa-rectangle-ad"></i> Promo Banner</h3>
                                                <div className="promo-banner-stage">
                                                    {uploadingId === block.id ? (<div className="upload-overlay"><i className="fa-solid fa-spinner fa-spin"></i></div>) : !slide ? (
                                                        <label className="promo-banner-empty">
                                                            <i className="fa-solid fa-plus" style={{ fontSize: "22px" }}></i>
                                                            Add first slide
                                                            <input type="file" style={{ display: "none" }} onChange={(e) => handlePromoSlideUpload(block.id, e)} />
                                                        </label>
                                                    ) : slide.isVideo ? (
                                                        <video src={slide.image} autoPlay loop muted playsInline />
                                                    ) : (<img src={slide.image} alt="" />)}

                                                    {slides.length > 1 && (
                                                        <>
                                                            <button type="button" className="promo-banner-nav prev" onClick={(e) => { e.stopPropagation(); go(-1); }}><i className="fa-solid fa-chevron-left"></i></button>
                                                            <button type="button" className="promo-banner-nav next" onClick={(e) => { e.stopPropagation(); go(1); }}><i className="fa-solid fa-chevron-right"></i></button>
                                                        </>
                                                    )}

                                                    {slide && (
                                                        <button type="button" className="promo-banner-slide-delete" onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { slides: slides.filter((_, i) => i !== activeIdx) }); setActiveBannerSlides(prev => ({ ...prev, [key]: 0 })); }}>Delete Slide</button>
                                                    )}

                                                    {slides.length > 1 && (
                                                        <div className="promo-banner-dots">
                                                            {slides.map((_, idx) => (
                                                                <div key={idx} className={`carousel-dot ${activeIdx === idx ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); setActiveBannerSlides(prev => ({ ...prev, [key]: idx })); }} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {slide && (
                                                    <LinkEditor
                                                        media={slide}
                                                        label={`Route Link — Slide ${activeIdx + 1} of ${slides.length}`}
                                                        onChange={(patch) => { const arr = [...slides]; arr[activeIdx] = { ...arr[activeIdx], ...patch }; updateBlock(block.id, { slides: arr }); }}
                                                    />
                                                )}

                                                <div className="promo-banner-actions">
                                                    <label className="banner-add-slide-btn"><i className="fa-solid fa-plus"></i> Add Slide
                                                        <input type="file" style={{ display: "none" }} onChange={(e) => handlePromoSlideUpload(block.id, e)} />
                                                    </label>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ))
                        )}
                    </div>

                    <div className="master-add-container">
                        <button className="master-add-btn" onClick={() => setShowAddMenu(!showAddMenu)}><i className={`fa-solid ${showAddMenu ? "fa-xmark" : "fa-plus"}`}></i></button>
                        {showAddMenu && (
                            <div className="add-options">
                                <button className="option-btn" onClick={() => addBlock("promo-banner")}><i className="fa-solid fa-rectangle-ad"></i> Promo Banner</button>
                                <button className="option-btn" onClick={() => addBlock("row", "rectangle")}><i className="fa-regular fa-square"></i> Product Cards</button>
                                <button className="option-btn" onClick={() => addBlock("row", "circle")}><i className="fa-regular fa-circle"></i> Circle Row</button>
                                <button className="option-btn" onClick={loadWireframeTemplate}><i className="fa-solid fa-pen-nib"></i> Load Wireframe</button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* PRODUCT MODAL */}
            {isModalOpen && (
                <div className="product-modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="product-modal" onClick={e => e.stopPropagation()}>
                        <div className="product-modal-header">
                            <h3>Select a Product</h3>
                            <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <input type="text" className="product-search-input" placeholder="Search..." onChange={e => setSearchTerm(e.target.value)} />

                        <div className="product-grid">
                            {isLoadingProducts ? (
                                <p style={{ padding: "20px", color: "#8a8178", textAlign: "center", gridColumn: "1 / -1" }}>
                                    <i className="fa-solid fa-spinner fa-spin"></i> Loading products...
                                </p>
                            ) : allProducts.length === 0 ? (
                                <p style={{ padding: "20px", color: "#b4544a", textAlign: "center", gridColumn: "1 / -1", fontWeight: "bold" }}>
                                    No products found in database. Check your .env file keys!
                                </p>
                            ) : (
                                allProducts.filter(p => p.title?.toLowerCase().includes(searchTerm.toLowerCase())).map(prod => (
                                    <div key={prod.id} className="product-select-card" onClick={() => {
                                        setHomeBlocks(prev => prev.map(b => b.id === activeBlockForModal ? { ...b, items: [...b.items, { name: prod.title, image: prod.images?.[0] || "", link: prod.id, price: prod.selling_price || 0, originalPrice: prod.original_price || 0, brand: prod.brandName }] } : b));
                                        setIsModalOpen(false); setSearchTerm("");
                                    }}>
                                        <img src={prod.images?.[0] || "https://via.placeholder.com/150"} alt={prod.title} />
                                        <p>{prod.title}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}