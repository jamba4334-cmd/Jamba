import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './SellerStorefrontEditor.css';

export default function SellerStorefrontEditor() {
    const auth = getAuth();
    const user = auth.currentUser;

    const [isSaving, setIsSaving] = useState(false);
    const [uploadingTarget, setUploadingTarget] = useState(null);

    // Global Store Brand Info
    const [brandName, setBrandName] = useState('');
    const [brandLogo, setBrandLogo] = useState('');
    const [brandColor, setBrandColor] = useState('#000000');
    
    // Header Display Options
    const [headerType, setHeaderType] = useState('text'); 
    const [headerBanner, setHeaderBanner] = useState('');
    
    // Core Data State
    const [modules, setModules] = useState([]); 
    const [customPages, setCustomPages] = useState([]); 
    const [storeCategories, setStoreCategories] = useState([]);
    
    // UI Navigation State
    const [activeTab, setActiveTab] = useState('store'); 
    const [editingPageId, setEditingPageId] = useState(null);

    // Product Selection State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [activeTargetModule, setActiveTargetModule] = useState(null);
    const [myProducts, setMyProducts] = useState([]); 
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);

    useEffect(() => {
        if (!user?.email) return;
        
        const loadData = async () => {
            const snap = await getDoc(doc(db, "seller_profiles", user.email));
            if (snap.exists() && snap.data().storefront) {
                const sf = snap.data().storefront;
                setBrandName(sf.brandName || '');
                setBrandLogo(sf.brandLogo || '');
                setBrandColor(sf.brandColor || '#000000');
                setHeaderType(sf.headerType || 'text');
                setHeaderBanner(sf.headerBanner || '');
                setModules(sf.modules || []);
                setCustomPages(sf.pages || []);
            }

            try {
                const catSnap = await getDocs(collection(db, "categories"));
                const cats = [];
                catSnap.forEach(d => cats.push({ id: d.id, ...d.data() }));
                setStoreCategories(cats);
            } catch (err) {}

            setIsLoadingProducts(true);
            try {
                const productSnap = await getDocs(collection(db, "products"));
                const loadedProducts = [];
                productSnap.forEach(d => {
                    const p = d.data();
                    let imgUrl = "https://via.placeholder.com/150";
                    if (p.images && p.images.length > 0) imgUrl = p.images[0];
                    else if (typeof p.image === 'string') imgUrl = p.image;
                    else if (typeof p.imageUrl === 'string') imgUrl = p.imageUrl;

                    loadedProducts.push({
                        id: d.id, name: p.title || p.name || 'Untitled Product', price: p.selling_price || p.price || 0, image: imgUrl
                    });
                });
                setMyProducts(loadedProducts);
            } catch (err) {} 
            finally { setIsLoadingProducts(false); }
        };
        loadData();
    }, [user]);

    const genId = () => Math.random().toString(36).substr(2, 9);

    const saveStorefront = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await setDoc(doc(db, "seller_profiles", user.email), {
                storefront: { 
                    brandName, brandLogo, brandColor, headerType, headerBanner, 
                    modules, pages: customPages, updatedAt: new Date().toISOString() 
                }
            }, { merge: true });
            alert("Storefront and Pages published successfully!");
        } catch (e) { alert("Error saving: " + e.message); }
        setIsSaving(false);
    };

    const handleUpload = async (e, callback) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
            const resourceType = file.type.startsWith("video/") ? "video" : "image";
            const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.secure_url) callback(data.secure_url, resourceType === 'video');
        } catch (err) { alert("Upload failed. Check credentials."); } 
        finally { setUploadingTarget(null); e.target.value = ''; }
    };

    const addModule = (type) => {
        const base = { id: genId(), type };
        if (type === 'main_banner') { base.slides = []; base.scrollTime = 10; }
        if (type === 'category_row') { base.heading = ''; base.items = []; }
        if (type === 'product_single') { base.heading = 'TRENDING'; base.products = []; base.bubbleColor = 'var(--ws-sand)'; base.moreLink = ''; }
        if (type === 'product_double') { base.heading = 'BEST SELLERS'; base.products = []; base.bubbleColor = 'var(--ws-sand)'; base.moreLink = ''; }
        if (type === 'small_banner') { base.slides = []; base.scrollTime = 5; }
        setModules([...modules, base]);
    };
    const updateModule = (id, key, value) => setModules(modules.map(m => m.id === id ? { ...m, [key]: value } : m));
    const removeModule = (id) => setModules(modules.filter(m => m.id !== id));
    const moveModule = (index, dir) => {
        const target = index + dir;
        if (target < 0 || target >= modules.length) return;
        const newMods = [...modules];
        const temp = newMods[index];
        newMods[index] = newMods[target];
        newMods[target] = temp;
        setModules(newMods);
    };

    const updateBannerSlideLink = (modId, slideIndex, linkValue) => {
        setModules(modules.map(m => {
            if (m.id !== modId) return m;
            const updatedSlides = [...m.slides];
            updatedSlides[slideIndex].link = linkValue;
            return { ...m, slides: updatedSlides };
        }));
    };
    const addBannerSlide = (modId, url, isVideo) => setModules(modules.map(m => m.id === modId ? { ...m, slides: [...(m.slides || []), { url, isVideo, link: '' }] } : m));
    const removeBannerSlide = (modId, slideIndex) => setModules(modules.map(m => {
        if (m.id !== modId) return m;
        const updatedSlides = [...m.slides];
        updatedSlides.splice(slideIndex, 1);
        return { ...m, slides: updatedSlides };
    }));

    const addCategoryItem = (modId, url, shape) => setModules(modules.map(m => m.id === modId ? { ...m, items: [...(m.items || []), { id: genId(), image: url, text: 'Item', shape }] } : m));
    const removeCategoryItem = (modId, itemId) => setModules(modules.map(m => m.id === modId ? { ...m, items: m.items.filter(i => i.id !== itemId) } : m));
    const updateCategoryItem = (modId, itemId, text) => setModules(modules.map(m => m.id === modId ? { ...m, items: m.items.map(i => i.id === itemId ? { ...i, text } : i) } : m));

    const createNewPage = () => {
        const newPage = { id: genId(), title: 'New Page', products: [] };
        setCustomPages([...customPages, newPage]);
        setEditingPageId(newPage.id);
        setActiveTab('edit-page');
    };
    
    const updatePageTitle = (title) => {
        setCustomPages(customPages.map(p => p.id === editingPageId ? { ...p, title } : p));
    };

    const deletePage = (id) => {
        if(window.confirm("Delete this custom page?")) {
            setCustomPages(customPages.filter(p => p.id !== id));
            const linkRef = `/pages/${id}`;
            setModules(modules.map(m => {
                let updated = { ...m };
                if (m.moreLink === linkRef) updated.moreLink = '';
                if (m.slides) updated.slides = m.slides.map(s => s.link === linkRef ? { ...s, link: '' } : s);
                return updated;
            }));
            setActiveTab('pages');
        }
    };

    const addProductToTarget = (product) => {
        if (activeTab === 'edit-page') {
            setCustomPages(customPages.map(p => p.id === editingPageId ? { ...p, products: [...p.products, product] } : p));
        } else {
            setModules(modules.map(m => {
                if (m.id !== activeTargetModule) return m;
                if (m.products?.length >= 7) { alert("Maximum 7 products allowed per view."); return m; }
                return { ...m, products: [...(m.products || []), product] };
            }));
        }
        setIsProductModalOpen(false);
    };

    const removeProductFromPage = (pIdx) => {
        setCustomPages(customPages.map(p => {
            if (p.id !== editingPageId) return p;
            const updated = [...p.products];
            updated.splice(pIdx, 1);
            return { ...p, products: updated };
        }));
    };

    const PageDropdown = ({ value, onChange }) => (
        <select value={value || ''} onChange={onChange} className="route-dropdown">
            <option value="">Select Page to Route...</option>
            {customPages.map(p => (
                <option key={p.id} value={`/pages/${p.id}`}>{p.title}</option>
            ))}
        </select>
    );

    return (
        <div className="content-section active wysiwyg-container">
            
            <div className="wysiwyg-header-controls">
                <div className="store-pages-toggle">
                    <button className={activeTab === 'store' ? 'active' : ''} onClick={() => setActiveTab('store')}>Store</button>
                    <button className={activeTab === 'pages' || activeTab === 'edit-page' ? 'active' : ''} onClick={() => setActiveTab('pages')}>Pages</button>
                </div>
            </div>

            {activeTab === 'store' && (
                <div className="wysiwyg-action-bar center-action">
                    <button className="save-publish-btn" onClick={saveStorefront} disabled={isSaving}>
                        {isSaving ? "Publishing..." : "Save & Publish"}
                    </button>
                </div>
            )}

            {activeTab === 'edit-page' && (
                <div className="wysiwyg-action-bar">
                    <div className="action-bar-left">
                        <div className="banner-link-hint">
                            Banner Link: <strong>/pages/{editingPageId}</strong>
                        </div>
                    </div>
                    <div className="action-bar-right">
                        <button className="save-publish-btn" onClick={saveStorefront} disabled={isSaving}>
                            {isSaving ? "Publishing..." : "Save & Publish"}
                        </button>
                    </div>
                </div>
            )}

            <div className="wysiwyg-canvas">

                {activeTab === 'store' && (
                    <>
                        <div className="canvas-block brand-header-block">
                            <div className="header-type-toggle">
                                <button className={headerType === 'text' ? 'active' : ''} onClick={() => setHeaderType('text')}>Text</button>
                                <button className={headerType === 'banner' ? 'active' : ''} onClick={() => setHeaderType('banner')}>Brand Banner</button>
                            </div>

                            <div className="brand-logo-circle">
                                {uploadingTarget === 'logo' ? <i className="fa-solid fa-spinner fa-spin"></i> : brandLogo ? <img src={brandLogo} alt="Logo" /> : (
                                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
                                        <span>Logo</span>
                                        <div className="info-tooltip">
                                            <i className="fa-solid fa-circle-info"></i>
                                            <span className="tooltip-text">Recommended Size: 400x400px (1:1 Ratio)</span>
                                        </div>
                                    </div>
                                )}
                                <label className="add-btn-circle inline">
                                    <i className="fa-solid fa-plus"></i>
                                    <input type="file" accept="image/*" style={{display:'none'}} onChange={(e) => { setUploadingTarget('logo'); handleUpload(e, (url) => setBrandLogo(url)); }} />
                                </label>
                            </div>
                            
                            {headerType === 'text' ? (
                                <div className="brand-name-wrapper">
                                    <input 
                                        type="text" className="invisible-input brand-name-input" placeholder="BRAND NAME" 
                                        value={brandName} onChange={(e) => setBrandName(e.target.value)} style={{ color: brandColor }} 
                                    />
                                    <input 
                                        type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} 
                                        className="brand-color-picker" title="Change Brand Name Color"
                                    />
                                </div>
                            ) : (
                                <div className="brand-banner-upload-area">
                                    {headerBanner ? (
                                        <img src={headerBanner} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="Brand Banner" />
                                    ) : (
                                        <span style={{color:'#888', fontSize:'12px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                            Upload Brand Banner
                                            <div className="info-tooltip">
                                                <i className="fa-solid fa-circle-info"></i>
                                                <span className="tooltip-text">Recommended Size: 1200x300px (Wide)</span>
                                            </div>
                                        </span>
                                    )}
                                    <label className="add-btn-circle" style={{ position: 'absolute' }}>
                                        {uploadingTarget === 'headerBanner' ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
                                        <input type="file" accept="image/*" style={{display:'none'}} onChange={(e) => { setUploadingTarget('headerBanner'); handleUpload(e, (url) => setHeaderBanner(url)); }} />
                                    </label>
                                </div>
                            )}

                            <span className="official-store-badge">OFFICIAL STORE</span>
                        </div>

                        {modules.map((mod, idx) => (
                            <div key={mod.id} className="canvas-block active-module">
                                <div className="module-controls">
                                    <button onClick={() => moveModule(idx, -1)}><i className="fa-solid fa-arrow-up"></i></button>
                                    <button onClick={() => moveModule(idx, 1)}><i className="fa-solid fa-arrow-down"></i></button>
                                    <button onClick={() => removeModule(mod.id)} className="delete-mod"><i className="fa-solid fa-trash"></i></button>
                                </div>

                                {mod.type === 'main_banner' && (
                                    <div className="module-main-banner">
                                        <div className="banner-settings">
                                            <span style={{fontSize:'10px', color: '#888', textTransform:'uppercase', fontWeight:'bold', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                                Main Banner
                                                <div className="info-tooltip">
                                                    <i className="fa-solid fa-circle-info"></i>
                                                    <span className="tooltip-text">Recommended Size: 1200x600px</span>
                                                </div>
                                            </span>
                                            <div>Scroll Time: <input type="number" value={mod.scrollTime || 10} onChange={(e) => updateModule(mod.id, 'scrollTime', e.target.value)} style={{width:'50px'}} /> sec</div>
                                        </div>
                                        <div className="banner-preview-area">
                                            {mod.slides?.map((slide, sIdx) => (
                                                <div key={sIdx} className="banner-slide-wrapper">
                                                    <button onClick={() => removeBannerSlide(mod.id, sIdx)} className="slide-delete-btn"><i className="fa-solid fa-xmark"></i></button>
                                                    <div className="banner-thumb">{slide.isVideo ? <video src={slide.url} muted /> : <img src={slide.url} alt="slide" />}</div>
                                                    <PageDropdown value={slide.link} onChange={(e) => updateBannerSlideLink(mod.id, sIdx, e.target.value)} />
                                                </div>
                                            ))}
                                            <label className="add-btn-circle add-slide-btn">
                                                {uploadingTarget === mod.id ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
                                                <input type="file" accept="image/*,video/mp4" style={{display:'none'}} onChange={(e) => { setUploadingTarget(mod.id); handleUpload(e, (url, isVid) => addBannerSlide(mod.id, url, isVid)); }} />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {mod.type === 'category_row' && (() => {
                                    const selectedCatObj = storeCategories.find(c => c.name === mod.heading);
                                    const availableSubcats = selectedCatObj ? (selectedCatObj.subcategories || []) : [];
                                    return (
                                        <div className="module-category">
                                            <select className="invisible-input category-title-select" value={mod.heading} onChange={(e) => updateModule(mod.id, 'heading', e.target.value)}>
                                                <option value="" disabled>Select Master Category...</option>
                                                {storeCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                                            </select>
                                            <div className="category-items-flex">
                                                {mod.items?.map((item) => (
                                                    <div key={item.id} className="category-item-card" style={{ position: 'relative' }}>
                                                        <button className="item-delete-btn" onClick={() => removeCategoryItem(mod.id, item.id)}><i className="fa-solid fa-xmark"></i></button>
                                                        <div className={`cat-image-frame ${item.shape}`}><img src={item.image} alt={item.text} /></div>
                                                        <select className="invisible-input cat-item-text" value={item.text} onChange={(e) => updateCategoryItem(mod.id, item.id, e.target.value)}>
                                                            <option value="Item" disabled>Select...</option>
                                                            {availableSubcats.length === 0 && <option value="" disabled>No Subcats</option>}
                                                            {availableSubcats.map((sub, i) => <option key={i} value={sub}>{sub.toUpperCase()}</option>)}
                                                        </select>
                                                    </div>
                                                ))}
                                                <div className="category-add-tools">
                                                    {mod.heading ? (
                                                        <label className="add-btn-circle circle" title="Add Circle Image"><i className="fa-solid fa-plus"></i><input type="file" accept="image/*" style={{display:'none'}} onChange={(e) => { setUploadingTarget(mod.id); handleUpload(e, (url) => addCategoryItem(mod.id, url, 'circle')); }} /></label>
                                                    ) : <div style={{fontSize: '10px', color: 'var(--ws-muted)'}}>Select Category First</div>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {(mod.type === 'product_single' || mod.type === 'product_double') && (
                                    <div className="module-product-view" style={{ backgroundColor: mod.bubbleColor || '#f5f5f5' }}>
                                        <div className="product-view-header">
                                            
                                            {/* 🔥 NEW: Displays the Circular Arrow Next to Title in the Editor */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <input type="text" className="invisible-input product-view-title" value={mod.heading} onChange={(e) => updateModule(mod.id, 'heading', e.target.value)} style={{ margin: 0 }} />
                                                {mod.moreLink && (
                                                    <div className="more-btn" style={{ pointerEvents: 'none' }}>
                                                        <i className="fa-solid fa-arrow-right"></i>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="product-view-tools">
                                                <div className="tool-pill">
                                                    'More' Route: <PageDropdown value={mod.moreLink} onChange={(e) => updateModule(mod.id, 'moreLink', e.target.value)} />
                                                </div>
                                                <div className="tool-pill">
                                                    Bubble: <input type="color" value={mod.bubbleColor || '#f5f5f5'} onChange={(e) => updateModule(mod.id, 'bubbleColor', e.target.value)} className="bubble-color-picker"/>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="product-grid">
                                            {mod.products?.map((prod, pIdx) => (
                                                <div key={pIdx} className="mock-product-card">
                                                    <button className="item-delete-btn" onClick={() => { const updatedProds = [...mod.products]; updatedProds.splice(pIdx, 1); updateModule(mod.id, 'products', updatedProds); }}><i className="fa-solid fa-xmark"></i></button>
                                                    <img src={prod.image} alt={prod.name} />
                                                    <div className="mock-prod-details">
                                                        <div className="mock-prod-name">{prod.name}</div>
                                                        <div className="mock-prod-price-pill">₹{prod.price}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button type="button" className="add-btn-circle square grid-add-btn" onClick={() => { setActiveTargetModule(mod.id); setIsProductModalOpen(true); }}><i className="fa-solid fa-plus"></i></button>
                                        </div>
                                    </div>
                                )}

                                {mod.type === 'small_banner' && (
                                    <div className="module-main-banner" style={{ borderStyle: 'dashed' }}>
                                        <div className="banner-settings">
                                            <span style={{fontSize:'10px', color: '#888', textTransform:'uppercase', fontWeight:'bold', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                                Small Banner Carousel
                                                <div className="info-tooltip">
                                                    <i className="fa-solid fa-circle-info"></i>
                                                    <span className="tooltip-text">Recommended Size: 1200x300px</span>
                                                </div>
                                            </span>
                                            <div>Scroll Time: <input type="number" value={mod.scrollTime || 5} onChange={(e) => updateModule(mod.id, 'scrollTime', e.target.value)} style={{width:'50px'}} /> sec</div>
                                        </div>
                                        <div className="banner-preview-area">
                                            {mod.slides?.map((slide, sIdx) => (
                                                <div key={sIdx} className="banner-slide-wrapper">
                                                    <button onClick={() => removeBannerSlide(mod.id, sIdx)} className="slide-delete-btn"><i className="fa-solid fa-xmark"></i></button>
                                                    <div className="banner-thumb small"><img src={slide.url} alt="slide" /></div>
                                                    <PageDropdown value={slide.link} onChange={(e) => updateBannerSlideLink(mod.id, sIdx, e.target.value)} />
                                                </div>
                                            ))}
                                            <label className="add-btn-circle add-slide-btn">
                                                {uploadingTarget === mod.id ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
                                                <input type="file" accept="image/*,video/mp4" style={{display:'none'}} onChange={(e) => { setUploadingTarget(mod.id); handleUpload(e, (url, isVid) => addBannerSlide(mod.id, url, isVid)); }} />
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        <div className="module-palette">
                            <button type="button" onClick={() => addModule('main_banner')}>BANNER</button>
                            <button type="button" onClick={() => addModule('category_row')}>CATEGORIES</button>
                            <button type="button" onClick={() => addModule('product_single')}>PRODUCT VIEW</button>
                            <button type="button" onClick={() => addModule('product_double')}>DOUBLE PRODUCT VIEW</button>
                            <button type="button" onClick={() => addModule('small_banner')}>SMALL BANNER</button>
                        </div>
                    </>
                )}

                {/* =========================================
                    TAB 2: PAGES DASHBOARD (GRID)
                ========================================= */}
                {activeTab === 'pages' && (
                    <div className="pages-dashboard-grid">
                        {customPages.map(page => (
                            <div key={page.id} className="page-card" onClick={() => { setEditingPageId(page.id); setActiveTab('edit-page'); }}>
                                <div className="page-card-preview">
                                    {page.products && page.products.length > 0 ? (
                                        <img src={page.products[0].image} alt="preview" />
                                    ) : (
                                        <span style={{ color: '#ccc' }}>Empty Page</span>
                                    )}
                                </div>
                                <div className="page-card-title">{page.title}</div>
                            </div>
                        ))}
                        <div className="page-card create-new" onClick={createNewPage}>
                            <div className="page-card-preview">
                                <i className="fa-solid fa-plus"></i>
                            </div>
                            <div className="page-card-title">Create New Page</div>
                        </div>
                    </div>
                )}

                {/* =========================================
                    TAB 3: EDIT SPECIFIC PAGE (TRADITIONAL GRID)
                ========================================= */}
                {activeTab === 'edit-page' && editingPageId && (() => {
                    const page = customPages.find(p => p.id === editingPageId);
                    if (!page) return null;
                    return (
                        <div className="page-editor-view">
                            <button className="back-btn" onClick={() => setActiveTab('pages')}>← Back to Pages</button>
                            
                            <div className="page-editor-header">
                                <input 
                                    type="text" 
                                    className="invisible-input page-editor-title" 
                                    value={page.title} 
                                    onChange={(e) => updatePageTitle(e.target.value)} 
                                    placeholder="Name Of The Page"
                                />
                                <button className="delete-page-btn full-width-mobile" onClick={() => deletePage(page.id)}>
                                    <i className="fa-solid fa-trash"></i> Delete Page
                                </button>
                            </div>

                            <div className="page-fake-sort-bar">
                                <span style={{fontWeight:'bold', marginRight:'10px'}}>SORT BY</span>
                                <span className="sort-pill active">Popularity</span>
                                <span className="sort-pill">Price -- Low to High</span>
                                <span className="sort-pill">Price -- High to Low</span>
                                <span className="sort-pill">Newest First</span>
                            </div>

                            <div className="page-traditional-grid">
                                {page.products?.map((prod, pIdx) => (
                                    <div key={pIdx} className="traditional-product-card">
                                        <button className="item-delete-btn" onClick={() => removeProductFromPage(pIdx)}>
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                        <div className="trad-img-wrapper">
                                            <img src={prod.image} alt={prod.name} />
                                            <div className="trad-heart"><i className="fa-regular fa-heart"></i></div>
                                        </div>
                                        <div className="trad-details">
                                            <div className="trad-brand">{brandName || 'JAMBA'}</div>
                                            <div className="trad-name">{prod.name}</div>
                                            <div className="trad-price-row">
                                                <span className="trad-price">₹{prod.price}</span>
                                                <span className="trad-old-price">₹{(prod.price * 1.2).toFixed(0)}</span> 
                                                <span className="trad-discount">20% off</span>
                                            </div>
                                            <div className="trad-delivery">Delivery by 11th Aug</div>
                                        </div>
                                    </div>
                                ))}
                                
                                <div className="traditional-product-card create-new" onClick={() => setIsProductModalOpen(true)}>
                                    <i className="fa-solid fa-plus"></i>
                                    <div>Add Product</div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

            </div>

            {/* PRODUCT SELECTOR MODAL */}
            {isProductModalOpen && (
                <div className="product-modal-overlay" onClick={() => setIsProductModalOpen(false)}>
                    <div className="product-modal" onClick={e => e.stopPropagation()}>
                        <h3>Select a Product</h3>
                        <div className="my-products-list">
                            {isLoadingProducts ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading...</div>
                            ) : myProducts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626' }}>No products found.</div>
                            ) : (
                                myProducts.map(p => (
                                    <div key={p.id} className="my-product-item" onClick={() => addProductToTarget(p)}>
                                        <img src={p.image} alt={p.name} />
                                        <div><strong>{p.name}</strong><div>₹{p.price}</div></div>
                                        <i className="fa-solid fa-plus"></i>
                                    </div>
                                ))
                            )}
                        </div>
                        <button className="btn-close" onClick={() => setIsProductModalOpen(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}