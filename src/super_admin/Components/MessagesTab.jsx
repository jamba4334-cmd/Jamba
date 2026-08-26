import React, { useState } from "react";
import { collection, doc, updateDoc, addDoc } from "firebase/firestore";
import "../styles/Messages.css";

export default function MessagesTab({ db, supportTickets, setSupportTickets, globalSellers }) {
    const [messageTab, setMessageTab] = useState("inbox");
    const [activeTicket, setActiveTicket] = useState(null);
    const [replyText, setReplyText] = useState("");

    const handleSendBroadcast = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('broadcast-btn');
        btn.disabled = true;
        btn.innerText = "Sending...";

        const targetEmail = document.getElementById('broadcast-target').value;
        const subject = document.getElementById('broadcast-subject').value;
        const message = document.getElementById('broadcast-message').value;

        try {
            const newTicketData = {
                sellerName: targetEmail === 'all' ? 'All Sellers' : globalSellers.find(s => s.email === targetEmail)?.profile?.brandName || targetEmail,
                email: targetEmail,
                subject: subject,
                status: 'open',
                date: new Date().toISOString(),
                messages: [{ sender: 'admin', text: message, time: new Date().toISOString() }]
            };
            
            const docRef = await addDoc(collection(db, "support_tickets"), newTicketData);
            setSupportTickets([{ id: docRef.id, ...newTicketData }, ...supportTickets]);
            if(window.showToast) window.showToast("Message Sent Successfully!");
            document.getElementById('broadcast-form').reset();
            setMessageTab('inbox');
        } catch (error) {
            alert("Error sending message: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "Send Message";
        }
    };

    const handleReplyTicket = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;

        try {
            const updatedMessages = [...activeTicket.messages, { sender: 'admin', text: replyText, time: new Date().toISOString() }];
            const ticketRef = doc(db, "support_tickets", activeTicket.id);
            await updateDoc(ticketRef, { messages: updatedMessages, status: 'open' });
            const updatedTicket = { ...activeTicket, messages: updatedMessages, status: 'open' };
            
            setActiveTicket(updatedTicket);
            setSupportTickets(supportTickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
            setReplyText('');
            
        } catch(error) {
            console.error(error);
            alert("Error replying to ticket: " + error.message);
        }
    };

    const markTicketResolved = async () => {
        try {
            const ticketRef = doc(db, "support_tickets", activeTicket.id);
            await updateDoc(ticketRef, { status: 'resolved' });
            const updatedTicket = { ...activeTicket, status: 'resolved' };
            setActiveTicket(updatedTicket);
            setSupportTickets(supportTickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
            if(window.showToast) window.showToast("Ticket marked as resolved.");
        } catch(error) {
            alert("Error resolving ticket: " + error.message);
        }
    };

    return (
        <div className="content-section active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span className="section-title">Communications Hub</span>
                <div className="filter-group">
                    <button type="button" className={`filter-btn ${messageTab === 'inbox' ? 'active' : ''}`} onClick={() => { setMessageTab('inbox'); setActiveTicket(null); }}>
                        Inbox 
                        {supportTickets.filter(t => t.status === 'open').length > 0 && <span style={{background:'var(--danger)', color:'white', padding:'2px 6px', borderRadius:'10px', fontSize:'10px', marginLeft:'4px'}}>{supportTickets.filter(t => t.status === 'open').length}</span>}
                    </button>
                    <button type="button" className={`filter-btn ${messageTab === 'broadcast' ? 'active' : ''}`} onClick={() => setMessageTab('broadcast')}>
                        <i className="fa-solid fa-paper-plane"></i> Send Broadcast
                    </button>
                </div>
            </div>

            {messageTab === 'inbox' && !activeTicket && (
                <div className="card">
                    <span className="section-subtitle">Support Tickets & Queries</span>
                    {supportTickets.length === 0 ? (
                        <p style={{color: 'var(--text-muted)'}}>No active messages from sellers.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {supportTickets.map(ticket => (
                                <div key={ticket.id} className="ticket-card" onClick={() => setActiveTicket(ticket)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>{ticket.subject}</strong>
                                        <span className={`ticket-status ${ticket.status}`}>{ticket.status === 'open' ? 'Needs Reply' : 'Resolved'}</span>
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '8px' }}>
                                        From: <strong>{ticket.sellerName}</strong> ({ticket.email})
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {new Date(ticket.date).toLocaleString()} | ID: {ticket.id}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {messageTab === 'inbox' && activeTicket && (
                <div className="card chat-view-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '16px' }}>
                        <div>
                            <button type="button" onClick={() => setActiveTicket(null)} className="action-btn" style={{marginBottom: '10px', fontSize:'12px', padding:'4px 8px'}}><i className="fa-solid fa-arrow-left"></i> Back to Inbox</button>
                            <h3 style={{ margin: 0, color: 'var(--primary)' }}>{activeTicket.subject}</h3>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{activeTicket.sellerName} ({activeTicket.email})</span>
                        </div>
                        {activeTicket.status === 'open' && (
                            <button type="button" onClick={markTicketResolved} className="action-btn btn-status-active">
                                <i className="fa-solid fa-check"></i> Mark Resolved
                            </button>
                        )}
                    </div>

                    <div className="chat-history-container">
                        {activeTicket.messages.map((msg, idx) => (
                            <div key={idx} className={`chat-bubble-wrapper ${msg.sender === 'admin' ? 'admin-bubble' : 'seller-bubble'}`}>
                                <div className="chat-bubble">
                                    {msg.text}
                                </div>
                                <span className="chat-time">{new Date(msg.time).toLocaleString([], {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'short'})}</span>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={handleReplyTicket} style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                        <input type="text" className="input-box" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your reply here..." required style={{flex: 1}} />
                        <button type="submit" className="btn-submit" style={{width: 'auto', margin: 0, padding: '10px 24px'}}>Reply</button>
                    </form>
                </div>
            )}

            {messageTab === 'broadcast' && (
                <form className="card" id="broadcast-form" onSubmit={handleSendBroadcast}>
                    <span className="section-subtitle">Send a Direct Message or Broadcast</span>
                    <p className="text-helper">Send an important update to all sellers or select a specific seller to communicate directly.</p>
                    
                    <div className="field-grid">
                        <div className="form-group">
                            <span className="label">To</span>
                            <select id="broadcast-target" className="input-box" required>
                                <option value="all">📣 ALL SELLERS (Broadcast)</option>
                                {(globalSellers || []).map(s => (
                                    <option key={s.email} value={s.email}>{s.profile?.brandName || s.email}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <span className="label">Subject</span>
                            <input type="text" id="broadcast-subject" className="input-box" placeholder="e.g. Action Required: Holiday Shipping Delay" required />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <span className="label">Message</span>
                        <textarea id="broadcast-message" className="input-box" style={{height: '150px'}} placeholder="Write your message here..." required></textarea>
                    </div>

                    <button type="submit" id="broadcast-btn" className="btn-submit">Send Message</button>
                </form>
            )}
        </div>
    );
}