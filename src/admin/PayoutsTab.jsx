import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../apiConfig.js"; 
import './PayoutsTab.css';

export default function PayoutsTab({ isActive, getAuthHeaders, sellerProfile }) {
    const [isLoading, setIsLoading] = useState(true);
    const [wallet, setWallet] = useState({ pending: 0, available: 0, lifetime: 0 });
    const [payoutHistory, setPayoutHistory] = useState([]);
    const [salesLedger, setSalesLedger] = useState([]); 

    useEffect(() => {
        if (isActive) {
            fetchSecureDashboard();
        }
    }, [isActive]);

    const fetchSecureDashboard = async () => {
        setIsLoading(true);
        try {
            const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
            
            const response = await fetch(`${API_BASE_URL}/api/v1/seller/dashboard`, { headers });
            if (response.ok) {
                const data = await response.json();
                setWallet(data.wallet || { pending: 0, available: 0, lifetime: 0 });
                setSalesLedger(data.sales_ledger || []);
            }
            
            // Fetch Payout History
            const historyResponse = await fetch(`${API_BASE_URL}/api/v1/seller/payouts/history`, { headers });
            if (historyResponse.ok) {
                const historyData = await historyResponse.json();
                setPayoutHistory(historyData || []);
            }
        } catch (error) {
            console.error("Error fetching secure seller pipeline:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestPayout = async () => {
        if (wallet.available <= 0) {
            alert("You have no available funds to withdraw.");
            return;
        }

        if (window.confirm(`Are you sure you want to request a payout of ₹${wallet.available}?`)) {
            try {
                const headers = typeof getAuthHeaders === 'function' ? await getAuthHeaders() : { 'Content-Type': 'application/json' };
                
                const response = await fetch(`${API_BASE_URL}/api/v1/seller/payouts/request`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        brand: sellerProfile?.brandName || "Unknown Brand",
                        amount: wallet.available
                    })
                });

                if (response.ok) {
                    alert("Payout request submitted successfully! The admin will process it shortly.");
                    fetchSecureDashboard(); 
                } else {
                    const errorData = await response.json();
                    alert("Failed to request payout: " + (errorData.error || "Unknown error"));
                }
            } catch (error) {
                alert("Error submitting request: " + error.message);
            }
        }
    };

    if (!isActive) return null;

    return (
        <div id="payouts" className="content-section active">
            <div className="payouts-header">
                <span className="section-title" style={{ margin: 0 }}>Earnings & Payouts</span>
            </div>
            
            {isLoading ? (
                <div style={{ padding: '20px', color: '#6b7280' }}>Syncing with Secure Server Pipeline...</div>
            ) : (
                <>
                    <div className="payout-stats-grid">
                        <div className="payout-stat-card escrow">
                            <div className="payout-stat-title">Pending Escrow</div>
                            <div className="payout-stat-amount">₹{wallet.pending.toLocaleString()}</div>
                            <div className="payout-stat-desc">Funds in clearing or return window</div>
                        </div>

                        <div className="payout-stat-card available">
                            <div className="payout-stat-title">Available for Payout</div>
                            <div className="payout-stat-amount text-success">₹{wallet.available.toLocaleString()}</div>
                            <button 
                                type="button" 
                                className="action-btn payout-request-btn" 
                                onClick={handleRequestPayout}
                                disabled={wallet.available <= 0}
                                style={{ opacity: wallet.available <= 0 ? 0.5 : 1, cursor: wallet.available <= 0 ? 'not-allowed' : 'pointer' }}
                            >
                                Request Payout
                            </button>
                        </div>

                        <div className="payout-stat-card withdrawn">
                            <div className="payout-stat-title">Lifetime Earnings</div>
                            <div className="payout-stat-amount">₹{wallet.lifetime.toLocaleString()}</div>
                            <div className="payout-stat-desc">Total net earnings generated</div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                        <span className="section-subtitle">Itemized Sales Ledger</span>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>This ledger securely displays your sales. Platform fees and statutory govt taxes (GST & TCS) are automatically deducted.</p>
                        
                        {salesLedger.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No secure sales data found for your products yet.</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="payout-history-table">
                                    <thead>
                                        <tr>
                                            <th>Order ID</th>
                                            <th>Product Name</th>
                                            <th>Gross Sale</th>
                                            <th style={{ color: '#b91c1c' }}>Jamba Fee</th>
                                            <th style={{ color: '#b91c1c' }}>Fee GST (18%)</th>
                                            <th style={{ color: '#b91c1c' }}>Govt TCS</th>
                                            <th style={{ color: '#059669' }}>Net Earned</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {salesLedger.map((sale, index) => (
                                            <tr key={index}>
                                                <td style={{fontFamily: 'monospace', color: '#6b7280', fontSize: '12px'}}>{sale.order_id}</td>
                                                <td style={{fontWeight: '500'}}>{sale.product_name} x{sale.qty}</td>
                                                <td>₹{sale.gross.toLocaleString()}</td>
                                                <td style={{ color: '#ef4444' }}>- ₹{sale.fee.toLocaleString()}</td>
                                                <td style={{ color: '#ef4444' }}>- ₹{(sale.commission_gst || 0).toLocaleString()}</td>
                                                <td style={{ color: '#ef4444' }}>- ₹{(sale.tcs || 0).toLocaleString()}</td>
                                                <td style={{ color: '#059669', fontWeight: 'bold' }}>₹{sale.net.toLocaleString()}</td>
                                                <td>
                                                    <span className={`status-dot ${sale.status === 'paid' ? 'escrow' : 'ready'}`}></span>
                                                    <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>{sale.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ padding: '24px' }}>
                        <span className="section-subtitle">Payout History</span>
                        {payoutHistory.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '10px' }}>You have no previous payout requests.</p>
                        ) : (
                            <div style={{ overflowX: 'auto', marginTop: '15px' }}>
                                <table className="payout-history-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th>Bank Ref (UTR)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payoutHistory.map((p, index) => (
                                            <tr key={index}>
                                                <td className="payout-date">{new Date(p.created_at || p.date).toLocaleDateString()}</td>
                                                <td className="payout-amt">₹{p.amount?.toLocaleString()}</td>
                                                <td>
                                                    {p.status === 'paid' 
                                                        ? <span className="payout-status-paid" style={{color: '#059669', fontWeight: 'bold'}}><i className="fa-solid fa-check"></i> Paid</span> 
                                                        : <span className="payout-status-pending" style={{color: '#f59e0b', fontWeight: 'bold'}}><i className="fa-solid fa-clock"></i> Pending</span>}
                                                </td>
                                                <td className="payout-utr" style={{fontFamily: 'monospace', color: '#6b7280'}}>{p.utr || 'Awaiting Transfer'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}