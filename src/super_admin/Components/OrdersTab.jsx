import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../apiConfig.js"; 
import "../styles/Orders.css";

export default function OrdersTab({ orders, liveProducts, getAuthHeaders, refreshOrders }) {
    // Local React State for this tab
    const [orderFilterStatus, setOrderFilterStatus] = useState('all');
    const [orderDateRange, setOrderDateRange] = useState('all');
    const [expandedOrders, setExpandedOrders] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.custom-filter-dropdown')) {
                setIsDateMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Action Handlers --- //

    const handleUpdateStatus = async (orderId, newStatus) => {
        if(window.confirm(`Are you sure you want to mark this order as ${newStatus.toUpperCase()}?`)) {
            try {
                const headers = await getAuthHeaders();
                await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
                    method: "PUT",
                    headers: headers,
                    body: JSON.stringify({ status: newStatus })
                });
                refreshOrders();
                if(window.showToast) window.showToast("Order Status Updated");
            } catch(e) {
                alert("Error updating order: " + e.message);
            }
        }
    };

    const handleVerifyPayment = async (orderId, isCOD) => {
        const inputElem = document.getElementById(`manual-pay-id-${orderId}`);
        let paymentId = isCOD ? 'COD' : (inputElem ? inputElem.value.trim() : '');
        
        if (!isCOD && !paymentId) {
            alert("Please enter the Razorpay Payment ID to verify this online order.");
            return;
        }

        if(window.confirm("Are you sure you want to verify this payment and mark the order as PAID?")) {
            try {
                const headers = await getAuthHeaders();
                await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
                    method: "PUT",
                    headers: headers,
                    body: JSON.stringify({ status: 'paid', payment_id: paymentId })
                });
                refreshOrders();
                if(window.showToast) window.showToast("Payment Verified successfully!");
            } catch(e) {
                alert("Error verifying payment: " + e.message);
            }
        }
    };

    const handleUpdateTracking = async (orderId) => {
        const trackingId = document.getElementById(`tracking-id-${orderId}`).value;
        const courierName = document.getElementById(`courier-name-${orderId}`).value;

        if (!trackingId || !courierName) {
            alert("Please enter both Courier Service Name and Tracking ID.");
            return;
        }

        const btn = document.getElementById(`track-btn-${orderId}`);
        btn.innerText = "Saving...";
        btn.disabled = true;

        try {
            const headers = await getAuthHeaders();
            await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
                method: "PUT",
                headers: headers,
                body: JSON.stringify({ trackingId: trackingId, courierName: courierName })
            });
            if(window.showToast) window.showToast("Tracking Info Saved Successfully!");
            refreshOrders();
        } catch(e) {
            alert("Error saving tracking info: " + e.message);
        } finally {
            btn.innerText = "Save Tracking";
            btn.disabled = false;
        }
    };

    const handleLabelUpload = async (orderId) => {
        const fileInput = document.getElementById(`pdf-file-${orderId}`);
        if (!fileInput) return;
        const file = fileInput.files[0];
        
        if (!file) {
            alert("Please select a PDF file from your device first.");
            return;
        }

        const uploadBtn = document.getElementById(`upload-pdf-btn-${orderId}`);
        const originalText = uploadBtn ? uploadBtn.innerHTML : "Upload Label";
        if (uploadBtn) {
            uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
            uploadBtn.disabled = true;
        }

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`, {
                method: "POST", 
                body: formData 
            });
            const data = await res.json();

            if (!data.secure_url) {
                throw new Error(data.error?.message || "Cloudinary upload failed.");
            }

            const headers = await getAuthHeaders();
            await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
                method: "PUT",
                headers: headers,
                body: JSON.stringify({ shipping_label_url: data.secure_url })
            });

            if(window.showToast) window.showToast("Shipping label securely uploaded to Cloudinary!");
            refreshOrders(); 
        } catch (err) {
            alert("Label upload failed: " + err.message);
        } finally {
            if (uploadBtn) {
                uploadBtn.innerHTML = originalText;
                uploadBtn.disabled = false;
            }
            if (fileInput) fileInput.value = ""; 
        }
    };

    const toggleOrderExpansion = (orderId) => {
        setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
    };

    // --- Multi-Layer Filtration & Bulletproof Sorting Logic --- //
    const filteredOrders = (orders || [])
        .filter(order => {
            // 1. Search Logic
            const searchLower = searchQuery.toLowerCase();
            const jambaId = (order.jamba_order_id || "").toLowerCase();
            const orderIdStr = (order.razorpay_order_id || order.id || "").toLowerCase();
            const contactInfo = (order.email || order.customerContact || "").toLowerCase();
            let addressString = "";
            if (order.shippingAddress) {
                addressString = `${order.shippingAddress.name} ${order.shippingAddress.phone} ${order.shippingAddress.district} ${order.shippingAddress.state}`.toLowerCase();
            }
            const matchesSearch = jambaId.includes(searchLower) || orderIdStr.includes(searchLower) || contactInfo.includes(searchLower) || addressString.includes(searchLower);

            // 2. Status Logic
            let matchesStatus = true;
            const currentStatus = order.status ? order.status.toLowerCase() : 'pending';
            if (orderFilterStatus !== 'all') {
                if (orderFilterStatus === 'pending') matchesStatus = (currentStatus === 'pending' || currentStatus === 'created');
                else if (orderFilterStatus === 'paid') matchesStatus = (currentStatus === 'paid' || currentStatus === 'processing');
                else if (orderFilterStatus === 'shipped') matchesStatus = (currentStatus === 'shipped' || currentStatus === 'out_for_delivery' || currentStatus === 'delivered');
                else matchesStatus = (currentStatus === orderFilterStatus);
            }

            // 3. Date Logic
            let matchesDate = true;
            if (orderDateRange !== "all") {
                const getOrderTime = (dateVal) => {
                    if (!dateVal) return 0;
                    if (typeof dateVal.toDate === 'function') return dateVal.toDate().getTime();
                    if (dateVal.seconds) return dateVal.seconds * 1000;
                    return new Date(dateVal).getTime();
                };
                
                const orderDate = new Date(getOrderTime(order.created_at || order.createdAt));
                const today = new Date();
                
                const getStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const startOfToday = getStartOfDay(today);
                
                const startOfYesterday = new Date(startOfToday);
                startOfYesterday.setDate(startOfYesterday.getDate() - 1);
                
                if (orderDateRange === "today") {
                    matchesDate = orderDate >= startOfToday;
                } else if (orderDateRange === "yesterday") {
                    matchesDate = orderDate >= startOfYesterday && orderDate < startOfToday;
                } else if (orderDateRange === "this_week") {
                    const startOfWeek = new Date(startOfToday);
                    startOfWeek.setDate(startOfWeek.getDate() - today.getDay()); 
                    matchesDate = orderDate >= startOfWeek;
                } else if (orderDateRange === "this_month") {
                    matchesDate = orderDate.getMonth() === today.getMonth() && orderDate.getFullYear() === today.getFullYear();
                } else if (orderDateRange === "last_month") {
                    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    matchesDate = orderDate >= lastMonthStart && orderDate < thisMonthStart;
                }
            }

            return matchesSearch && matchesStatus && matchesDate;
        })
        .sort((a, b) => {
            // Forces the absolute newest order to the top, regardless of Firebase Date format
            const getTime = (dateVal) => {
                if (!dateVal) return 0;
                if (typeof dateVal.toDate === 'function') return dateVal.toDate().getTime();
                if (dateVal.seconds) return dateVal.seconds * 1000;
                return new Date(dateVal).getTime();
            };
            
            const timeA = getTime(a.created_at || a.createdAt);
            const timeB = getTime(b.created_at || b.createdAt);
            
            return timeB - timeA; 
        });

    return (
        <div className="content-section active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span className="section-title">Master Order Processing</span>
            </div>

            <div className="orders-controls-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div className="search-container" style={{ flex: '1', minWidth: '250px' }}>
                    <i className="fa-solid fa-search"></i>
                    <input 
                        type="text" 
                        placeholder="Search Order ID, Email, Phone..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                </div>

                {/* RESTORED: THE DATE DROPDOWN */}
                <div className="orders-filter-wrapper">
                    <div className="custom-filter-dropdown" style={{ minWidth: '180px' }}>
                        <div 
                            className="input-box" 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'white' }}
                            onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                        >
                            <span style={{ fontWeight: '500', color: 'var(--text)' }}>
                                {orderDateRange === 'all' ? 'All Time' : 
                                 orderDateRange === 'today' ? 'Today' : 
                                 orderDateRange === 'yesterday' ? 'Yesterday' : 
                                 orderDateRange === 'this_week' ? 'This Week' : 
                                 orderDateRange === 'this_month' ? 'This Month' : 
                                 'Last Month'}
                            </span>
                            <i className={`fa-solid fa-chevron-${isDateMenuOpen ? 'up' : 'down'}`} style={{ fontSize: '12px', color: 'var(--text-muted)' }}></i>
                        </div>
                        
                        {isDateMenuOpen && (
                            <div className="filter-dropdown-menu">
                                <div className={`filter-dropdown-item ${orderDateRange === 'all' ? 'active' : ''}`} onClick={() => { setOrderDateRange('all'); setIsDateMenuOpen(false); }}>All Time</div>
                                <div className={`filter-dropdown-item ${orderDateRange === 'today' ? 'active' : ''}`} onClick={() => { setOrderDateRange('today'); setIsDateMenuOpen(false); }}>Today</div>
                                <div className={`filter-dropdown-item ${orderDateRange === 'yesterday' ? 'active' : ''}`} onClick={() => { setOrderDateRange('yesterday'); setIsDateMenuOpen(false); }}>Yesterday</div>
                                <div className={`filter-dropdown-item ${orderDateRange === 'this_week' ? 'active' : ''}`} onClick={() => { setOrderDateRange('this_week'); setIsDateMenuOpen(false); }}>This Week</div>
                                <div className={`filter-dropdown-item ${orderDateRange === 'this_month' ? 'active' : ''}`} onClick={() => { setOrderDateRange('this_month'); setIsDateMenuOpen(false); }}>This Month</div>
                                <div className={`filter-dropdown-item ${orderDateRange === 'last_month' ? 'active' : ''}`} onClick={() => { setOrderDateRange('last_month'); setIsDateMenuOpen(false); }}>Last Month</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* STATUS FILTER BUTTONS */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #f3f4f6', paddingBottom: '16px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <span style={{fontWeight: 'bold', marginRight: '8px', color: 'var(--text-muted)', alignSelf: 'center', minWidth: '55px'}}>Status:</span>
                <button type="button" className={`filter-btn ${orderFilterStatus === 'all' ? 'active' : ''}`} onClick={() => setOrderFilterStatus('all')}>All Orders</button>
                <button type="button" className={`filter-btn ${orderFilterStatus === 'pending' ? 'active' : ''}`} onClick={() => setOrderFilterStatus('pending')}>
                    <i className="fa-solid fa-circle-exclamation" style={{ color: orderFilterStatus === 'pending' ? 'white' : 'var(--accent)' }}></i> Needs Verification
                </button>
                <button type="button" className={`filter-btn ${orderFilterStatus === 'paid' ? 'active' : ''}`} onClick={() => setOrderFilterStatus('paid')}>
                    <i className="fa-solid fa-box" style={{ color: orderFilterStatus === 'paid' ? 'white' : 'var(--success)' }}></i> Ready to Ship
                </button>
                <button type="button" className={`filter-btn ${orderFilterStatus === 'shipped' ? 'active' : ''}`} onClick={() => setOrderFilterStatus('shipped')}>
                    <i className="fa-solid fa-plane" style={{ color: orderFilterStatus === 'shipped' ? 'white' : 'var(--primary)' }}></i> Shipped
                </button>
            </div>
            
            <div id="admin-orders-list">
                {filteredOrders.length === 0 ? (
                    <p style={{ padding: '20px', fontWeight: '500', color: 'var(--text-muted)' }}>No orders found matching your search.</p>
                ) : (
                    filteredOrders.map(order => {
                        const currentStatus = order.status ? order.status.toLowerCase() : 'pending';
                        const pMethod = order.payment_method || order.paymentMethod;
                        const isCOD = pMethod && pMethod.toUpperCase() === 'COD';
                        
                        let statusClass = "status-pending";
                        let statusLabel = "PENDING";
                        if (currentStatus === 'paid') { statusClass = "status-paid"; statusLabel = "PAID"; }
                        else if (currentStatus === 'processing') { statusClass = "status-processing"; statusLabel = "PROCESSING"; }
                        else if (currentStatus === 'shipped') { statusClass = "status-shipped"; statusLabel = "SHIPPED"; }
                        else if (currentStatus === 'out_for_delivery') { statusClass = "status-ofd"; statusLabel = "OUT FOR DELIVERY"; }
                        else if (currentStatus === 'delivered') { statusClass = "status-delivered"; statusLabel = "DELIVERED"; }
                        else if (currentStatus === 'cancelled') { statusClass = "status-cancelled"; statusLabel = "CANCELLED"; }

                        const sellerAcceptedBadge = order.seller_accepted 
                            ? `<span style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-store"></i> SELLER ACCEPTED</span>`
                            : `<span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-clock"></i> WAITING FOR SELLER</span>`;

                        const customerName = order.shippingAddress?.name || 'Guest Customer';
                        const customerPhone = order.shippingAddress?.phone || order.customerContact || 'No phone provided';
                        const addressString = order.shippingAddress 
                            ? `${order.shippingAddress.address1}${order.shippingAddress.landmark ? `, ${order.shippingAddress.landmark}` : ''}, ${order.shippingAddress.district}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}` 
                            : 'No shipping address provided by customer';

                        let sellerName = 'N/A', brandName = 'N/A', sellerPhone = 'N/A', pickupAddress = 'N/A', locationStr = '';
                        if (order.items && order.items.length > 0) {
                            const firstItem = order.items[0];
                            const liveProduct = (liveProducts || []).find(p => p.docId === firstItem.id || p.item_id === firstItem.item_id || p.title === firstItem.title);
                            const source = liveProduct || firstItem; 
                            
                            sellerName = source.sellerName || 'N/A';
                            brandName = source.brandName || 'N/A';
                            sellerPhone = source.sellerPhone || 'N/A';
                            pickupAddress = source.pickupAddress || 'N/A';
                            locationStr = source.city ? `${source.city}, ${source.state} - ${source.pincode}` : '';
                        }

                        const existingCourier = order.courierName || '';
                        const existingTracking = order.trackingId || '';
                        const existingLabel = order.shipping_label_url || order.shippingLabel || '';

                        // --- NEW: DYNAMIC FINANCIAL MATH FOR ADMIN ---
                        const baseSubtotal = Number(order.subtotal || order.items.reduce((sum, item) => sum + ((item.price || item.selling_price || 0) * (item.quantity || 1)), 0));
                        const discountAmount = Number(order.discount_applied || 0);
                        const shippingFee = Number(order.shipping_fee || (baseSubtotal < 1999 ? 149 : 0));
                        const finalTotal = Number(order.total || Math.max(baseSubtotal - discountAmount + shippingFee, 0));
                        const totalGst = Number(order.total_gst || 0);

                        // Robust Date display for the header
                        const getDisplayDate = (dateVal) => {
                            if (!dateVal) return new Date();
                            if (typeof dateVal.toDate === 'function') return dateVal.toDate();
                            if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
                            return new Date(dateVal);
                        };

                        return (
                            <div key={order.id} className="moc-card">
                                <div className="moc-header">
                                    <div className="moc-header-left">
                                        <div className="moc-ref">Order Ref: <strong>{order.jamba_order_id || order.id}</strong></div>
                                        <div className="moc-date" dangerouslySetInnerHTML={{__html: sellerAcceptedBadge}}></div>
                                    </div>
                                    <div className="moc-header-right" style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px'}}>
                                        <div className="moc-date">{getDisplayDate(order.created_at || order.createdAt).toLocaleString([], {day:'numeric', month:'short', year:'numeric'})}</div>
                                        {isCOD ? <span className="moc-payment-badge cod">COD</span> : <span className="moc-payment-badge prepaid">PREPAID</span>}
                                    </div>
                                </div>

                                <div className="moc-body">
                                    <div className="moc-items-header">
                                        <span className="moc-items-title"><i className="fa-solid fa-box-open" style={{color: '#4b5563', marginRight: '6px'}}></i> Items</span>
                                        <span className={`moc-status-badge ${statusClass}`}>{statusLabel}</span>
                                    </div>

                                    {order.items && order.items.map((item, idx) => (
                                        <div key={idx} className="moc-item-row">
                                            <img src={item.image || 'https://via.placeholder.com/150'} alt={item.title} className="moc-item-img" style={{width:'50px', height:'60px'}} />
                                            <div className="moc-item-details">
                                                <div className="moc-item-title" style={{fontSize:'13px'}}>{item.title}</div>
                                                <div className="moc-item-meta">Qty: {item.quantity || 1} | Size: {item.size || 'N/A'}</div>
                                            </div>
                                            <div className="moc-item-earnings">
                                                <div className="moc-earning-amount" style={{fontSize:'14px'}}>₹{((item.price || item.selling_price || 0) * (item.quantity || 1)).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                            </div>
                                        </div>
                                    ))}

                                    {expandedOrders[order.id] && (
                                        <div className="fade-in">
                                            <div className="moc-customer-section" style={{background:'#fef2f2', border:'1px solid #fecaca'}}>
                                                <div className="moc-customer-title" style={{color:'#991b1b'}}><i className="fa-solid fa-location-dot"></i> Delivery Address</div>
                                                <div className="moc-customer-name" style={{color:'#7f1d1d'}}>{customerName}</div>
                                                <div className="moc-customer-address">{addressString}</div>
                                                <div className="moc-customer-phone"><i className="fa-solid fa-phone"></i> {customerPhone}</div>
                                            </div>

                                            <div className="moc-customer-section" style={{background:'#f8fafc', border:'1px solid #e2e8f0'}}>
                                                <div className="moc-customer-title"><i className="fa-solid fa-store"></i> Seller Details</div>
                                                <div className="moc-customer-name">{brandName} ({sellerName})</div>
                                                <div className="moc-customer-address">{pickupAddress}<br/>{locationStr}</div>
                                                <div className="moc-customer-phone"><i className="fa-solid fa-phone"></i> {sellerPhone}</div>
                                            </div>

                                            {/* --- NEW ADMIN FINANCIAL BREAKDOWN --- */}
                                            <div className="moc-customer-section" style={{background:'#fefcf5', border:'1px solid #fde68a'}}>
                                                <div className="moc-customer-title" style={{color:'#b45309'}}><i className="fa-solid fa-file-invoice-dollar"></i> Financial Breakdown</div>
                                                
                                                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px'}}>
                                                    <span>Base Subtotal</span>
                                                    <span>₹{baseSubtotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                                </div>
                                                
                                                {discountAmount > 0 && (
                                                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px', color: '#059669', fontWeight: '700'}}>
                                                        <span>Discount ({order.promo_used || 'PROMO'})</span>
                                                        <span>- ₹{discountAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                                    </div>
                                                )}
                                                
                                                {totalGst > 0 && (
                                                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px', color: '#6b7280'}}>
                                                        <span>GST (Included in Total)</span>
                                                        <span>₹{totalGst.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                                    </div>
                                                )}

                                                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px'}}>
                                                    <span>Delivery Fee</span>
                                                    <span>{shippingFee === 0 ? 'FREE' : `₹${shippingFee.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}</span>
                                                </div>
                                                
                                                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '800', borderTop: '1px solid #fde68a', paddingTop: '8px', color: '#92400e'}}>
                                                    <span>Customer Paid Amount</span>
                                                    <span>₹{finalTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                                </div>
                                            </div>

                                            {/* Admin Actions */}
                                            <div style={{marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb'}}>
                                                {(currentStatus === 'pending' || currentStatus === 'created') && (
                                                    <div style={{display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center'}}>
                                                        {!isCOD && <input type="text" id={`manual-pay-id-${order.id}`} placeholder="Payment ID" className="input-box" style={{maxWidth:'140px', minHeight:'38px'}} />}
                                                        <button type="button" className="action-btn" style={{background:'var(--success)', color:'white', border:'none'}} onClick={() => handleVerifyPayment(order.id, isCOD)}>Verify Payment</button>
                                                        <button type="button" className="action-btn" style={{background:'var(--danger)', color:'white', border:'none'}} onClick={() => handleUpdateStatus(order.id, 'cancelled')}>Reject</button>
                                                    </div>
                                                )}
                                                {currentStatus === 'paid' && <button type="button" className="btn-submit" onClick={() => handleUpdateStatus(order.id, 'processing')}>Mark Processing</button>}
                                                {currentStatus === 'processing' && <button type="button" className="btn-submit" onClick={() => handleUpdateStatus(order.id, 'shipped')}>Mark Shipped</button>}
                                                {currentStatus === 'shipped' && <button type="button" className="btn-submit" onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}>Mark Out for Delivery</button>}
                                                {currentStatus === 'out_for_delivery' && <button type="button" className="btn-submit" style={{background:'var(--success)'}} onClick={() => handleUpdateStatus(order.id, 'delivered')}>Mark Delivered</button>}
                                            </div>

                                            <div style={{marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb'}}>
                                                <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                                                    <input type="text" id={`courier-name-${order.id}`} defaultValue={existingCourier} placeholder="Courier Name" className="input-box" style={{flex:1, minWidth:'120px'}} />
                                                    <input type="text" id={`tracking-id-${order.id}`} defaultValue={existingTracking} placeholder="Tracking ID" className="input-box" style={{flex:1, minWidth:'120px'}} />
                                                    <button type="button" id={`track-btn-${order.id}`} className="action-btn" style={{background:'var(--primary)', color:'white', border:'none'}} onClick={() => handleUpdateTracking(order.id)}>Save Tracking</button>
                                                </div>
                                                
                                                <div style={{marginTop:'12px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap'}}>
                                                    {existingLabel && <a href={existingLabel} target="_blank" rel="noopener noreferrer" className="action-btn" style={{background:'#ecfdf5', color:'#065f46', borderColor:'#a7f3d0'}}><i className="fa-solid fa-file-pdf"></i> View Label</a>}
                                                    <input type="file" id={`pdf-file-${order.id}`} accept=".pdf" style={{fontSize:'12px', maxWidth:'180px'}} />
                                                    <button type="button" id={`upload-pdf-btn-${order.id}`} className="action-btn" onClick={() => handleLabelUpload(order.id)}>Upload Label PDF</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="moc-expand-trigger" onClick={() => toggleOrderExpansion(order.id)}>
                                    {expandedOrders[order.id] ? <>HIDE ADMIN DETAILS <i className="fa-solid fa-chevron-up"></i></> : <>VIEW ADMIN DETAILS <i className="fa-solid fa-chevron-down"></i></>}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}