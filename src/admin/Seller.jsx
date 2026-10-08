import React, { useEffect, useState } from "react";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, query, where } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

import { API_BASE_URL } from "../apiConfig.js"; 
import './Seller.css'; 

import OrdersTab from "./OrdersTab";
import LiveProductsTab from "./LiveProductsTab";
import AddProductTab from "./AddProductTab";
import StoreProfileTab from "./StoreProfileTab";
import PayoutsTab from "./PayoutsTab";
import ReviewsTab from "./ReviewsTab";
import MessagesTab from "./MessagesTab";
import SellerFooter from "./SellerFooter";
import SellerPromoTab from "./SellerPromoTab"; 

// 🔥 NEW: Import the Storefront and Subscription Tabs
import SellerSubscription from "./SellerSubscription";
import SellerStorefrontEditor from "./SellerStorefrontEditor";

// SECURED: Firebase Initialization using .env
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const appName = "jambawear-seller";
const app = getApps().some((firebaseApp) => firebaseApp.name === appName)
    ? getApp(appName)
    : initializeApp(firebaseConfig, appName);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const stateDistrictMap = {
    "Assam": ["Baksa", "Barpeta", "Biswanath"],
};

export default function SellerDashboard() {
    const [sellerEmail, setSellerEmail] = useState("");
    const [activeTab, setActiveTab] = useState("orders");
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [showLoginOverlay, setShowLoginOverlay] = useState(true);
    const [authError, setAuthError] = useState("");
    
    const [sellerOrders, setSellerOrders] = useState([]);
    const [sellerProducts, setSellerProducts] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    const [sellerProfile, setSellerProfile] = useState({}); 
    const [isProfileEditing, setIsProfileEditing] = useState(false); 
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false); 
    
    const [wallet, setWallet] = useState({ available: 0, pending: 0, withdrawn: 0 });
    const [payoutHistory, setPayoutHistory] = useState([]);

    const [selectedState, setSelectedState] = useState("");
    const [selectedDistrict, setSelectedDistrict] = useState("");
    const [selectedPickupState, setSelectedPickupState] = useState("");
    const [selectedPickupDistrict, setSelectedPickupDistrict] = useState("");
    const [sameAsPermanent, setSameAsPermanent] = useState(false);

    const [editingProductId, setEditingProductId] = useState(null);
    const [currentEditImageUrls, setCurrentEditImageUrls] = useState([null, null, null, null, null]);
    const [selectedFiles, setSelectedFiles] = useState([null, null, null, null, null]);
    
    const [currentEditVideoUrl, setCurrentEditVideoUrl] = useState("");
    const [selectedVideo, setSelectedVideo] = useState(null);
    
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [tempProfilePhoto, setTempProfilePhoto] = useState("");
    const [sellerReviews, setSellerReviews] = useState([]);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState("");
    const [fullscreenImage, setFullscreenImage] = useState(null);

    const [supportTickets, setSupportTickets] = useState([]);
    const [activeTicket, setActiveTicket] = useState(null);
    const [isCreatingTicket, setIsCreatingTicket] = useState(false);
    const [newTicketSubject, setNewTicketSubject] = useState("");
    const [ticketMessage, setTicketMessage] = useState("");

    useEffect(() => {
        window.showSection = (sectionId) => {
            setActiveTab(sectionId);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        window.showToast = (message) => {
            const toast = document.getElementById('toast-notification');
            if(toast) {
                toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
                toast.classList.add('show');
                setTimeout(() => { toast.classList.remove('show'); }, 3000);
            }
        };
        const handleClickOutside = (event) => {
            if (!event.target.closest('.header-profile-container')) setIsProfileMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setSellerEmail(user.email);
                try {
                    const docRef = doc(db, "authorized_sellers", user.email);
                    const docSnap = await getDoc(docRef);
                    if (!docSnap.exists()) {
                        await signOut(auth);
                        setAuthError("Unauthorized: Email not registered.");
                        setShowLoginOverlay(true);
                        setIsCheckingAuth(false);
                        return; 
                    }
                    setAuthError("");
                    setShowLoginOverlay(false);
                    
                    const profileRef = doc(db, "seller_profiles", user.email);
                    const profileSnap = await getDoc(profileRef);
                    let currentProfileData = {}; 

                    if (profileSnap.exists()) {
                        const data = profileSnap.data();
                        currentProfileData = data; 
                        setSellerProfile(data);
                        setTempProfilePhoto(data.profilePhoto || ""); 
                        setSameAsPermanent(data.sameAsPermanent || false);
                        setSelectedState(data.state || "");
                        setSelectedDistrict(data.district || "");
                        setSelectedPickupState(data.pickupState || "");
                        setSelectedPickupDistrict(data.pickupDistrict || "");
                        setIsProfileEditing(false); 
                    } else {
                        setIsProfileEditing(true); 
                    }

                    await loadSellerInventory(user.email); 
                    await loadSellerOrders(user.email, currentProfileData); 
                    await loadSellerReviews(user.email); 
                    await loadSupportTickets(user.email); 
                    setIsCheckingAuth(false);
                } catch (err) {
                    console.error("Verification failed", err);
                    setAuthError("Verification failed. Check Firebase Rules.");
                    setShowLoginOverlay(true);
                    setIsCheckingAuth(false);
                }
            } else {
                setShowLoginOverlay(true);
                setIsCheckingAuth(false);
            }
        });
        return () => unsubscribe();
    }, []); 

    const loadSellerInventory = async (email) => {
        try {
            const q = query(collection(db, "products"), where("sellerEmail", "==", email));
            const querySnapshot = await getDocs(q);
            let products = []; 
            querySnapshot.forEach((doc) => { products.push({ id: doc.id, docId: doc.id, ...doc.data() }); });
            setSellerProducts(products);
        } catch (err) { console.error("Inventory Load Error:", err); }
    };

    const loadSellerOrders = async (email, profileData) => {
        try {
            const q = query(collection(db, "orders"), where("sellerEmails", "array-contains", email));
            const querySnapshot = await getDocs(q);
            
            let ordersList = [];
            
            querySnapshot.forEach(document => {
                const orderData = document.data();
                
                if(orderData.items) {
                    const myFilteredItems = orderData.items.filter(orderItem => {
                        const matchEmail = orderItem.sellerEmail && orderItem.sellerEmail.toLowerCase() === email.toLowerCase();
                        const matchBrand = orderItem.brandName && profileData.brandName && orderItem.brandName.toLowerCase() === profileData.brandName.toLowerCase();
                        
                        return matchEmail || matchBrand;
                    });

                    if(myFilteredItems.length > 0) {
                        const mySubtotal = myFilteredItems.reduce((sum, item) => sum + ((item.price || item.selling_price || 0) * (item.quantity || 1)), 0);
                        ordersList.push({ 
                            id: document.id, 
                            ...orderData, 
                            items: myFilteredItems, 
                            sellerSubtotal: mySubtotal 
                        });
                    }
                }
            });

            ordersList.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
            
            setSellerOrders(ordersList);
            setLoadingData(false);
        } catch (error) { 
            console.error("Error loading orders:", error); 
            setLoadingData(false); 
        }
    };

    const loadSellerReviews = async (email) => {
        try {
            const q = query(collection(db, "reviews"), where("sellerEmail", "==", email));
            const querySnapshot = await getDocs(q);
            let loadedReviews = [];
            querySnapshot.forEach((doc) => { loadedReviews.push({ id: doc.id, ...doc.data() }); });
            loadedReviews.sort((a, b) => {
                const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return dateB - dateA;
            });
            setSellerReviews(loadedReviews);
        } catch (error) { console.error("Error fetching reviews:", error); }
    };

    const loadSupportTickets = async (email) => {
        try {
            const q = query(collection(db, "support_tickets"), where("email", "==", email));
            const querySnapshot = await getDocs(q);
            let tickets = [];
            querySnapshot.forEach((doc) => { tickets.push({ id: doc.id, ...doc.data() }); });
            tickets.sort((a, b) => new Date(b.date) - new Date(a.date));
            setSupportTickets(tickets);
        } catch (error) { console.error("Error loading tickets:", error); }
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        if (!newTicketSubject.trim() || !ticketMessage.trim()) return;
        try {
            const newTicket = {
                sellerName: sellerProfile.brandName || sellerEmail,
                email: sellerEmail,
                subject: newTicketSubject,
                status: 'open',
                date: new Date().toISOString(),
                messages: [{ sender: 'seller', text: ticketMessage, time: new Date().toISOString() }]
            };
            const docRef = await addDoc(collection(db, "support_tickets"), newTicket);
            setSupportTickets([{ id: docRef.id, ...newTicket }, ...supportTickets]);
            setIsCreatingTicket(false);
            setNewTicketSubject("");
            setTicketMessage("");
            if(window.showToast) window.showToast("Support ticket created!");
        } catch (error) { alert("Error creating ticket: " + error.message); }
    };

    const handleTicketReply = async (e) => {
        e.preventDefault();
        if (!ticketMessage.trim()) return;
        try {
            const updatedMessages = [...activeTicket.messages, { sender: 'seller', text: ticketMessage, time: new Date().toISOString() }];
            const ticketRef = doc(db, "support_tickets", activeTicket.id);
            await updateDoc(ticketRef, { messages: updatedMessages, status: 'open' });
            const updatedTicket = { ...activeTicket, messages: updatedMessages, status: 'open' };
            setActiveTicket(updatedTicket);
            setSupportTickets(supportTickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
            setTicketMessage("");
        } catch(error) { alert("Error replying to ticket: " + error.message); }
    };

    const handlePostReply = async (reviewId) => {
        if (!replyText.trim()) return;
        try {
            const reviewRef = doc(db, "reviews", reviewId);
            await updateDoc(reviewRef, { sellerReply: replyText, replyCreatedAt: new Date().toISOString() });
            setSellerReviews(sellerReviews.map(rev => rev.id === reviewId ? { ...rev, sellerReply: replyText } : rev));
            setReplyingTo(null);
            setReplyText("");
            if(window.showToast) window.showToast("Reply posted successfully!");
        } catch (error) { alert("Error posting reply: " + error.message); }
    };

    const acceptOrder = async (orderId) => {
        if(window.confirm("By accepting, you confirm you have this item in stock and will prepare it for pickup.")) {
            try {
                await updateDoc(doc(db, "orders", orderId), { seller_accepted: true, accepted_at: new Date().toISOString() });
                if(window.showToast) window.showToast("Order Accepted Successfully!");
                loadSellerOrders(sellerEmail, sellerProfile); 
            } catch(e) { alert("Error accepting order: " + e.message); }
        }
    };

    const handleSellerLogin = async () => {
        setAuthError(""); 
        try { await signInWithPopup(auth, provider); } catch (error) { setAuthError("Login failed: " + error.message); setShowLoginOverlay(true); }
    };

    const handleLogout = async () => {
        await signOut(auth);
        window.location.reload(); 
    };

    const getAuthHeaders = async () => {
        const user = auth.currentUser;
        if (user) {
            const token = await user.getIdToken();
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            };
        }
        return { 'Content-Type': 'application/json' };
    };

    const removeImageSlot = (index) => {
        let newFiles = [...selectedFiles];
        newFiles[index] = null;
        setSelectedFiles(newFiles);

        let newUrls = [...currentEditImageUrls];
        newUrls[index] = null;
        setCurrentEditImageUrls(newUrls);
    };

    const handleFileSelect = (e, index) => {
        const file = e.target.files[0];
        if (!file) return;
        
        let newFiles = [...selectedFiles];
        newFiles[index] = file;
        setSelectedFiles(newFiles);
        
        let newUrls = [...currentEditImageUrls];
        newUrls[index] = null; 
        setCurrentEditImageUrls(newUrls);
        
        e.target.value = ""; 
    };

    const handleVideoSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) {
            alert("Video must be under 15MB.");
            e.target.value = ""; return;
        }
        setSelectedVideo(file);
        e.target.value = "";
    };

    const removeVideo = () => {
        setSelectedVideo(null);
        setCurrentEditVideoUrl("");
    };

    const editProduct = (productId) => {
        const product = sellerProducts.find(p => p.id === productId || p.docId === productId);
        if (!product) return;

        setEditingProductId(product.id); 
        setActiveTab('add-product'); 

        setTimeout(() => {
            const payoutEl = document.getElementById('p-payout');
            if(payoutEl) payoutEl.value = product.seller_payout || "";

            const nameEl = document.getElementById('p-name');
            if(nameEl) nameEl.value = product.title || "";

            const origPriceEl = document.getElementById('p-original-price');
            if(origPriceEl) origPriceEl.value = product.original_price || product.selling_price || 0;

            const priceEl = document.getElementById('p-price');
            if(priceEl) priceEl.value = product.selling_price || 0;

            const stockEl = document.getElementById('p-stock');
            if(stockEl) stockEl.value = product.stock || 0;
            
            const parts = (product.category || "").split(' - ');
            const genEl = document.getElementById('p-gender');
            if(genEl) genEl.value = parts[1] ? parts[1].trim() : '';

            const catEl = document.getElementById('p-category');
            if(catEl) catEl.value = parts[0] ? parts[0].trim() : '';

            const colorEl = document.getElementById('p-color');
            if(colorEl) colorEl.value = product.color || "";

            const fabricEl = document.getElementById('p-fabric');
            if(fabricEl) fabricEl.value = product.fabric || "";

            const descEl = document.getElementById('p-desc');
            if(descEl) descEl.value = product.description || "";

            const codEl = document.getElementById('p-pay-cod');
            if(codEl) codEl.checked = product.allow_cod !== false; 

            const onlineEl = document.getElementById('p-pay-online');
            if(onlineEl) onlineEl.checked = product.allow_online !== false; 

            const polEl = document.getElementById('p-return-policy');
            if (polEl) polEl.value = product.return_policy || '7_day_return_replace';

            const weightEl = document.getElementById('p-weight');
            if(weightEl) weightEl.value = product.package_weight || "Under 500g";

            const dispatchEl = document.getElementById('p-dispatch');
            if(dispatchEl) dispatchEl.value = product.dispatch_time || "Ships in 2-3 Days";

            const tagsEl = document.getElementById('p-tags');
            if(tagsEl) tagsEl.value = product.search_tags || "";
            
            const careArr = Array.isArray(product.care_instructions) ? product.care_instructions : [];
            document.querySelectorAll('.p-care-chk').forEach(cb => { 
                cb.checked = careArr.includes(cb.value); 
            });

            if (product.sizing_type === 'free_size' && product.dimensions) {
                const lenEl = document.getElementById('p-length');
                if(lenEl) lenEl.value = product.dimensions.length || "";
                
                const widEl = document.getElementById('p-width');
                if(widEl) widEl.value = product.dimensions.width || "";
            } else if (product.sizing_type?.startsWith('chart_') && product.size_chart) {
                Object.keys(product.size_chart).forEach(s => {
                    const chk = document.getElementById(`sz-chk-${s}`);
                    if(chk) chk.checked = true;
                    
                    const szData = product.size_chart[s];
                    if (product.sizing_type === 'chart_top_standard') {
                        const chestEl = document.getElementById(`sz-${s}-chest`); if(chestEl) chestEl.value = szData.chest || "";
                        const shEl = document.getElementById(`sz-${s}-shoulder`); if(shEl) shEl.value = szData.shoulder || "";
                        const lenEl2 = document.getElementById(`sz-${s}-length`); if(lenEl2) lenEl2.value = szData.length || "";
                        const slvEl = document.getElementById(`sz-${s}-sleeve`); if(slvEl) slvEl.value = szData.sleeve || "";
                    } else if (product.sizing_type === 'chart_blouse') {
                        const bustEl = document.getElementById(`sz-${s}-bust`); if(bustEl) bustEl.value = szData.bust || "";
                        const waistEl = document.getElementById(`sz-${s}-waist`); if(waistEl) waistEl.value = szData.waist || "";
                        const shEl2 = document.getElementById(`sz-${s}-shoulder`); if(shEl2) shEl2.value = szData.shoulder || "";
                        const armEl = document.getElementById(`sz-${s}-armhole`); if(armEl) armEl.value = szData.armhole || "";
                    } else if (product.sizing_type === 'chart_bottom') {
                        const waistEl2 = document.getElementById(`sz-${s}-waist`); if(waistEl2) waistEl2.value = szData.waist || "";
                        const hipEl = document.getElementById(`sz-${s}-hip`); if(hipEl) hipEl.value = szData.hip || "";
                        const lenEl3 = document.getElementById(`sz-${s}-length`); if(lenEl3) lenEl3.value = szData.length || "";
                    }
                });
            }
        }, 150);

        const editUrls = [null, null, null, null, null];
        if (product.images && Array.isArray(product.images)) {
            product.images.forEach((url, idx) => {
                if (idx < 5) editUrls[idx] = url;
            });
        }
        setCurrentEditImageUrls(editUrls);
        setSelectedFiles([null, null, null, null, null]);
        
        setCurrentEditVideoUrl(product.video_url || "");
        setSelectedVideo(null);
    };

    const cancelEdit = () => {
        const form = document.getElementById('new-product-form');
        if (form) form.reset();
        
        const codEl = document.getElementById('p-pay-cod');
        if(codEl) codEl.checked = true; 
        
        const onlineEl = document.getElementById('p-pay-online');
        if(onlineEl) onlineEl.checked = true; 
        
        document.querySelectorAll('.p-care-chk').forEach(cb => cb.checked = false); 
        
        setEditingProductId(null);
        setCurrentEditImageUrls([null, null, null, null, null]);
        setSelectedFiles([null, null, null, null, null]);
        setCurrentEditVideoUrl("");
        setSelectedVideo(null);
        setIsUploading(false);
        setUploadProgress(0);
        setActiveTab('live-products');
    };

    const uploadFileWithProgress = (file, resourceType, totalFiles, completedFilesRef) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`);
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const fileFraction = e.loaded / e.total;
                    const overallPercentage = Math.round(((completedFilesRef.current + fileFraction) / totalFiles) * 100);
                    setUploadProgress(overallPercentage);
                }
            };
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    completedFilesRef.current += 1;
                    setUploadProgress(Math.round((completedFilesRef.current / totalFiles) * 100));
                    resolve(JSON.parse(xhr.responseText).secure_url);
                } else {
                    reject(new Error(`${resourceType} upload failed.`));
                }
            };
            
            xhr.onerror = () => reject(new Error("Network Error"));
            
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
            xhr.send(formData);
        });
    };

    const handleProductSubmit = async (e) => {
        e.preventDefault();

        if(!sellerProfile.brandName || !sellerProfile.sellerName || !selectedState) {
            alert("Please complete your Store Profile (Brand, Permanent & Pickup Location) before submitting a product!");
            setActiveTab('profile');
            return;
        }

        if (!selectedFiles[0] && !currentEditImageUrls[0]) {
            alert("Please upload at least the Front View image.");
            return;
        }

        const validFilesToUpload = selectedFiles.filter(f => f !== null);
        const totalFilesToUpload = validFilesToUpload.length + (selectedVideo ? 1 : 0);
        
        setIsUploading(true);
        setUploadProgress(0);
        let completedFilesRef = { current: 0 };

        try {
            let finalUrls = [];
            let finalVideoUrl = currentEditVideoUrl;

            for (let i = 0; i < 5; i++) {
                if (selectedFiles[i]) {
                    const url = await uploadFileWithProgress(selectedFiles[i], "image", totalFilesToUpload, completedFilesRef);
                    finalUrls.push(url);
                } else if (currentEditImageUrls[i]) {
                    finalUrls.push(currentEditImageUrls[i]);
                }
            }

            if (selectedVideo) {
                finalVideoUrl = await uploadFileWithProgress(selectedVideo, "video", totalFilesToUpload, completedFilesRef);
            }

            let sizingData = { sizing_type: null };
            const dept = document.getElementById('p-gender').value;
            const cat = document.getElementById('p-category').value;
            let currentSizingType = null;
            if (dept === 'Men' && ['Shirt', 'T-Shirt', 'Waistcoat'].includes(cat)) currentSizingType = 'chart_top_standard';
            if (dept === 'Men' && cat === 'Trouser') currentSizingType = 'chart_bottom';
            if (dept === 'Men' && cat === 'Gamsa') currentSizingType = 'free_size';
            if (dept === 'Women' && ['Shirt', 'T-Shirt', 'Waist Coat'].includes(cat)) currentSizingType = 'chart_top_standard';
            if (dept === 'Women' && cat === 'Blows') currentSizingType = 'chart_blouse';
            if (dept === 'Women' && cat === 'Trouser') currentSizingType = 'chart_bottom';
            if (dept === 'Women' && ['Dokhona', 'Fasra', 'Jwmgra'].includes(cat)) currentSizingType = 'free_size';
            if (dept === 'Accessories') currentSizingType = 'free_size';

            if (currentSizingType === 'free_size' && document.getElementById('p-length') && document.getElementById('p-width')) {
                sizingData.sizing_type = 'free_size';
                sizingData.dimensions = { length: document.getElementById('p-length').value, width: document.getElementById('p-width').value };
            } else if (currentSizingType?.startsWith('chart_')) {
                sizingData.sizing_type = currentSizingType;
                sizingData.size_chart = {};
                const possibleSizes = currentSizingType === 'chart_blouse' ? ['XS','S','M','L','XL','XXL'] : ['S','M','L','XL','XXL','XXXL'];
                
                possibleSizes.forEach(s => {
                    if (document.getElementById(`sz-chk-${s}`)?.checked) {
                        sizingData.size_chart[s] = {};
                        if (currentSizingType === 'chart_top_standard') {
                            sizingData.size_chart[s] = { chest: document.getElementById(`sz-${s}-chest`)?.value || "", shoulder: document.getElementById(`sz-${s}-shoulder`)?.value || "", length: document.getElementById(`sz-${s}-length`)?.value || "", sleeve: document.getElementById(`sz-${s}-sleeve`)?.value || "" };
                        } else if (currentSizingType === 'chart_blouse') {
                            sizingData.size_chart[s] = { bust: document.getElementById(`sz-${s}-bust`)?.value || "", waist: document.getElementById(`sz-${s}-waist`)?.value || "", shoulder: document.getElementById(`sz-${s}-shoulder`)?.value || "", armhole: document.getElementById(`sz-${s}-armhole`)?.value || "" };
                        } else if (currentSizingType === 'chart_bottom') {
                            sizingData.size_chart[s] = { waist: document.getElementById(`sz-${s}-waist`)?.value || "", hip: document.getElementById(`sz-${s}-hip`)?.value || "", length: document.getElementById(`sz-${s}-length`)?.value || "" };
                        }
                    }
                });
                sizingData.available_sizes = Object.keys(sizingData.size_chart);
            }

            const careInstructions = Array.from(document.querySelectorAll('.p-care-chk:checked')).map(cb => cb.value);

            const productData = {
                title: document.getElementById('p-name').value || "",
                original_price: parseFloat(document.getElementById('p-original-price').value) || 0,
                selling_price: parseFloat(document.getElementById('p-price').value) || 0,
                seller_payout: parseFloat(document.getElementById('p-payout').value) || 0,
                stock: parseInt(document.getElementById('p-stock').value) || 0, 
                category: (document.getElementById('p-category').value || "") + " - " + (document.getElementById('p-gender').value || ""),
                
                ...sizingData,
                
                return_policy: document.getElementById('p-return-policy')?.value || "7_day_return_replace", 
                package_weight: document.getElementById('p-weight')?.value || "Under 500g",
                dispatch_time: document.getElementById('p-dispatch')?.value || "Ships in 2-3 Days",
                care_instructions: careInstructions, 
                search_tags: document.getElementById('p-tags')?.value || "",
                
                images: finalUrls, 
                video_url: finalVideoUrl,
                description: document.getElementById('p-desc').value || "",
                color: document.getElementById('p-color').value || "",
                fabric: document.getElementById('p-fabric').value || "",
                brandName: sellerProfile.brandName || "",
                sellerName: sellerProfile.sellerName || "",
                sellerPhone: sellerProfile.primaryPhone || "",
                sellerEmail: sellerProfile.storeEmail || sellerEmail, 
                sellerAddress: sellerProfile.address || "",
                city: sellerProfile.town || "",
                district: sellerProfile.district || "",
                state: selectedState || "",
                pincode: sellerProfile.pincode || "",
                pickupAddress: sellerProfile.pickupAddress || "",
                pickupTown: sellerProfile.pickupTown || "",
                pickupDistrict: selectedPickupDistrict || "",
                pickupState: selectedPickupState || "",
                pickupPincode: sellerProfile.pickupPincode || "",
                allow_cod: document.getElementById('p-pay-cod').checked,
                allow_online: document.getElementById('p-pay-online').checked,
                approval_status: "pending", 
                isHidden: true,
                updated_at: new Date().toISOString()
            };

            if (editingProductId) {
                await updateDoc(doc(db, "products", editingProductId), productData);
                if(window.showToast) window.showToast("Product Updated & Sent for Approval!");
            } else {
                productData.item_id = "JW" + Date.now().toString().slice(-6);
                productData.created_at = new Date().toISOString();
                await addDoc(collection(db, "products"), productData);
                if(window.showToast) window.showToast("Product Submitted for Admin Approval!");
            }

            document.getElementById('new-product-form').reset();
            document.querySelectorAll('.p-care-chk').forEach(cb => cb.checked = false); 
            setEditingProductId(null);
            setCurrentEditImageUrls([null, null, null, null, null]);
            setSelectedFiles([null, null, null, null, null]);
            setCurrentEditVideoUrl("");
            setSelectedVideo(null);
            setActiveTab('live-products');
            loadSellerInventory(sellerEmail);
            
        } catch (err) { 
            alert("Error submitting product: " + err.message); 
        } finally { 
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleProfilePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const btnText = document.getElementById('profile-photo-btn-text');
        if(btnText) btnText.innerText = "Uploading...";
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.secure_url) {
                setTempProfilePhoto(data.secure_url);
                setSellerProfile(prev => ({...prev, profilePhoto: data.secure_url}));
                if(window.showToast) window.showToast("Photo uploaded! Click Save to confirm.");
            } else {
                throw new Error("Upload failed");
            }
        } catch (err) {
            alert("Image upload failed: " + err.message);
        } finally {
            if(btnText) btnText.innerText = "Change Photo";
            e.target.value = ""; 
        }
    };

    const handleProfileSave = async (e) => {
        e.preventDefault();
        const accNum = document.getElementById('bank-acc-num').value;
        const confirmAccNum = document.getElementById('bank-acc-num-confirm').value;
        const ifsc = document.getElementById('bank-ifsc').value;
        const confirmIfsc = document.getElementById('bank-ifsc-confirm').value;

        if (accNum !== confirmAccNum) return alert("Account Numbers do not match.");
        if (ifsc !== confirmIfsc) return alert("IFSC Codes do not match.");

        const btn = document.getElementById('save-profile-btn');
        btn.disabled = true;
        btn.innerText = 'Saving...';

        const profileData = {
            email: sellerEmail,
            profilePhoto: tempProfilePhoto,
            brandName: document.getElementById('prof-brand-name').value,
            sellerName: document.getElementById('prof-seller-name').value,
            storeEmail: document.getElementById('prof-email').value,
            primaryPhone: document.getElementById('prof-phone-1').value,
            secondaryPhone: document.getElementById('prof-phone-2').value,
            address: document.getElementById('prof-address').value,
            town: document.getElementById('prof-town').value,
            state: selectedState,
            district: selectedDistrict,
            pincode: document.getElementById('prof-pincode').value,
            pickupAddress: sameAsPermanent ? document.getElementById('prof-address').value : document.getElementById('pickup-address').value,
            pickupTown: sameAsPermanent ? document.getElementById('pickup-town').value : document.getElementById('pickup-town').value,
            pickupState: sameAsPermanent ? selectedState : selectedPickupState,
            pickupDistrict: sameAsPermanent ? selectedDistrict : selectedPickupDistrict,
            pickupPincode: sameAsPermanent ? document.getElementById('prof-pincode').value : document.getElementById('pickup-pincode').value,
            sameAsPermanent: sameAsPermanent,
            bankName: document.getElementById('bank-name').value,
            accName: document.getElementById('bank-acc-name').value,
            accNumber: accNum,
            ifsc: ifsc,
            updated_at: new Date().toISOString()
        };

        try {
            await setDoc(doc(db, "seller_profiles", sellerEmail), profileData);
            setSellerProfile(profileData); 
            setIsProfileEditing(false); 
            if(window.showToast) window.showToast("Store Profile Saved!");
        } catch (err) {
            alert("Failed to save profile.");
        } finally {
            btn.disabled = false;
            btn.innerText = 'Save Profile Details';
        }
    };

    return (
        <div className="seller-isolated-wrapper">
            <div id="toast-notification" className="toast-notification"></div>

            {showLoginOverlay && (
                <div id="login-overlay" style={{ display: 'flex' }}>
                    <div className="login-box" style={{ textAlign: 'center' }}>
                        <h2><span style={{ color: 'var(--accent)' }}>JAMBA</span>WEAR</h2>
                        <h3 style={{ color: 'var(--text-main)', marginBottom: '10px', fontSize: '16px' }}>Seller Dashboard</h3>
                        <p>Log in to manage your inventory and orders.</p>
                        
                        {authError && (
                            <div className="login-error" style={{ display: 'block', marginBottom: '15px' }}>
                                <i className="fa-solid fa-triangle-exclamation"></i> {authError}
                            </div>
                        )}
                        
                        <button type="button" className="btn-submit" onClick={handleSellerLogin} style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <i className="fa-brands fa-google"></i> Sign In With Google
                        </button>
                    </div>
                </div>
            )}

            <header className="seller-top-header">
                <div className="logo-block">
                    <div className="logo-jamba">JAMBA</div>
                    <div className="logo-sub">SELLER DASHBOARD</div>
                </div>

                <div className="header-profile-container">
                    <div className="header-profile-trigger" onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                        {sellerProfile.profilePhoto ? (
                            <img src={sellerProfile.profilePhoto} alt="Logo" className="header-avatar" />
                        ) : (
                            <div className="header-avatar-placeholder">
                                {sellerProfile.brandName ? sellerProfile.brandName.charAt(0).toUpperCase() : 'S'}
                            </div>
                        )}
                        <div className="header-brand-details" style={{ justifyContent: 'center' }}>
                            <span className="header-brand-name" style={{ fontSize: '15px' }}>{sellerProfile.brandName || "Setup Profile"}</span>
                        </div>
                        <i className={`fa-solid fa-chevron-${isProfileMenuOpen ? 'up' : 'down'} header-chevron`}></i>
                    </div>

                    {isProfileMenuOpen && (
                        <div className="header-profile-dropdown">
                            <div className="dropdown-menu-item" onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }}>
                                <i className="fa-solid fa-user-gear"></i> Store Profile
                            </div>
                            <div className="dropdown-menu-item text-danger" onClick={handleLogout}>
                                <i className="fa-solid fa-arrow-right-from-bracket"></i> Logout
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <nav className="seller-tab-bar">
                <ul className="nav-menu">
                    <li className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}><i className="fa-solid fa-truck"></i> My Orders</li>
                    <li className={`nav-item ${activeTab === 'live-products' ? 'active' : ''}`} onClick={() => setActiveTab('live-products')}><i className="fa-solid fa-layer-group"></i> Live Products</li>
                    <li className={`nav-item ${activeTab === 'add-product' ? 'active' : ''}`} onClick={() => setActiveTab('add-product')}><i className="fa-solid fa-plus"></i> Submit Product</li>
                    <li className={`nav-item ${activeTab === 'payouts' ? 'active' : ''}`} onClick={() => setActiveTab('payouts')}><i className="fa-solid fa-wallet"></i> Earnings & Payouts</li>
                    
                    {/* 🔥 NEW: Storefront and Subscription Tabs */}
                    <li className={`nav-item ${activeTab === 'storefront' ? 'active' : ''}`} onClick={() => setActiveTab('storefront')}><i className="fa-solid fa-palette"></i> Storefront Editor</li>
                    <li className={`nav-item ${activeTab === 'subscription' ? 'active' : ''}`} onClick={() => setActiveTab('subscription')}><i className="fa-solid fa-crown"></i> Subscriptions</li>

                    <li className={`nav-item ${activeTab === 'promos' ? 'active' : ''}`} onClick={() => setActiveTab('promos')}><i className="fa-solid fa-ticket"></i> Promo Codes</li>
                    <li className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}><i className="fa-solid fa-star"></i> Customer Reviews</li>
                    <li className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}><i className="fa-solid fa-headset"></i> Support</li>
                </ul>
            </nav>

            <div className="main-pannel">
                <OrdersTab isActive={activeTab === 'orders'} sellerOrders={sellerOrders} loadingData={loadingData} acceptOrder={acceptOrder} />
                <LiveProductsTab isActive={activeTab === 'live-products'} sellerProducts={sellerProducts} loadingData={loadingData} setActiveTab={setActiveTab} editProduct={editProduct} />
                
                <AddProductTab 
                    isActive={activeTab === 'add-product'} 
                    handleProductSubmit={handleProductSubmit} 
                    editingProductId={editingProductId} 
                    cancelEdit={cancelEdit} 
                    currentEditImageUrls={currentEditImageUrls} 
                    selectedFiles={selectedFiles} 
                    removeImageSlot={removeImageSlot} 
                    handleFileSelect={handleFileSelect} 
                    currentEditVideoUrl={currentEditVideoUrl}
                    selectedVideo={selectedVideo}
                    handleVideoSelect={handleVideoSelect}
                    removeVideo={removeVideo}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                />
                
                <StoreProfileTab isActive={activeTab === 'profile'} isProfileEditing={isProfileEditing} setIsProfileEditing={setIsProfileEditing} sellerProfile={sellerProfile} tempProfilePhoto={tempProfilePhoto} handleProfilePhotoUpload={handleProfilePhotoUpload} handleProfileSave={handleProfileSave} selectedState={selectedState} setSelectedState={setSelectedState} selectedDistrict={selectedDistrict} setSelectedDistrict={setSelectedDistrict} sameAsPermanent={sameAsPermanent} setSameAsPermanent={setSameAsPermanent} selectedPickupState={selectedPickupState} setSelectedPickupState={setSelectedPickupState} selectedPickupDistrict={selectedPickupDistrict} setSelectedPickupDistrict={setSelectedPickupDistrict} stateDistrictMap={stateDistrictMap} />
                
                <PayoutsTab isActive={activeTab === 'payouts'} getAuthHeaders={getAuthHeaders} sellerProfile={sellerProfile} />

                {activeTab === 'promos' && <SellerPromoTab getAuthHeaders={getAuthHeaders} />}
                
                {/* 🔥 FIXED: Now passing getAuthHeaders and sellerEmail into the Storefront component */}
                {activeTab === 'storefront' && <SellerStorefrontEditor getAuthHeaders={getAuthHeaders} sellerEmail={sellerEmail} />}

                {activeTab === 'subscription' && <SellerSubscription />}

                <ReviewsTab isActive={activeTab === 'reviews'} sellerReviews={sellerReviews} replyingTo={replyingTo} setReplyingTo={setReplyingTo} replyText={replyText} setReplyText={setReplyText} handlePostReply={handlePostReply} setFullscreenImage={setFullscreenImage} />
                <MessagesTab isActive={activeTab === 'messages'} isCreatingTicket={isCreatingTicket} setIsCreatingTicket={setIsCreatingTicket} handleCreateTicket={handleCreateTicket} newTicketSubject={newTicketSubject} setNewTicketSubject={setNewTicketSubject} ticketMessage={ticketMessage} setTicketMessage={setTicketMessage} activeTicket={activeTicket} setActiveTicket={setActiveTicket} handleTicketReply={handleTicketReply} supportTickets={supportTickets} />
                
                {fullscreenImage && (
                    <div className="image-lightbox-overlay" onClick={() => setFullscreenImage(null)}>
                        <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
                            <button className="image-lightbox-close" onClick={() => setFullscreenImage(null)}>✕</button>
                            <img src={fullscreenImage} alt="Fullscreen Review" />
                        </div>
                    </div>
                )}

                <SellerFooter />
            </div>
        </div>
    );
}