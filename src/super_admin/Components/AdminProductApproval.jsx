import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../apiConfig.js";

export default function AdminProductApproval({ isActive, getAuthHeaders }) {
    const [pendingProducts, setPendingProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modal State
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    useEffect(() => {
        if (isActive) {
            fetchPendingProducts();
        }
    }, [isActive]);

    const fetchPendingProducts = async () => {
        setIsLoading(true);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/admin/products?limit=200`, { headers });
            
            if (response.ok) {
                const data = await response.json();
                // Filter for products that need review
                const pending = data.filter(p => p.approval_status === 'pending');
                setPendingProducts(pending);
            }
        } catch (error) {
            console.error("Error fetching pending products:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (docId, action) => {
        if (!window.confirm(`Are you sure you want to ${action.toUpperCase()} this product?`)) return;
        
        setIsProcessing(true);
        try {
            const headers = await getAuthHeaders();
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            const newGlobalStatus = action === 'approve' ? 'active' : 'hidden';

            const response = await fetch(`${API_BASE_URL}/admin/products/${docId}`, {
                method: 'PUT',
                headers: {
                    ...headers,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    approval_status: newStatus,
                    status: newGlobalStatus
                })
            });

            if (response.ok) {
                alert(`Product successfully ${newStatus}!`);
                setPendingProducts(prev => prev.filter(p => p.docId !== docId));
                setSelectedProduct(null);
            } else {
                const errData = await response.json();
                alert(`Error: ${errData.error}`);
            }
        } catch (error) {
            alert(`Failed to ${action} product: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isActive) return null;

    return (
        <div className="content-section active" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                    Product Approvals
                </h2>
                <span style={{ background: '#fef3c7', color: '#b45309', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                    {pendingProducts.length} Pending Review
                </span>
            </div>

            {isLoading ? (
                <p style={{ color: '#6b7280' }}>Loading pending queue...</p>
            ) : pendingProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f9fafb', borderRadius: '8px', color: '#6b7280' }}>
                    <i className="fa-solid fa-check-double" style={{ fontSize: '40px', color: '#10b981', marginBottom: '16px', display: 'block' }}></i>
                    <h3>All Caught Up!</h3>
                    <p>There are no products waiting for approval right now.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {pendingProducts.map(product => (
                        <div key={product.docId} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            <div style={{ height: '200px', backgroundColor: '#f3f4f6', backgroundImage: `url(${product.images?.[0] || 'https://via.placeholder.com/300'})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                            
                            <div style={{ padding: '16px' }}>
                                <p style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{product.brandName || "JAMBA ARTISAN"}</p>
                                <h3 style={{ margin: '4px 0 8px 0', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name || product.title}</h3>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '14px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#111827' }}>₹{product.selling_price}</span>
                                    <span style={{ color: '#6b7280', fontSize: '12px' }}>HSN: {product.hsn || 'Missing'}</span>
                                </div>

                                <button 
                                    onClick={() => { setSelectedProduct(product); setActiveImageIndex(0); }}
                                    style={{ width: '100%', padding: '10px', background: '#111827', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    Review Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- DETAILED REVIEW MODAL --- */}
            {selectedProduct && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '900px', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        
                        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0 }}>Review Product Submission</h2>
                            <button onClick={() => setSelectedProduct(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', padding: '20px' }}>
                            <div style={{ flex: '1 1 400px', paddingRight: '20px', borderRight: '1px solid #e5e7eb' }}>
                                <div style={{ height: '400px', background: '#f3f4f6', borderRadius: '8px', backgroundImage: `url(${selectedProduct.images?.[activeImageIndex]})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', marginBottom: '12px' }} />
                                
                                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                                    {selectedProduct.images?.map((img, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => setActiveImageIndex(idx)}
                                            style={{ width: '60px', height: '60px', backgroundImage: `url(${img})`, backgroundSize: 'cover', borderRadius: '4px', cursor: 'pointer', border: activeImageIndex === idx ? '2px solid #111827' : '1px solid transparent' }} 
                                        />
                                    ))}
                                </div>
                            </div>

                            <div style={{ flex: '1 1 300px', paddingLeft: '20px' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 4px 0', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Basic Details</h4>
                                    <p style={{ margin: 0 }}><strong>Title:</strong> {selectedProduct.name || selectedProduct.title}</p>
                                    <p style={{ margin: '4px 0 0 0' }}><strong>Category:</strong> {selectedProduct.category}</p>
                                    <p style={{ margin: '4px 0 0 0' }}><strong>Tribe/Origin:</strong> {selectedProduct.tribe || 'N/A'}</p>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 4px 0', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Pricing & Taxation</h4>
                                    <p style={{ margin: 0 }}><strong>Selling Price:</strong> ₹{selectedProduct.selling_price}</p>
                                    <p style={{ margin: '4px 0 0 0' }}><strong>MRP:</strong> ₹{selectedProduct.mrp}</p>
                                    <p style={{ margin: '4px 0 0 0', color: selectedProduct.hsn ? '#111827' : '#dc2626' }}>
                                        <strong>HSN Code:</strong> {selectedProduct.hsn || 'MISSING (Required for GST)'}
                                    </p>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 4px 0', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Inventory</h4>
                                    <p style={{ margin: 0 }}><strong>Stock:</strong> {selectedProduct.stock} units</p>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 4px 0', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Seller Info</h4>
                                    <p style={{ margin: 0 }}><strong>Brand:</strong> {selectedProduct.brandName}</p>
                                    <p style={{ margin: '4px 0 0 0' }}><strong>Email:</strong> {selectedProduct.sellerEmail}</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '16px', background: '#f9fafb' }}>
                            <button 
                                onClick={() => handleAction(selectedProduct.docId, 'reject')}
                                disabled={isProcessing}
                                style={{ flex: 1, padding: '12px', background: '#fff', color: '#dc2626', border: '1px solid #dc2626', borderRadius: '6px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer' }}
                            >
                                <i className="fa-solid fa-xmark"></i> Reject Submission
                            </button>
                            
                            <button 
                                onClick={() => handleAction(selectedProduct.docId, 'approve')}
                                disabled={isProcessing || !selectedProduct.hsn}
                                style={{ flex: 2, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isProcessing || !selectedProduct.hsn ? 'not-allowed' : 'pointer', opacity: !selectedProduct.hsn ? 0.5 : 1 }}
                            >
                                <i className="fa-solid fa-check"></i> Approve & Publish
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}