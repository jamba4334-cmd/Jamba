import React, { useState } from 'react';
import EarningsLedger from './EarningsTab.jsx';
import CommissionSettings from './CommissionSettings.jsx';
import GstTaxSettings from './GstTaxSettings.jsx';
import "../../styles/Finance.css";

export default function FinanceTab({ getAuthHeaders }) {
    const [financeSubTab, setFinanceSubTab] = useState('earnings');

    return (
        <div className="content-section active earnings-section" style={{ display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <h1 className="section-title" style={{ margin: 0 }}>Jamba Financial Center</h1>
                <p className="text-helper" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                    Ultimate Control Engine: Customer inflows, payout hooks, and dynamic tax brackets.
                </p>
            </div>

            {/* CENTERED PILL NAVIGATION */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
                <div style={{ 
                    display: 'inline-flex', 
                    background: '#f9fafb', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '999px', 
                    padding: '4px' 
                }}>
                    <button 
                        onClick={() => setFinanceSubTab('earnings')}
                        style={{ padding: '8px 32px', borderRadius: '999px', border: 'none', background: financeSubTab === 'earnings' ? '#e5e3db' : 'transparent', color: financeSubTab === 'earnings' ? '#111827' : '#6b7280', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: financeSubTab === 'earnings' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                    >
                        Earnings
                    </button>
                    <button 
                        onClick={() => setFinanceSubTab('commission')}
                        style={{ padding: '8px 32px', borderRadius: '999px', border: 'none', background: financeSubTab === 'commission' ? '#e5e3db' : 'transparent', color: financeSubTab === 'commission' ? '#111827' : '#6b7280', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: financeSubTab === 'commission' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                    >
                        Commission
                    </button>
                    <button 
                        onClick={() => setFinanceSubTab('gst')}
                        style={{ padding: '8px 32px', borderRadius: '999px', border: 'none', background: financeSubTab === 'gst' ? '#e5e3db' : 'transparent', color: financeSubTab === 'gst' ? '#111827' : '#6b7280', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: financeSubTab === 'gst' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                    >
                        GstTax
                    </button>
                </div>
            </div>

            {/* RENDER THE SELECTED COMPONENT */}
            <div className="finance-workspace" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {financeSubTab === 'earnings' && <EarningsLedger getAuthHeaders={getAuthHeaders} />}
                {financeSubTab === 'commission' && <CommissionSettings getAuthHeaders={getAuthHeaders} />}
                {financeSubTab === 'gst' && <GstTaxSettings getAuthHeaders={getAuthHeaders} />}
            </div>

            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
}