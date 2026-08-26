import React from 'react';
import './StoreProfileTab.css';

export default function StoreProfileTab({
    isActive,
    isProfileEditing,
    setIsProfileEditing,
    sellerProfile,
    tempProfilePhoto,
    handleProfilePhotoUpload,
    handleProfileSave,
    selectedState, setSelectedState,
    selectedDistrict, setSelectedDistrict,
    sameAsPermanent, setSameAsPermanent,
    selectedPickupState, setSelectedPickupState,
    selectedPickupDistrict, setSelectedPickupDistrict,
    stateDistrictMap
}) {
    if (!isActive) return null;

    if (isProfileEditing) {
        return (
            <div id="profile" className="content-section active">
                <div className="profile-header-flex">
                    <span className="section-title" style={{margin: 0}}>Store Settings & Bank Details</span>
                    <button type="button" className="action-btn" style={{margin: 0, fontSize: '12px'}} onClick={() => setIsProfileEditing(false)}>Cancel Edit</button>
                </div>
                
                <form className="card" onSubmit={handleProfileSave}>
                    <span className="section-subtitle"><i className="fa-solid fa-address-card" style={{ color: 'var(--text-muted)' }}></i> Identity & Branding</span>
                    
                    <div className="profile-avatar-container" style={{ border: 'none' }}>
                        <div className="profile-avatar-circle">
                            {tempProfilePhoto || sellerProfile.profilePhoto ? (
                                <img src={tempProfilePhoto || sellerProfile.profilePhoto} alt="Profile" className="profile-avatar-img" />
                            ) : (
                                sellerProfile.brandName ? sellerProfile.brandName.charAt(0).toUpperCase() : 'S'
                            )}
                        </div>
                        <div>
                            <label htmlFor="profile-photo-upload" className="action-btn" style={{ background: '#f3f4f6', color: 'var(--text-main)', border: '1px solid var(--input-border)', cursor: 'pointer', display: 'inline-block', padding: '8px 16px' }}>
                                <i className="fa-solid fa-camera"></i> <span id="profile-photo-btn-text">Upload Store Logo</span>
                            </label>
                            <input id="profile-photo-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoUpload} />
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Square image recommended (Max 2MB)</div>
                        </div>
                    </div>

                    <div className="field-grid">
                        <div className="form-group"><span className="label">Brand Name</span><input type="text" id="prof-brand-name" defaultValue={sellerProfile.brandName || ""} className="input-box" required /></div>
                        <div className="form-group"><span className="label">Seller Name</span><input type="text" id="prof-seller-name" defaultValue={sellerProfile.sellerName || ""} className="input-box" required /></div>
                    </div>

                    <span className="section-subtitle" style={{ marginTop: '20px' }}><i className="fa-solid fa-phone" style={{ color: 'var(--text-muted)' }}></i> Contact</span>
                    <div className="field-grid">
                        <div className="form-group"><span className="label">Email</span><input type="email" id="prof-email" defaultValue={sellerProfile.storeEmail || ""} className="input-box" required /></div>
                        <div className="form-group"><span className="label">Primary Phone</span><input type="text" id="prof-phone-1" defaultValue={sellerProfile.primaryPhone || ""} className="input-box" required minLength="10" maxLength="10" /></div>
                    </div>
                    <div className="field-grid">
                        <div className="form-group"><span className="label">Secondary Phone</span><input type="text" id="prof-phone-2" defaultValue={sellerProfile.secondaryPhone || ""} className="input-box" minLength="10" maxLength="10" /></div>
                    </div>

                    <span className="section-subtitle" style={{ marginTop: '20px' }}><i className="fa-solid fa-location-dot" style={{ color: 'var(--text-muted)' }}></i> Permanent Address</span>
                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <span className="label">Permanent Address</span>
                        <input type="text" id="prof-address" defaultValue={sellerProfile.address || ""} className="input-box" required />
                    </div>

                    <div className="field-grid">
                        <div className="form-group">
                            <span className="label">State / UT</span>
                            <select id="prof-state" className="input-box" required value={selectedState} onChange={(e) => { setSelectedState(e.target.value); setSelectedDistrict(""); }}>
                                <option value="" disabled>Select State</option>
                                {Object.keys(stateDistrictMap).sort().map(state => <option key={state} value={state}>{state}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <span className="label">District</span>
                            <select id="prof-district" className="input-box" required value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} disabled={!selectedState}>
                                <option value="" disabled>Select District</option>
                                {selectedState && stateDistrictMap[selectedState] ? stateDistrictMap[selectedState].map(dist => <option key={dist} value={dist}>{dist}</option>) : null}
                            </select>
                        </div>
                    </div>

                    <div className="field-grid">
                        <div className="form-group"><span className="label">Town / City</span><input type="text" id="prof-town" defaultValue={sellerProfile.town || ""} className="input-box" required /></div>
                        <div className="form-group"><span className="label">Pincode</span><input type="text" id="prof-pincode" defaultValue={sellerProfile.pincode || ""} className="input-box" required minLength="6" maxLength="6" /></div>
                    </div>

                    <span className="section-subtitle" style={{ marginTop: '30px' }}><i className="fa-solid fa-box" style={{ color: 'var(--text-muted)' }}></i> Pickup Location</span>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: 'var(--primary)' }}>
                            <input 
                                type="checkbox" checked={sameAsPermanent}
                                onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setSameAsPermanent(isChecked);
                                    if(isChecked) {
                                        setSelectedPickupState(selectedState);
                                        setSelectedPickupDistrict(selectedDistrict);
                                        document.getElementById('pickup-address').value = document.getElementById('prof-address').value;
                                        document.getElementById('pickup-town').value = document.getElementById('prof-town').value;
                                        document.getElementById('pickup-pincode').value = document.getElementById('prof-pincode').value;
                                    }
                                }}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} 
                            />
                            Same as Permanent Address
                        </label>
                    </div>

                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <span className="label">Pickup Address</span>
                        <input type="text" id="pickup-address" defaultValue={sellerProfile.pickupAddress || ""} className="input-box" disabled={sameAsPermanent} required />
                    </div>

                    <div className="field-grid">
                        <div className="form-group">
                            <span className="label">State / UT</span>
                            <select id="pickup-state" className="input-box" required value={selectedPickupState} onChange={(e) => { setSelectedPickupState(e.target.value); setSelectedPickupDistrict(""); }} disabled={sameAsPermanent}>
                                <option value="" disabled>Select State</option>
                                {Object.keys(stateDistrictMap).sort().map(state => <option key={state} value={state}>{state}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <span className="label">District</span>
                            <select id="pickup-district" className="input-box" required value={selectedPickupDistrict} onChange={(e) => setSelectedPickupDistrict(e.target.value)} disabled={!selectedPickupState || sameAsPermanent}>
                                <option value="" disabled>Select District</option>
                                {selectedPickupState && stateDistrictMap[selectedPickupState] ? stateDistrictMap[selectedPickupState].map(dist => <option key={dist} value={dist}>{dist}</option>) : null}
                            </select>
                        </div>
                    </div>

                    <div className="field-grid">
                        <div className="form-group"><span className="label">Town / City</span><input type="text" id="pickup-town" defaultValue={sellerProfile.pickupTown || ""} className="input-box" disabled={sameAsPermanent} required /></div>
                        <div className="form-group"><span className="label">Pincode</span><input type="text" id="pickup-pincode" defaultValue={sellerProfile.pickupPincode || ""} className="input-box" required minLength="6" maxLength="6" disabled={sameAsPermanent} /></div>
                    </div>

                    <span className="section-subtitle" style={{ color: 'var(--success)', marginTop: '30px' }}><i className="fa-solid fa-building-columns"></i> Financial Details</span>
                    <div className="field-grid">
                        <div className="form-group"><span className="label">Bank Name</span><input type="text" id="bank-name" defaultValue={sellerProfile.bankName || ""} className="input-box" required /></div>
                        <div className="form-group"><span className="label">Account Holder Name</span><input type="text" id="bank-acc-name" defaultValue={sellerProfile.accName || ""} className="input-box" required /></div>
                    </div>
                    <div className="field-grid">
                        <div className="form-group"><span className="label">Account Number</span><input type="text" id="bank-acc-num" defaultValue={sellerProfile.accNumber || ""} className="input-box" required /></div>
                        <div className="form-group"><span className="label" style={{ color: 'var(--danger)' }}>Confirm Account Number</span><input type="text" id="bank-acc-num-confirm" defaultValue={sellerProfile.accNumber || ""} className="input-box" style={{ borderColor: '#fca5a5' }} required /></div>
                    </div>
                    <div className="field-grid">
                        <div className="form-group"><span className="label">IFSC Code</span><input type="text" id="bank-ifsc" defaultValue={sellerProfile.ifsc || ""} className="input-box" required /></div>
                        <div className="form-group"><span className="label" style={{ color: 'var(--danger)' }}>Confirm IFSC Code</span><input type="text" id="bank-ifsc-confirm" defaultValue={sellerProfile.ifsc || ""} className="input-box" style={{ borderColor: '#fca5a5' }} required /></div>
                    </div>

                    <button type="submit" id="save-profile-btn" className="btn-submit" style={{ marginTop: '30px' }}>Save Profile Details</button>
                </form>
            </div>
        );
    }

    return (
        <div id="profile" className="content-section active">
            <div className="profile-header-flex">
                <span className="section-title" style={{ margin: 0 }}>Store Profile</span>
                <button type="button" className="action-btn" onClick={() => setIsProfileEditing(true)} style={{margin: 0}}>
                    <i className="fa-solid fa-pen" style={{ marginRight: '6px' }}></i> Edit Profile
                </button>
            </div>

            <div className="card" style={{ padding: '32px' }}>
                <div className="profile-avatar-container">
                    <div className="profile-avatar-circle read-only">
                        {sellerProfile.profilePhoto ? (
                            <img src={sellerProfile.profilePhoto} alt="Profile" className="profile-avatar-img" />
                        ) : (
                            sellerProfile.brandName ? sellerProfile.brandName.charAt(0).toUpperCase() : 'S'
                        )}
                    </div>
                    <div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--primary)' }}>{sellerProfile.brandName}</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Owned by {sellerProfile.sellerName}</div>
                    </div>
                </div>

                <div className="field-grid">
                    <div className="profile-data-block">
                        <div className="profile-data-label"><i className="fa-solid fa-phone"></i> Contact Details</div>
                        <div className="profile-data-content">
                            <strong>Email:</strong> {sellerProfile.storeEmail}<br/>
                            <strong>Primary:</strong> {sellerProfile.primaryPhone}<br/>
                            <strong>Secondary:</strong> {sellerProfile.secondaryPhone || 'N/A'}
                        </div>
                    </div>
                    <div className="profile-data-block">
                        <div className="profile-data-label"><i className="fa-solid fa-building-columns"></i> Banking Info</div>
                        <div className="profile-data-content">
                            <strong>Bank:</strong> {sellerProfile.bankName}<br/>
                            <strong>Holder:</strong> {sellerProfile.accName}<br/>
                            <strong>A/C No:</strong> •••• •••• {String(sellerProfile.accNumber).slice(-4)}<br/>
                            <strong>IFSC:</strong> {sellerProfile.ifsc}
                        </div>
                    </div>
                </div>

                <div className="field-grid profile-section-divider">
                    <div className="profile-data-block">
                        <div className="profile-data-label"><i className="fa-solid fa-location-dot"></i> Permanent Address</div>
                        <div className="profile-data-content">
                            {sellerProfile.address}<br/>
                            {sellerProfile.town}, {sellerProfile.district}<br/>
                            {sellerProfile.state} - <strong>{sellerProfile.pincode}</strong>
                        </div>
                    </div>
                    <div className="profile-data-block">
                        <div className="profile-data-label"><i className="fa-solid fa-box"></i> Pickup Location</div>
                        <div className="profile-data-content">
                            {sellerProfile.pickupAddress}<br/>
                            {sellerProfile.pickupTown}, {sellerProfile.pickupDistrict}<br/>
                            {sellerProfile.pickupState} - <strong>{sellerProfile.pickupPincode}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}