import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './SellerSubscription.css';

export default function SellerStorefrontEditor() {
    const auth = getAuth();
    const user = auth.currentUser;
    const [profile, setProfile] = useState({ vanityHandle: '', brandStory: '', bannerUrl: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Fetch existing storefront data when the page loads
    useEffect(() => {
        if (user?.email) {
            getDoc(doc(db, "seller_profiles", user.email)).then(snap => {
                if (snap.exists() && snap.data().storefront) {
                    setProfile(snap.data().storefront);
                }
            });
        }
    }, [user]);

    // Handle the custom banner upload via Cloudinary
    const handleBannerUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            setProfile({ ...profile, bannerUrl: data.secure_url });
        } catch (error) {
            console.error("Cloudinary error:", error);
            alert("Banner upload failed. Check your Cloudinary credentials.");
        } finally {
            setIsUploading(false);
        }
    };

    // Save the customized brand details to Firebase
    const handleSave = async (e) => {
        e.preventDefault();
        if (!user) return;
        setIsSaving(true);
        
        try {
            const docRef = doc(db, "seller_profiles", user.email);
            const snap = await getDoc(docRef);
            
            // If they don't have a profile yet, create one. Otherwise, update it.
            if (snap.exists()) {
                await updateDoc(docRef, { storefront: profile });
            } else {
                await setDoc(docRef, { email: user.email, storefront: profile });
            }
            
            alert("Storefront updated! Customers can now see your changes.");
        } catch (error) {
            console.error("Firebase save error:", error);
            alert("Error saving storefront details.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="sub-page-wrapper">
            <div className="sub-container" style={{ maxWidth: '800px' }}>
                <div className="pricing-card" style={{ padding: '40px' }}>
                    <h2 className="sub-title">Design Your Flagship Store</h2>
                    <p className="sub-subtitle">Customize how customers experience your brand and traditional woven patterns.</p>
                    
                    <form onSubmit={handleSave}>
                        {/* Vanity URL Input */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#2d2a26' }}>Store Handle (URL)</label>
                            <div style={{ display: 'flex', alignItems: 'center', background: '#faf8f5', border: '1px solid #e5ded4', borderRadius: '8px', padding: '0 12px' }}>
                                <span style={{ color: '#8b7355', fontWeight: '500' }}>jambawear.com/shop/</span>
                                <input 
                                    type="text" 
                                    value={profile.vanityHandle}
                                    onChange={(e) => setProfile({...profile, vanityHandle: e.target.value.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()})}
                                    placeholder="your-brand-name"
                                    style={{ border: 'none', background: 'transparent', padding: '12px 8px', flex: 1, outline: 'none', color: '#2d2a26', fontWeight: '600' }}
                                    required
                                />
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#8b7355', marginTop: '6px' }}>Use only letters, numbers, and hyphens.</p>
                        </div>

                        {/* Brand Story Input */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#2d2a26' }}>Brand Story / Description</label>
                            <textarea 
                                value={profile.brandStory}
                                onChange={(e) => setProfile({...profile, brandStory: e.target.value})}
                                placeholder="Tell customers about your weaving traditions, heritage, and the story behind your products..."
                                style={{ width: '100%', padding: '12px', border: '1px solid #e5ded4', borderRadius: '8px', minHeight: '120px', resize: 'vertical', fontFamily: 'inherit' }}
                                required
                            />
                        </div>

                        {/* Custom Banner Upload */}
                        <div style={{ marginBottom: '36px' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#2d2a26' }}>Hero Banner Image</label>
                            
                            {profile.bannerUrl && (
                                <div style={{ position: 'relative', marginBottom: '16px' }}>
                                    <img src={profile.bannerUrl} alt="Banner Preview" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5ded4' }} />
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                        Preview
                                    </div>
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleBannerUpload} 
                                    disabled={isUploading} 
                                    id="banner-upload"
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor="banner-upload" className="sub-btn-secondary" style={{ display: 'inline-block', width: 'auto', cursor: 'pointer', textAlign: 'center' }}>
                                    <i className="fa-solid fa-cloud-arrow-up"></i> {profile.bannerUrl ? 'Change Banner' : 'Upload Banner'}
                                </label>
                                
                                {isUploading && (
                                    <span style={{ fontSize: '14px', color: '#8b7355', fontWeight: '600' }}>
                                        <i className="fa-solid fa-spinner fa-spin"></i> Uploading to Cloudinary...
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button type="submit" className="sub-btn-primary" disabled={isSaving || isUploading}>
                            {isSaving ? "Publishing to live site..." : "Save & Publish Storefront"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}