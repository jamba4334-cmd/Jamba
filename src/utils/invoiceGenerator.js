import { doc, getDoc } from "firebase/firestore";
import { db as defaultDb } from "../firebase";

// 🔥 SECURITY FIX: Strict HTML escaping to prevent Stored XSS inside the Invoice Window
const escapeHtml = (unsafe) => {
    return String(unsafe ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

export const generateOrderInvoice = async (order, dbInstance = null, autoPrint = false) => {
    try {
        if (!order) throw new Error("Order data is missing.");
        const activeDb = dbInstance || defaultDb;

        // 1. Resolve Seller KYC data to determine Tax Invoice vs Bill of Supply
        let sellerInfo = {};
        const primarySellerEmail = (
            order.sellerEmails?.[0] ||
            order.items?.[0]?.sellerEmail ||
            order.items?.[0]?.email ||
            ""
        ).toLowerCase().trim();

        if (activeDb && primarySellerEmail) {
            try {
                const sellerSnap = await getDoc(doc(activeDb, "authorized_sellers", primarySellerEmail));
                if (sellerSnap.exists()) {
                    sellerInfo = sellerSnap.data();
                }
            } catch (e) {
                console.warn("Seller KYC lookup skipped, using order fallback metadata.");
            }
        }

        const kyc = sellerInfo.kycData || {};
        const hasGst = kyc.hasGst === true || Number(order.total_gst) > 0;
        const gstNumber = escapeHtml(hasGst ? (kyc.gstNumber || "REGISTERED") : "UNREGISTERED");
        const panNumber = escapeHtml(kyc.panNumber || "N/A");
        const docTitle = hasGst ? "TAX INVOICE" : "BILL OF SUPPLY";

        const rawOrderId = String(order.jamba_order_id || order.id || "N/A");
        const safeOrderId = escapeHtml(rawOrderId);
        const invoiceNo = escapeHtml(`JW-${rawOrderId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10).toUpperCase()}`);

        const parseDate = (d) => {
            if (!d) return new Date().toISOString().split("T")[0];
            if (typeof d.toDate === "function") return d.toDate().toISOString().split("T")[0];
            if (d.seconds) return new Date(d.seconds * 1000).toISOString().split("T")[0];
            return String(d).substring(0, 10);
        };
        const orderDate = escapeHtml(parseDate(order.created_at || order.createdAt));

        const brandName = escapeHtml(sellerInfo.brandName || order.items?.[0]?.brandName || "JAMBA WEAR PARTNER");
        const sellerName = escapeHtml(sellerInfo.ownerName || order.items?.[0]?.sellerName || "Authorized Artisan");
        const safeSellerEmail = escapeHtml(primarySellerEmail);

        const addrObj = order.shippingAddress || {};
        const customerName = escapeHtml(addrObj.name || order.customerName || "Valued Customer");
        const customerAddress = escapeHtml(
            addrObj.address1
                ? `${addrObj.address1}${addrObj.landmark ? `, ${addrObj.landmark}` : ""}, ${addrObj.district || addrObj.city || ""}, ${addrObj.state || ""} - ${addrObj.pincode || ""}`
                : (order.address || "Address on file")
        );
        const customerPhone = escapeHtml(addrObj.phone || order.customerContact || "N/A");
        const paymentMethod = escapeHtml((order.payment_method || order.paymentMethod || "ONLINE").toUpperCase());

        const items = Array.isArray(order.items) ? order.items : [];
        let calculatedSubtotal = 0;

        const rowsHtml = items.map((item, idx) => {
            const qty = Math.max(1, parseInt(item.quantity || item.qty || 1, 10));
            const price = Math.max(0, Number(item.price || item.selling_price || 0));
            const lineTotal = price * qty;
            calculatedSubtotal += lineTotal;

            const safeTitle = escapeHtml(item.title || item.name || "Artisan Product");
            const safeSize = escapeHtml(item.size || "Standard");

            if (hasGst) {
                const taxable = lineTotal / 1.05;
                const gstAmt = lineTotal - taxable;
                return `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${safeTitle}</strong><br/><small>Size: ${safeSize}</small></td>
                        <td style="text-align:center;">${qty}</td>
                        <td style="text-align:right;">₹${taxable.toFixed(2)}</td>
                        <td style="text-align:right;">₹${gstAmt.toFixed(2)}</td>
                        <td style="text-align:right;"><strong>₹${lineTotal.toFixed(2)}</strong></td>
                    </tr>
                `;
            } else {
                return `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${safeTitle}</strong><br/><small>Size: ${safeSize}</small></td>
                        <td style="text-align:center;">${qty}</td>
                        <td style="text-align:right;">₹${price.toFixed(2)}</td>
                        <td style="text-align:right;"><strong>₹${lineTotal.toFixed(2)}</strong></td>
                    </tr>
                `;
            }
        }).join("");

        const baseSubtotal = Number(order.subtotal || calculatedSubtotal || 0);
        const discountAmount = Math.max(0, Number(order.discount_applied || 0));
        const shippingFee = Number(order.shipping_fee ?? (baseSubtotal < 1999 ? 149 : 0));
        const finalTotal = Number(order.total || Math.max(baseSubtotal - discountAmount + shippingFee, 0));
        const totalGst = hasGst ? Number(order.total_gst || (finalTotal - finalTotal / 1.05)) : 0;
        const totalTaxable = Math.max(0, finalTotal - totalGst);

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>${docTitle} - ${invoiceNo}</title>
            <style>
                body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #111827; padding: 36px; max-width: 820px; margin: 0 auto; background: #fff; }
                .top-actions { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 24px; }
                .btn { background: #111827; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; }
                .btn-secondary { background: #f3f4f6; color: #111827; border: 1px solid #d1d5db; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 24px; }
                .brand-logo { font-size: 26px; font-weight: 900; letter-spacing: 1px; color: #8b7355; }
                .brand-logo span { color: #111827; font-weight: 500; font-size: 15px; }
                .doc-type { text-align: right; }
                .doc-type h2 { margin: 0; font-size: 20px; letter-spacing: 0.8px; }
                .doc-type p { margin: 4px 0 0; font-size: 11px; color: #6b7280; }
                .meta-grid { display: flex; justify-content: space-between; margin-bottom: 24px; background: #faf8f5; padding: 14px 18px; border-radius: 8px; border: 1px solid #e8e1d7; font-size: 13px; line-height: 1.6; }
                .addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 13px; line-height: 1.6; }
                .addr-box { border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; }
                .addr-box h4 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #8b7355; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
                th { background: #2e2a25; color: #fff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .totals { width: 320px; margin-left: auto; font-size: 13px; }
                .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
                .totals-row.grand { border-top: 2px solid #111827; font-weight: 800; font-size: 16px; padding-top: 10px; margin-top: 6px; color: #111827; }
                .footer { margin-top: 40px; padding-top: 16px; border-top: 1px dashed #d1d5db; font-size: 11px; color: #6b7280; line-height: 1.5; }
                @media print { .no-print { display: none !important; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="no-print top-actions">
                <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
                <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
            </div>

            <div class="header">
                <div>
                    <div class="brand-logo">JAMBA <span>WEAR</span></div>
                    <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">Authentic Traditional Fashion Marketplace</div>
                </div>
                <div class="doc-type">
                    <h2>${docTitle}</h2>
                    <p>${hasGst ? "Original for Recipient" : "Issued by Unregistered Artisan (No GST Charged)"}</p>
                </div>
            </div>

            <div class="meta-grid">
                <div>
                    <strong>Invoice No:</strong> ${invoiceNo}<br/>
                    <strong>Order Ref:</strong> #${safeOrderId}
                </div>
                <div style="text-align: right;">
                    <strong>Order Date:</strong> ${orderDate}<br/>
                    <strong>Payment Mode:</strong> ${paymentMethod}
                </div>
            </div>

            <div class="addresses">
                <div class="addr-box">
                    <h4>Sold By (Artisan / Merchant)</h4>
                    <strong>${brandName}</strong><br/>
                    Prop: ${sellerName}<br/>
                    ${safeSellerEmail ? `Email: ${safeSellerEmail}<br/>` : ""}
                    <strong>PAN:</strong> ${panNumber}<br/>
                    <strong>GSTIN:</strong> ${gstNumber}
                </div>
                <div class="addr-box">
                    <h4>Billing & Shipping Address</h4>
                    <strong>${customerName}</strong><br/>
                    ${customerAddress}<br/>
                    <strong>Phone:</strong> ${customerPhone}
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th>Item Description</th>
                        <th style="text-align:center; width: 60px;">Qty</th>
                        ${hasGst ? `
                            <th style="text-align:right;">Taxable Val</th>
                            <th style="text-align:right;">GST (5%)</th>
                        ` : `
                            <th style="text-align:right;">Unit Price</th>
                        `}
                        <th style="text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="totals">
                ${hasGst ? `
                    <div class="totals-row"><span>Taxable Subtotal:</span><span>₹${totalTaxable.toFixed(2)}</span></div>
                    <div class="totals-row"><span>GST (Included):</span><span>₹${totalGst.toFixed(2)}</span></div>
                ` : `
                    <div class="totals-row"><span>Base Subtotal:</span><span>₹${baseSubtotal.toFixed(2)}</span></div>
                `}
                ${discountAmount > 0 ? `<div class="totals-row" style="color:#059669;"><span>Promo Discount:</span><span>- ₹${discountAmount.toFixed(2)}</span></div>` : ""}
                <div class="totals-row"><span>Delivery Fee:</span><span>${shippingFee === 0 ? "FREE" : `₹${shippingFee.toFixed(2)}`}</span></div>
                <div class="totals-row grand"><span>Customer Paid Amount:</span><span>₹${finalTotal.toFixed(2)}</span></div>
            </div>

            <div class="footer">
                <strong>Statutory Declaration:</strong><br/>
                ${hasGst 
                    ? "We declare that this Tax Invoice shows the actual price of the goods described and that all particulars are true and correct. Tax is payable on reverse charge basis: No." 
                    : "Issued as a statutory Bill of Supply by an unregistered micro-artisan/merchant. No GST is charged or collected on this supply."}
                <br/><br/>
                <div style="text-align: center; font-weight: 700; color: #111827;">Thank you for supporting authentic traditional artisans on Jamba Wear!</div>
            </div>

            ${autoPrint ? `<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>` : ""}
        </body>
        </html>
        `;

        const printWin = window.open("", "_blank", "width=860,height=920,noopener,noreferrer");
        if (!printWin) {
            alert("Popup blocked! Please allow popups for this site to view or download the invoice.");
            return;
        }
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();
    } catch (err) {
        console.error("Invoice Generation Error:", err);
        alert("Could not generate invoice: " + err.message);
    }
};