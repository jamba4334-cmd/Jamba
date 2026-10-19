import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../../apiConfig.js";

export default function CommissionSettings({ getAuthHeaders }) {
    const [saving, setSaving] = useState(false);
    const [charges, setCharges] = useState({ platformCommission: 25.0, shippingFreeThreshold: 1999, defaultShippingFee: 149, codConvenienceFee: 39 });

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, { headers: await getAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    if (Object.keys(data).length > 0) setCharges(p => ({ ...p, ...data }));
                }
            } catch (err) {}
        };
        load();
    }, []);

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const headers = await getAuthHeaders();
            const currentData = await (await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, { headers })).json();
            await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, {
                method: "PUT", headers, body: JSON.stringify({ ...currentData, ...charges })
            });
            alert("Commission rules saved successfully!");
        } catch (err) { alert("Error saving."); } finally { setSaving(false); }
    };

    return (
        <form onSubmit={save} style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', padding: '24px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ color: '#8b7355', marginTop: 0, textTransform: 'uppercase', fontSize: '14px' }}>Jamba Platform Fees</h3>
            <div style={{ marginBottom: '24px' }}>
                <label className="text-helper" style={{ display: 'block', marginBottom: '6px' }}>Platform Commission Rate (%)</label>
                <input type="number" step="0.1" value={charges.platformCommission} onChange={(e) => setCharges({...charges, platformCommission: parseFloat(e.target.value)})} className="input-box" required style={{maxWidth: '300px'}} />
            </div>

            <h3 style={{ color: '#8b7355', textTransform: 'uppercase', fontSize: '14px' }}>Logistics Configuration</h3>
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