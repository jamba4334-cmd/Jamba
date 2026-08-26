import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import './Address.css'; 

export default function Address() {
  const navigate = useNavigate();
  const { user } = useAuth(); 
  
  const [addresses, setAddresses] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [newAddress, setNewAddress] = useState({
    name: '', phone: '', address1: '', landmark: '', district: '', state: '', pincode: ''
  });

  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user) {
        setAddresses([]);
        localStorage.removeItem('jambaSavedAddresses');
        setLoading(false);
        return;
      }
      
      try {
        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists() && docSnap.data().addresses) {
          const fetchedAddresses = docSnap.data().addresses;
          setAddresses(fetchedAddresses);
          localStorage.setItem('jambaSavedAddresses', JSON.stringify(fetchedAddresses));
        }
      } catch (error) {
        console.error("Error fetching addresses:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAddresses();
  }, [user]);

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please log in to save addresses!");
    
    const updatedAddresses = [...addresses, newAddress];
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { addresses: updatedAddresses }, { merge: true });
      
      setAddresses(updatedAddresses);
      localStorage.setItem('jambaSavedAddresses', JSON.stringify(updatedAddresses));
      setIsAdding(false);
      setNewAddress({ name: '', phone: '', address1: '', landmark: '', district: '', state: '', pincode: '' });
    } catch (error) {
      console.error("Error saving address:", error);
      alert("Failed to save address.");
    }
  };

  const handleDeleteAddress = async (indexToDelete) => {
    const updatedAddresses = addresses.filter((_, index) => index !== indexToDelete);
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { addresses: updatedAddresses }, { merge: true });
      
      setAddresses(updatedAddresses);
      localStorage.setItem('jambaSavedAddresses', JSON.stringify(updatedAddresses));
    } catch (error) {
      console.error("Error deleting address:", error);
    }
  };

  if (loading) return <div className="ws-loading-state">Loading your addresses...</div>;

  if (!user) {
    return (
      <div className="ws-empty-state">
        <h2>Please log in to manage your addresses</h2>
        <button className="ws-primary-btn" onClick={() => navigate('/login')}>Go to Login</button>
      </div>
    );
  }

  return (
    <div className="address-container">
      <div className="page-header">
        <h1 className="page-title">Saved Addresses</h1>
      </div>

      {!isAdding ? (
        <div className="address-list-wrapper">
          {addresses.length === 0 ? (
            <div className="empty-address-msg">
              You have no saved addresses yet.
            </div>
          ) : (
            addresses.map((addr, idx) => (
              <div key={idx} className="address-list-card">
                <div className="address-card-header">
                  <span className="addr-type-badge">Address {idx + 1}</span>
                  <button className="addr-delete-btn" onClick={() => handleDeleteAddress(idx)}>✕</button>
                </div>
                <div className="address-card-content">
                  <h3 className="addr-name">{addr.name}</h3>
                  <p className="addr-line">{addr.address1}, {addr.landmark}</p>
                  <p className="addr-line">{addr.district}, {addr.state} - {addr.pincode}</p>
                  <p className="addr-line">Phone: {addr.phone}</p>
                </div>
              </div>
            ))
          )}
          
          <button className="add-new-addr-btn" onClick={() => setIsAdding(true)}>
            + Add New Address
          </button>
        </div>
      ) : (
        <div className="address-card form-layout-wrapper">
          <div className="form-header-box">
            <h2>Add New Location</h2>
            <p className="helper-text">Fill in the details below to add a new delivery destination.</p>
          </div>
          
          <form onSubmit={handleSaveAddress} className="address-form-strict">
            <div className="grid-2">
              <div className="input-group">
                <label>Full Name</label>
                <input required className="input-field" value={newAddress.name} onChange={(e) => setNewAddress({...newAddress, name: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Phone</label>
                <input required type="tel" className="input-field" value={newAddress.phone} onChange={(e) => setNewAddress({...newAddress, phone: e.target.value})} />
              </div>
            </div>
            
            <div className="input-group">
              <label>Flat, House no., Apartment</label>
              <input required className="input-field" value={newAddress.address1} onChange={(e) => setNewAddress({...newAddress, address1: e.target.value})} />
            </div>
            
            <div className="input-group">
              <label>Area, Street, Village</label>
              <input className="input-field" value={newAddress.landmark} onChange={(e) => setNewAddress({...newAddress, landmark: e.target.value})} />
            </div>
            
            {/* 🔥 NEW: 3-Column Grid for massive space saving */}
            <div className="grid-3">
              <div className="input-group">
                <label>Pincode</label>
                <input required className="input-field" value={newAddress.pincode} onChange={(e) => setNewAddress({...newAddress, pincode: e.target.value})} />
              </div>
              <div className="input-group">
                <label>City/District</label>
                <input required className="input-field" value={newAddress.district} onChange={(e) => setNewAddress({...newAddress, district: e.target.value})} />
              </div>
              <div className="input-group full-width-mob">
                <label>State</label>
                <input required className="input-field" value={newAddress.state} onChange={(e) => setNewAddress({...newAddress, state: e.target.value})} />
              </div>
            </div>

            <div className="action-buttons">
              <button type="button" className="btn cancel-btn" onClick={() => setIsAdding(false)}>Cancel</button>
              <button type="submit" className="btn save-btn">Save Address</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}