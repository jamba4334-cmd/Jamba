import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../apiConfig.js"; 
import "../styles/Earnings.css";

// --- INLINE PREMIUM MODAL COMPONENT ---
const FinanceModal = ({ isOpen, onClose, onConfirm, title, children, confirmText="Confirm" }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content fade-in">
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    {children}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#f3f4f6', fontWeight: '600', cursor: 'pointer', color: '#374151' }}>
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: 'var(--primary, #111827)', color: 'white', fontWeight: '600', cursor: 'pointer' }}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function EarningsTab({ getAuthHeaders }) {
    const [activeView, setActiveView] = useState('money-in'); 
    const [isLoading, setIsLoading] = useState(true);
    
    const [kpis, setKpis] = useState({ jambaRevenue: 0, pendingPayouts: 0, inEscrow: 0, totalGST: 0 });
    const [customerPayments, setCustomerPayments] = useState([]); 
    const [pendingSettlements, setPendingSettlements] = useState([]); 
    const [masterLedger, setMasterLedger] = useState([]); 

    const [godModeModal, setGodModeModal] = useState({ isOpen: false, brand: '', amount: '', reason: '' });
    const [payoutModal, setPayoutModal] = useState({ isOpen: false, payoutId: null, brandName: '', amount: 0, utr: '' });

    // --- DYNAMIC TAX SLAB STATE ---
    const [taxConfig, setTaxConfig] = useState({ 
        platformCommission: 30, 
        tcsRate: 1.0,
        gstThreshold: 2500,
        gstLowerRate: 5,
        gstUpperRate: 18
    });
    const [isSavingTax, setIsSavingTax] = useState(false);

    useEffect(() => {
        fetchFinancialData();
    }, []);

    const fetchFinancialData = async () => {
        setIsLoading(true);
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };

            const kpiRes = await fetch(`${API_BASE_URL}/admin/finance/kpis`, { headers });
            if (kpiRes.ok) setKpis(await kpiRes.json());

            const inflowRes = await fetch(`${API_BASE_URL}/admin/finance/customer-payments`, { headers });
            if (inflowRes.ok) setCustomerPayments(await inflowRes.json());

            const payoutsRes = await fetch(`${API_BASE_URL}/admin/payouts?status=pending`, { headers });
            if (payoutsRes.ok) setPendingSettlements(await payoutsRes.json());

            const ledgerRes = await fetch(`${API_BASE_URL}/admin/transactions`, { headers });
            if (ledgerRes.ok) setMasterLedger(await ledgerRes.json());

            // --- FETCH TAX CONFIGURATION ---
            const taxRes = await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, { headers });
            if (taxRes.ok) {
                const taxData = await taxRes.json();
                if (Object.keys(taxData).length > 0) {
                    setTaxConfig({
                        platformCommission: taxData.platformCommission || 30,
                        tcsRate: taxData.tcsRate || 1.0,
                        gstThreshold: taxData.gstThreshold || 2500,
                        gstLowerRate: taxData.gstLowerRate || 5,
                        gstUpperRate: taxData.gstUpperRate || 18
                    });
                }
            }

        } catch (error) {
            console.error("Error loading secure financial modules:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const executeGodModeAdjustment = async () => {
        if (!godModeModal.brand || !godModeModal.amount || !godModeModal.reason) {
            alert("Please fill all fields."); return;
        }
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            const response = await fetch(`${API_BASE_URL}/admin/finance/adjust`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ brand: godModeModal.brand, amount: parseFloat(godModeModal.amount), reason: godModeModal.reason })
            });
            if (response.ok) {
                alert("🛡️ God Mode Override Successful! Adjustment recorded.");
                setGodModeModal({ isOpen: false, brand: '', amount: '', reason: '' });
                fetchFinancialData();
            }
        } catch (e) { alert("Adjustment injection failed: " + e.message); }
    };

    const executePayout = async () => {
        if (!payoutModal.utr) {
            alert("Please enter the UTR reference number."); return;
        }
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            const response = await fetch(`${API_BASE_URL}/admin/payouts/${payoutModal.payoutId}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({ status: 'paid', utr: payoutModal.utr })
            });
            if (response.ok) {
                alert(`Success! ₹${payoutModal.amount} cleared. UTR: ${payoutModal.utr}`);
                setPayoutModal({ isOpen: false, payoutId: null, brandName: '', amount: 0, utr: '' });
                fetchFinancialData(); 
            }
        } catch (error) { alert("Error: " + error.message); }
    };

    // --- SAVE TAX CONFIGURATION ---
    const saveTaxConfiguration = async () => {
        setIsSavingTax(true);
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            const res = await fetch(`${API_BASE_URL}/admin/settings/financial_settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(taxConfig)
            });
            
            if (res.ok) {
                alert("✅ Global Financial Configuration Locked Successfully!");
            } else {
                alert("❌ Failed to save configuration. Check permissions.");
            }
        } catch (error) {
            alert("❌ Network error while saving.");
        } finally {
            setIsSavingTax(false);
        }
    };

    const handleExportCSV = () => {
        alert("Downloading CSV file for Bank Bulk Upload...");
    };

    if (isLoading) return <div style={{ padding: '40px', fontWeight: '500', color: 'var(--text-muted)' }}>Syncing Core Financial Ledger Modules...</div>;

    return (
        <div className="content-section active earnings-section">
            <div className="earnings-header-container">
                <div className="earnings-top-row">
                    <div>
                        <span className="section-title" style={{ margin: 0 }}>Jamba Financial Center</span>
                        <p className="text-helper" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Ultimate Control Engine: Customer inflows, payout hooks, and manual balance overrides.</p>
                    </div>
                    <div style={{display: 'flex', gap: '12px'}}>
                        <button type="button" className="btn-export" onClick={handleExportCSV}>
                            <i className="fa-solid fa-file-csv"></i> Export Ledger
                        </button>
                        <button type="button" className="btn-pay" style={{ backgroundColor: 'var(--danger)' }} onClick={() => setGodModeModal({ ...godModeModal, isOpen: true })}>
                            <i className="fa-solid fa-shield-halved"></i> Inject Correction
                        </button>
                    </div>
                </div>
            </div>

            <div className="kpi-grid">
                <div className="kpi-card highlight-primary">
                    <div className="kpi-icon"><i className="fa-solid fa-wallet"></i></div>
                    <div className="kpi-data">
                        <span className="kpi-label">Jamba Net Revenue</span>
                        <span className="kpi-value">₹{(kpis.jambaRevenue || 0).toLocaleString()}</span>
                    </div>
                </div>
                <div className="kpi-card highlight-danger">
                    <div className="kpi-icon"><i className="fa-solid fa-money-bill-transfer"></i></div>
                    <div className="kpi-data">
                        <span className="kpi-label">Pending Payouts (Owed)</span>
                        <span className="kpi-value">₹{(kpis.pendingPayouts || 0).toLocaleString()}</span>
                    </div>
                </div>
                <div className="kpi-card highlight-warning">
                    <div className="kpi-icon"><i className="fa-solid fa-lock"></i></div>
                    <div className="kpi-data">
                        <span className="kpi-label">Funds in Escrow</span>
                        <span className="kpi-value">₹{(kpis.inEscrow || 0).toLocaleString()}</span>
                    </div>
                </div>
                <div className="kpi-card highlight-secondary">
                    <div className="kpi-icon"><i className="fa-solid fa-building-columns"></i></div>
                    <div className="kpi-data">
                        <span className="kpi-label">Govt GST Collected</span>
                        <span className="kpi-value">₹{(kpis.totalGST || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div className="filter-group-pills" style={{ marginBottom: '24px' }}>
                <button type="button" className={`pill-btn ${activeView === 'money-in' ? 'active' : ''}`} onClick={() => setActiveView('money-in')}>Money In (Customers)</button>
                <button type="button" className={`pill-btn ${activeView === 'money-out' ? 'active' : ''}`} onClick={() => setActiveView('money-out')}>Money Out (Sellers)</button>
                <button type="button" className={`pill-btn ${activeView === 'ledger' ? 'active' : ''}`} onClick={() => setActiveView('ledger')}>Master Ledger</button>
                <button type="button" className={`pill-btn ${activeView === 'tax-control' ? 'active' : ''}`} onClick={() => setActiveView('tax-control')}>
                    <i className="fa-solid fa-sliders" style={{marginRight: '6px'}}></i> GST & Tax Control
                </button>
            </div>

            <div className="table-card">
                {activeView === 'money-in' && (
                    <div className="table-responsive">
                        <table className="finance-table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Date</th>
                                    <th>Customer Email</th>
                                    <th>Amount Paid</th>
                                    <th>Payment Mode</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customerPayments.length === 0 ? (
                                    <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px'}}>No customer transactions.</td></tr>
                                ) : (
                                    customerPayments.map((payment, idx) => (
                                        <tr key={idx}>
                                            <td style={{color: '#6b7280', fontSize: '12px', fontFamily: 'monospace'}}>{payment.order_id}</td>
                                            <td>{payment.date}</td>
                                            <td style={{fontWeight: '500'}}>{payment.customer}</td>
                                            <td style={{fontWeight: '700', color: '#111827'}}>₹{(payment.amount || 0).toLocaleString()}</td>
                                            <td>
                                                <span className={`tx-type ${payment.method === 'COD' ? 'payout' : 'sale'}`}>
                                                    {payment.method === 'COD' ? <i className="fa-solid fa-truck-fast"></i> : <i className="fa-solid fa-bolt"></i>} &nbsp;
                                                    {payment.method}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-dot ${payment.status === 'paid' ? 'ready' : 'escrow'}`}></span>
                                                <span style={{textTransform: 'capitalize'}}>{payment.status}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeView === 'money-out' && (
                    <div className="table-responsive">
                        <table className="finance-table">
                            <thead>
                                <tr>
                                    <th>Seller / Brand</th>
                                    <th>Gross Sales</th>
                                    <th>Jamba Comm.</th>
                                    <th style={{color: 'var(--danger)'}}>18% GST on Comm.</th>
                                    <th style={{color: 'var(--danger)'}}>Govt TCS</th>
                                    <th>Net Payable</th>
                                    <th style={{textAlign: 'right'}}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingSettlements.length === 0 ? (
                                    <tr><td colSpan="7" style={{textAlign: 'center', padding: '30px'}}>All payouts settled.</td></tr>
                                ) : (
                                    pendingSettlements.map((seller, idx) => (
                                        <tr key={idx}>
                                            <td style={{fontWeight: '600', color: '#111827'}}><i className="fa-solid fa-store" style={{color: '#9ca3af', marginRight: '8px'}}></i>{seller.brand || seller.sellerName || 'Unknown Brand'}</td>
                                            <td>₹{(seller.grossAmount || 0).toLocaleString()}</td>
                                            <td style={{color: 'var(--primary)'}}>- ₹{(seller.jambaFee || 0).toLocaleString()}</td>
                                            <td style={{color: 'var(--danger)'}}>- ₹{(seller.commissionGst || 0).toLocaleString()}</td>
                                            <td style={{color: 'var(--danger)'}}>- ₹{(seller.tcsAmount || 0).toLocaleString()}</td>
                                            <td style={{fontWeight: '700', fontSize: '15px', color: '#065f46'}}>₹{(seller.netPayable || seller.amount || 0).toLocaleString()}</td>
                                            <td style={{textAlign: 'right'}}>
                                                <button type="button" className="btn-pay" onClick={() => setPayoutModal({ 
                                                    isOpen: true, 
                                                    payoutId: seller.id, 
                                                    brandName: (seller.brand || seller.sellerName), 
                                                    amount: (seller.netPayable || seller.amount || 0), 
                                                    utr: '' 
                                                })}>
                                                    <i className="fa-solid fa-check"></i> Submit UTR
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeView === 'ledger' && (
                    <div className="table-responsive">
                        <table className="finance-table">
                            <thead>
                                <tr>
                                    <th>Transaction ID</th>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Brand / Entity</th>
                                    <th>Amount Flow</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {masterLedger.length === 0 ? (
                                    <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px'}}>No structural history logs found.</td></tr>
                                ) : (
                                    masterLedger.map((tx, idx) => (
                                        <tr key={idx}>
                                            <td style={{color: '#6b7280', fontSize: '12px', fontFamily: 'monospace'}}>{tx.txId}</td>
                                            <td>{tx.date}</td>
                                            <td>
                                                <span className={`tx-type ${tx.type?.toLowerCase() === 'sale' || tx.type?.toLowerCase() === 'bonus' ? 'sale' : 'penalty'}`}>
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td style={{fontWeight: '500'}}>
                                                {tx.brand}
                                            </td>
                                            <td style={{fontWeight: '600', color: tx.amount?.toString().includes('-') ? 'var(--danger)' : '#059669'}}>
                                                {tx.amount}
                                            </td>
                                            <td>
                                                <span className={`status-dot ${tx.status?.includes('Escrow') ? 'escrow' : tx.status?.includes('Paid') ? 'paid' : 'ready'}`}></span>
                                                {tx.status}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeView === 'tax-control' && (
                    <div style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#111827' }}>Global Master Tax & Commission Settings</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                These rates dictate the backend calculation engine. Updating these will apply to all future orders immediately.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', maxWidth: '800px' }}>
                            
                            {/* Jamba Revenue Settings */}
                            <div className="kpi-card" style={{ display: 'block', padding: '20px', borderLeft: '4px solid var(--ws-brown)', margin: 0 }}>
                                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--ws-brown)' }}>Jamba Platform Fees</h4>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>Platform Commission Rate (%)</label>
                                    <input 
                                        type="number" 
                                        className="input-box" 
                                        value={taxConfig.platformCommission} 
                                        onChange={(e) => setTaxConfig({...taxConfig, platformCommission: parseFloat(e.target.value)})}
                                        step="0.1" 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>GST on Commission (%)</label>
                                    <input type="number" className="input-box" value="18" disabled style={{ backgroundColor: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed' }} title="Statutory rate locked by law" />
                                    <span style={{ fontSize: '11px', color: 'var(--ws-danger)', display: 'block', marginTop: '4px' }}>*Fixed at 18% under Indian GST Law</span>
                                </div>
                            </div>

                            {/* Government Tax Settings */}
                            <div className="kpi-card" style={{ display: 'block', padding: '20px', borderLeft: '4px solid var(--ws-danger)', margin: 0 }}>
                                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--ws-danger)' }}>Government Tax Collection</h4>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>E-Commerce TCS Rate (%)</label>
                                    <input 
                                        type="number" 
                                        className="input-box" 
                                        value={taxConfig.tcsRate} 
                                        onChange={(e) => setTaxConfig({...taxConfig, tcsRate: parseFloat(e.target.value)})}
                                        step="0.1" 
                                    />
                                    <span style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginTop: '4px' }}>(0.5% CGST + 0.5% SGST or 1% IGST)</span>
                                </div>
                                
                                <div style={{ paddingTop: '12px', borderTop: '1px dashed var(--border-color)' }}>
                                    <h5 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#111827' }}>Dynamic Product GST Slabs</h5>
                                    
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>Price Threshold (₹)</label>
                                        <input 
                                            type="number" 
                                            className="input-box" 
                                            value={taxConfig.gstThreshold} 
                                            onChange={(e) => setTaxConfig({...taxConfig, gstThreshold: parseFloat(e.target.value)})}
                                            step="1" 
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>Below Threshold (%)</label>
                                            <input 
                                                type="number" 
                                                className="input-box" 
                                                value={taxConfig.gstLowerRate} 
                                                onChange={(e) => setTaxConfig({...taxConfig, gstLowerRate: parseFloat(e.target.value)})}
                                                step="0.1" 
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>Above Threshold (%)</label>
                                            <input 
                                                type="number" 
                                                className="input-box" 
                                                value={taxConfig.gstUpperRate} 
                                                onChange={(e) => setTaxConfig({...taxConfig, gstUpperRate: parseFloat(e.target.value)})}
                                                step="0.1" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--ws-line)' }}>
                            <button 
                                type="button" 
                                className="btn-pay" 
                                style={{ backgroundColor: 'var(--ws-ink)', padding: '10px 24px' }}
                                onClick={saveTaxConfiguration}
                                disabled={isSavingTax}
                            >
                                {isSavingTax ? "Saving to Database..." : <><i className="fa-solid fa-floppy-disk"></i> Save Global Configuration</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <FinanceModal 
                isOpen={godModeModal.isOpen} 
                onClose={() => setGodModeModal({ ...godModeModal, isOpen: false })} 
                onConfirm={executeGodModeAdjustment}
                title="🛡️ Inject Financial Correction"
                confirmText="Inject to Ledger"
            >
                <input type="text" className="input-box" placeholder="Seller Brand Name" value={godModeModal.brand} onChange={(e) => setGodModeModal({...godModeModal, brand: e.target.value})} />
                <input type="number" className="input-box" placeholder="Amount (e.g. -150 for penalty, 500 for bonus)" value={godModeModal.amount} onChange={(e) => setGodModeModal({...godModeModal, amount: e.target.value})} />
                <textarea className="input-box" placeholder="Reason for adjustment..." rows="3" value={godModeModal.reason} onChange={(e) => setGodModeModal({...godModeModal, reason: e.target.value})} />
            </FinanceModal>

            <FinanceModal 
                isOpen={payoutModal.isOpen} 
                onClose={() => setPayoutModal({ ...payoutModal, isOpen: false })} 
                onConfirm={executePayout}
                title={`💸 Pay ${payoutModal.brandName}`}
                confirmText="Mark as Paid"
            >
                <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#4b5563' }}>
                    You are clearing a pending payout of <strong style={{ color: '#111827' }}>₹{payoutModal.amount}</strong>. Please complete the transfer in your banking app and paste the UTR below.
                </p>
                <input type="text" className="input-box" placeholder="Enter Bank UTR Ref Number..." value={payoutModal.utr} onChange={(e) => setPayoutModal({...payoutModal, utr: e.target.value})} />
            </FinanceModal>

        </div>
    );
}