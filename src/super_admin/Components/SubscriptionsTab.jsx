import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function SubscriptionsTab({ db }) {
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch the data as soon as the Master Admin clicks this tab
    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            // Fetch all users who are registered as "seller"
            const q = query(collection(db, "users"), where("role", "==", "seller"));
            const querySnapshot = await getDocs(q);
            
            const sellerData = [];
            querySnapshot.forEach((document) => {
                const data = document.data();
                sellerData.push({
                    id: document.id,
                    email: data.email,
                    brandName: data.brandName || "Unknown Brand",
                    status: data.subscription_status || "trial",
                    plan: data.subscription_plan || "free_tier", 
                });
            });
            setSellers(sellerData);
        } catch (error) {
            console.error("Error fetching subscriptions:", error);
        } finally {
            setLoading(false);
        }
    };

    // Master Admin Override: Instantly revoke Flagship access
    const handleRevokeSubscription = async (userId, brandName) => {
        const confirmRevoke = window.confirm(
            `Are you sure you want to revoke the subscription for ${brandName}? This will lock them out of their Flagship Storefront and hide their custom banner.`
        );
        
        if (confirmRevoke) {
            try {
                // Update Firebase to remove their premium status
                await updateDoc(doc(db, "users", userId), {
                    subscription_status: 'cancelled',
                    subscription_plan: 'none'
                });
                
                alert(`Success: ${brandName}'s subscription has been revoked.`);
                fetchSubscriptions(); // Refresh the table automatically
            } catch (error) {
                alert("Failed to update subscription status in the database.");
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
        <div className="content-section">
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
                                                background: seller.plan.includes('999') || seller.plan.includes('799') ? 'var(--warning-light)' : 'var(--bg-light)',
                                                color: seller.plan.includes('999') || seller.plan.includes('799') ? 'var(--warning)' : 'var(--text-muted)',
                                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em'
                                            }}>
                                                {seller.plan.replace('_', ' ')}
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
                                                {seller.status}
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