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

    const [brandName, setBrandName] = useState('');
    const [brandLogo, setBrandLogo] = useState('');
    const [modules, setModules] = useState([]);
    const [storeCategories, setStoreCategories] = useState([]);

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [activeTargetModule, setActiveTargetModule] = useState(null);
    
    // Starts empty, will be populated by Firebase
    const [myProducts, setMyProducts] = useState([]); 
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);

    useEffect(() => {
        if (!user?.email) return;
        
        const loadData = async () => {
            // 1. Load Storefront Layout
            const snap = await getDoc(doc(db, "seller_profiles", user.email));
            if (snap.exists() && snap.data().storefront) {
                const sf = snap.data().storefront;
                setBrandName(sf.brandName || '');
                setBrandLogo(sf.brandLogo || '');
                setModules(sf.modules || []);
            }

            // 2. Load Master Categories
            try {
                const catSnap = await getDocs(collection(db, "categories"));
                const cats = [];
                catSnap.forEach(d => cats.push({ id: d.id, ...d.data() }));
                setStoreCategories(cats);
            } catch (err) {
                console.error("Error loading categories", err);
            }

            // 3. Load REAL Products from Firebase
            setIsLoadingProducts(true);
            try {
                const productSnap = await getDocs(collection(db, "products"));
                const loadedProducts = [];
                
                productSnap.forEach(d => {
                    const p = d.data();
                    
                    // Robust image extraction (handles arrays or strings)
                    let imgUrl = "https://via.placeholder.com/150";
                    if (p.images && p.images.length > 0) imgUrl = p.images[0];
                    else if (typeof p.image === 'string') imgUrl = p.image;
                    else if (typeof p.imageUrl === 'string') imgUrl = p.imageUrl;

                    // Filter logic: In a full production app, you might want to only push products 
                    // where p.sellerEmail === user.email. For now, we load products to ensure it works.
                    loadedProducts.push({
                        id: d.id, // REAL FIREBASE ID FOR ROUTING!
                        name: p.title || p.name || 'Untitled Product',
                        price: p.selling_price || p.price || 0,
                        image: imgUrl
                    });
                });
                
                setMyProducts(loadedProducts);
            } catch (err) {
                console.error("Error loading products", err);
            } finally {
                setIsLoadingProducts(false);
            }
        };
        loadData();
    }, [user]);

    const genId = () => Math.random().toString(36).substr(2, 9);

    const handleUpload = async (e, callback) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
            const resourceType = file.type.startsWith("video/") ? "video" : "image";
            
            const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
                method: "POST", body: formData
            });
            const data = await res.json();
            if (data.secure_url) callback(data.secure_url, resourceType === 'video');
        } catch (err) {
            alert("Upload failed. Check credentials.");
        } finally {
            setUploadingTarget(null);
            e.target.value = '';
        }
    };

    const addModule = (type) => {
        const base = { id: genId(), type };
        if (type === 'main_banner') base.slides = []; base.scrollTime = 10;
        if (type === 'category_row') base.heading = ''; base.items = []; 
        if (type === 'product_single') base.heading = 'TRENDING'; base.products = [];
        if (type === 'product_double') base.heading = 'BEST SELLERS'; base.products = [];
        if (type === 'small_banner') { base.imageUrl = ''; base.link = ''; }
        
        setModules([...modules, base]);
    };

    const updateModule = (id, key, value) => {
        setModules(modules.map(m => m.id === id ? { ...m, [key]: value } : m));
    };

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

    const addBannerSlide = (modId, url, isVideo) => {
        setModules(modules.map(m => m.id === modId ? { ...m, slides: [...(m.slides || []), { url, isVideo, link: '' }] } : m));
    };

    const addCategoryItem = (modId, url, shape) => {
        setModules(modules.map(m => m.id === modId ? { ...m, items: [...(m.items || []), { id: genId(), image: url, text: 'Item', shape }] } : m));
    };

    const updateCategoryItem = (modId, itemId, text) => {
        setModules(modules.map(m => {
            if (m.id !== modId) return m;
            return { ...m, items: m.items.map(i => i.id === itemId ? { ...i, text } : i) };
        }));
    };

    const addProductToView = (product) => {
        setModules(modules.map(m => {
            if (m.id !== activeTargetModule) return m;
            return { ...m, products: [...(m.products || []), product] };
        }));
        setIsProductModalOpen(false);
    };

    const saveStorefront = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await setDoc(doc(db, "seller_profiles", user.email), {
                storefront: { brandName, brandLogo, modules, updatedAt: new Date().toISOString() }
            }, { merge: true });
            alert("Storefront published successfully!");
        } catch (e) {
            alert("Error saving: " + e.message);
        }
        setIsSaving(false);
    };

    return (
        <div className="content-section active wysiwyg-container">
            
            <div className="wysiwyg-header-controls">
                <div>
                    <h2 style={{margin:0, fontSize: '20px'}}>Storefront Visual Builder</h2>
                    <p style={{margin: '4px 0 0', fontSize: '13px', color: 'var(--ws-muted)'}}>Drag, drop, and click to build your custom brand page.</p>
                </div>
                <button className="btn-submit" onClick={saveStorefront} disabled={isSaving}>
                    {isSaving ? "Publishing..." : "Save & Publish"}
                </button>
            </div>

            <div className="wysiwyg-canvas">
                
                <div className="canvas-block brand-header-block">
                    <div className="brand-logo-circle">
                        {uploadingTarget === 'logo' ? <i className="fa-solid fa-spinner fa-spin"></i> : brandLogo ? <img src={brandLogo} alt="Logo" /> : <span>Logo</span>}
                        <label className="add-btn-circle inline">
                            <i className="fa-solid fa-plus"></i>
                            <input type="file" accept="image/*" style={{display:'none'}} onChange={(e) => { setUploadingTarget('logo'); handleUpload(e, (url) => setBrandLogo(url)); }} />
                        </label>
                    </div>
                    <input 
                        type="text" 
                        className="invisible-input brand-name-input" 
                        placeholder="BRAND NAME" 
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                    />
                </div>

                {modules.map((mod, idx) => (
                    <div key={mod.id} className="canvas-block active-module">
                        
                        <div className="module-controls">
                            <button onClick={() => moveModule(idx, -1)}><i className="fa-solid fa-arrow-up"></i></button>
                            <button onClick={() => moveModule(idx, 1)}><i className="fa-solid fa-arrow-down"></i></button>
                            <button onClick={() => removeModule(mod.id)} className="delete-mod"><i className="fa-solid fa-trash"></i></button>
                        </div>

                        {/* --- MAIN BANNER --- */}
                        {mod.type === 'main_banner' && (
                            <div className="module-main-banner">
                                <div className="banner-settings">
                                    <span style={{fontSize:'10px', color: '#888', textTransform:'uppercase', fontWeight:'bold'}}>Main Banner</span>
                                    <div>Scroll Time: <input type="number" value={mod.scrollTime || 10} onChange={(e) => updateModule(mod.id, 'scrollTime', e.target.value)} style={{width:'50px'}} /> sec</div>
                                </div>
                                <div className="banner-preview-area" style={{ flexWrap: 'nowrap' }}>
                                    {mod.slides?.map((slide, sIdx) => (
                                        <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div className="banner-thumb">
                                                {slide.isVideo ? <video src={slide.url} muted /> : <img src={slide.url} alt="slide" />}
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="/category/... or https://..." 
                                                style={{ fontSize: '10px', padding: '4px', width: '140px', border: '1px solid var(--ws-line)', borderRadius: '4px' }}
                                                value={slide.link || ''}
                                                onChange={(e) => updateBannerSlideLink(mod.id, sIdx, e.target.value)}
                                                title="Add a link so customers can click this banner"
                                            />
                                        </div>
                                    ))}
                                    
                                    <label className="add-btn-circle" style={{ alignSelf: 'flex-start' }}>
                                        {uploadingTarget === mod.id ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
                                        <input type="file" accept="image/*,video/mp4" style={{display:'none'}} onChange={(e) => { setUploadingTarget(mod.id); handleUpload(e, (url, isVid) => addBannerSlide(mod.id, url, isVid)); }} />
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* --- CATEGORY ROW --- */}
                        {mod.type === 'category_row' && (
                            <div className="module-category">
                                <select 
                                    className="invisible-input category-title-select" 
                                    value={mod.heading} 
                                    onChange={(e) => updateModule(mod.id, 'heading', e.target.value)}
                                    style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', width: '100%', borderBottom: '2px solid var(--ws-ink)', marginBottom: '20px' }}
                                >
                                    <option value="" disabled>Select Master Category...</option>
                                    {storeCategories.map(cat => (
                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                    ))}
                                    <option value="CUSTOM">Custom Title</option>
                                </select>

                                {mod.heading === 'CUSTOM' && (
                                    <input 
                                        type="text" 
                                        className="invisible-input category-title" 
                                        placeholder="Type custom heading..."
                                        onChange={(e) => updateModule(mod.id, 'heading', e.target.value)} 
                                        style={{ width: '100%', borderBottom: '2px solid var(--ws-ink)', fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '20px' }}
                                    />
                                )}
                                
                                <div className="category-items-flex">
                                    {mod.items?.map((item) => (
                                        <div key={item.id} className="category-item-card">
                                            <div className={`cat-image-frame ${item.shape}`}>
                                                <img src={item.image} alt={item.text} />
                                            </div>
                                            <input 
                                                type="text" 
                                                className="invisible-input cat-item-text" 
                                                value={item.text} 
                                                onChange={(e) => updateCategoryItem(mod.id, item.id, e.target.value)} 
                                            />
                                        </div>
                                    ))}
                                    
                                    <div className="category-add-tools">
                                        <label className="add-btn-circle circle" title="Add Circle Image">
                                            <i className="fa-solid fa-plus"></i>
                                            <input type="file" accept="image/*" style={{display:'none'}} onChange={(e) => { setUploadingTarget(mod.id); handleUpload(e, (url) => addCategoryItem(mod.id, url, 'circle')); }} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- PRODUCT VIEW --- */}
                        {(mod.type === 'product_single' || mod.type === 'product_double') && (
                            <div className="module-product-view">
                                <input 
                                    type="text" 
                                    className="invisible-input product-view-title" 
                                    value={mod.heading} 
                                    onChange={(e) => updateModule(mod.id, 'heading', e.target.value)} 
                                />
                                <div className={`product-grid ${mod.type === 'product_double' ? 'double-row' : 'single-row'}`}>
                                    {mod.products?.map((prod, pIdx) => (
                                        <div key={pIdx} className="mock-product-card">
                                            {/* Delete Product from layout button */}
                                            <button 
                                                className="item-delete-btn" 
                                                onClick={() => {
                                                    const updatedProds = [...mod.products];
                                                    updatedProds.splice(pIdx, 1);
                                                    updateModule(mod.id, 'products', updatedProds);
                                                }}
                                                style={{position: 'absolute', top: '5px', right: '5px', zIndex: 10, background: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', color: '#dc2626'}}
                                            ><i className="fa-solid fa-xmark"></i></button>
                                            
                                            <img src={prod.image} alt={prod.name} />
                                            <div className="mock-prod-details">
                                                <div className="mock-prod-name">{prod.name}</div>
                                                <div className="mock-prod-price-pill">₹{prod.price}</div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        type="button" 
                                        className="add-btn-circle square" 
                                        onClick={() => { setActiveTargetModule(mod.id); setIsProductModalOpen(true); }}
                                    >
                                        <i className="fa-solid fa-plus"></i>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* --- SMALL BANNER --- */}
                        {mod.type === 'small_banner' && (
                            <div className="module-small-banner" style={{ flexDirection: 'column', height: 'auto', border: '1px solid var(--ws-ink)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ position: 'relative', width: '100%', height: '90px', background: '#fdfdfd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{fontSize:'10px', color: '#888', textTransform:'uppercase', fontWeight:'bold', position: 'absolute', top: '10px', left: '10px', background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: '4px', zIndex: 2}}>Small Banner</span>
                                    
                                    {mod.imageUrl ? (
                                        <img src={mod.imageUrl} alt="Small Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <span className="helper-text">Blank Small Banner Area</span>
                                    )}
                                    <label className="add-btn-circle absolute-center" style={{ zIndex: 3 }}>
                                        {uploadingTarget === mod.id ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
                                        <input type="file" accept="image/*" style={{display:'none'}} onChange={(e) => { setUploadingTarget(mod.id); handleUpload(e, (url) => updateModule(mod.id, 'imageUrl', url)); }} />
                                    </label>
                                </div>
                                <input 
                                    type="text" 
                                    className="invisible-input" 
                                    placeholder="Add banner click link (e.g., /category/men)" 
                                    value={mod.link || ''} 
                                    onChange={(e) => updateModule(mod.id, 'link', e.target.value)} 
                                    style={{ width: '100%', padding: '8px 12px', fontSize: '11px', borderTop: '1px solid var(--ws-line)' }}
                                />
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
            </div>

            {isProductModalOpen && (
                <div className="product-modal-overlay" onClick={() => setIsProductModalOpen(false)}>
                    <div className="product-modal" onClick={e => e.stopPropagation()}>
                        <h3>Add Your Uploaded Product</h3>
                        <p style={{fontSize: '12px', color: '#666', marginBottom: '16px'}}>Select a product from your inventory to feature in this section.</p>
                        
                        <div className="my-products-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {isLoadingProducts ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <i className="fa-solid fa-spinner fa-spin"></i> Fetching your products...
                                </div>
                            ) : myProducts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626' }}>
                                    No products found in your database. Please upload a product first!
                                </div>
                            ) : (
                                myProducts.map(p => (
                                    <div key={p.id} className="my-product-item" onClick={() => addProductToView(p)}>
                                        <img src={p.image} alt={p.name} />
                                        <div>
                                            <strong>{p.name}</strong>
                                            <div>₹{p.price}</div>
                                        </div>
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