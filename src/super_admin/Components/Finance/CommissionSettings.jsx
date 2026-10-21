import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../../apiConfig.js";

export default function CommissionSettings({ getAuthHeaders }) {
    const [saving, setSaving] = useState(false);
    const [charges, setCharges] = useState({ 
        commissionBrackets: [
            { maxLimit: 1499, rate: 25 },
            { maxLimit: 3999, rate: 18 },
            { maxLimit: 999999, rate: 10 }
        ],
        shippingFreeThreshold: 1999, 
        defaultShippingFee: 149, 
        codConvenienceFee: 39 
    });

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, { headers: await getAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    if (Object.keys(data).length > 0) {
                        setCharges(p => ({ 
                            ...p, 
                            ...data,
                            // Load custom tiers if they exist, otherwise use our default slab model
                            commissionBrackets: data.commissionBrackets?.length ? data.commissionBrackets : p.commissionBrackets
                        }));
                    }
                }
            } catch (err) {}
        };
        load();
    }, [getAuthHeaders]);

    const updateBracket = (index, field, value) => {
        const newBrackets = [...charges.commissionBrackets];
        newBrackets[index][field] = parseFloat(value) || 0;
        // Auto-sort brackets from lowest to highest price limit
        newBrackets.sort((a, b) => a.maxLimit - b.maxLimit);
        setCharges(p => ({ ...p, commissionBrackets: newBrackets }));
    };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const headers = await getAuthHeaders();
            const currentDataRes = await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, { headers });
            const currentData = await currentDataRes.json();
            
            const updatedData = { ...currentData, ...charges };
            // Wipe out the old single flat rate so it doesn't conflict with the new slab logic
            delete updatedData.platformCommission; 

            await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, {
                method: "PUT", headers, body: JSON.stringify(updatedData)
            });
            alert("Dynamic Commission Tiers saved successfully!");
        } catch (err) { alert("Error saving."); } finally { setSaving(false); }
    };

    return (
        <form onSubmit={save} style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', padding: '24px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: '#8b7355', margin: 0, textTransform: 'uppercase', fontSize: '14px' }}>Price-Tiered Platform Commission</h3>
                <button type="button" onClick={() => setCharges(p => ({...p, commissionBrackets: [...p.commissionBrackets, {maxLimit: 0, rate: 0}].sort((a,b) => a.maxLimit - b.maxLimit)}))} style={{ background: '#111827', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>+ Add Tier</button>
            </div>
            
            <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '16px', marginBottom: '8px', fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>
                    <span>Selling Price UP TO (₹)</span><span>Jamba Commission (%)</span><span></span>
                </div>
                {charges.commissionBrackets.map((bracket, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '16px', marginBottom: '10px' }}>
                        <input type="number" value={bracket.maxLimit} onChange={(e) => updateBracket(index, 'maxLimit', e.target.value)} className="input-box" placeholder="e.g. 1500" required />
                        <input type="number" step="0.1" value={bracket.rate} onChange={(e) => updateBracket(index, 'rate', e.target.value)} className="input-box" required />
                        {charges.commissionBrackets.length > 1 && (
                            <button type="button" onClick={() => setCharges(p => ({...p, commissionBrackets: p.commissionBrackets.filter((_, i) => i !== index)}))} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-trash"></i></button>
                        )}
                    </div>
                ))}
                <small style={{ color: '#9ca3af', fontSize: '11px' }}>* Ensure your final highest tier is set to 999999 to cover all premium products.</small>
            </div>

            <h3 style={{ color: '#8b7355', textTransform: 'uppercase', fontSize: '14px', marginTop: '30px' }}>Logistics Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                    <label className="text-helper" style={{ display: 'block', marginBottom: '6px' }}>Free Shipping Threshold (₹)</label>
                    <input type="number" value={charges.shippingFreeThreshold} onChange={(e) => setCharges({...charges, shippingFreeThreshold: parseFloat(e.target.value)})} className="input-box" required />
                </div>
                <div>
                    <label className="text-helper" style={{ display: 'block', marginBottom: '6px' }}>Standard Delivery Fee (₹)</label>
                    <input type="number" value={charges.defaultShippingFee} onChange={(e) => setCharges({...charges, defaultShippingFee: parseFloat(e.target.value)})} className="input-box" required />
                </div>
                <div>
                    <label className="text-helper" style={{ display: 'block', marginBottom: '6px' }}>COD Handling Surcharge (₹)</label>
                    <input type="number" value={charges.codConvenienceFee} onChange={(e) => setCharges({...charges, codConvenienceFee: parseFloat(e.target.value)})} className="input-box" required />
                </div>
            </div>
            
            <button type="submit" className="btn-pay" style={{ width: '100%', background: '#111827' }} disabled={saving}>{saving ? "Saving..." : "Save Commission Settings"}</button>
        </form>
    );
}