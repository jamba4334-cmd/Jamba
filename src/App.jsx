import React, { lazy, Suspense } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Layout from './components/Layout';
import Home from './pages/Home';
import Cart from './pages/Cart';
import Payment from './pages/Payment';
import Login from './pages/Login';
import Address from './pages/Address';
import ProductView from './pages/ProductView';
import Terms from './pages/terms';
import Privacy from './pages/Privacy';
import Shipping from './pages/Shipping';
import Refunds from './pages/Refunds';
import Contact from './pages/Contact';
import Orders from './pages/Orders';
import Wishlist from './pages/Wishlist';
import OrderSuccess from './pages/OrderSuccess';
import ScrollToTop from './components/ScrollToTop';
import SearchResults from './components/SearchResults';
import CategoryPage from './pages/CategoryPage';
import UnifiedCategory from './pages/UnifiedCategory';

import SellerLanding from './admin/SellerLanding';
import SellerPortal from './admin/Seller';
import BrandStorefront from './pages/BrandStorefront'; 

// Pointing to your nested AdminLayout file
const SuperAdmin = lazy(() => import('./super_admin/Admin/AdminLayout')); 

const AdminLoader = () => (
  <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f9fafb' }}>
    <h3 style={{ color: '#374151' }}><i className="fa-solid fa-lock"></i> Decrypting Secure Portal...</h3>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <Routes>
        
        {/* 🔥 SUPER ADMIN ROUTE 🔥 
            This is now outside of any protected wrappers. 
            The AdminLayout component securely handles its own login screen! */}
        <Route path="/super-admin/*" element={
          <Suspense fallback={<AdminLoader />}>
            <SuperAdmin />
          </Suspense>
        } />

        <Route path="/seller/*" element={<SellerPortal />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="category/:category" element={<CategoryPage />} />
          <Route path="category/:category/:subcategory" element={<UnifiedCategory />} />
          <Route path="cart" element={<Cart />} />
          <Route path="payment" element={<Payment />} />
          <Route path="login" element={<Login />} />
          <Route path="address" element={<Address />} />
          <Route path="product/:id" element={<ProductView />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="shipping" element={<Shipping />} />
          <Route path="refunds" element={<Refunds />} />
          <Route path="contact" element={<Contact />} />
          <Route path="orders" element={<Orders />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="order-success" element={<OrderSuccess />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="sell-with-us" element={<SellerLanding />} />
          
          {/* 🔥 UPDATED: Dynamic routing for Custom Brand Storefronts using vanity handles */}
          <Route path="shop/:vanityHandle" element={<BrandStorefront />} />
        </Route>

        <Route path="*" element={<div style={{padding: '50px', textAlign: 'center'}}><h2>404 - Page Not Found</h2></div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;