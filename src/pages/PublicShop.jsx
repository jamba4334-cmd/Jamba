import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function PublicShop() {
    const { handle } = useParams(); // Grabs 'bodo-weavers' from the URL
    const [seller, setSeller] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStorefront() {
            try {
                // 1. Find the seller profile using the URL handle
                const profilesRef = collection(db, "seller_profiles");
                const qProfile = query(profilesRef, where("storefront.vanityHandle", "==", handle));
                const profileSnap = await getDocs(qProfile);

                if (profileSnap.empty) {
                    setSeller(null);
                    setLoading(false);
                    return;
                }

                const sellerData = profileSnap.docs[0].data();
                setSeller(sellerData);

                // 2. Fetch only the products belonging to this specific seller
                const productsRef = collection(db, "products");
                const qProducts = query(productsRef, where("sellerEmail", "==", sellerData.email));
                const productSnap = await getDocs(qProducts);

                const sellerProducts = productSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setProducts(sellerProducts);
                
            } catch (error) {
                console.error("Error loading storefront:", error);
            } finally {
                setLoading(false);
            }
        }

        if (handle) {
            fetchStorefront();
        }
    }, [handle]);

    // Loading State
    if (loading) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <h3 style={{ color: '#8b7355' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading Flagship Store...</h3>
            </div>
        );
    }

    // 404 Not Found State
    if (!seller) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <h2>Store Not Found</h2>
                <p>We couldn't find a flagship store with the handle "{handle}".</p>
                <Link to="/" style={{ color: '#2563EB', textDecoration: 'underline', marginTop: '10px' }}>Return to Jamba Wear Homepage</Link>
            </div>
        );
    }

    // Storefront Data
    const storefront = seller.storefront || {};
    const bannerImage = storefront.bannerUrl || 'https://via.placeholder.com/1200x400?text=Welcome+to+Our+Store';

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#faf8f5' }}>
            
            {/* 1. The Custom Hero Banner */}
            <div style={{ 
                width: '100%', 
                height: '400px', 
                backgroundImage: `url(${bannerImage})`,
                backgroundSize: 'cover', 
                backgroundPosition: 'center', 
                position: 'relative'
            }}>
                {/* Dark Overlay for Text Readability */}
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}></div>
                
                <div style={{ position: 'absolute', bottom: '40px', left: '5%', color: 'white', maxWidth: '800px', zIndex: 10 }}>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: '800', margin: '0 0 10px', textTransform: 'capitalize' }}>
                        {storefront.vanityHandle ? storefront.vanityHandle.replace(/-/g, ' ') : "Brand Store"}
                    </h1>
                    <p style={{ fontSize: '1.2rem', lineHeight: '1.6', opacity: 0.95, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        {storefront.brandStory || "Discover our exclusive collection of traditional woven apparel."}
                    </p>
                </div>
            </div>

            {/* 2. The Seller's Product Grid */}
            <div style={{ padding: '60px 5%', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ borderBottom: '2px solid #e5ded4', paddingBottom: '16px', marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '2rem', color: '#2d2a26', margin: 0 }}>Explore the Collection</h2>
                    <p style={{ color: '#8b7355', marginTop: '8px', fontWeight: '600' }}>
                        {products.length} {products.length === 1 ? 'Product' : 'Products'} Available
                    </p>
                </div>
                
                {products.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '12px', border: '1px dashed #ccc' }}>
                        <i className="fa-solid fa-box-open" style={{ fontSize: '3rem', color: '#e5ded4', marginBottom: '16px' }}></i>
                        <h3 style={{ color: '#5a5651' }}>No products available yet.</h3>
                        <p style={{ color: '#8b7355' }}>Check back soon for new arrivals from this artisan!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
                        
                        {products.map(product => (
                            <Link to={`/product/${product.id}`} key={product.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div style={{ 
                                    background: '#fff', border: '1px solid #e5ded4', borderRadius: '12px', overflow: 'hidden',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease', cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.08)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                                >
                                    <div style={{ height: '300px', overflow: 'hidden', position: 'relative' }}>
                                        <img 
                                            src={product.image_url || product.image || 'https://via.placeholder.com/300x400?text=No+Image'} 
                                            alt={product.title || product.name} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                        />
                                    </div>
                                    
                                    <div style={{ padding: '20px' }}>
                                        <h4 style={{ margin: '0 0 10px', color: '#2d2a26', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {product.title || product.name || 'Untitled Product'}
                                        </h4>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: '800', color: '#2d2a26', fontSize: '1.2rem' }}>
                                                ₹{product.selling_price || product.price || 0}
                                            </div>
                                            {product.mrp && (
                                                <div style={{ textDecoration: 'line-through', color: '#a8a29e', fontSize: '0.9rem' }}>₹{product.mrp}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}