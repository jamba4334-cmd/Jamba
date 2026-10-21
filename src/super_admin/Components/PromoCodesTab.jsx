import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../apiConfig.js';
import "../styles/PromoCodesTab.css";

export default function PromoCodesTab({ getAuthHeaders }) {
    const [promos, setPromos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [newPromo, setNewPromo] = useState({
        code: '', type: 'percentage', value: '', usage_limit: 'unlimited', 
        valid_from: '', valid_until: '', payment_method: 'all'
    });

    useEffect(() => { 
        fetchPromos(); 
    }, []);

    const fetchPromos = async () => {
        setIsLoading(true);
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
            const res = await fetch(`${API_BASE_URL}/admin/promocodes`, { headers });
            if (res.ok) {
                setPromos(await res.json());
            }
        } catch (err) { 
            console.error("Error fetching promos", err); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const handleCreatePromo = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            
            // Clean up empty dates for the backend
            const payload = {
                ...newPromo,
                valid_from: newPromo.valid_from || null,
                valid_until: newPromo.valid_until || null
            };

            const res = await fetch(`${API_BASE_URL}/admin/promocodes`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                alert("✅ Master Promo Code Activated!");
                setNewPromo({ code: '', type: 'percentage', value: '', usage_limit: 'unlimited', valid_from: '', valid_until: '', payment_method: 'all' });
                setIsCreating(false);
                fetchPromos();
            } else {
                const err = await res.json();
                alert(`❌ Error: ${err.error}`);
            }
        } catch (err) { 
            alert("Network error connecting to the secure engine."); 
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateStatus = async (id, newStatus) => {
        const actionText = newStatus === 'active' ? 'Approve' : newStatus === 'paused' ? 'Pause' : 'Reject';
        if (!window.confirm(`Are you sure you want to ${actionText} this promo code?`)) return;

        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`${API_BASE_URL}/admin/promocodes/${id}`, {
                method: 'PUT', 
                headers, 
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                fetchPromos();
            } else {
                alert("Failed to update status.");
            }
        } catch (err) { 
            alert("Server connection failed."); 
        }
    };

    const deletePromo = async (id) => {
        if (!window.confirm("🚨 WARNING: Are you sure you want to permanently delete this code? This action cannot be undone.")) return;
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
            await fetch(`${API_BASE_URL}/admin/promocodes/${id}`, { method: 'DELETE', headers });
            fetchPromos();
        } catch (err) { 
            alert("Failed to delete promo code."); 
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "No Expiry";
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="content-section active" style={{ padding: '20px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>Promotional Engine</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>Manage global discounts and approve seller-specific codes.</p>
                </div>
                <button 
                    onClick={() => setIsCreating(!isCreating)}
                    style={{ background: isCreating ? '#ef4444' : '#111827', color: 'white', padding: '10px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                >
                    {isCreating ? <><i className="fa-solid fa-xmark"></i> Cancel Creation</> : <><i className="fa-solid fa-plus"></i> Generate Master Code</>}
                </button>
            </div>

            {/* --- ADMIN PROMO CREATOR FORM --- */}
            {isCreating && (
                <form className="card" onSubmit={handleCreatePromo} style={{ background: '#f8fafc', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                    <span className="section-subtitle" style={{ color: '#0f172a' }}>Create Global Admin Discount</span>
                    
                    <div className="field-grid">
                        <div className="form-group">
                            <span className="label" style={{ color: '#059669' }}>Promo Code (Customers will type this)</span>
                            <input type="text" required placeholder="e.g. JAMBA50" value={newPromo.code} onChange={e => setNewPromo({...newPromo, code: e.target.value.toUpperCase().replace(/\s+/g, '')})} className="input-box" style={{ textTransform: 'uppercase', borderColor: '#34d399', fontWeight: 'bold' }} disabled={isSubmitting} />
                        </div>
                        <div className="form-group">
                            <span className="label">Allowed Payment Methods</span>
                            <select value={newPromo.payment_method} onChange={e => setNewPromo({...newPromo, payment_method: e.target.value})} className="input-box" disabled={isSubmitting}>
                                <option value="all">All Methods (COD & Online)</option>
                                <option value="online">Online Prepaid Only</option>
                                <option value="cod">Cash on Delivery (COD) Only</option>
                            </select>
                        </div>
                    </div>

                    <div className="field-grid">
                        <div className="form-group">
                            <span className="label">Discount Type</span>
                            <select value={newPromo.type} onChange={e => setNewPromo({...newPromo, type: e.target.value})} className="input-box" disabled={isSubmitting}>
                                <option value="percentage">% Percentage Discount</option>
                                <option value="flat">₹ Flat Amount Off</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <span className="label">Discount Value ({newPromo.type === 'percentage' ? '%' : '₹'})</span>
                            <input type="number" required placeholder={newPromo.type === 'percentage' ? "e.g. 15" : "e.g. 500"} value={newPromo.value} onChange={e => setNewPromo({...newPromo, value: e.target.value})} className="input-box" min="1" max={newPromo.type === 'percentage' ? "100" : "100000"} disabled={isSubmitting} />
                        </div>
                    </div>

                    <div className="field-grid">
                        <div className="form-group">
                            <span className="label">Valid From (Optional)</span>
                            <input type="datetime-local" value={newPromo.valid_from} onChange={e => setNewPromo({...newPromo, valid_from: e.target.value})} className="input-box" disabled={isSubmitting} />
                        </div>
                        <div className="form-group">
                            <span className="label">Valid Until (Optional)</span>
                            <input type="datetime-local" value={newPromo.valid_until} onChange={e => setNewPromo({...newPromo, valid_until: e.target.value})} className="input-box" disabled={isSubmitting} />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <span className="label">Customer Usage Limit</span>
                        <select value={newPromo.usage_limit} onChange={e => setNewPromo({...newPromo, usage_limit: e.target.value})} className="input-box" disabled={isSubmitting}>
                            <option value="unlimited">Unlimited Uses per Customer</option>
                            <option value="single">Single Use per Customer</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" disabled={isSubmitting} style={{ padding: '12px 24px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                            {isSubmitting ? "Generating..." : "Activate Master Code"}
                        </button>
                    </div>
                </form>
            )}

            {/* --- PROMO CODES LEDGER --- */}
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                        <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <tr>
                                <th style={{ padding: '16px', color: '#374151', fontWeight: '600' }}>Code ID</th>
                                <th style={{ padding: '16px', color: '#374151', fontWeight: '600' }}>Discount</th>
                                <th style={{ padding: '16px', color: '#374151', fontWeight: '600' }}>Ownership</th>
                                <th style={{ padding: '16px', color: '#374151', fontWeight: '600' }}>Validity</th>
                                <th style={{ padding: '16px', color: '#374151', fontWeight: '600' }}>Status</th>
                                <th style={{ padding: '16px', color: '#374151', fontWeight: '600', textAlign: 'right' }}>Management</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading secure codes...</td></tr>
                            ) : promos.length === 0 ? (
                                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No promotional codes found in the database.</td></tr>
                            ) : promos.map((p) => {
                                
                                const isAdmin = p.creator_role === 'admin';
                                
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: p.status === 'pending' ? '#fffbeb' : 'transparent' }}>
                                        <td style={{ padding: '16px', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '16px', color: '#111827' }}>
                                            {p.code}
                                        </td>
                                        <td style={{ padding: '16px', color: '#059669', fontWeight: '700' }}>
                                            {p.type === 'percentage' ? `${p.value}% OFF` : `₹${p.value} OFF`}
                                            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal', marginTop: '2px' }}>
                                                {p.payment_method === 'all' ? 'All Payments' : p.payment_method === 'online' ? 'Prepaid Only' : 'COD Only'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px' }}>
                                            {isAdmin ? (
                                                <span style={{ color: '#4f46e5', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-shield-halved"></i> Global Admin</span>
                                            ) : (
                                                <div style={{ color: '#b45309' }}>
                                                    <strong><i className="fa-solid fa-store"></i> Seller Brand</strong><br/>
                                                    <span style={{ fontSize: '11px' }}>{p.seller_email}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
                                            <strong>Start:</strong> {formatDate(p.valid_from)}<br/>
                                            <strong>End:</strong> {formatDate(p.valid_until)}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ 
                                                padding: '6px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                                                background: p.status === 'active' ? '#dcfce7' : p.status === 'pending' ? '#fef3c7' : p.status === 'paused' ? '#e5e7eb' : '#fee2e2',
                                                color: p.status === 'active' ? '#166534' : p.status === 'pending' ? '#b45309' : p.status === 'paused' ? '#4b5563' : '#991b1b'
                                            }}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            {p.status === 'pending' && (
                                                <div style={{ display: 'inline-flex', gap: '8px', marginRight: '16px' }}>
                                                    <button onClick={() => updateStatus(p.id, 'active')} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Approve</button>
                                                    <button onClick={() => updateStatus(p.id, 'rejected')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Reject</button>
                                                </div>
                                            )}
                                            
                                            {p.status === 'active' && (
                                                <button onClick={() => updateStatus(p.id, 'paused')} title="Pause Promo" style={{ background: 'transparent', color: '#4b5563', border: '1px solid #d1d5db', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}><i className="fa-solid fa-pause"></i></button>
                                            )}
                                            {p.status === 'paused' && (
                                                <button onClick={() => updateStatus(p.id, 'active')} title="Reactivate Promo" style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}><i className="fa-solid fa-play"></i></button>
                                            )}

                                            <button onClick={() => deletePromo(p.id)} title="Delete Code" style={{ background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}><i className="fa-solid fa-trash"></i></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}