import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../apiConfig.js"; 
import "../styles/CategorySettings.css";

export default function CategorySettings({ getAuthHeaders }) {
    const tabs = ["MEN", "WOMEN", "ACCESSORIES"];
    const [activeTab, setActiveTab] = useState("MEN");
    const [pageData, setPageData] = useState({ MEN: [], WOMEN: [], ACCESSORIES: [] });
    
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false); 
    const [showAddMenu, setShowAddMenu] = useState(false);
    
    const [activeBannerSlides, setActiveBannerSlides] = useState({});
    const [isUploading, setIsUploading] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeBlockForModal, setActiveBlockForModal] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        loadTribes();
        fetchStoreProducts();
    }, []);

    const loadTribes = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE_URL}/admin/settings/tribe_categories`, { headers });
            const data = await res.json();
            
            if (data.tribes && data.tribes.length > 0) {
                const newPageData = { MEN: [], WOMEN: [], ACCESSORIES: [] };
                data.tribes.forEach(t => {
                    const tabName = t.name.replace(' CATEGORIES', '').toUpperCase();
                    if (newPageData[tabName] !== undefined) {
                        newPageData[tabName] = t.blocks || []; 
                    }
                });
                setPageData(newPageData);
            }
        } catch (error) { console.error("Error loading tribes:", error); }
    };

    const fetchStoreProducts = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE_URL}/admin/products`, { headers });
            if (res.ok) {
                const data = await res.json();
                setAllProducts(data.products || data || []);
            } else {
                throw new Error("Failed to fetch from API");
            }
        } catch (error) { 
            console.error("Error fetching products:", error);
            setAllProducts([
                { item_id: "1", title: "Aronai Shirt", brandName: "JAMBA", selling_price: 1427.14, original_price: 1999, images: ["https://via.placeholder.com/150"] }
            ]);
        }
    };

    const addBlock = (type, shape = null) => {
        const newBlock = {
            id: Date.now(),
            type: type, 
            shape: shape, 
            title: type === 'row' ? 'NEW SECTION' : '',
            bgColor: shape === 'rectangle' ? '#fce268' : '#a7d7b5', 
            items: [] 
        };
        setPageData(prev => ({ ...prev, [activeTab]: [...prev[activeTab], newBlock] }));
        setShowAddMenu(false); 
    };

    const removeBlock = (blockId) => {
        if(window.confirm("Delete this entire section?")) {
            setPageData(prev => ({ ...prev, [activeTab]: prev[activeTab].filter(b => b.id !== blockId) }));
        }
    };

    const updateBlockTitle = (blockId, newTitle) => {
        setPageData(prev => ({ ...prev, [activeTab]: prev[activeTab].map(b => b.id === blockId ? { ...b, title: newTitle } : b) }));
    };

    const updateBlockColor = (blockId, newColor) => {
        setPageData(prev => ({ ...prev, [activeTab]: prev[activeTab].map(b => b.id === blockId ? { ...b, bgColor: newColor } : b) }));
    };

    const removeItemFromBlock = (blockId, itemIndex) => {
        setPageData(prev => ({ ...prev, [activeTab]: prev[activeTab].map(b => {
            if (b.id === blockId) return { ...b, items: b.items.filter((_, i) => i !== itemIndex) };
            return b;
        }) }));
    };

    const updateItemName = (blockId, itemIndex, newName) => {
        setPageData(prev => ({ ...prev, [activeTab]: prev[activeTab].map(b => {
            if (b.id === blockId) {
                const newItems = [...b.items];
                newItems[itemIndex].name = newName;
                return { ...b, items: newItems };
            }
            return b;
        }) }));
    };

    const updateItemLink = (blockId, itemIndex, newLink) => {
        setPageData(prev => ({ ...prev, [activeTab]: prev[activeTab].map(b => {
            if (b.id === blockId) {
                const newItems = [...b.items];
                newItems[itemIndex].link = newLink;
                return { ...b, items: newItems };
            }
            return b;
        }) }));
    };

    const handleProductSelect = (product) => {
        const realProductId = product.item_id || product.id || product._id;

        if (!realProductId) {
            alert("Error: Missing database ID for this product. Check your Firebase database!");
            return;
        }

        setPageData(prev => ({
            ...prev,
            [activeTab]: prev[activeTab].map(b => {
                if (b.id === activeBlockForModal) {
                    return { 
                        ...b, 
                        items: [...b.items, { 
                            name: product.title || 'Product Name', 
                            image: product.images?.[0] || product.image || '', 
                            link: String(realProductId), 
                            price: product.selling_price || product.price || 0,
                            originalPrice: product.original_price || product.price || 0,
                            brand: product.brandName || 'JAMBA'
                        }] 
                    };
                }
                return b;
            })
        }));
        setIsModalOpen(false);
        setSearchTerm("");
    };

    const filteredProducts = allProducts.filter(p => p.title?.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleFileUpload = async (blockId, itemIndex, e) => {
        const file = e.target.files[0];
        if(!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`;

        try {
            const res = await fetch(cloudinaryUrl, { method: "POST", body: formData });
            const data = await res.json();
            
            if (data.secure_url) {
                setPageData(prev => ({
                    ...prev,
                    [activeTab]: prev[activeTab].map(b => {
                        if (b.id === blockId) {
                            const newItems = [...b.items];
                            if(!newItems[itemIndex]) newItems[itemIndex] = { name: '', image: '', link: '' };
                            
                            newItems[itemIndex] = { 
                                ...newItems[itemIndex], 
                                image: data.secure_url,
                                isVideo: data.resource_type === 'video' 
                            };
                            return { ...b, items: newItems };
                        }
                        return b;
                    })
                }));
            }
        } catch (error) { alert("Upload Error: " + error.message); } 
        finally { setIsUploading(false); }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveSuccess(false); 
        
        const payload = tabs.map(tab => ({ name: `${tab} CATEGORIES`, blocks: pageData[tab] }));
        
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE_URL}/admin/settings/tribe_categories`, {
                method: "PUT", headers: headers, body: JSON.stringify({ tribes: payload })
            });
            if(!res.ok) throw new Error("Failed to save layout");
            
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000); 
            if(window.showToast) window.showToast(`${activeTab} Layout Saved Successfully!`);
        } catch (error) { 
            alert("Error saving layout: " + error.message); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleViewLive = () => {
        const storefrontPort = "5173"; 
        const categoryUrl = `http://localhost:${storefrontPort}/category/${activeTab.toLowerCase()}`;
        window.open(categoryUrl, "_blank");
    };

    return (
        <div className="content-section active category-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span className="section-title">Storefront Page Builder</span>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="option-btn" style={{ margin: 0, height: '44px' }} onClick={handleViewLive}>
                        <i className="fa-solid fa-arrow-up-right-from-square"></i> View Live
                    </button>
                    <button 
                        className="btn-submit" 
                        disabled={isSaving} 
                        style={{ 
                            width: 'auto', marginTop: 0, padding: '0 24px', height: '44px',
                            backgroundColor: saveSuccess ? '#10b981' : '#111', 
                            transition: 'background-color 0.3s'
                        }} 
                        onClick={handleSave}
                    >
                        {isSaving ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : saveSuccess ? <><i className="fa-solid fa-check"></i> Saved!</> : "Save Layout"}
                    </button>
                </div>
            </div>

            <div className="builder-tabs">
                {tabs.map(tab => (
                    <button key={tab} className={`builder-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
                ))}
            </div>

            <div className="blocks-container">
                {pageData[activeTab].length === 0 ? (
                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>This page is empty. Click + below to start building.</p>
                ) : (
                    pageData[activeTab].map(block => (
                        <div key={block.id} className="builder-block">
                            <button className="block-delete-btn" onClick={() => removeBlock(block.id)}>Remove Section</button>
                            
                            {block.type === 'row' && (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', paddingRight: '120px' }}>
                                        <input 
                                            type="text" 
                                            className="block-title-input" 
                                            value={block.title} 
                                            onChange={(e) => updateBlockTitle(block.id, e.target.value)}
                                            placeholder="SECTION TITLE"
                                            style={{ marginBottom: 0, width: '100%' }}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', marginLeft: '20px', flexShrink: 0 }}>
                                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#111' }}>Background:</label>
                                            <input 
                                                type="color" 
                                                value={block.bgColor || (block.shape === 'rectangle' ? '#fce268' : '#a7d7b5')} 
                                                onChange={(e) => updateBlockColor(block.id, e.target.value)}
                                                style={{ border: 'none', width: '24px', height: '24px', cursor: 'pointer', padding: 0, background: 'transparent' }}
                                            />
                                        </div>
                                    </div>

                                    <div 
                                        className="row-scroll-area" 
                                        style={{ 
                                            backgroundColor: block.bgColor || (block.shape === 'rectangle' ? '#fce268' : 'transparent'),
                                            padding: block.shape === 'rectangle' || block.bgColor ? '20px' : '0 0 12px 0',
                                            borderRadius: '16px',
                                            transition: 'background-color 0.3s'
                                        }}
                                    >
                                        {block.items.map((item, idx) => (
                                            <div key={idx} className="row-item">
                                                <button className="item-delete-btn" onClick={() => removeItemFromBlock(block.id, idx)}><i className="fa-solid fa-xmark"></i></button>
                                                
                                                {block.shape === 'circle' ? (
                                                    <>
                                                        <div className="upload-box circle">
                                                            {item.image ? <img src={item.image} alt={item.name} /> : <i className="fa-solid fa-image"></i>}
                                                        </div>
                                                        <input 
                                                            type="text" 
                                                            className="item-name-input" 
                                                            placeholder="Name" 
                                                            value={item.name} 
                                                            onChange={(e) => updateItemName(block.id, idx, e.target.value)}
                                                        />
                                                        <input 
                                                            type="text" 
                                                            className="item-name-input" 
                                                            placeholder="Route Link" 
                                                            value={item.link || ''} 
                                                            onChange={(e) => updateItemLink(block.id, idx, e.target.value)}
                                                            style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px', borderBottom: '1px dashed #d1d5db', paddingBottom: '2px' }}
                                                            title="e.g. /category/men/shirts"
                                                        />
                                                    </>
                                                ) : (
                                                    <div className="admin-product-card">
                                                        <div className="img-wrapper">
                                                            <img src={item.image || 'https://via.placeholder.com/150'} alt={item.name} />
                                                        </div>
                                                        <div className="admin-product-info">
                                                            <p className="admin-product-title">{item.name}</p>
                                                            <p className="admin-product-brand">{item.brand || 'JAMBA'}</p>
                                                            <div className="admin-product-price-row">
                                                                <div className="admin-price-group">
                                                                    <span className="admin-current-price">₹{Number(item.price || 0).toLocaleString('en-IN')}</span>
                                                                    {item.originalPrice > item.price && (
                                                                        <span className="admin-original-price">₹{Number(item.originalPrice).toLocaleString('en-IN')}</span>
                                                                    )}
                                                                </div>
                                                                <span className="admin-heart-btn"><i className="fa-regular fa-heart"></i></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        
                                        <div className="row-item" style={{ justifyContent: 'center' }}>
                                            {block.shape === 'circle' ? (
                                                <label className="upload-box circle" style={{ borderStyle: 'solid', background: 'transparent' }} title="Upload New Category Image">
                                                    <i className="fa-solid fa-plus" style={{ fontSize: '24px' }}></i>
                                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                                                        const newIndex = block.items.length;
                                                        handleFileUpload(block.id, newIndex, e);
                                                    }} />
                                                </label>
                                            ) : (
                                                <div className="upload-box rectangle" style={{ borderStyle: 'solid', background: 'transparent', height: '100%', minHeight: '160px' }} onClick={() => {
                                                    setActiveBlockForModal(block.id);
                                                    setIsModalOpen(true);
                                                }} title="Search & Add Product">
                                                    <i className="fa-solid fa-plus" style={{ fontSize: '24px' }}></i>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {block.type === 'banner' && (
                                <>
                                    <h3 style={{ margin: '0 0 16px 0', color: '#111' }}>PROMO BANNER</h3>
                                    {block.items.length === 0 ? (
                                        <label className="banner-carousel" style={{ cursor: 'pointer', border: '1px dashed #9ca3af' }}>
                                            {isUploading ? (
                                                <div className="upload-overlay"><i className="fa-solid fa-spinner fa-spin"></i> Uploading...</div>
                                            ) : (
                                                <span><i className="fa-solid fa-cloud-arrow-up"></i> Upload First Image or Video</span>
                                            )}
                                            <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(block.id, 0, e)} />
                                        </label>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div className="banner-carousel">
                                                {isUploading && (
                                                    <div className="upload-overlay">
                                                        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '30px', marginBottom: '10px' }}></i>
                                                        Uploading File...
                                                    </div>
                                                )}
                                                {block.items.length > 1 && (
                                                    <button className="carousel-arrow left" onClick={() => {
                                                        const current = activeBannerSlides[block.id] || 0;
                                                        setActiveBannerSlides(prev => ({...prev, [block.id]: current === 0 ? block.items.length - 1 : current - 1}));
                                                    }}><i className="fa-solid fa-chevron-left"></i></button>
                                                )}
                                                {(() => {
                                                    const activeIdx = activeBannerSlides[block.id] || 0;
                                                    const activeMedia = block.items[activeIdx];
                                                    if (!activeMedia || !activeMedia.image) return <span>Empty Slide</span>;
                                                    if (activeMedia.isVideo) {
                                                        return <video src={activeMedia.image} autoPlay loop muted playsInline />;
                                                    } else {
                                                        return <img src={activeMedia.image} alt="Banner" />;
                                                    }
                                                })()}
                                                {block.items.length > 1 && (
                                                    <button className="carousel-arrow right" onClick={() => {
                                                        const current = activeBannerSlides[block.id] || 0;
                                                        setActiveBannerSlides(prev => ({...prev, [block.id]: current === block.items.length - 1 ? 0 : current + 1}));
                                                    }}><i className="fa-solid fa-chevron-right"></i></button>
                                                )}
                                                <div className="carousel-dots">
                                                    {block.items.map((_, idx) => (
                                                        <div key={idx} className={`carousel-dot ${ (activeBannerSlides[block.id] || 0) === idx ? 'active' : '' }`} onClick={() => setActiveBannerSlides(prev => ({...prev, [block.id]: idx}))} />
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            {(() => {
                                                const activeIdx = activeBannerSlides[block.id] || 0;
                                                const activeMedia = block.items[activeIdx];
                                                return (
                                                    <div style={{ marginTop: '16px', width: '100%', maxWidth: '500px', background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Slide {activeIdx + 1} Route Link (Optional):</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="e.g., /product/123 or /category/men/shirts" 
                                                            value={activeMedia?.link || ''}
                                                            onChange={(e) => updateItemLink(block.id, activeIdx, e.target.value)}
                                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                                                        />
                                                    </div>
                                                )
                                            })()}

                                            <label className="banner-add-slide-btn" style={{ marginTop: '16px' }}>
                                                <i className="fa-solid fa-plus"></i> Add Another Slide
                                                <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => {
                                                    const newIndex = block.items.length;
                                                    setActiveBannerSlides(prev => ({...prev, [block.id]: newIndex}));
                                                    handleFileUpload(block.id, newIndex, e);
                                                }} />
                                            </label>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="master-add-container">
                <button className="master-add-btn" onClick={() => setShowAddMenu(!showAddMenu)}>
                    <i className={`fa-solid ${showAddMenu ? 'fa-xmark' : 'fa-plus'}`}></i>
                </button>
                {showAddMenu && (
                    <div className="add-options">
                        <button className="option-btn" onClick={() => addBlock('row', 'circle')}><i className="fa-regular fa-circle"></i> Add Circle Row</button>
                        <button className="option-btn" onClick={() => addBlock('row', 'rectangle')}><i className="fa-regular fa-square"></i> Add Product Row</button>
                        <button className="option-btn" onClick={() => addBlock('banner')}><i className="fa-solid fa-image"></i> Add Banner</button>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="product-modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="product-modal" onClick={e => e.stopPropagation()}>
                        <div className="product-modal-header">
                            <h3>Select a Product</h3>
                            <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <input 
                            type="text" 
                            className="product-search-input" 
                            placeholder="Search products by name..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <div className="product-grid">
                            {filteredProducts.map(prod => (
                                <div key={prod.item_id || prod.id || prod._id || Math.random()} className="product-select-card" onClick={() => handleProductSelect(prod)}>
                                    <img src={prod.images?.[0] || 'https://via.placeholder.com/150'} alt={prod.title} />
                                    <p>{prod.title}</p>
                                </div>
                            ))}
                            {filteredProducts.length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6b7280' }}>No products found.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}