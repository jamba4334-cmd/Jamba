import React, { useState, useEffect } from 'react';
import './OrdersTab.css';

export default function OrdersTab({ isActive, sellerOrders, loadingData, acceptOrder }) {
    const [expandedOrders, setExpandedOrders] = useState({});
    const [orderSearchTerm, setOrderSearchTerm] = useState("");
    const [orderDateRange, setOrderDateRange] = useState("all");
    const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.custom-filter-dropdown')) {
                setIsDateMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOrderDetails = (orderId) => {
        setExpandedOrders(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    // --- NEW: Advanced Date Filtration & "Latest First" Sorting --- //
    const processedOrders = sellerOrders
        .filter(order => {
            // 1. Search Filter
            const searchLower = orderSearchTerm.toLowerCase();
            const customerName = (order.shippingAddress?.name || 'Guest Customer').toLowerCase();
            const customerPhone = (order.shippingAddress?.phone || order.customerContact || '').toLowerCase();
            const orderId = (order.jamba_order_id || order.id).toLowerCase();
            
            const matchesSearch = orderId.includes(searchLower) || customerName.includes(searchLower) || customerPhone.includes(searchLower);

            // 2. Advanced Date Filter
            let matchesDate = true;
            if (orderDateRange !== "all") {
                const orderDate = new Date(order.created_at || order.createdAt || 0);
                const today = new Date();
                
                // Helper to strip time for exact day comparisons
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

            return matchesSearch && matchesDate;
        })
        .sort((a, b) => {
            // 3. Sort logic: Forces the newest orders to the top
            const dateA = new Date(a.created_at || a.createdAt || 0);
            const dateB = new Date(b.created_at || b.createdAt || 0);
            return dateB - dateA; 
        });

    return (
        <div id="orders" className={`content-section ${isActive ? 'active' : ''}`}>
            
            {/* ORDERS CONTROL BAR */}
            <div className="orders-controls-bar">
                
                <div className="orders-search-wrapper">
                    <div className="search-container">
                        <i className="fa-solid fa-search"></i>
                        <input 
                            type="text" 
                            placeholder="Search Order ID, Customer Name, or Phone..." 
                            value={orderSearchTerm}
                            onChange={(e) => setOrderSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="orders-filter-wrapper">
                    <div className="custom-filter-dropdown">
                        <div 
                            className="input-box" 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                        >
                            <span>
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

            {loadingData ? (
                <p style={{ padding: '20px', fontWeight: '500', color: 'var(--text-muted)' }}>Loading incoming orders...</p>
            ) : processedOrders.length === 0 ? (
                <p style={{ padding: '20px', fontWeight: '500', color: 'var(--text-muted)' }}>No orders match your current filters.</p>
            ) : (
                processedOrders.map(order => {
                    const isAcceptedBySeller = order.seller_accepted === true;
                    const existingCourier = order.courierName || '';
                    const existingTracking = order.trackingId || '';
                    const existingLabel = order.shipping_label_url || order.shippingLabel || '';
                    
                    const currentStatus = order.status ? order.status.toLowerCase() : 'pending';
                    
                    let statusClass = "status-pending";
                    let statusLabel = "PENDING";
                    if (currentStatus === 'paid') { statusClass = "status-paid"; statusLabel = "PAID"; }
                    else if (currentStatus === 'processing') { statusClass = "status-processing"; statusLabel = "PROCESSING"; }
                    else if (currentStatus === 'shipped') { statusClass = "status-shipped"; statusLabel = "SHIPPED"; }
                    else if (currentStatus === 'out_for_delivery') { statusClass = "status-ofd"; statusLabel = "OUT FOR DELIVERY"; }
                    else if (currentStatus === 'delivered') { statusClass = "status-delivered"; statusLabel = "DELIVERED"; }
                    else if (currentStatus === 'cancelled') { statusClass = "status-cancelled"; statusLabel = "CANCELLED"; }

                    const customerName = order.shippingAddress?.name || 'Guest Customer';
                    const customerPhone = order.shippingAddress?.phone || order.customerContact || 'No phone provided';
                    const addressString = order.shippingAddress 
                        ? `${order.shippingAddress.address1}${order.shippingAddress.landmark ? `, ${order.shippingAddress.landmark}` : ''}, ${order.shippingAddress.district}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}` 
                        : 'No shipping address provided by customer';

                    // --- DYNAMIC FINANCIAL MATH ---
                    const baseSubtotal = Number(order.sellerSubtotal || order.items.reduce((sum, item) => sum + ((item.price || item.selling_price || 0) * (item.quantity || 1)), 0));
                    
                    const discountAmount = order.promo_creator_role === 'seller' ? Number(order.discount_applied || 0) : 0;
                    const finalSellerTotal = Math.max(baseSubtotal - discountAmount, 0);

                    return (
                        <div key={order.id} className="moc-card">
                            <div className="moc-header">
                                <div className="moc-header-left">
                                    <div className="moc-ref">Order Ref: <strong>{order.jamba_order_id || order.id}</strong></div>
                                </div>
                                <div className="moc-header-right">
                                    <div className="moc-date">{new Date(order.created_at || order.createdAt).toLocaleString([], {day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit'})}</div>
                                </div>
                            </div>

                            <div className="moc-body">
                                <div className="moc-items-header">
                                    <span className="moc-items-title"><i className="fa-solid fa-box-open" style={{color: '#4b5563', marginRight: '6px'}}></i> Items to fulfill</span>
                                    <span className={`moc-status-badge ${statusClass}`}>{statusLabel}</span>
                                </div>

                                {order.items.map((item, idx) => (
                                    <div key={idx} className="moc-item-row">
                                        <img src={item.image || 'https://via.placeholder.com/150'} alt={item.title} className="moc-item-img" />
                                        <div className="moc-item-details">
                                            <div className="moc-item-line1">
                                                <span className="moc-item-title">{item.title}</span>
                                                <span className="moc-earning-amount">₹{((item.price || item.selling_price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="moc-item-line2">
                                                <span className="moc-item-meta">Quantity - {item.quantity || 1}</span>
                                                <span className="moc-earning-label">Retail Value</span>
                                            </div>
                                            <div className="moc-item-line3">
                                                <span className="moc-item-meta">Size: {item.size || 'XL'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div className="moc-customer-section">
                                    <div className="moc-customer-title"><i className="fa-solid fa-location-dot" style={{color: '#4b5563', marginRight: '6px'}}></i> SHIP TO CUSTOMER</div>
                                    <div className="moc-customer-name">{customerName}</div>
                                    <div className="moc-customer-address"><i className="fa-solid fa-location-dot" style={{color: '#9ca3af', marginRight: '4px'}}></i> Address<br/><span style={{paddingLeft: '16px', display: 'block'}}>{addressString}</span></div>
                                    <div className="moc-customer-phone"><i className="fa-solid fa-phone" style={{color: '#9ca3af', marginRight: '4px'}}></i> {customerPhone}</div>
                                </div>

                                {expandedOrders[order.id] && (
                                    <div className="moc-price-breakdown fade-in">
                                        <div className="moc-pb-title">Price Breakdown</div>
                                        <div className="moc-pb-row"><span>Subtotal</span><span>₹{baseSubtotal.toLocaleString('en-IN')}</span></div>
                                        
                                        {/* --- DISCOUNT DEDUCTION ROW --- */}
                                        {discountAmount > 0 && (
                                            <div className="moc-pb-row" style={{ color: '#059669', fontWeight: '600' }}>
                                                <span>Discount ({order.promo_used})</span>
                                                <span>- ₹{discountAmount.toLocaleString('en-IN')}</span>
                                            </div>
                                        )}

                                        <div className="moc-pb-row"><span>Delivery Fee</span><span>FREE</span></div>
                                        <div className="moc-pb-dashed"></div>
                                        <div className="moc-pb-row moc-pb-final"><span>Gross Earning Base</span><span>₹{finalSellerTotal.toLocaleString('en-IN')}</span></div>
                                    </div>
                                )}
                            </div>

                            <div className="moc-footer">
                                <div className="moc-logistics">
                                    <div><strong>Courier:</strong> <span style={{color: 'var(--text-muted)'}}>{existingCourier || 'Pending'}</span></div>
                                    <div><strong>Tracking:</strong> <span style={{color: 'var(--text-muted)'}}>{existingTracking || 'Pending'}</span></div>
                                </div>
                                <div className="moc-actions">
                                    {isAcceptedBySeller && existingLabel ? (
                                        <a href={existingLabel} target="_blank" rel="noopener noreferrer" className="moc-btn-label">
                                            <i className="fa-solid fa-file-pdf"></i> Download Label
                                        </a>
                                    ) : isAcceptedBySeller ? (
                                        <span className="moc-btn-pending"><i className="fa-solid fa-gear fa-spin"></i> Label generating...</span>
                                    ) : (
                                        <button type="button" onClick={() => acceptOrder(order.id)} className="moc-btn-accept">ACCEPT ORDER</button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="moc-expand-trigger" onClick={() => toggleOrderDetails(order.id)}>
                                {expandedOrders[order.id] ? (
                                    <>HIDE ORDER DETAILS <i className="fa-solid fa-chevron-up"></i></>
                                ) : (
                                    <>VIEW ORDER DETAILS <i className="fa-solid fa-chevron-down"></i></>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}