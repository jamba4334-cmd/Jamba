import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { signInWithPopup, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber, updateProfile } from 'firebase/auth'; // 🔥 FIX: Added updateProfile
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [view, setView] = useState('login'); 
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState(new Array(6).fill('')); 
  const [confirmation, setConfirmation] = useState(null);
  const [profile, setProfile] = useState({ name: '', email: '' });
  
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [mediaItems, setMediaItems] = useState([]);
  const [slideDuration, setSlideDuration] = useState(5); 
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  
  const [overlayText, setOverlayText] = useState({
    title: "Authentic Traditional Fashion.",
    subtitle: "Elevate your everyday wardrobe with premium fabrics and modern cuts."
  });

  const navigate = useNavigate();
  const otpRefs = useRef([]); 

  useEffect(() => {
    document.body.classList.add('login-active');
    return () => document.body.classList.remove('login-active');
  }, []);
 
  useEffect(() => {
    const fetchMediaConfig = async () => {
      try {
        const docRef = doc(db, "settings", "login_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.mediaItems && data.mediaItems.length > 0) setMediaItems(data.mediaItems);
          if (data.slideDuration) setSlideDuration(data.slideDuration);
          
          if (data.title) setOverlayText(prev => ({ ...prev, title: data.title }));
          if (data.subtitle) setOverlayText(prev => ({ ...prev, subtitle: data.subtitle }));
        }
      } catch (err) {
        console.error("Failed to load login media settings:", err);
      }
    };
    fetchMediaConfig();
  }, []);

  useEffect(() => {
    if (mediaItems.length <= 1) return; 
    const interval = setInterval(() => {
      setCurrentMediaIndex((prevIndex) => (prevIndex + 1) % mediaItems.length);
    }, slideDuration * 1000); 
    return () => clearInterval(interval);
  }, [mediaItems, slideDuration]);

  useEffect(() => {
    if (view === 'login' && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => { }
      });
    }
  }, [view]);
 
  // 🔥 FIX: Added 'isGoogle' flag to handle routing differently based on your flowchart
  const checkExistingUser = async (user, isGoogle = false) => {
    try {
      localStorage.setItem('jamba_user_role', 'customer');
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists() && (docSnap.data().name || docSnap.data().ownerName)) {
        window.location.href = '/'; 
      } else {
        // 🔥 NEW ROUTING LOGIC FROM YOUR NOTES
        if (isGoogle) {
          // GOOGLE PATH: Create DB record silently and jump to Front Store
          const payload = {
            name: user.displayName || 'JAMBA Member',
            ownerName: user.displayName || 'JAMBA Member',
            email: user.email || '',
            role: "customer",
            uid: user.uid,
            createdAt: serverTimestamp()
          };
          await setDoc(docRef, payload, { merge: true });
          window.location.href = '/';
        } else {
          // MOBILE PATH: Stop at the "Name" form
          setView('profile');
          setLoading(false); 
        }
      }
    } catch (err) {
      console.error("Database Error:", err);
      setLoading(false);
      navigate('/'); 
    }
  };
 
  const handleGoogleLogin = async () => {
    if (!termsAccepted) return setError("Please accept the Terms and Conditions to continue.");
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const res = await signInWithPopup(auth, provider);
      // Send 'true' to flag that this is a Google login
      await checkExistingUser(res.user, true);
    } catch (err) { 
      setError(err.message); 
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!termsAccepted) return setError("Please accept the Terms and Conditions to continue.");
    
    let phoneStr = phone.replace(/\s/g, '');
    if (!phoneStr.startsWith('+')) phoneStr = '+91' + phoneStr; 

    const phoneRegex = /^\+91[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneStr)) {
      setError("Enter a valid 10-digit Indian number.");
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const appVerifier = window.recaptchaVerifier;
      const confirm = await signInWithPhoneNumber(auth, phoneStr, appVerifier);
      setConfirmation(confirm);
      setView('otp');
    } catch (err) { 
      setError("Failed to send OTP. Too many attempts or invalid number."); 
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await confirmation.confirm(otpString);
      // Send 'false' because this is a Mobile login
      await checkExistingUser(res.user, false);
    } catch (err) { 
      setError("Invalid OTP Code. Please try again."); 
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!profile.name.trim() || !profile.email.trim()) {
      setError("Name and Email are required.");
      return;
    }
    if (!emailRegex.test(profile.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Session expired. Please refresh the page and try again.");
        setLoading(false);
        return;
      }
      
      // 🔥 FIX: Update the Firebase Auth profile so the Navbar can read the name!
      await updateProfile(user, { displayName: profile.name.trim() });
      
      const payload = {
        name: profile.name.trim(), 
        ownerName: profile.name.trim(),
        email: profile.email.trim(), 
        role: "customer",
        uid: user.uid,
        createdAt: serverTimestamp() 
      };

      if (phone && phone !== '+91') {
        payload.phone = phone;
      }

      const savePromise = setDoc(doc(db, "users", user.uid), payload, { merge: true });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firebase timeout")), 6000)
      );

      await Promise.race([savePromise, timeoutPromise]);
      window.location.href = '/';
      
    } catch (err) {
      console.error("Save profile error:", err);
      setError("Failed to connect to the database. Please check your internet or refresh the page.");
      setLoading(false);
    }
  };
 
  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return;
    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);
    if (element.value && index < 5) otpRefs.current[index + 1].focus();
  };

  const handleOtpBackspace = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
    if (pastedData.some(isNaN)) return; 
    const newOtp = [...otp];
    pastedData.forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    const focusIndex = pastedData.length < 6 ? pastedData.length : 5;
    otpRefs.current[focusIndex].focus();
  };

  return (
    <div className="login-page-wrapper">
      
      <div className="login-image-side">
        {mediaItems.map((item, index) => (
          <div 
            key={index} 
            className={`media-slide ${index === currentMediaIndex ? 'active' : ''}`}
          >
            {item.type === 'video' || item.isVideo ? (
              <video src={item.url || item.image} autoPlay loop muted playsInline className="slide-media" />
            ) : (
              <img src={item.url || item.image} alt="Jamba Wear Fashion" className="slide-media" />
            )}
          </div>
        ))}

        <div className="image-overlay">
          <h2>{overlayText.title}</h2>
          <p>{overlayText.subtitle}</p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <div className="login-brand-logo" onClick={() => navigate('/')}>
            JAMBA<span>WEAR</span>
          </div>

          {error && <div className="error-message" role="alert" aria-live="assertive">{error}</div>}

          {view === 'login' && (
            <div className="fade-in">
              <h2 className="login-title">Welcome Back</h2>
              <p className="login-subtitle" style={{ marginBottom: '25px' }}>Sign in to access your orders, saved addresses, and exclusive offers.</p>

              <button 
                className="btn-google" 
                onClick={handleGoogleLogin} 
                disabled={loading || !termsAccepted} 
                style={{ opacity: !termsAccepted ? 0.5 : 1, cursor: !termsAccepted ? 'not-allowed' : 'pointer' }}
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="" aria-hidden="true" />
                {loading ? "Connecting..." : "Continue with Google"}
              </button>
              
              <div className="divider" aria-hidden="true" style={{ marginTop: '20px', marginBottom: '20px' }}>
                <span>OR CONTINUE WITH PHONE</span>
              </div>
              
              <div className="input-group">
                <label htmlFor="phoneInput">Mobile Number</label>
                <input id="phoneInput" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" disabled={loading} aria-invalid={!!error} />
              </div>
              
              <div id="recaptcha-container"></div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '20px', marginBottom: '20px', textAlign: 'left' }}>
                <input 
                  type="checkbox" 
                  id="termsCheck" 
                  checked={termsAccepted} 
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked) setError('');
                  }}
                  style={{ marginTop: '4px', cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                />
                <label htmlFor="termsCheck" style={{ fontSize: '12px', color: '#555', lineHeight: '1.4', cursor: 'pointer' }}>
                  By checking this box, I agree to JAMBA WEAR's <Link to="/terms" style={{ color: '#1a1a1a', fontWeight: 'bold' }}>Terms of Service</Link> and <Link to="/privacy" style={{ color: '#1a1a1a', fontWeight: 'bold' }}>Privacy Policy</Link>.
                </label>
              </div>
              
              <button 
                className="login-btn" 
                onClick={handleSendOTP} 
                disabled={loading || !termsAccepted}
                style={{ opacity: !termsAccepted ? 0.5 : 1, cursor: !termsAccepted ? 'not-allowed' : 'pointer' }}
              >
                {loading ? "Sending Code..." : "Get OTP"}
              </button>
            </div>
          )}
          
          {view === 'otp' && (
            <div className="fade-in">
              <h2 className="login-title">Verify Phone</h2>
              <p className="login-subtitle">We sent a secure 6-digit code to <strong>{phone}</strong></p>
              
              <div className="otp-group" onPaste={handleOtpPaste}>
                {otp.map((data, index) => (
                  <input key={index} type="text" inputMode="numeric" maxLength="1" value={data} ref={(el) => otpRefs.current[index] = el} onChange={(e) => handleOtpChange(e.target, index)} onKeyDown={(e) => handleOtpBackspace(e, index)} disabled={loading} className="otp-input" aria-label={`Digit ${index + 1}`} />
                ))}
              </div>
              
              <button className="login-btn" onClick={verifyOTP} disabled={loading || otp.join('').length !== 6}>
                {loading ? "Verifying..." : "Verify & Secure Login"}
              </button>
              
              <div className="toggle-mode">
                <span onClick={() => {setView('login'); setOtp(new Array(6).fill('')); setError('');}} className="toggle-link" role="button" tabIndex="0">
                  Entered wrong number? Go back
                </span>
              </div>
            </div>
          )}

          {view === 'profile' && (
            <div className="fade-in">
              <h2 className="login-title">Complete Your Profile</h2>
              <p className="login-subtitle">Just a few more details to finalize your JAMBA account.</p>
              
              <div className="input-group">
                <label htmlFor="nameInput">Full Name</label>
                <input id="nameInput" type="text" value={profile.name} onChange={(e) => setProfile({...profile, name: e.target.value})} placeholder="e.g. Rahul Boro" disabled={loading} />
              </div>
              
              <div className="input-group">
                <label htmlFor="emailInput">Email Address</label>
                <input id="emailInput" type="email" value={profile.email} onChange={(e) => setProfile({...profile, email: e.target.value})} placeholder="you@example.com" disabled={loading} />
              </div>
              
              <button className="login-btn" onClick={saveProfile} disabled={loading}>
                {loading ? "Saving..." : "Enter Store"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}