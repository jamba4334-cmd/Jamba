import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../../apiConfig.js";

const FinanceModal = ({ isOpen, onClose, onConfirm, title, children, confirmText="Confirm" }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content fade-in">
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>{children}</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: '#f3f4f6', fontWeight: '600', cursor: 'pointer', color: '#374151' }}>Cancel</button>
                    <button type="button" onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: 'var(--primary, #111827)', color: 'white', fontWeight: '600', cursor: 'pointer' }}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

export default function EarningsLedger({ getAuthHeaders }) {
    const [activeView, setActiveView] = useState('money-in'); 
    const [isLoading, setIsLoading] = useState(true);
    
    const [kpis, setKpis] = useState({ jambaRevenue: 0, pendingPayouts: 0, inEscrow: 0, totalGST: 0 });
    const [customerPayments, setCustomerPayments] = useState([]); 
    const [pendingSettlements, setPendingSettlements] = useState([]); 
    const [masterLedger, setMasterLedger] = useState([]); 

    const [godModeModal, setGodModeModal] = useState({ isOpen: false, brand: '', amount: '', reason: '' });
    const [payoutModal, setPayoutModal] = useState({ isOpen: false, payoutId: null, brandName: '', amount: 0, utr: '' });

    useEffect(() => { fetchFinancialData(); }, []);

    const fetchFinancialData = async () => {
        setIsLoading(true);
        try {
            const headers = await getAuthHeaders();
            const [kpiRes, inflowRes, payoutsRes, ledgerRes] = await Promise.all([
                fetch(`${API_BASE_URL}/admin/finance/kpis`, { headers }),
                fetch(`${API_BASE_URL}/admin/finance/customer-payments`, { headers }),
                fetch(`${API_BASE_URL}/admin/payouts?status=pending`, { headers }),
                fetch(`${API_BASE_URL}/admin/transactions`, { headers })
            ]);

            if (kpiRes.ok) setKpis(await kpiRes.json());
            if (inflowRes.ok) setCustomerPayments(await inflowRes.json());
            if (payoutsRes.ok) setPendingSettlements(await payoutsRes.json());
            if (ledgerRes.ok) setMasterLedger(await ledgerRes.json());
        } catch (error) { console.error("Error loading secure financial modules:", error); } 
        finally { setIsLoading(false); }
    };

    const executeGodModeAdjustment = async () => {
        if (!godModeModal.brand || !godModeModal.amount || !godModeModal.reason) return alert("Fill all fields.");
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/admin/finance/adjust`, {
                method: 'POST', headers,
                body: JSON.stringify({ brand: godModeModal.brand, amount: parseFloat(godModeModal.amount), reason: godModeModal.reason })
            });
            if (response.ok) {
                alert("🛡️ God Mode Override Successful!");
                setGodModeModal({ isOpen: false, brand: '', amount: '', reason: '' });
                fetchFinancialData();
            }
        } catch (e) { alert("Adjustment failed: " + e.message); }
    };

    const executePayout = async () => {
        if (!payoutModal.utr) return alert("Enter the UTR reference number.");
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/admin/payouts/${payoutModal.payoutId}`, {
                method: 'PUT', headers,
                body: JSON.stringify({ status: 'paid', utr: payoutModal.utr })
            });
            if (response.ok) {
                alert(`Success! ₹${payoutModal.amount} cleared.`);
                setPayoutModal({ isOpen: false, payoutId: null, brandName: '', amount: 0, utr: '' });
                fetchFinancialData(); 
            }
        } catch (error) { alert("Error: " + error.message); }
    };

    if (isLoading) return <div style={{ padding: '40px', fontWeight: '500', color: 'var(--text-muted)' }}>Syncing Core Financial Ledgers...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '20px' }}>
                <button type="button" className="btn-export" onClick={() => alert("Downloading CSV...")}>
                    <i className="fa-solid fa-file-csv"></i> Export Ledger
                </button>
                <button type="button" className="btn-pay" style={{ backgroundColor: 'var(--danger)' }} onClick={() => setGodModeModal({ ...godModeModal, isOpen: true })}>
                    <i className="fa-solid fa-shield-halved"></i> Inject Correction
                </button>
            </div>

            <div className="kpi-grid">
                <div className="kpi-card highlight-primary">
                    <div className="kpi-icon"><i className="fa-solid fa-wallet"></i></div>
                    <div className="kpi-data"><span className="kpi-label">Jamba Net Revenue</span><span className="kpi-value">₹{(kpis.jambaRevenue || 0).toLocaleString()}</span></div>
                </div>
                <div className="kpi-card highlight-danger">
                    <div className="kpi-icon"><i className="fa-solid fa-money-bill-transfer"></i></div>
                    <div className="kpi-data"><span className="kpi-label">Pending Payouts (Owed)</span><span className="kpi-value">₹{(kpis.pendingPayouts || 0).toLocaleString()}</span></div>
                </div>
                <div className="kpi-card highlight-warning">
                    <div className="kpi-icon"><i className="fa-solid fa-lock"></i></div>
                    <div className="kpi-data"><span className="kpi-label">Funds in Escrow</span><span className="kpi-value">₹{(kpis.inEscrow || 0).toLocaleString()}</span></div>
                </div>
                <div className="kpi-card highlight-secondary">
                    <div className="kpi-icon"><i className="fa-solid fa-building-columns"></i></div>
                    <div className="kpi-data"><span className="kpi-label">Govt GST Collected</span><span className="kpi-value">₹{(kpis.totalGST || 0).toLocaleString()}</span></div>
                </div>
            </div>

            <div className="filter-group-pills" style={{ marginBottom: '24px' }}>
                <button type="button" className={`pill-btn ${activeView === 'money-in' ? 'active' : ''}`} onClick={() => setActiveView('money-in')}>Money In (Customers)</button>
                <button type="button" className={`pill-btn ${activeView === 'money-out' ? 'active' : ''}`} onClick={() => setActiveView('money-out')}>Money Out (Sellers)</button>
                <button type="button" className={`pill-btn ${activeView === 'ledger' ? 'active' : ''}`} onClick={() => setActiveView('ledger')}>Master Ledger</button>
            </div>

            <div className="table-card">
                {activeView === 'money-in' && (
                    <table className="finance-table">
                        <thead><tr><th>Order ID</th><th>Date</th><th>Customer Email</th><th>Amount Paid</th><th>Payment Mode</th><th>Status</th></tr></thead>
                        <tbody>
                            {customerPayments.length === 0 ? <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px'}}>No transactions.</td></tr> : customerPayments.map((payment, idx) => (
                                <tr key={idx}>
                                    <td style={{color: '#6b7280', fontSize: '12px'}}>{payment.order_id}</td>
                                    <td>{payment.date}</td>
                                    <td style={{fontWeight: '500'}}>{payment.customer}</td>
                                    <td style={{fontWeight: '700'}}>₹{(payment.amount || 0).toLocaleString()}</td>
                                    <td>{payment.method}</td>
                                    <td>{payment.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {activeView === 'money-out' && (
                    <table className="finance-table">
                        <thead><tr><th>Seller / Brand</th><th>Gross Sales</th><th>Jamba Comm.</th><th style={{color:'var(--danger)'}}>18% GST</th><th style={{color:'var(--danger)'}}>Govt TCS</th><th>Net Payable</th><th style={{textAlign:'right'}}>Action</th></tr></thead>
                        <tbody>
                            {pendingSettlements.length === 0 ? <tr><td colSpan="7" style={{textAlign: 'center', padding: '30px'}}>All payouts settled.</td></tr> : pendingSettlements.map((seller, idx) => (
                                <tr key={idx}>
                                    <td style={{fontWeight: '600'}}>{seller.brand || seller.sellerName}</td>
                                    <td>₹{(seller.grossAmount || 0).toLocaleString()}</td>
                                    <td style={{color:'var(--primary)'}}>- ₹{(seller.jambaFee || 0).toLocaleString()}</td>
                                    <td style={{color:'var(--danger)'}}>- ₹{(seller.commissionGst || 0).toLocaleString()}</td>
                                    <td style={{color:'var(--danger)'}}>- ₹{(seller.tcsAmount || 0).toLocaleString()}</td>
                                    <td style={{fontWeight: '700', color: '#065f46'}}>₹{(seller.netPayable || seller.amount || 0).toLocaleString()}</td>
                                    <td style={{textAlign: 'right'}}>
                                        <button className="btn-pay" onClick={() => setPayoutModal({ isOpen: true, payoutId: seller.id, brandName: (seller.brand || seller.sellerName), amount: (seller.netPayable || seller.amount || 0), utr: '' })}>Submit UTR</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {activeView === 'ledger' && (
                    <table className="finance-table">
                        <thead><tr><th>TX ID</th><th>Date</th><th>Type</th><th>Brand</th><th>Amount</th><th>Status</th></tr></thead>
                        <tbody>
                            {masterLedger.length === 0 ? <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px'}}>No logs.</td></tr> : masterLedger.map((tx, idx) => (
                                <tr key={idx}>
                                    <td style={{color: '#6b7280', fontSize: '12px'}}>{tx.txId}</td>
                                    <td>{tx.date}</td>
                                    <td>{tx.type}</td>
                                    <td style={{fontWeight: '500'}}>{tx.brand}</td>
                                    <td style={{fontWeight: '600'}}>{tx.amount}</td>
                                    <td>{tx.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <FinanceModal isOpen={godModeModal.isOpen} onClose={() => setGodModeModal({ ...godModeModal, isOpen: false })} onConfirm={executeGodModeAdjustment} title="🛡️ Inject Correction" confirmText="Inject to Ledger">
                <input type="text" className="input-box" placeholder="Seller Brand Name" value={godModeModal.brand} onChange={(e) => setGodModeModal({...godModeModal, brand: e.target.value})} />
                <input type="number" className="input-box" placeholder="Amount (e.g. -150 or 500)" value={godModeModal.amount} onChange={(e) => setGodModeModal({...godModeModal, amount: e.target.value})} />
                <textarea className="input-box" placeholder="Reason..." value={godModeModal.reason} onChange={(e) => setGodModeModal({...godModeModal, reason: e.target.value})} />
            </FinanceModal>

            <FinanceModal isOpen={payoutModal.isOpen} onClose={() => setPayoutModal({ ...payoutModal, isOpen: false })} onConfirm={executePayout} title={`💸 Pay ${payoutModal.brandName}`} confirmText="Mark as Paid">
                <input type="text" className="input-box" placeholder="Enter Bank UTR..." value={payoutModal.utr} onChange={(e) => setPayoutModal({...payoutModal, utr: e.target.value})} />
            </FinanceModal>
        </div>
    );
}