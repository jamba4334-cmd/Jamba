import React from 'react';
import './Privacy.css';

export default function Privacy() {
  return (
    <main className="policy-container">
      <h1>Privacy Policy</h1>
      <span className="last-updated">Last Updated: May 2026</span>

      <p>At JAMBA WEAR, we are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about our policy, or our practices with regards to your personal information, please contact us.</p>

      <h2>1. Information We Collect</h2>
      <p>We collect personal information that you voluntarily provide to us when you register on the Website, express an interest in obtaining information about us or our products, or when you participate in activities on the Website (such as placing an order).</p>
      <p>The personal information that we collect depends on the context of your interactions with us and the Website, the choices you make, and the products and features you use. The personal information we collect can include the following:</p>
      <ul>
        <li>Name and Contact Data (Email address, phone number, shipping and billing address).</li>
        <li>Credentials (Passwords and similar security information used for authentication).</li>
      </ul>

      <h2>2. Payment Security</h2>
      <p>We prioritize your security by processing transactions directly through manual UPI transfers and personal account QR codes. Because we utilize these direct bank transfers rather than automated third-party payment gateways, your financial data is never processed or stored on our servers, ensuring your information remains completely safe and entirely under your control during checkout.</p>

      <h2>3. Data Sharing and Disclosure</h2>
      <p>We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. Specifically, we share your shipping details with our trusted courier partners strictly for the purpose of delivering your purchased items.</p>
      <p>We do not sell, rent, or trade your personal information to third parties for their promotional purposes.</p>

      <h2>4. Your Privacy Rights</h2>
      <p>You may review, change, or terminate your account at any time by logging into your account settings or contacting us directly.</p>
    </main>
  );
}