import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../apiConfig.js';
import './SellerPromoTab.css'; // Import the unified styles

export default function SellerPromoTab({ getAuthHeaders }) {
    const [promos, setPromos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    
    const [newPromo, setNewPromo] = useState({
        code: '', type: 'percentage', value: '', usage_limit: 'unlimited', 
        valid_from: '', valid_until: '', payment_method: 'all'
    });

    useEffect(() => { fetchMyPromos(); }, []);

    const fetchMyPromos = async () => {
        setIsLoading(true);
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
            const res = await fetch(`${API_BASE_URL}/api/v1/seller/promocodes`, { headers });
            if (res.ok) setPromos(await res.json());
        } catch (err) { console.error("Error fetching promos", err); }
        finally { setIsLoading(false); }
    };

    const handleRequestPromo = async (e) => {
        e.preventDefault();
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`${API_BASE_URL}/api/v1/seller/promocodes`, {
                method: 'POST',
                headers,
                body: JSON.stringify(newPromo)
            });
            
            if (res.ok) {
                alert("✅ Promo Code Requested! Waiting for Admin approval.");
                setNewPromo({ code: '', type: 'percentage', value: '', usage_limit: 'unlimited', valid_from: '', valid_until: '', payment_method: 'all' });
                setIsCreating(false);
                fetchMyPromos();
            } else {
                const err = await res.json();
                alert(`❌ ${err.error}`);
            }
        } catch (err) { alert("Network error"); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this promo code request?")) return;
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
            // Sellers hit the same delete route as admins, but we would need to add a seller delete route if you want strict isolation.
            // For now, let's just alert them to contact admin, or we can use the admin route if the seller token is accepted.
            alert("To delete an active code, please contact Jamba Support.");
        } catch (err) {}
    };

    return (
        <div className="content-section active">
            <div className="promo-header-container">
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', color: '#111827' }}>My Discount Codes</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                        Create promotional codes for your products. Discounts are deducted from your seller payout.
                    </p>
                </div>
                <button 
                    onClick={() => setIsCreating(!isCreating)}
                    className="promo-btn-submit"
                >
                    {isCreating ? "Cancel" : "+ Request Promo Code"}
                </button>
            </div>

            {isCreating && (
                <form onSubmit={handleRequestPromo} className="promo-form-card">
                    <div className="promo-input-group">
                        <label className="promo-label">CODE NAME (e.g. MYBRAND10)</label>
                        <input type="text" required value={newPromo.code} onChange={e => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})} className="promo-input" style={{ textTransform: 'uppercase' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="promo-input-group" style={{ flex: 1 }}>
                            <label className="promo-label">DISCOUNT TYPE</label>
                            <select value={newPromo.type} onChange={e => setNewPromo({...newPromo, type: e.target.value})} className="promo-input">
                                <option value="percentage">% Discount</option>
                                <option value="flat">Flat ₹ Amount</option>
                            </select>
                        </div>
                        <div className="promo-input-group" style={{ flex: 1 }}>
                            <label className="promo-label">VALUE</label>
                            <input type="number" required value={newPromo.value} onChange={e => setNewPromo({...newPromo, value: e.target.value})} className="promo-input" />
                        </div>
                    </div>
                    <div className="promo-input-group">
                        <label className="promo-label">START DATE & TIME</label>
                        <input type="datetime-local" required value={newPromo.valid_from} onChange={e => setNewPromo({...newPromo, valid_from: e.target.value})} className="promo-input" />
                    </div>
                    <div className="promo-input-group">
                        <label className="promo-label">END DATE & TIME</label>
                        <input type="datetime-local" required value={newPromo.valid_until} onChange={e => setNewPromo({...newPromo, valid_until: e.target.value})} className="promo-input" />
                    </div>
                    <div className="promo-input-group">
                        <label className="promo-label">PAYMENT METHOD</label>
                        <select value={newPromo.payment_method} onChange={e => setNewPromo({...newPromo, payment_method: e.target.value})} className="promo-input">
                            <option value="all">Both (COD & Online Prepaid)</option>
                            <option value="online">Online Prepaid Only</option>
                            <option value="cod">Cash on Delivery (COD) Only</option>
                        </select>
                    </div>
                    <div className="promo-input-group" style={{ gridColumn: '1 / -1' }}>
                        <button type="submit" className="promo-btn-submit" style={{ width: '100%' }}>Submit for Admin Approval</button>
                    </div>
                </form>
            )}

            <div className="table-responsive" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <tr>
                            <th style={{ padding: '12px 16px' }}>Code</th>
                            <th style={{ padding: '12px 16px' }}>Discount</th>
                            <th style={{ padding: '12px 16px' }}>Valid Until</th>
                            <th style={{ padding: '12px 16px' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
                        ) : promos.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>You haven't requested any promo codes yet.</td></tr>
                        ) : promos.map((p) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold', fontFamily: 'monospace' }}>{p.code}</td>
                                <td style={{ padding: '12px 16px', color: '#059669', fontWeight: '600' }}>
                                    {p.type === 'percentage' ? `${p.value}% OFF` : `₹${p.value} OFF`}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>
                                    {new Date(p.valid_until).toLocaleString()}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <span className={`status-badge ${p.status}`}>{p.status}</span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                    <button onClick={() => handleDelete(p.id)} style={{ background: 'transparent', color: '#dc2626', border: 'none', cursor: 'pointer' }}>
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}