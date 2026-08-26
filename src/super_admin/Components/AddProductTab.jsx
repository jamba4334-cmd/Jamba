import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../apiConfig.js";
import "../styles/AddProduct.css";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase.js";

export default function AddProductTab({ getAuthHeaders, refreshInventory, onComplete, editingProduct = null }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // --- Dynamic Categories State ---
    const [storeCategories, setStoreCategories] = useState([]);
    
    // --- Pricing & Earnings State ---
    const [platformFee, setPlatformFee] = useState(0);
    const [gstIncluded, setGstIncluded] = useState(0);
    const [gstRate, setGstRate] = useState(5);
    const [finalPrice, setFinalPrice] = useState(0);

    // --- Core Form Data ---
    const [formData, setFormData] = useState({
        title: "", original_price: "", selling_price: "", seller_payout: "", stock: "",
        department: "", category: "", color: "", fabric: "", description: "", search_tags: "",
        sellerName: "", brandName: "", sellerPhone: "", sellerEmail: "", sellerAddress: "",
        pickupAddress: "", city: "", state: "", pincode: "", allow_cod: true, allow_online: true,
        return_policy: "7_day_return_replace", package_weight: "Under 500g", dispatch_time: "Ships in 2-3 Days",
        placement: "regular" // Admin exclusive
    });

    // --- Advanced Specs State ---
    const [careInstructions, setCareInstructions] = useState([]);
    const [dimensions, setDimensions] = useState({ length: "", width: "" });
    const [sizeChart, setSizeChart] = useState({});

    // --- Media State (Guided 5-Slot Grid) ---
    const [existingImages, setExistingImages] = useState([null, null, null, null, null]);
    const [newFiles, setNewFiles] = useState([null, null, null, null, null]);
    const [existingVideo, setExistingVideo] = useState("");
    const [newVideo, setNewVideo] = useState(null);

    // --- Fetch Master Categories from DB ---
    useEffect(() => {
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
        fetchCategories();
    }, []);

    // --- Dynamic Pricing Calculator ---
    useEffect(() => {
        const val = parseFloat(formData.seller_payout);
        if (!isNaN(val) && val > 0) {
            const total = val / 0.70;
            const fee = total - val; 
            const rate = total > 2500 ? 18 : 5;
            const basePrice = total / (1 + (rate / 100));
            const tax = total - basePrice;

            setPlatformFee(fee);
            setGstIncluded(tax);
            setGstRate(rate);
            setFinalPrice(total);
            setFormData(prev => ({ ...prev, selling_price: total.toFixed(2) }));
        } else {
            setPlatformFee(0); setGstIncluded(0); setGstRate(5); setFinalPrice(0);
            setFormData(prev => ({ ...prev, selling_price: 0 }));
        }
    }, [formData.seller_payout]);

    // --- Lifecycle: Populate Edit Data ---
    useEffect(() => {
        if (editingProduct) {
            const parts = (editingProduct.category || "").split(' - ');
            setFormData(prev => ({
                ...prev,
                ...editingProduct,
                department: parts[1] ? parts[1].trim() : '',
                category: parts[0] ? parts[0].trim() : '',
                allow_cod: editingProduct.allow_cod !== false,
                allow_online: editingProduct.allow_online !== false
            }));

            // Map images into fixed 5 slots
            let loadedImages = [null, null, null, null, null];
            if (editingProduct.images) {
                editingProduct.images.forEach((url, i) => { if (i < 5) loadedImages[i] = url; });
            }
            setExistingImages(loadedImages);
            setExistingVideo(editingProduct.video_url || "");
            setCareInstructions(editingProduct.care_instructions || []);
            
            if (editingProduct.dimensions) setDimensions(editingProduct.dimensions);
            if (editingProduct.size_chart) {
                let loadedChart = {};
                Object.keys(editingProduct.size_chart).forEach(size => {
                    loadedChart[size] = { active: true, ...editingProduct.size_chart[size] };
                });
                setSizeChart(loadedChart);
            }
        }
    }, [editingProduct]);

    // --- Handlers ---
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSizeToggle = (size) => {
        setSizeChart(prev => ({ ...prev, [size]: { ...(prev[size] || {}), active: !(prev[size]?.active) } }));
    };

    const handleSizeChange = (size, field, value) => {
        setSizeChart(prev => ({ ...prev, [size]: { ...(prev[size] || {}), [field]: value } }));
    };

    const handleCareToggle = (opt) => {
        setCareInstructions(prev => prev.includes(opt) ? prev.filter(c => c !== opt) : [...prev, opt]);
    };

    const handleFileSelect = (e, index) => {
        const file = e.target.files[0];
        if (!file) return;
        setNewFiles(prev => { const arr = [...prev]; arr[index] = file; return arr; });
        setExistingImages(prev => { const arr = [...prev]; arr[index] = null; return arr; });
    };

    const removeImageSlot = (index) => {
        setNewFiles(prev => { const arr = [...prev]; arr[index] = null; return arr; });
        setExistingImages(prev => { const arr = [...prev]; arr[index] = null; return arr; });
    };

    const handleVideoSelect = (e) => {
        if(e.target.files[0]?.size < 15000000) setNewVideo(e.target.files[0]);
        else alert("Video too large. Max 15MB.");
        e.target.value = "";
    };

    const removeVideo = () => { setNewVideo(null); setExistingVideo(""); };

    // Determine Sizing Type based on category selection
    const currentSizingType = () => {
        const cat = formData.category.toLowerCase();
        if (cat.includes("shirt") || cat.includes("waistcoat")) return "chart_top_standard";
        if (cat.includes("blows")) return "chart_blouse";
        if (cat.includes("trouser")) return "chart_bottom";
        return "free_size"; // Fallback
    };
    const sizingType = currentSizingType();

    // Dynamically retrieve available subcategories based on department selection
    const selectedMainCategory = storeCategories.find(c => c.name === formData.department);
    const dynamicSubcategories = selectedMainCategory ? (selectedMainCategory.subcategories || []) : [];

    // --- Submission Logic ---
    const handleProductSubmit = async (e) => {
        e.preventDefault();
        
        if (sizingType?.startsWith('chart_')) {
            const sizes = sizingType === 'chart_blouse' ? ['XS','S','M','L','XL','XXL'] : ['S','M','L','XL','XXL','XXXL'];
            const isChecked = sizes.some(s => sizeChart[s]?.active);
            if (!isChecked) return alert("Please select at least one available size and fill in its measurements.");
        }

        const activeImageCount = newFiles.filter(Boolean).length + existingImages.filter(Boolean).length;
        if (activeImageCount === 0) return alert("Please upload at least 1 image (Front View required).");

        setIsSubmitting(true);
        setUploadProgress(10);

        try {
            let finalUrls = [];
            let finalVideoUrl = existingVideo;
            
            // Cloudinary Image Upload
            for (let i = 0; i < 5; i++) {
                if (newFiles[i]) {
                    const cFormData = new FormData();
                    cFormData.append("file", newFiles[i]);
                    cFormData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET); 
                    const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: cFormData });
                    const data = await res.json();
                    if (data.secure_url) finalUrls.push(data.secure_url);
                } else if (existingImages[i]) {
                    finalUrls.push(existingImages[i]);
                }
            }

            // Cloudinary Video Upload
            if (newVideo) {
                setUploadProgress(50);
                const vFormData = new FormData();
                vFormData.append("file", newVideo);
                vFormData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
                const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload`, { method: "POST", body: vFormData });
                const data = await res.json();
                if (data.secure_url) finalVideoUrl = data.secure_url;
            }

            setUploadProgress(80);

            // Sizing Logic Builder
            let sizingData = { sizing_type: sizingType };
            if (sizingType === 'free_size') {
                sizingData.dimensions = dimensions;
            } else if (sizingType) {
                sizingData.size_chart = {};
                Object.keys(sizeChart).filter(s => sizeChart[s].active).forEach(s => {
                    sizingData.size_chart[s] = {};
                    if (sizingType === 'chart_top_standard') {
                        sizingData.size_chart[s] = { chest: sizeChart[s].chest, shoulder: sizeChart[s].shoulder, length: sizeChart[s].length, sleeve: sizeChart[s].sleeve };
                    } else if (sizingType === 'chart_blouse') {
                        sizingData.size_chart[s] = { bust: sizeChart[s].bust, waist: sizeChart[s].waist, shoulder: sizeChart[s].shoulder, armhole: sizeChart[s].armhole };
                    } else if (sizingType === 'chart_bottom') {
                        sizingData.size_chart[s] = { waist: sizeChart[s].waist, hip: sizeChart[s].hip, length: sizeChart[s].length };
                    }
                });
                sizingData.available_sizes = Object.keys(sizingData.size_chart);
            }

            const productData = {
                ...formData,
                original_price: parseFloat(formData.original_price) || 0,
                selling_price: parseFloat(formData.selling_price) || 0,
                seller_payout: parseFloat(formData.seller_payout) || 0,
                stock: parseInt(formData.stock) || 0,
                category: `${formData.category.charAt(0).toUpperCase() + formData.category.slice(1)} - ${formData.department}`, // Ensure capitalized display format
                images: finalUrls,
                video_url: finalVideoUrl,
                care_instructions: careInstructions,
                ...sizingData,
                isHidden: editingProduct ? editingProduct.isHidden : false,
                approval_status: editingProduct ? editingProduct.approval_status : "approved"
            };
            delete productData.department;

            const method = editingProduct ? "PUT" : "POST";
            const endpoint = editingProduct ? `${API_BASE_URL}/admin/products/${editingProduct.docId}` : `${API_BASE_URL}/admin/products`;

            const headers = await getAuthHeaders();
            const response = await fetch(endpoint, {
                method: method,
                headers: headers,
                body: JSON.stringify(productData)
            });

            if (!response.ok) throw new Error("Failed to save product on server.");

            if(window.showToast) window.showToast(editingProduct ? "Product Updated Successfully!" : "New Product Added Successfully!");
            
            refreshInventory();
            if(onComplete) onComplete();

        } catch (err) { 
            alert("Error saving product: " + err.message); 
        } finally { 
            setIsSubmitting(false); 
            setUploadProgress(0);
        }
    };

    // --- Inline Styles from Seller UI ---
    const tableHeaderStyle = { padding: '10px', background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left', fontSize: '13px', color: '#334155' };
    const tableCellStyle = { padding: '8px', borderBottom: '1px solid #e2e8f0' };
    const chartInputStyle = { width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' };

    const renderImageSlot = (index, label, icon) => {
        const hasFile = newFiles[index];
        const hasUrl = existingImages[index];
        const displayUrl = hasFile ? URL.createObjectURL(hasFile) : hasUrl;

        return (
            <div key={index} style={{ border: '1px dashed var(--input-border)', borderRadius: '8px', padding: '12px', textAlign: 'center', position: 'relative', background: '#ffffff' }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-main)' }}>{label}</span>
                <label htmlFor={`file-upload-${index}`} style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'block' }}>
                    {!displayUrl ? (
                        <div style={{ padding: '15px 0' }}>
                            <i className={`fa-solid ${icon}`} style={{ fontSize: '20px', color: 'var(--text-muted)', marginBottom: '8px' }}></i>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to upload</div>
                        </div>
                    ) : (
                        <div>
                            <img src={displayUrl} alt={label} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px' }} />
                            {!isSubmitting && <button type="button" onClick={(e) => { e.preventDefault(); removeImageSlot(index); }} style={{position:'absolute', top:'4px', right:'4px', background:'var(--danger)', color:'white', border:'none', borderRadius:'50%', width:'22px', height:'22px', fontSize:'12px', cursor:'pointer'}}><i className="fa-solid fa-xmark"></i></button>}
                        </div>
                    )}
                </label>
                <input id={`file-upload-${index}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileSelect(e, index)} disabled={isSubmitting} />
            </div>
        );
    };

    return (
        <div className="content-section active add-product-container">
            <span className="section-title" style={{ marginBottom: '24px' }}>
                {editingProduct ? 'Edit Product Details (Admin)' : 'Submit New Product (Admin)'}
            </span>
            <p className="text-helper" style={{ marginBottom: '20px' }}>Admin module full-access override. Use caution when editing seller financial details.</p>
            
            <form className="card" onSubmit={handleProductSubmit}>
                
                {/* PRICING SECTION */}
                <span className="section-subtitle">Pricing & Earnings</span>
                <div className="field-grid" style={{ marginBottom: '10px' }}>
                    <div className="form-group">
                        <span className="label" style={{ color: 'var(--success)' }}>Seller Guaranteed Payout (₹)</span>
                        <input type="number" name="seller_payout" className="input-box" placeholder="e.g. 1000" value={formData.seller_payout} onChange={handleChange} required min="10" style={{ borderColor: 'var(--success)', fontWeight: 'bold' }} disabled={isSubmitting} />
                    </div>
                    <div className="form-group">
                        <span className="label">Original MRP (Optional Strikethrough)</span>
                        <input type="number" name="original_price" className="input-box" placeholder="e.g. 2500" value={formData.original_price} onChange={handleChange} min="0" disabled={isSubmitting} />
                    </div>
                </div>

                {formData.seller_payout && !isNaN(formData.seller_payout) && parseFloat(formData.seller_payout) > 0 && (
                    <div className="pricing-breakdown-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '30px' }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '14px' }}><i className="fa-solid fa-calculator"></i> Retail Price Breakdown</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                            <span>Seller Guaranteed Earnings (70%):</span>
                            <strong>₹{parseFloat(formData.seller_payout).toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '2px' }}>
                            <span>Platform Fee (30%):</span>
                            <span>+ ₹{platformFee.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed #cbd5e1' }}>
                            <span>↳ Includes Govt GST ({gstRate}%):</span>
                            <span>(₹{gstIncluded.toFixed(2)})</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', color: '#0f172a', fontWeight: '700', marginTop: '12px' }}>
                            <span>Final Price Customer Pays:</span>
                            <span style={{ color: 'var(--primary)' }}>₹{finalPrice.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* CATEGORY & SIZING SECTION */}
                <span className="section-subtitle">Product Categories & Sizing</span>
                <div className="field-grid">
                    
                    {/* 🔥 UPDATED: Dynamic Department Dropdown */}
                    <div className="form-group">
                        <span className="label">Department / Gender</span> 
                        <select name="department" className="input-box" required value={formData.department} onChange={(e) => setFormData(p => ({...p, department: e.target.value, category: ""}))} disabled={isSubmitting} style={{textTransform: 'capitalize'}}>
                            <option value="" disabled>Select Department</option>
                            {storeCategories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* 🔥 UPDATED: Dynamic Category Dropdown */}
                    <div className="form-group">
                        <span className="label">Category</span>
                        <select name="category" className="input-box" required value={formData.category} onChange={handleChange} disabled={!formData.department || isSubmitting} style={{textTransform: 'capitalize'}}>
                            <option value="" disabled>Select Category</option>
                            {dynamicSubcategories.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <span className="label" style={{ color: 'var(--accent)' }}>Placement Visibility (Admin)</span>
                        <select name="placement" value={formData.placement} onChange={handleChange} className="input-box" required disabled={isSubmitting}>
                            <option value="regular">Regular Collection Only</option>
                            <option value="hero">Homepage Hero (Display on Front Page)</option>
                        </select>
                    </div>
                </div>

                {/* DYNAMIC SIZING POPUPS */}
                {sizingType === 'chart_top_standard' && (
                    <div style={{ marginBottom: '24px', background: '#e0f2fe', padding: '16px', borderRadius: '8px', border: '1px solid #7dd3fc', overflowX: 'auto' }}>
                        <span className="label" style={{ color: '#0369a1', fontWeight: '700', display: 'block', marginBottom: '10px' }}><i className="fa-solid fa-ruler"></i> Detailed Size Chart (Inches)</span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                            <thead><tr><th style={tableHeaderStyle}>Size</th><th style={tableHeaderStyle}>Chest</th><th style={tableHeaderStyle}>Shoulder</th><th style={tableHeaderStyle}>Length</th><th style={tableHeaderStyle}>Sleeve</th></tr></thead>
                            <tbody>
                                {['S (36)', 'M (38)', 'L (40)', 'XL (42)', 'XXL (44)', 'XXXL (46)'].map(sz => {
                                    const code = sz.split(' ')[0];
                                    return (
                                        <tr key={code}>
                                            <td style={tableCellStyle}><label style={{cursor:'pointer', fontWeight:'500'}}><input type="checkbox" checked={sizeChart[code]?.active || false} onChange={() => handleSizeToggle(code)} style={{ accentColor: '#0284c7', marginRight:'6px' }} disabled={isSubmitting}/> {sz}</label></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.chest || ''} onChange={(e) => handleSizeChange(code, 'chest', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.shoulder || ''} onChange={(e) => handleSizeChange(code, 'shoulder', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.length || ''} onChange={(e) => handleSizeChange(code, 'length', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.sleeve || ''} onChange={(e) => handleSizeChange(code, 'sleeve', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {sizingType === 'chart_blouse' && (
                    <div style={{ marginBottom: '24px', background: '#fce7f3', padding: '16px', borderRadius: '8px', border: '1px solid #f9a8d4', overflowX: 'auto' }}>
                        <span className="label" style={{ color: '#be185d', fontWeight: '700', display: 'block', marginBottom: '10px' }}><i className="fa-solid fa-ruler"></i> Blouse Size Chart (Inches)</span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                            <thead><tr><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Size</th><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Bust</th><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Waist</th><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Shoulder</th><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Armhole</th></tr></thead>
                            <tbody>
                                {['XS (32)', 'S (34)', 'M (36)', 'L (38)', 'XL (40)', 'XXL (42)'].map(sz => {
                                    const code = sz.split(' ')[0];
                                    return (
                                        <tr key={code}>
                                            <td style={tableCellStyle}><label style={{cursor:'pointer', fontWeight:'500'}}><input type="checkbox" checked={sizeChart[code]?.active || false} onChange={() => handleSizeToggle(code)} style={{ accentColor: '#db2777', marginRight:'6px' }} disabled={isSubmitting}/> {sz}</label></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.bust || ''} onChange={(e) => handleSizeChange(code, 'bust', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.waist || ''} onChange={(e) => handleSizeChange(code, 'waist', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.shoulder || ''} onChange={(e) => handleSizeChange(code, 'shoulder', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.armhole || ''} onChange={(e) => handleSizeChange(code, 'armhole', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {sizingType === 'chart_bottom' && (
                    <div style={{ marginBottom: '24px', background: '#ecfdf5', padding: '16px', borderRadius: '8px', border: '1px solid #6ee7b7', overflowX: 'auto' }}>
                        <span className="label" style={{ color: '#047857', fontWeight: '700', display: 'block', marginBottom: '10px' }}><i className="fa-solid fa-ruler"></i> Trouser Size Chart (Inches)</span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                            <thead><tr><th style={{...tableHeaderStyle, background:'#f0fdf4'}}>Size</th><th style={{...tableHeaderStyle, background:'#f0fdf4'}}>Waist</th><th style={{...tableHeaderStyle, background:'#f0fdf4'}}>Hip</th><th style={{...tableHeaderStyle, background:'#f0fdf4'}}>Length</th></tr></thead>
                            <tbody>
                                {['S (30)', 'M (32)', 'L (34)', 'XL (36)', 'XXL (38)', 'XXXL (40)'].map(sz => {
                                    const code = sz.split(' ')[0];
                                    return (
                                        <tr key={code}>
                                            <td style={tableCellStyle}><label style={{cursor:'pointer', fontWeight:'500'}}><input type="checkbox" checked={sizeChart[code]?.active || false} onChange={() => handleSizeToggle(code)} style={{ accentColor: '#059669', marginRight:'6px' }} disabled={isSubmitting}/> {sz}</label></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.waist || ''} onChange={(e) => handleSizeChange(code, 'waist', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.hip || ''} onChange={(e) => handleSizeChange(code, 'hip', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                            <td style={tableCellStyle}><input type="number" value={sizeChart[code]?.length || ''} onChange={(e) => handleSizeChange(code, 'length', e.target.value)} style={chartInputStyle} step="0.5" disabled={isSubmitting}/></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {sizingType === 'free_size' && (
                    <div style={{ marginBottom: '24px', background: '#fef3c7', padding: '16px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                        <span className="label" style={{ color: '#b45309', fontWeight: '700', display: 'block', marginBottom: '10px' }}><i className="fa-solid fa-maximize"></i> Product Dimensions (Compulsory for Free Size)</span>
                        <div className="field-grid" style={{ marginBottom: 0 }}>
                            <div className="form-group"><input type="text" value={dimensions.length} onChange={(e)=>setDimensions(p=>({...p, length: e.target.value}))} className="input-box" placeholder="Length (e.g., 2.5 meters)" required style={{ borderColor: '#fcd34d' }} disabled={isSubmitting}/></div>
                            <div className="form-group"><input type="text" value={dimensions.width} onChange={(e)=>setDimensions(p=>({...p, width: e.target.value}))} className="input-box" placeholder="Width (e.g., 1 meter)" required style={{ borderColor: '#fcd34d' }} disabled={isSubmitting}/></div>
                        </div>
                    </div>
                )}

                {/* DETAILS SECTION */}
                <span className="section-subtitle">Product Details</span>
                <div className="field-grid">
                    <div className="form-group"><span className="label">Product Name</span><input type="text" name="title" value={formData.title} onChange={handleChange} className="input-box" placeholder="e.g. Classic Bodo Waistcoat" required disabled={isSubmitting}/></div>
                    <div className="form-group"><span className="label">Available Stock</span><input type="number" name="stock" value={formData.stock} onChange={handleChange} className="input-box" placeholder="e.g. 50" required min="0" disabled={isSubmitting}/></div>
                </div>
                
                <div className="field-grid">
                    <div className="form-group"><span className="label">Colour</span><input type="text" name="color" value={formData.color} onChange={handleChange} className="input-box" placeholder="e.g. Mustard Yellow" required disabled={isSubmitting}/></div>
                    <div className="form-group"><span className="label">Fabric</span><input type="text" name="fabric" value={formData.fabric} onChange={handleChange} className="input-box" placeholder="e.g. Pure Cotton" required disabled={isSubmitting}/></div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <span className="label">Search Tags (Comma separated)</span>
                    <input type="text" name="search_tags" value={formData.search_tags} onChange={handleChange} className="input-box" placeholder="e.g. Bihu, Traditional, Wedding Wear" disabled={isSubmitting}/>
                </div>
                
                <div className="form-group" style={{ marginBottom: '30px' }}>
                    <span className="label">Wash & Care Instructions (Select all that apply)</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--input-border)' }}>
                        {['Standard Machine Wash', 'Hand Wash Cold', 'Dry Clean Only', 'Do Not Bleach', 'Iron Low Heat', 'Dry in Shade'].map(opt => (
                            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                                <input type="checkbox" checked={careInstructions.includes(opt)} onChange={() => handleCareToggle(opt)} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }} disabled={isSubmitting}/> {opt}
                            </label>
                        ))}
                    </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: '30px' }}>
                    <span className="label">Description</span>
                    <textarea name="description" value={formData.description} onChange={handleChange} className="input-box" style={{ height: '100px' }} placeholder="Write a compelling description for the product..." required disabled={isSubmitting}></textarea>
                </div>

                <span className="section-subtitle">Logistics & Fulfillment</span>
                <div className="field-grid">
                    <div className="form-group">
                        <span className="label">Approx. Package Weight</span>
                        <select name="package_weight" value={formData.package_weight} onChange={handleChange} className="input-box" required disabled={isSubmitting}>
                            <option value="Under 500g">Under 500g (Standard)</option>
                            <option value="500g - 1kg">500g - 1kg (Heavy)</option>
                            <option value="1kg - 2kg">1kg - 2kg (Very Heavy)</option>
                            <option value="Above 2kg">Above 2kg (Bulk)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <span className="label">Dispatch Time</span>
                        <select name="dispatch_time" value={formData.dispatch_time} onChange={handleChange} className="input-box" required disabled={isSubmitting}>
                            <option value="Ships within 24 Hours">Ships within 24 Hours (Fast)</option>
                            <option value="Ships in 2-3 Days">Ships in 2-3 Days (Standard)</option>
                            <option value="Ships in 4-7 Days">Ships in 4-7 Days (Made to Order)</option>
                        </select>
                    </div>
                </div>

                <div style={{ marginBottom: '30px', background: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid var(--input-border)' }}>
                    <span className="label" style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: 'var(--primary)' }}>Allowed Payment Ways</span>
                    <div style={{ display: 'flex', gap: '24px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                            <input type="checkbox" name="allow_cod" checked={formData.allow_cod} onChange={handleChange} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }} disabled={isSubmitting}/> Cash on Delivery (COD)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                            <input type="checkbox" name="allow_online" checked={formData.allow_online} onChange={handleChange} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }} disabled={isSubmitting}/> Online Payment
                        </label>
                    </div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <span className="label" style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: 'var(--primary)' }}>
                        <i className="fa-solid fa-arrow-right-arrow-left"></i> Return & Replacement Policy
                    </span>
                    <select name="return_policy" value={formData.return_policy} onChange={handleChange} className="input-box" required disabled={isSubmitting}>
                        <option value="7_day_return_replace">7-Day Return & Replacement (Recommended)</option>
                        <option value="7_day_replacement">7-Day Replacement Only (No Refunds)</option>
                        <option value="final_sale">Final Sale (No Returns / No Replacements)</option>
                    </select>
                    {formData.return_policy !== 'final_sale' && (
                        <div style={{ marginTop: '12px', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '13px', color: '#1e3a8a', lineHeight: '1.5' }}>
                            <strong><i className="fa-solid fa-circle-info"></i> Admin Note:</strong> Returns affect seller payouts. Deductions may apply based on SLA policies.
                        </div>
                    )}
                </div>

                {/* STORE & SELLER INFO (ADMIN OVERRIDE) */}
                <span className="section-subtitle">Store & Seller Information (Admin Setup)</span>
                <div className="field-grid">
                    <div className="form-group"><span className="label">Seller Name</span><input type="text" name="sellerName" value={formData.sellerName} onChange={handleChange} className="input-box" required /></div>
                    <div className="form-group"><span className="label">Brand Name</span><input type="text" name="brandName" value={formData.brandName} onChange={handleChange} className="input-box" required /></div>
                    <div className="form-group"><span className="label">Phone Number</span><input type="text" inputMode="numeric" name="sellerPhone" value={formData.sellerPhone} onChange={handleChange} className="input-box" required minLength="10" maxLength="10" /></div>
                    <div className="form-group"><span className="label">Email Address</span><input type="email" name="sellerEmail" value={formData.sellerEmail} onChange={handleChange} className="input-box" required /></div>
                </div>

                <div className="field-grid">
                    <div className="form-group"><span className="label">Billing Address</span><input type="text" name="sellerAddress" value={formData.sellerAddress} onChange={handleChange} className="input-box" placeholder="Main office/shop address" required /></div>
                    <div className="form-group"><span className="label">Pickup Address</span><input type="text" name="pickupAddress" value={formData.pickupAddress} onChange={handleChange} className="input-box" placeholder="Where courier picks up" required /></div>
                </div>
                
                <div className="field-grid">
                    <div className="form-group"><span className="label">City</span><input type="text" name="city" value={formData.city} onChange={handleChange} className="input-box" placeholder="e.g. Jorhat" required /></div>
                    <div className="form-group">
                        <span className="label">State / UT</span>
                        <select name="state" value={formData.state} onChange={handleChange} className="input-box" required>
                            <option value="" disabled>Select State</option>
                            <option value="Assam">Assam</option>
                            <option value="Delhi">Delhi</option>
                            <option value="Maharashtra">Maharashtra</option>
                        </select>
                    </div>
                    <div className="form-group"><span className="label">Pincode</span><input type="text" inputMode="numeric" name="pincode" value={formData.pincode} onChange={handleChange} className="input-box" required minLength="6" maxLength="6" /></div>
                </div>

                {/* 🔥 STRUCTURED MEDIA UPLOAD GRID 🔥 */}
                <div style={{ marginTop: '30px' }}>
                    <span className="section-subtitle">Product Media (Guided Setup)</span>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Upload clear, high-quality media to maximize your sales. Front view is required.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                        
                        {renderImageSlot(0, "1. Front View (Hero)", "fa-image")}

                        <div style={{ border: '1px dashed var(--primary)', borderRadius: '8px', padding: '12px', textAlign: 'center', position: 'relative', background: '#eff6ff' }}>
                            <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: 'var(--primary)' }}>2. Video (Optional)</span>
                            <label htmlFor="video-upload" style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'block' }}>
                                {!(existingVideo || newVideo) ? (
                                    <div style={{ padding: '15px 0' }}>
                                        <i className="fa-solid fa-video" style={{ fontSize: '20px', color: '#93c5fd', marginBottom: '8px' }}></i>
                                        <div style={{ fontSize: '11px', color: '#60a5fa' }}>Max 15MB</div>
                                    </div>
                                ) : (
                                    <div>
                                        <video src={newVideo ? URL.createObjectURL(newVideo) : existingVideo} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px' }} muted loop autoPlay playsInline />
                                        {!isSubmitting && <button type="button" onClick={(e) => { e.preventDefault(); removeVideo(); }} style={{position:'absolute', top:'4px', right:'4px', background:'var(--danger)', color:'white', border:'none', borderRadius:'50%', width:'22px', height:'22px', fontSize:'12px', cursor:'pointer'}}><i className="fa-solid fa-xmark"></i></button>}
                                    </div>
                                )}
                            </label>
                            <input id="video-upload" type="file" accept="video/mp4,video/quicktime" style={{ display: 'none' }} onChange={handleVideoSelect} disabled={isSubmitting} />
                        </div>

                        {renderImageSlot(1, "3. Back View", "fa-person")}
                        {renderImageSlot(2, "4. Side View", "fa-person-walking")}
                        {renderImageSlot(3, "5. Fabric Close-up", "fa-magnifying-glass-plus")}
                        {renderImageSlot(4, "6. Lifestyle", "fa-camera-retro")}

                    </div>
                </div>
                
                {/* LIVE UPLOAD PROGRESS BAR */}
                {isSubmitting && uploadProgress > 0 && (
                    <div style={{ marginTop: '30px', padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#166534' }}>
                            <span><i className="fa-solid fa-cloud-arrow-up fa-bounce"></i> Syncing to Database... Please wait</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#dcfce7', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#22c55e', transition: 'width 0.3s ease' }}></div>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '30px' }}>
                    <button type="submit" className="btn-submit" disabled={isSubmitting}>
                        {isSubmitting ? "Processing..." : (editingProduct ? "Save Admin Overrides" : "Force Add to Catalogue")}
                    </button> 
                    {editingProduct && (
                        <button type="button" className="btn-submit" style={{ background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--input-border)', marginLeft: '10px' }} onClick={() => { if(onComplete) onComplete(); }} disabled={isSubmitting}>Cancel Edit</button> 
                    )}
                </div>
            </form>
        </div>
    );
}