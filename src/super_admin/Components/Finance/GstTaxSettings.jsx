import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../../apiConfig.js";

export default function GstTaxSettings({ getAuthHeaders }) {
    const [saving, setSaving] = useState(false);
    const [taxes, setTaxes] = useState({
        gstOnCommission: 18.0, tcsRate: 1.0, gstBrackets: [{ maxLimit: 2500, rate: 5 }, { maxLimit: 999999, rate: 18 }]
    });

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, { headers: await getAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    if (Object.keys(data).length > 0) setTaxes(p => ({ ...p, ...data, gstBrackets: data.gstBrackets?.length ? data.gstBrackets : p.gstBrackets }));
                }
            } catch (err) {}
        };
        load();
    }, []);

    const updateBracket = (index, field, value) => {
        const newBrackets = [...taxes.gstBrackets];
        newBrackets[index][field] = parseFloat(value) || 0;
        newBrackets.sort((a, b) => a.maxLimit - b.maxLimit);
        setTaxes(p => ({ ...p, gstBrackets: newBrackets }));
    };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const headers = await getAuthHeaders();
            const currentData = await (await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, { headers })).json();
            await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, {
                method: "PUT", headers, body: JSON.stringify({ ...currentData, ...taxes })
            });
            alert("Tax configurations saved successfully!");
        } catch (err) { alert("Error saving."); } finally { setSaving(false); }
    };

    return (
        <form onSubmit={save} style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', padding: '24px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ color: '#8b7355', margin: 0, textTransform: 'uppercase', fontSize: '14px' }}>Dynamic Product GST Slabs</h3>
                <button type="button" onClick={() => setTaxes(p => ({...p, gstBrackets: [...p.gstBrackets, {maxLimit: 0, rate: 0}].sort((a,b) => a.maxLimit - b.maxLimit)}))} style={{ background: '#111827', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>+ Add Bracket</button>
            </div>
            
            <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '16px', marginBottom: '8px', fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>
                    <span>Price Threshold UP TO (₹)</span><span>Tax Rate Applied (%)</span><span></span>
                </div>
                {taxes.gstBrackets.map((bracket, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '16px', marginBottom: '10px' }}>
                        <input type="number" value={bracket.maxLimit} onChange={(e) => updateBracket(index, 'maxLimit', e.target.value)} className="input-box" placeholder="e.g. 2500" required />
                        <input type="number" step="0.1" value={bracket.rate} onChange={(e) => updateBracket(index, 'rate', e.target.value)} className="input-box" required />
                        {taxes.gstBrackets.length > 1 && (
                            <button type="button" onClick={() => setTaxes(p => ({...p, gstBrackets: p.gstBrackets.filter((_, i) => i !== index)}))} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer' }}><i className="fa-solid fa-trash"></i></button>
                        )}
                    </div>
                ))}
                <small style={{ color: '#9ca3af', fontSize: '11px' }}>* Ensure your final highest bracket is set to 999999.</small>
            </div>

            <h3 style={{ color: '#8b7355', textTransform: 'uppercase', fontSize: '14px', marginTop: '30px' }}>Government Tax Collection</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                    <label className="text-helper" style={{ display: 'block', marginBottom: '6px' }}>GST on Jamba Commission (%)</label>
                    <input type="number" step="0.1" value={taxes.gstOnCommission} onChange={(e) => setTaxes({...taxes, gstOnCommission: parseFloat(e.target.value)})} className="input-box" required />
                </div>
                <div>
                    <label className="text-helper" style={{ display: 'block', marginBottom: '6px' }}>E-Commerce TCS Rate (%)</label>
                    <input type="number" step="0.05" value={taxes.tcsRate} onChange={(e) => setTaxes({...taxes, tcsRate: parseFloat(e.target.value)})} className="input-box" required />
                </div>
            </div>

            <button type="submit" className="btn-pay" style={{ width: '100%', background: '#111827' }} disabled={saving}>{saving ? "Saving..." : "Save Tax Configurations"}</button>
        </form>
    );
}