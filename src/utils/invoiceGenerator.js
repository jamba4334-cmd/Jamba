import { doc, getDoc } from "firebase/firestore";
import { db as defaultDb } from "../firebase";

const escapeHtml = (unsafe) => {
    return String(unsafe ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const STATE_GST_CODES = {
    "jammu & kashmir": "01", "himachal pradesh": "02", "punjab": "03", "chandigarh": "04",
    "uttarakhand": "05", "haryana": "06", "delhi": "07", "rajasthan": "08",
    "uttar pradesh": "09", "bihar": "10", "sikkim": "11", "arunachal pradesh": "12",
    "nagaland": "13", "manipur": "14", "mizoram": "15", "tripura": "16",
    "meghalaya": "17", "assam": "18", "west bengal": "19", "jharkhand": "20",
    "odisha": "21", "chhattisgarh": "22", "madhya pradesh": "23", "gujarat": "24",
    "maharashtra": "27", "andhra pradesh": "28", "karnataka": "29", "goa": "30",
    "kerala": "32", "tamil nadu": "33", "telangana": "36", "ladakh": "38"
};

const getStateCode = (stateName) => {
    if (!stateName) return "";
    return STATE_GST_CODES[stateName.trim().toLowerCase()] || "";
};

export const generateOrderInvoice = async (order, dbInstance = null, autoPrint = false) => {
    try {
        if (!order) throw new Error("Order data is missing.");
        const activeDb = dbInstance || defaultDb;

        // 1. Fetch Primary Seller KYC & Store Details
        let sellerKyc = {};
        let sellerProfile = {};
        const primarySellerEmail = (
            order.sellerEmails?.[0] ||
            order.items?.[0]?.sellerEmail ||
            order.items?.[0]?.email ||
            ""
        ).toLowerCase().trim();

        if (activeDb && primarySellerEmail) {
            try {
                const [authSnap, profSnap] = await Promise.all([
                    getDoc(doc(activeDb, "authorized_sellers", primarySellerEmail)),
                    getDoc(doc(activeDb, "seller_profiles", primarySellerEmail))
                ]);
                if (authSnap.exists()) sellerKyc = authSnap.data().kycData || {};
                if (profSnap.exists()) sellerProfile = profSnap.data() || {};
            } catch (e) {
                console.warn("Seller lookup fallback.", e);
            }
        }

        // 2. Classify Document Type & Tax Status
        const isRegistered = sellerKyc.hasGst === true || 
                             (sellerKyc.gstNumber && sellerKyc.gstNumber !== "UNREGISTERED");
        const docTitle = isRegistered ? "TAX INVOICE" : "BILL OF SUPPLY";

        const rawOrderId = String(order.jamba_order_id || order.id || "N/A");
        const safeOrderId = escapeHtml(rawOrderId);
        const invoiceNo = escapeHtml(`JW/${rawOrderId.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase()}`);

        const parseDate = (d) => {
            if (!d) return new Date().toISOString().split("T")[0];
            if (typeof d.toDate === "function") return d.toDate().toISOString().split("T")[0];
            if (d.seconds) return new Date(d.seconds * 1000).toISOString().split("T")[0];
            return String(d).substring(0, 10);
        };
        const orderDate = escapeHtml(parseDate(order.created_at || order.createdAt));

        // 3. Jamba Wear Platform / ECO Details
        const ecoName = "JAMBA WEAR PRIVATE LIMITED";
        const ecoAddress = "Guwahati, Kamrup Metropolitan, Assam - 781001, India";
        const ecoGstin = "18AAACJ0000A1Z5"; // Update with Jamba Wear's official GSTIN when issued

        // 4. Seller Details (Sold By)
        const sellerBrand = escapeHtml(sellerProfile.brandName || order.items?.[0]?.brandName || "JAMBA WEAR ARTISAN");
        const sellerOwner = escapeHtml(sellerProfile.sellerName || "Registered Partner");
        const sellerState = sellerProfile.pickupState || sellerProfile.state || "Assam";
        const sellerStateCode = getStateCode(sellerState) || "18";
        const sellerAddress = escapeHtml(
            sellerProfile.pickupAddress 
                ? `${sellerProfile.pickupAddress}, ${sellerProfile.pickupTown || ""}, ${sellerState} - ${sellerProfile.pickupPincode || ""}`
                : (sellerProfile.address || "Registered Artisan Center")
        );

        // Seller Identification: GSTIN vs Enrolment ID
        const sellerPan = escapeHtml(sellerKyc.panNumber || "N/A");
        let sellerIdHtml = "";
        if (isRegistered) {
            sellerIdHtml = `<strong>GSTIN:</strong> ${escapeHtml(sellerKyc.gstNumber || "N/A")}`;
        } else {
            const enrId = sellerKyc.enrolmentId || sellerKyc.enrId || "UNREGISTERED";
            sellerIdHtml = `<strong>GST Enrolment ID:</strong> ${escapeHtml(enrId)}`;
        }

        // 5. Customer Details (Billed & Shipped To)
        const addrObj = order.shippingAddress || {};
        const customerName = escapeHtml(addrObj.name || order.customerName || "Customer");
        const customerState = addrObj.state || sellerState;
        const customerStateCode = getStateCode(customerState) || sellerStateCode;
        const customerAddress = escapeHtml(
            addrObj.address1 || addrObj.line1
                ? `${addrObj.address1 || addrObj.line1}${addrObj.landmark ? `, ${addrObj.landmark}` : ""}, ${addrObj.city || addrObj.district || ""}, ${customerState} - ${addrObj.pincode || ""}`
                : (order.address || "Address on file")
        );
        const customerPhone = escapeHtml(addrObj.phone || order.customerContact || "N/A");

        const isIntraState = sellerState.trim().toLowerCase() === customerState.trim().toLowerCase();

        // 6. Line Item Calculations
        const items = Array.isArray(order.items) ? order.items : [];
        let totalTaxableValue = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;

        const orderLevelDiscount = Math.max(0, Number(order.discount_applied || 0));
        const rawSubtotal = items.reduce((acc, item) => acc + (Number(item.price || item.selling_price || 0) * Math.max(1, parseInt(item.quantity || item.qty || 1, 10))), 0);

        const rowsHtml = items.map((item, idx) => {
            const qty = Math.max(1, parseInt(item.quantity || item.qty || 1, 10));
            const gross = Math.max(0, Number(item.price || item.selling_price || 0)) * qty;
            const itemDiscount = rawSubtotal > 0 ? (gross / rawSubtotal) * orderLevelDiscount : 0;
            const netAmount = Math.max(0, gross - itemDiscount);

            const hsn = escapeHtml(item.hsn || "6204");
            const safeTitle = escapeHtml(item.name || item.title || "Handloom Traditional Attire");
            const safeSize = escapeHtml(item.size || "Standard");

            if (isRegistered) {
                const rate = netAmount > 2500 ? 18 : 5;
                const taxable = netAmount / (1 + rate / 100);
                const tax = netAmount - taxable;
                totalTaxableValue += taxable;

                let taxCol = "";
                if (isIntraState) {
                    const half = tax / 2;
                    totalCgst += half;
                    totalSgst += half;
                    taxCol = `CGST (${rate / 2}%): ₹${half.toFixed(2)}<br/>SGST (${rate / 2}%): ₹${half.toFixed(2)}`;
                } else {
                    totalIgst += tax;
                    taxCol = `IGST (${rate}%): ₹${tax.toFixed(2)}`;
                }

                return `
                    <tr>
                        <td style="text-align: center;">${idx + 1}</td>
                        <td><strong>${safeTitle}</strong> (Size: ${safeSize})<br/><small style="color: #666;">HSN: ${hsn}</small></td>
                        <td style="text-align: center;">${qty}</td>
                        <td style="text-align: right;">₹${taxable.toFixed(2)}</td>
                        <td style="text-align: right;">${taxCol}</td>
                        <td style="text-align: right; font-weight: 600;">₹${netAmount.toFixed(2)}</td>
                    </tr>
                `;
            } else {
                totalTaxableValue += netAmount;
                return `
                    <tr>
                        <td style="text-align: center;">${idx + 1}</td>
                        <td><strong>${safeTitle}</strong> (Size: ${safeSize})<br/><small style="color: #666;">HSN: ${hsn}</small></td>
                        <td style="text-align: center;">${qty}</td>
                        <td style="text-align: right;">₹${netAmount.toFixed(2)}</td>
                        <td style="text-align: right;">₹0.00</td>
                        <td style="text-align: right; font-weight: 600;">₹${netAmount.toFixed(2)}</td>
                    </tr>
                `;
            }
        }).join("");

        const shippingFee = Number(order.shipping_fee ?? 0);
        const grandTotal = Number(order.total || (totalTaxableValue + totalCgst + totalSgst + totalIgst + shippingFee));

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>${docTitle} - ${invoiceNo}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; background: #fff; font-size: 13px; line-height: 1.4; }
                .no-print { display: flex; justify-content: flex-end; margin-bottom: 20px; }
                .print-btn { background: #111; color: #fff; border: none; padding: 8px 18px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 13px; }
                
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
                .brand { font-size: 22px; font-weight: 800; color: #8b7355; margin: 0; }
                .doc-type { text-align: right; font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; }
                
                .eco-banner { background: #fbfbfb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px; color: #4b5563; }
                
                .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; padding: 12px; background: #fbfbfb; border: 1px solid #eee; border-radius: 6px; }
                
                .address-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
                .addr-box { border-left: 3px solid #8b7355; padding-left: 12px; }
                .addr-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8b7355; margin-bottom: 4px; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #f4f4f4; text-align: left; padding: 10px 8px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #ccc; }
                td { padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
                
                .calc-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
                .calc-left { width: 45%; font-size: 11px; color: #666; line-height: 1.5; }
                .totals-box { width: 300px; }
                .tot-row { display: flex; justify-content: space-between; padding: 4px 0; }
                .grand-total { border-top: 2px solid #111; border-bottom: 2px solid #111; font-weight: 800; font-size: 15px; padding: 8px 0; margin-top: 6px; }
                
                .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #ccc; padding-top: 16px; font-size: 11px; color: #666; }
                @media print { .no-print { display: none !important; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="no-print">
                <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
            </div>

            <div class="header">
                <div>
                    <h1 class="brand">JAMBA WEAR</h1>
                    <small style="color: #666;">Authentic Traditional Fashion Marketplace</small>
                </div>
                <div>
                    <h2 class="doc-type">${docTitle}</h2>
                </div>
            </div>

            <!-- Jamba Wear Registered Marketplace / ECO Details -->
            <div class="eco-banner">
                <strong>Facilitated By (E-Commerce Operator):</strong> ${ecoName}<br/>
                Reg. Office: ${ecoAddress} | GSTIN: ${ecoGstin}<br/>
                <em>* TCS under Section 52 of the CGST Act is discharged on this transaction.</em>
            </div>

            <div class="meta-grid">
                <div>
                    <strong>Invoice No:</strong> ${invoiceNo}<br/>
                    <strong>Order Ref:</strong> #${safeOrderId}
                </div>
                <div style="text-align: right;">
                    <strong>Date:</strong> ${orderDate}<br/>
                    <strong>Place of Supply:</strong> ${customerState} (${customerStateCode})
                </div>
            </div>

            <div class="address-grid">
                <!-- Seller Registered Details -->
                <div class="addr-box">
                    <div class="addr-title">Sold By (Seller)</div>
                    <strong>${sellerBrand}</strong> (Prop: ${sellerOwner})<br/>
                    ${sellerAddress}<br/>
                    State: ${sellerState} (${sellerStateCode})<br/>
                    <strong>PAN:</strong> ${sellerPan}<br/>
                    ${sellerIdHtml}
                </div>
                <!-- Customer Details -->
                <div class="addr-box">
                    <div class="addr-title">Billed & Shipped To</div>
                    <strong>${customerName}</strong><br/>
                    ${customerAddress}<br/>
                    State: ${customerState} (${customerStateCode})<br/>
                    Phone: ${customerPhone}
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px; text-align: center;">#</th>
                        <th>Item Description</th>
                        <th style="width: 50px; text-align: center;">Qty</th>
                        <th style="width: 80px; text-align: right;">Taxable</th>
                        <th style="width: 120px; text-align: right;">Tax</th>
                        <th style="width: 80px; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    ${shippingFee > 0 ? `
                    <tr>
                        <td style="text-align: center;">-</td>
                        <td><strong>Shipping & Handling</strong> (SAC: 996511)</td>
                        <td style="text-align: center;">1</td>
                        <td style="text-align: right;">₹${shippingFee.toFixed(2)}</td>
                        <td style="text-align: right;">₹0.00</td>
                        <td style="text-align: right; font-weight: 600;">₹${shippingFee.toFixed(2)}</td>
                    </tr>` : ''}
                </tbody>
            </table>

            <div class="calc-section">
                <div class="calc-left">
                    <p style="margin: 0;"><strong>Tax Payable on Reverse Charge (RCM):</strong> No</p>
                    <p style="margin: 4px 0 0 0;">
                        ${isRegistered 
                            ? "We declare that this invoice shows the actual price of the goods described." 
                            : "Issued as a Bill of Supply by an unregistered artisan. No GST is charged or collected on this supply."
                        }
                    </p>
                </div>
                <div class="totals-box">
                    <div class="tot-row"><span>Taxable Value:</span><span>₹${(totalTaxableValue + shippingFee).toFixed(2)}</span></div>
                    ${isRegistered ? (
                        isIntraState ? `
                        <div class="tot-row"><span>CGST:</span><span>₹${totalCgst.toFixed(2)}</span></div>
                        <div class="tot-row"><span>SGST:</span><span>₹${totalSgst.toFixed(2)}</span></div>
                        ` : `
                        <div class="tot-row"><span>IGST:</span><span>₹${totalIgst.toFixed(2)}</span></div>
                        `
                    ) : ''}
                    ${orderLevelDiscount > 0 ? `
                    <div class="tot-row" style="color: #059669;"><span>Discount:</span><span>-₹${orderLevelDiscount.toFixed(2)}</span></div>
                    ` : ''}
                    <div class="tot-row grand-total"><span>Grand Total:</span><span>₹${grandTotal.toFixed(2)}</span></div>
                </div>
            </div>

            <div class="footer">
                <div>E. & O.E.</div>
                <div style="text-align: right;">
                    <strong>Ordered Through: JAMBA WEAR</strong><br/><br/>
                    <span style="border-top: 1px dashed #999; padding-top: 4px; display: inline-block;">Authorized Signatory (${sellerBrand})</span>
                </div>
            </div>
        </body>
        </html>
        `;

        const printWin = window.open("", "_blank", "width=840,height=900");
        if (!printWin) {
            alert("Popup blocked! Please allow popups to view or print the invoice.");
            return;
        }

        try {
            printWin.document.open();
            printWin.document.write(htmlContent);
            printWin.document.close();
        } catch (e) {
            const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
            printWin.location.href = URL.createObjectURL(blob);
        }

    } catch (err) {
        console.error("Invoice Generation Failed:", err);
        alert("Failed to create invoice: " + err.message);
    }
};