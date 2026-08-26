import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../apiConfig.js';
import "../styles/PromoCodesTab.css";

export default function PromoCodesTab({ getAuthHeaders }) {
    const [promos, setPromos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    
    // New Promo Form State
    const [newPromo, setNewPromo] = useState({
        code: '', type: 'percentage', value: '', usage_limit: 'unlimited', 
        valid_from: '', valid_until: '', payment_method: 'all'
    });

    useEffect(() => { fetchPromos(); }, []);

    const fetchPromos = async () => {
        setIsLoading(true);
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
            const res = await fetch(`${API_BASE_URL}/admin/promocodes`, { headers });
            if (res.ok) setPromos(await res.json());
        } catch (err) { console.error("Error fetching promos", err); }
        finally { setIsLoading(false); }
    };

    const handleCreatePromo = async (e) => {
        e.preventDefault();
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`${API_BASE_URL}/admin/promocodes`, {
                method: 'POST',
                headers,
                body: JSON.stringify(newPromo)
            });
            
            if (res.ok) {
                alert("✅ Admin Promo Code Generated!");
                setNewPromo({ code: '', type: 'percentage', value: '', usage_limit: 'unlimited', valid_from: '', valid_until: '', payment_method: 'all' });
                setIsCreating(false);
                fetchPromos();
            } else {
                const err = await res.json();
                alert(`❌ ${err.error}`);
            }
        } catch (err) { alert("Network error"); }
    };

    const updateStatus = async (id, newStatus) => {
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            await fetch(`${API_BASE_URL}/admin/promocodes/${id}`, {
                method: 'PUT', headers, body: JSON.stringify({ status: newStatus })
            });
            fetchPromos();
        } catch (err) { alert("Failed to update status"); }
    };

    const deletePromo = async (id) => {
        if (!window.confirm("Are you sure you want to permanently delete this code?")) return;
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {};
            await fetch(`${API_BASE_URL}/admin/promocodes/${id}`, { method: 'DELETE', headers });
            fetchPromos();
        } catch (err) { alert("Failed to delete"); }
    };

    return (
        <div className="content-section active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', color: '#111827' }}>Promotional Engine</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>Manage platform discounts and approve seller codes.</p>
                </div>
                <button 
                    onClick={() => setIsCreating(!isCreating)}
                    style={{ background: '#111827', color: 'white', padding: '10px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                >
                    {isCreating ? "Cancel" : "+ Generate Admin Code"}
                </button>
            </div>

            {isCreating && (
                <form onSubmit={handleCreatePromo} style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>CODE NAME</label>
                        <input type="text" required placeholder="e.g. DIWALI20" value={newPromo.code} onChange={e => setNewPromo({...newPromo, code: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', textTransform: 'uppercase' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>TYPE</label>
                            <select value={newPromo.type} onChange={e => setNewPromo({...newPromo, type: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                                <option value="percentage">% Discount</option>
                                <option value="flat">Flat ₹ Amount</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>VALUE</label>
                            <input type="number" required placeholder="e.g. 20" value={newPromo.value} onChange={e => setNewPromo({...newPromo, value: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>START TIMER</label>
                        <input type="datetime-local" required value={newPromo.valid_from} onChange={e => setNewPromo({...newPromo, valid_from: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>END TIMER</label>
                        <input type="datetime-local" required value={newPromo.valid_until} onChange={e => setNewPromo({...newPromo, valid_until: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>USAGE LIMIT</label>
                        <select value={newPromo.usage_limit} onChange={e => setNewPromo({...newPromo, usage_limit: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                            <option value="unlimited">Unlimited Uses</option>
                            <option value="single">Single Use Per Customer</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '4px' }}>PAYMENT METHOD</label>
                        <select value={newPromo.payment_method} onChange={e => setNewPromo({...newPromo, payment_method: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                            <option value="all">Both (COD & Online Prepaid)</option>
                            <option value="online">Online Prepaid Only</option>
                            <option value="cod">Cash on Delivery (COD) Only</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="submit" style={{ width: '100%', padding: '10px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Save Master Code</button>
                    </div>
                </form>
            )}

            <div className="table-responsive" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <tr>
                            <th style={{ padding: '12px 16px' }}>Code</th>
                            <th style={{ padding: '12px 16px' }}>Discount</th>
                            <th style={{ padding: '12px 16px' }}>Creator</th>
                            <th style={{ padding: '12px 16px' }}>Valid Until</th>
                            <th style={{ padding: '12px 16px' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center' }}>Loading...</td></tr>
                        ) : promos.map((p) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold', fontFamily: 'monospace' }}>{p.code}</td>
                                <td style={{ padding: '12px 16px', color: '#059669', fontWeight: '600' }}>
                                    {p.type === 'percentage' ? `${p.value}% OFF` : `₹${p.value} OFF`}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                                    {p.creator_role === 'admin' ? <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>Admin</span> : <span style={{ color: '#d97706' }}>Seller ({p.seller_email})</span>}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>
                                    {new Date(p.valid_until).toLocaleString()}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <span style={{ 
                                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                                        background: p.status === 'active' ? '#dcfce7' : p.status === 'pending' ? '#fef3c7' : '#fee2e2',
                                        color: p.status === 'active' ? '#166534' : p.status === 'pending' ? '#b45309' : '#991b1b'
                                    }}>
                                        {p.status}
                                    </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                    {p.status === 'pending' && (
                                        <>
                                            <button onClick={() => updateStatus(p.id, 'active')} style={{ background: '#059669', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', marginRight: '8px', cursor: 'pointer', fontSize: '12px' }}>Approve</button>
                                            <button onClick={() => updateStatus(p.id, 'rejected')} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', marginRight: '8px', cursor: 'pointer', fontSize: '12px' }}>Reject</button>
                                        </>
                                    )}
                                    <button onClick={() => deletePromo(p.id)} style={{ background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer' }}><i className="fa-solid fa-trash"></i></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}