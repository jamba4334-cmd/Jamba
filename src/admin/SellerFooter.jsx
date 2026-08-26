import React from 'react';
import './SellerFooter.css';

export default function SellerFooter() {
    return (
        <footer className="seller-footer-wrapper">
            <div className="seller-footer-links">
                {/* Eventually, you can change these <span> tags to React Router <Link> tags */}
                <span className="seller-footer-link">Seller Terms & Conditions</span>
                <span className="seller-footer-link">Prohibited Items Policy</span>
                <span className="seller-footer-link">Payout Guidelines</span>
            </div>
            
            <p className="seller-footer-text">
                &copy; {new Date().getFullYear()} JAMBA WEAR. All rights reserved.
            </p>
            <p className="seller-footer-text" style={{ margin: 0 }}>
                By utilizing this dashboard, you agree to adhere to all platform rules, quality standards, and shipping deadlines.
            </p>
        </footer>
    );
}