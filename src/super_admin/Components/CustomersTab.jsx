import React, { useState, useEffect } from "react";
// FIXED PATH: Exactly 2 dots
import { API_BASE_URL } from "../../apiConfig.js"; 
import "../styles/Customers.css";

export default function CustomersTab({ getAuthHeaders }) {
    const [customers, setCustomers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch data immediately when the tab is opened
    useEffect(() => {
        loadCustomerDetails();
    }, []);

    const loadCustomerDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/admin/customers?limit=50`, {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) throw new Error("Failed to load customers.");
            
            const data = await response.json();
            // Sort by newest joined
            data.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
            setCustomers(data);
        } catch (err) {
            console.error("Error loading customers:", err);
            setError("Failed to load customer details.");
        } finally {
            setIsLoading(false);
        }
    };

    // React-driven search filter
    const filteredCustomers = customers.filter(user => {
        const lowerTerm = searchQuery.toLowerCase();
        const name = (user.name || "").toLowerCase();
        const contactInfo = (user.email || user.phone || "").toLowerCase();
        
        let addressString = "";
        if (user.address) {
            addressString = `${user.address.name} ${user.address.phone} ${user.address.district} ${user.address.state}`.toLowerCase();
        }
        
        return name.includes(lowerTerm) || contactInfo.includes(lowerTerm) || addressString.includes(lowerTerm);
    });

    return (
        <div className="content-section active customers-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <span className="section-title" style={{ margin: 0 }}>Customer Relationship</span>
                
                <div className="search-container">
                    <i className="fa-solid fa-search"></i>
                    <input 
                        type="text" 
                        placeholder="Search Name, Email, Phone..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                </div>
            </div>

            <div id="admin-customers-list">
                {isLoading ? (
                    <p style={{ padding: '20px', fontWeight: '500', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-spinner fa-spin"></i> Loading customers from database...
                    </p>
                ) : error ? (
                    <p style={{ padding: '20px', color: 'var(--danger)', fontWeight: 'bold' }}>{error}</p>
                ) : filteredCustomers.length === 0 ? (
                    <p style={{ padding: '20px', fontWeight: '500', color: 'var(--text-muted)' }}>No customers found matching your search.</p>
                ) : (
                    filteredCustomers.map(user => {
                        const dateStr = (user.createdAt || user.created_at) ? new Date(user.createdAt || user.created_at).toLocaleString() : 'N/A';
                        const contactInfo = user.email ? user.email : (user.phone ? user.phone : 'No Contact Info Provided');

                        return (
                            <div key={user.id} className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                                <div className="customer-card-header">
                                    <div>
                                        <div className="customer-name-role">
                                            {user.name || 'Unknown User'} 
                                            {user.role === 'admin' ? (
                                                <span className="hero-badge" style={{ backgroundColor: 'var(--primary)' }}>ADMIN</span>
                                            ) : (
                                                <span className="hero-badge" style={{ backgroundColor: 'var(--success)' }}>CUSTOMER</span>
                                            )}
                                        </div>
                                        
                                        <div className="customer-contact-info">
                                            <i className="fa-regular fa-envelope"></i> {contactInfo}
                                        </div>
                                        
                                        <div className="customer-meta">
                                            Joined: {dateStr} &nbsp;|&nbsp; UID: {user.id}
                                        </div>
                                    </div>
                                </div>
                                
                                {user.address && (
                                    <div className="customer-saved-address">
                                        <strong>Saved Primary Address:</strong>
                                        {user.address.name} - {user.address.phone}<br/>
                                        {user.address.address1}, {user.address.landmark}<br/>
                                        {user.address.district}, {user.address.state} - {user.address.pincode}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}