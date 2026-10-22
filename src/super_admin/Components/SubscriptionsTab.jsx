import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../apiConfig.js";
import { auth } from '../../firebase'; // Fallback token getter

export default function SubscriptionsTab({ getAuthHeaders }) {
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);

    const getHeaders = async () => {
        if (getAuthHeaders) return await getAuthHeaders();
        const token = await auth.currentUser.getIdToken();
        return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
    };

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const headers = await getHeaders();
            const response = await fetch(`${API_BASE_URL}/api/v1/admin/subscriptions`, { headers });
            
            if (response.ok) {
                const data = await response.json();
                setSellers(data);
            }
        } catch (error) {
            console.error("Error fetching subscriptions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeSubscription = async (userId, brandName) => {
        const confirmRevoke = window.confirm(
            `Are you sure you want to revoke the subscription for ${brandName}? This will lock them out of their Flagship Storefront and hide their custom banner.`
        );
        
        if (confirmRevoke) {
            try {
                const headers = await getHeaders();
                const res = await fetch(`${API_BASE_URL}/api/v1/admin/subscriptions/${userId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        subscription_status: 'cancelled',
                        subscription_plan: 'none'
                    })
                });
                
                if (!res.ok) throw new Error("Failed to revoke subscription");
                
                alert(`Success: ${brandName}'s subscription has been revoked.`);
                fetchSubscriptions(); 
            } catch (error) {
                alert("Failed to update subscription status securely.");
                console.error(error);
            }
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', color: 'var(--primary)', fontWeight: '600' }}>
                <i className="fa-solid fa-spinner fa-spin"></i> Fetching Storefront Subscriptions...
            </div>
        );
    }

    return (
        <div className="content-section active">
            <h2 className="section-title">Storefront Subscriptions</h2>
            <span className="section-subtitle">Manage seller billing plans and flagship storefront access.</span>

            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--input-border)', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Brand Name</th>
                                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Email Address</th>
                                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Current Plan</th>
                                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}>Admin Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sellers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <i className="fa-solid fa-store-slash" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
                                        <br />
                                        No registered sellers found.
                                    </td>
                                </tr>
                            ) : (
                                sellers.map((seller) => (
                                    <tr key={seller.id} style={{ borderBottom: '1px solid var(--input-border)', transition: 'background 0.2s ease' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-light)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)' }}>{seller.brandName}</td>
                                        <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>{seller.email}</td>
                                        
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ 
                                                background: (seller.plan || '').includes('999') || (seller.plan || '').includes('799') ? 'var(--warning-light)' : 'var(--bg-light)',
                                                color: (seller.plan || '').includes('999') || (seller.plan || '').includes('799') ? 'var(--warning)' : 'var(--text-muted)',
                                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em'
                                            }}>
                                                {(seller.plan || 'free_tier').replace('_', ' ')}
                                            </span>
                                        </td>

                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ 
                                                color: seller.status === 'active' ? 'var(--success)' : seller.status === 'trial' ? 'var(--accent)' : 'var(--danger)',
                                                fontWeight: '700', textTransform: 'capitalize', fontSize: '13px'
                                            }}>
                                                {seller.status === 'active' && <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>}
                                                {seller.status === 'trial' && <i className="fa-solid fa-clock" style={{ marginRight: '6px' }}></i>}
                                                {seller.status === 'cancelled' && <i className="fa-solid fa-circle-xmark" style={{ marginRight: '6px' }}></i>}
                                                {seller.status || 'trial'}
                                            </span>
                                        </td>

                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <button 
                                                onClick={() => handleRevokeSubscription(seller.id, seller.brandName)}
                                                className="action-btn"
                                                style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)', background: 'var(--danger-light)' }}
                                            >
                                                <i className="fa-solid fa-ban"></i> Revoke
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}