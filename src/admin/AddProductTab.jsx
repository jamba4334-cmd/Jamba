import React, { useState, useEffect } from 'react';
import './AddProductTab.css'; 

export default function AddProductTab({ 
    isActive, 
    handleProductSubmit, 
    editingProductId, 
    cancelEdit, 
    currentEditImageUrls, 
    selectedFiles, 
    removeImageSlot, 
    handleFileSelect,
    currentEditVideoUrl,
    selectedVideo,
    handleVideoSelect,
    removeVideo,
    isUploading,
    uploadProgress
}) {
    const [payout, setPayout] = useState("");
    const [platformFee, setPlatformFee] = useState(0);
    const [gstIncluded, setGstIncluded] = useState(0);
    const [gstRate, setGstRate] = useState(5);
    const [finalPrice, setFinalPrice] = useState(0);

    const [department, setDepartment] = useState("");
    const [category, setCategory] = useState("");
    const [returnPolicy, setReturnPolicy] = useState("7_day_return_replace");

    const categoryData = {
        "Men": [
            { name: "Shirt", type: "chart_top_standard" },
            { name: "T-Shirt", type: "chart_top_standard" },
            { name: "Waistcoat", type: "chart_top_standard" },
            { name: "Trouser", type: "chart_bottom" },
            { name: "Gamsa", type: "free_size" }
        ],
        "Women": [
            { name: "Blows", type: "chart_blouse" },
            { name: "T-Shirt", type: "chart_top_standard" },
            { name: "Dokhona", type: "free_size" },
            { name: "Fasra", type: "free_size" },
            { name: "Jwmgra", type: "free_size" },
            { name: "Shirt", type: "chart_top_standard" },
            { name: "Waist Coat", type: "chart_top_standard" },
            { name: "Trouser", type: "chart_bottom" }
        ],
        "Accessories": [
            { name: "Aronai", type: "free_size" },
            { name: "Bag", type: "free_size" },
            { name: "Flowers", type: "free_size" }
        ]
    };

    useEffect(() => {
        const val = parseFloat(payout);
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
            
            const priceEl = document.getElementById('p-price');
            if(priceEl) priceEl.value = total.toFixed(2);
        } else {
            setPlatformFee(0);
            setGstIncluded(0);
            setGstRate(5);
            setFinalPrice(0);
            const priceEl = document.getElementById('p-price');
            if(priceEl) priceEl.value = 0;
        }
    }, [payout]);

    useEffect(() => {
        if (isActive && editingProductId) {
            setTimeout(() => {
                const genEl = document.getElementById('p-gender');
                const catEl = document.getElementById('p-category');
                const polEl = document.getElementById('p-return-policy');
                if (genEl && genEl.value) setDepartment(genEl.value);
                if (catEl && catEl.value) setCategory(catEl.value);
                if (polEl && polEl.value) setReturnPolicy(polEl.value);
            }, 100);
        }
    }, [isActive, editingProductId]);

    const onCancel = () => {
        setPayout("");
        setDepartment("");
        setCategory("");
        setReturnPolicy("7_day_return_replace");
        cancelEdit();
    };

    const currentSizingType = () => {
        if (!department || !category) return null;
        const found = categoryData[department]?.find(c => c.name === category);
        return found ? found.type : null;
    };

    const sizingType = currentSizingType();

    // 🔥 LOGIC: Calculate total stock dynamically based on sizes
    const calculateTotalStock = () => {
        const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
        let total = 0;
        sizes.forEach(sz => {
            const chk = document.getElementById(`sz-chk-${sz}`);
            if (chk && chk.checked) {
                const stockVal = parseInt(document.getElementById(`sz-${sz}-stock`)?.value) || 0;
                total += stockVal;
            }
        });
        const stockEl = document.getElementById('p-stock');
        if (stockEl) stockEl.value = total;
    };

    // Auto-Fill Measurements & Clear Stock Logic
    const handleSizeCheck = (e, type, code) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            if (type === 'chart_top_standard') {
                const defaults = {
                    'S': { chest: 36, shoulder: 16, length: 27, sleeve: 24 },
                    'M': { chest: 38, shoulder: 17, length: 28, sleeve: 24.5 },
                    'L': { chest: 40, shoulder: 18, length: 29, sleeve: 25 },
                    'XL': { chest: 42, shoulder: 19, length: 30, sleeve: 25.5 },
                    'XXL': { chest: 44, shoulder: 19.5, length: 30.5, sleeve: 26 },
                    'XXXL': { chest: 46, shoulder: 20, length: 31, sleeve: 26.5 }
                };
                if(defaults[code]) {
                    document.getElementById(`sz-${code}-chest`).value = defaults[code].chest;
                    document.getElementById(`sz-${code}-shoulder`).value = defaults[code].shoulder;
                    document.getElementById(`sz-${code}-length`).value = defaults[code].length;
                    document.getElementById(`sz-${code}-sleeve`).value = defaults[code].sleeve;
                }
            } else if (type === 'chart_blouse') {
                const defaults = {
                    'XS': { bust: 32, waist: 26, shoulder: 13.5, armhole: 14 },
                    'S': { bust: 34, waist: 28, shoulder: 14, armhole: 15 },
                    'M': { bust: 36, waist: 30, shoulder: 14.5, armhole: 16 },
                    'L': { bust: 38, waist: 32, shoulder: 15, armhole: 17 },
                    'XL': { bust: 40, waist: 34, shoulder: 15.5, armhole: 18 },
                    'XXL': { bust: 42, waist: 36, shoulder: 16, armhole: 19 }
                };
                if(defaults[code]) {
                    document.getElementById(`sz-${code}-bust`).value = defaults[code].bust;
                    document.getElementById(`sz-${code}-waist`).value = defaults[code].waist;
                    document.getElementById(`sz-${code}-shoulder`).value = defaults[code].shoulder;
                    document.getElementById(`sz-${code}-armhole`).value = defaults[code].armhole;
                }
            } else if (type === 'chart_bottom') {
                const defaults = {
                    'S': { waist: 30, hip: 38, length: 38 },
                    'M': { waist: 32, hip: 40, length: 39 },
                    'L': { waist: 34, hip: 42, length: 40 },
                    'XL': { waist: 36, hip: 44, length: 41 },
                    'XXL': { waist: 38, hip: 46, length: 41.5 },
                    'XXXL': { waist: 40, hip: 48, length: 42 }
                };
                if(defaults[code]) {
                    document.getElementById(`sz-${code}-waist`).value = defaults[code].waist;
                    document.getElementById(`sz-${code}-hip`).value = defaults[code].hip;
                    document.getElementById(`sz-${code}-length`).value = defaults[code].length;
                }
            }
        } else {
            // Clear all fields if unchecked
            const stockEl = document.getElementById(`sz-${code}-stock`);
            if (stockEl) stockEl.value = '';

            if (type === 'chart_top_standard') {
                document.getElementById(`sz-${code}-chest`).value = '';
                document.getElementById(`sz-${code}-shoulder`).value = '';
                document.getElementById(`sz-${code}-length`).value = '';
                document.getElementById(`sz-${code}-sleeve`).value = '';
            } else if (type === 'chart_blouse') {
                document.getElementById(`sz-${code}-bust`).value = '';
                document.getElementById(`sz-${code}-waist`).value = '';
                document.getElementById(`sz-${code}-shoulder`).value = '';
                document.getElementById(`sz-${code}-armhole`).value = '';
            } else if (type === 'chart_bottom') {
                document.getElementById(`sz-${code}-waist`).value = '';
                document.getElementById(`sz-${code}-hip`).value = '';
                document.getElementById(`sz-${code}-length`).value = '';
            }
        }
        setTimeout(calculateTotalStock, 50);
    };

    const tableHeaderStyle = { padding: '10px', background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left', fontSize: '13px', color: '#334155' };
    const tableCellStyle = { padding: '8px', borderBottom: '1px solid #e2e8f0' };
    const chartInputStyle = { width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' };

    const renderImageSlot = (index, label, icon) => {
        const hasFile = selectedFiles[index];
        const hasUrl = currentEditImageUrls[index];
        const displayUrl = hasFile ? URL.createObjectURL(hasFile) : hasUrl;

        return (
            <div key={index} style={{ border: '1px dashed var(--input-border)', borderRadius: '8px', padding: '12px', textAlign: 'center', position: 'relative', background: '#ffffff' }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-main)' }}>{label}</span>
                <label htmlFor={`file-upload-${index}`} style={{ cursor: isUploading ? 'not-allowed' : 'pointer', display: 'block' }}>
                    {!displayUrl ? (
                        <div style={{ padding: '15px 0' }}>
                            <i className={`fa-solid ${icon}`} style={{ fontSize: '20px', color: 'var(--text-muted)', marginBottom: '8px' }}></i>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to upload</div>
                        </div>
                    ) : (
                        <div>
                            <img src={displayUrl} alt={label} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px' }} />
                            {!isUploading && <button type="button" onClick={(e) => { e.preventDefault(); removeImageSlot(index); }} style={{position:'absolute', top:'4px', right:'4px', background:'var(--danger)', color:'white', border:'none', borderRadius:'50%', width:'22px', height:'22px', fontSize:'12px', cursor:'pointer'}}><i className="fa-solid fa-xmark"></i></button>}
                        </div>
                    )}
                </label>
                <input id={`file-upload-${index}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileSelect(e, index)} disabled={isUploading} />
            </div>
        );
    };

    return (
        <div id="add-product" className={`content-section ${isActive ? 'active' : ''}`}>
            <span className="section-title" style={{ marginBottom: '24px' }}>Submit/Edit Product</span>
            <p className="text-helper" style={{ marginBottom: '20px' }}>Your brand and dispatch information will be automatically attached using your Store Profile.</p>
            
            <form className="card" id="new-product-form" onSubmit={(e) => {
                if (sizingType?.startsWith('chart_')) {
                    const sizes = sizingType === 'chart_blouse' ? ['XS','S','M','L','XL','XXL'] : ['S','M','L','XL','XXL','XXXL'];
                    const isChecked = sizes.some(s => document.getElementById(`sz-chk-${s}`)?.checked);
                    if (!isChecked) {
                        e.preventDefault();
                        alert("Please select at least one available size and fill in its measurements.");
                        return;
                    }
                }
                handleProductSubmit(e);
            }}>
                
                {/* PRICING SECTION */}
                <span className="section-subtitle">Pricing & Earnings</span>
                <div className="field-grid" style={{ marginBottom: '10px' }}>
                    <div className="form-group">
                        <span className="label" style={{ color: 'var(--success)' }}>Your Guaranteed Payout (₹)</span>
                        <input type="number" id="p-payout" className="input-box" placeholder="e.g. 1000" value={payout} onChange={(e) => setPayout(e.target.value)} required min="10" style={{ borderColor: 'var(--success)', fontWeight: 'bold' }} disabled={isUploading} />
                    </div>
                    <div className="form-group">
                        <span className="label">Original MRP (Optional Strikethrough)</span>
                        <input type="number" id="p-original-price" className="input-box" placeholder="e.g. 2500" min="0" disabled={isUploading} />
                    </div>
                </div>

                {payout && !isNaN(payout) && parseFloat(payout) > 0 && (
                    <div className="pricing-breakdown-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '30px' }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '14px' }}><i className="fa-solid fa-calculator"></i> Retail Price Breakdown</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                            <span>Your Guaranteed Earnings (70%):</span>
                            <strong>₹{parseFloat(payout).toFixed(2)}</strong>
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
                        <input type="hidden" id="p-price" value={finalPrice.toFixed(2)} />
                    </div>
                )}

                {/* CATEGORY & SIZING SECTION */}
                <span className="section-subtitle">Product Categories & Sizing</span>
                <div className="field-grid">
                    <div className="form-group">
                        <span className="label">Department / Gender</span> 
                        <select id="p-gender" className="input-box" required value={department} onChange={(e) => { setDepartment(e.target.value); setCategory(""); }} disabled={isUploading}>
                            <option value="" disabled>Select Department</option>
                            <option value="Women">Women</option>
                            <option value="Men">Men</option>
                            <option value="Accessories">Accessories</option> 
                        </select>
                    </div>
                    <div className="form-group">
                        <span className="label">Category</span>
                        <select id="p-category" className="input-box" required value={category} onChange={(e) => setCategory(e.target.value)} disabled={!department || isUploading} >
                            <option value="" disabled>Select Category</option>
                            {department && categoryData[department].map(cat => (
                                <option key={cat.name} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* DYNAMIC SIZING POPUPS WITH AUTO-FILL AND STOCK */}
                {sizingType === 'chart_top_standard' && (
                    <div style={{ marginBottom: '24px', background: '#e0f2fe', padding: '16px', borderRadius: '8px', border: '1px solid #7dd3fc', overflowX: 'auto' }}>
                        <span className="label" style={{ color: '#0369a1', fontWeight: '700', display: 'block', marginBottom: '10px' }}><i className="fa-solid fa-ruler"></i> Detailed Size Chart (Inches)</span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                            <thead><tr><th style={tableHeaderStyle}>Size</th><th style={tableHeaderStyle}>Chest</th><th style={tableHeaderStyle}>Shoulder</th><th style={tableHeaderStyle}>Length</th><th style={tableHeaderStyle}>Sleeve</th><th style={tableHeaderStyle}>Stock Qty</th></tr></thead>
                            <tbody>
                                {['S (36)', 'M (38)', 'L (40)', 'XL (42)', 'XXL (44)', 'XXXL (46)'].map(sz => {
                                    const code = sz.split(' ')[0];
                                    return (
                                        <tr key={code}>
                                            <td style={tableCellStyle}>
                                                <label style={{cursor:'pointer', fontWeight:'500'}}>
                                                    <input type="checkbox" id={`sz-chk-${code}`} value={code} style={{ accentColor: '#0284c7', marginRight:'6px' }} disabled={isUploading} onChange={(e) => handleSizeCheck(e, 'chart_top_standard', code)}/> {sz}
                                                </label>
                                            </td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-chest`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-shoulder`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-length`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-sleeve`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-stock`} style={chartInputStyle} min="0" placeholder="Qty" disabled={isUploading} onKeyUp={calculateTotalStock} onChange={calculateTotalStock}/></td>
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
                            <thead><tr><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Size</th><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Bust</th><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Waist</th><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Shoulder</th><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Armhole</th><th style={{...tableHeaderStyle, background:'#fdf2f8'}}>Stock Qty</th></tr></thead>
                            <tbody>
                                {['XS (32)', 'S (34)', 'M (36)', 'L (38)', 'XL (40)', 'XXL (42)'].map(sz => {
                                    const code = sz.split(' ')[0];
                                    return (
                                        <tr key={code}>
                                            <td style={tableCellStyle}>
                                                <label style={{cursor:'pointer', fontWeight:'500'}}>
                                                    <input type="checkbox" id={`sz-chk-${code}`} value={code} style={{ accentColor: '#db2777', marginRight:'6px' }} disabled={isUploading} onChange={(e) => handleSizeCheck(e, 'chart_blouse', code)}/> {sz}
                                                </label>
                                            </td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-bust`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-waist`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-shoulder`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-armhole`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-stock`} style={chartInputStyle} min="0" placeholder="Qty" disabled={isUploading} onKeyUp={calculateTotalStock} onChange={calculateTotalStock}/></td>
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
                            <thead><tr><th style={{...tableHeaderStyle, background:'#f0fdf4'}}>Size</th><th style={{...tableHeaderStyle, background:'#f0fdf4'}}>Waist</th><th style={{...tableHeaderStyle, background:'#f0fdf4'}}>Hip</th><th style={{...tableHeaderStyle, background:'#f0fdf4'}}>Length</th><th style={{...tableHeaderStyle, background:'#f0fdf4'}}>Stock Qty</th></tr></thead>
                            <tbody>
                                {['S (30)', 'M (32)', 'L (34)', 'XL (36)', 'XXL (38)', 'XXXL (40)'].map(sz => {
                                    const code = sz.split(' ')[0];
                                    return (
                                        <tr key={code}>
                                            <td style={tableCellStyle}>
                                                <label style={{cursor:'pointer', fontWeight:'500'}}>
                                                    <input type="checkbox" id={`sz-chk-${code}`} value={code} style={{ accentColor: '#059669', marginRight:'6px' }} disabled={isUploading} onChange={(e) => handleSizeCheck(e, 'chart_bottom', code)}/> {sz}
                                                </label>
                                            </td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-waist`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-hip`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-length`} style={chartInputStyle} step="0.5" disabled={isUploading}/></td>
                                            <td style={tableCellStyle}><input type="number" id={`sz-${code}-stock`} style={chartInputStyle} min="0" placeholder="Qty" disabled={isUploading} onKeyUp={calculateTotalStock} onChange={calculateTotalStock}/></td>
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
                            <div className="form-group"><input type="text" id="p-length" className="input-box" placeholder="Length (e.g., 2.5 meters)" required style={{ borderColor: '#fcd34d' }} disabled={isUploading}/></div>
                            <div className="form-group"><input type="text" id="p-width" className="input-box" placeholder="Width (e.g., 1 meter)" required style={{ borderColor: '#fcd34d' }} disabled={isUploading}/></div>
                        </div>
                    </div>
                )}

                {/* DETAILS SECTION */}
                <span className="section-subtitle">Product Details</span>
                <div className="field-grid">
                    <div className="form-group"><span className="label">Product Name</span><input type="text" id="p-name" className="input-box" placeholder="e.g. Classic Bodo Waistcoat" required disabled={isUploading}/></div>
                    
                    {/* 🔥 EXPLICIT STOCK LOGIC UI */}
                    <div className="form-group">
                        <span className="label">
                            Available Stock 
                            {sizingType?.startsWith('chart_') ? 
                                <span style={{fontSize: '11px', color: 'var(--danger)', marginLeft: '4px'}}>(Auto-calculated from sizes)</span> : 
                                <span style={{fontSize: '11px', color: 'var(--success)', marginLeft: '4px'}}>(Enter total quantity)</span>
                            }
                        </span>
                        <input 
                            type="number" 
                            id="p-stock" 
                            className="input-box" 
                            placeholder={sizingType?.startsWith('chart_') ? "Auto-calculated" : "e.g. 50"} 
                            required 
                            min="0" 
                            disabled={isUploading} 
                            readOnly={sizingType?.startsWith('chart_')} 
                            style={sizingType?.startsWith('chart_') ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#9ca3af' } : {}}
                        />
                    </div>
                </div>
                
                <div className="field-grid">
                    <div className="form-group"><span className="label">Colour</span><input type="text" id="p-color" className="input-box" placeholder="e.g. Mustard Yellow" required disabled={isUploading}/></div>
                    <div className="form-group"><span className="label">Fabric</span><input type="text" id="p-fabric" className="input-box" placeholder="e.g. Pure Cotton" required disabled={isUploading}/></div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <span className="label">Search Tags (Comma separated)</span>
                    <input type="text" id="p-tags" className="input-box" placeholder="e.g. Bihu, Traditional, Wedding Wear" disabled={isUploading}/>
                </div>
                
                <div className="form-group" style={{ marginBottom: '30px' }}>
                    <span className="label">Wash & Care Instructions (Select all that apply)</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--input-border)' }}>
                        {['Standard Machine Wash', 'Hand Wash Cold', 'Dry Clean Only', 'Do Not Bleach', 'Iron Low Heat', 'Dry in Shade'].map(opt => (
                            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                                <input type="checkbox" className="p-care-chk" value={opt} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }} disabled={isUploading}/> {opt}
                            </label>
                        ))}
                    </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: '30px' }}>
                    <span className="label">Description</span>
                    <textarea id="p-desc" className="input-box" style={{ height: '100px' }} placeholder="Write a compelling description for the product..." required disabled={isUploading}></textarea>
                </div>

                <span className="section-subtitle">Logistics & Fulfillment</span>
                <div className="field-grid">
                    <div className="form-group">
                        <span className="label">Approx. Package Weight</span>
                        <select id="p-weight" className="input-box" required defaultValue="Under 500g" disabled={isUploading}>
                            <option value="Under 500g">Under 500g (Standard)</option>
                            <option value="500g - 1kg">500g - 1kg (Heavy)</option>
                            <option value="1kg - 2kg">1kg - 2kg (Very Heavy)</option>
                            <option value="Above 2kg">Above 2kg (Bulk)</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <span className="label">Dispatch Time</span>
                        <select id="p-dispatch" className="input-box" required defaultValue="Ships in 2-3 Days" disabled={isUploading}>
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
                            <input type="checkbox" id="p-pay-cod" defaultChecked style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }} disabled={isUploading}/> Cash on Delivery (COD)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                            <input type="checkbox" id="p-pay-online" defaultChecked style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }} disabled={isUploading}/> Online Payment
                        </label>
                    </div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <span className="label" style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: 'var(--primary)' }}>
                        <i className="fa-solid fa-arrow-right-arrow-left"></i> Return & Replacement Policy
                    </span>
                    <select id="p-return-policy" className="input-box" value={returnPolicy} onChange={(e) => setReturnPolicy(e.target.value)} required disabled={isUploading}>
                        <option value="7_day_return_replace">7-Day Return & Replacement (Recommended)</option>
                        <option value="7_day_replacement">7-Day Replacement Only (No Refunds)</option>
                        <option value="final_sale">Final Sale (No Returns / No Replacements)</option>
                    </select>
                    {returnPolicy !== 'final_sale' && (
                        <div style={{ marginTop: '12px', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '13px', color: '#1e3a8a', lineHeight: '1.5' }}>
                            <strong><i className="fa-solid fa-circle-info"></i> How returns affect your payout:</strong>
                            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                                <li style={{ marginBottom: '6px' }}><strong>Size/Fit Issues (Customer changed mind):</strong> Customer pays a ₹100 fee. <em>You pay nothing.</em></li>
                                <li><strong>Defective/Wrong Item Sent:</strong> Customer receives a full refund. <em>A ₹150 logistics penalty will be deducted from your earnings.</em> Please verify quality before packing!</li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* 🔥 STRUCTURED MEDIA UPLOAD GRID 🔥 */}
                <div style={{ marginTop: '30px' }}>
                    <span className="section-subtitle">Product Media (Guided Setup)</span>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Upload clear, high-quality media to maximize your sales. Front view is required.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                        
                        {renderImageSlot(0, "1. Front View (Hero)", "fa-image")}

                        <div style={{ border: '1px dashed var(--primary)', borderRadius: '8px', padding: '12px', textAlign: 'center', position: 'relative', background: '#eff6ff' }}>
                            <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: 'var(--primary)' }}>2. Video (Optional)</span>
                            <label htmlFor="video-upload" style={{ cursor: isUploading ? 'not-allowed' : 'pointer', display: 'block' }}>
                                {!(currentEditVideoUrl || selectedVideo) ? (
                                    <div style={{ padding: '15px 0' }}>
                                        <i className="fa-solid fa-video" style={{ fontSize: '20px', color: '#93c5fd', marginBottom: '8px' }}></i>
                                        <div style={{ fontSize: '11px', color: '#60a5fa' }}>Max 15MB</div>
                                    </div>
                                ) : (
                                    <div>
                                        <video src={selectedVideo ? URL.createObjectURL(selectedVideo) : currentEditVideoUrl} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '4px' }} muted loop autoPlay playsInline />
                                        {!isUploading && <button type="button" onClick={(e) => { e.preventDefault(); removeVideo(); }} style={{position:'absolute', top:'4px', right:'4px', background:'var(--danger)', color:'white', border:'none', borderRadius:'50%', width:'22px', height:'22px', fontSize:'12px', cursor:'pointer'}}><i className="fa-solid fa-xmark"></i></button>}
                                    </div>
                                )}
                            </label>
                            <input id="video-upload" type="file" accept="video/mp4,video/quicktime" style={{ display: 'none' }} onChange={handleVideoSelect} disabled={isUploading} />
                        </div>

                        {renderImageSlot(1, "3. Back View", "fa-person")}
                        {renderImageSlot(2, "4. Side View", "fa-person-walking")}
                        {renderImageSlot(3, "5. Fabric Close-up", "fa-magnifying-glass-plus")}
                        {renderImageSlot(4, "6. Lifestyle", "fa-camera-retro")}

                    </div>
                </div>
                
                {/* LIVE UPLOAD PROGRESS BAR */}
                {isUploading && (
                    <div style={{ marginTop: '30px', padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#166534' }}>
                            <span><i className="fa-solid fa-cloud-arrow-up fa-bounce"></i> Uploading Media... Please do not close window</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#dcfce7', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#22c55e', transition: 'width 0.3s ease' }}></div>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '30px' }}>
                    <button type="submit" id="submit-btn" className="btn-submit" disabled={isUploading}>
                        {isUploading ? "Processing..." : (editingProductId ? "Update & Request Approval" : "Submit for Admin Approval")}
                    </button> 
                    <button type="button" id="cancel-edit-btn" className="btn-submit" style={{ background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--input-border)', display: editingProductId ? 'inline-block' : 'none', marginLeft: '10px' }} onClick={onCancel} disabled={isUploading}>Cancel Edit</button> 
                </div>
            </form>
        </div>
    );
}