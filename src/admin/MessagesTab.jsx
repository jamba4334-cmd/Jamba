import React, { useState } from 'react'; // 🔥 Added useState
import './MessagesTab.css';

export default function MessagesTab({
    isActive,
    isCreatingTicket, setIsCreatingTicket,
    handleCreateTicket,
    newTicketSubject, setNewTicketSubject,
    ticketMessage, setTicketMessage,
    activeTicket, setActiveTicket,
    handleTicketReply,
    supportTickets,
    isSubmittingTicket, // 🔥 NEW PROP
    refreshTickets      // 🔥 NEW PROP
}) {
    const [isRefreshing, setIsRefreshing] = useState(false); // 🔥 Added loading state for animation

    if (!isActive) return null;

    // 🔥 Wrapper to add a spinning animation while it fetches
    const handleRefresh = async () => {
        setIsRefreshing(true);
        if (refreshTickets) await refreshTickets();
        setTimeout(() => setIsRefreshing(false), 500); // Brief delay so the spin is visible
    };

    return (
        <div id="messages" className="content-section active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span className="section-title">Support & Messages</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    
                    {/* 🔥 REFRESH BUTTON PLACED HERE */}
                    <button 
                        type="button" 
                        className="action-btn" 
                        onClick={handleRefresh} 
                        style={{ margin: 0, padding: '8px 16px', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1' }}
                    >
                        <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'fa-spin' : ''}`}></i> Refresh
                    </button>

                    <button type="button" className="action-btn" onClick={() => setIsCreatingTicket(true)} style={{ margin: 0 }}>
                        <i className="fa-solid fa-plus"></i> New Support Ticket
                    </button>
                </div>
            </div>

            {isCreatingTicket ? (
                <form className="card" onSubmit={handleCreateTicket}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <span className="section-subtitle" style={{ margin: 0, border: 'none', padding: 0 }}>Contact Administration</span>
                        <button type="button" onClick={() => setIsCreatingTicket(false)} className="action-btn" style={{ fontSize: '12px' }}>Cancel</button>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <span className="label">Subject</span>
                        <input 
                            type="text" 
                            value={newTicketSubject} 
                            onChange={(e) => setNewTicketSubject(e.target.value)} 
                            className="input-box" 
                            placeholder="e.g. Question about my recent payout" 
                            required 
                            disabled={isSubmittingTicket} // 🔥 Locks input during submit
                        />
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <span className="label">Message</span>
                        <textarea 
                            value={ticketMessage} 
                            onChange={(e) => setTicketMessage(e.target.value)} 
                            className="input-box" 
                            style={{ height: '120px' }} 
                            placeholder="Provide details here..." 
                            required
                            disabled={isSubmittingTicket} // 🔥 Locks input during submit
                        ></textarea>
                    </div>
                    
                    <button 
                        type="submit" 
                        className="btn-submit" 
                        style={{ margin: 0, width: 'auto', padding: '10px 24px' }}
                        disabled={isSubmittingTicket} // 🔥 Prevents spam clicks
                    >
                        {isSubmittingTicket ? "Submitting..." : "Submit Ticket"}
                    </button>
                </form>
            ) : activeTicket ? (
                <div className="card chat-view-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '16px' }}>
                        <div>
                            <button type="button" onClick={() => setActiveTicket(null)} className="action-btn" style={{marginBottom: '10px', fontSize:'12px', padding:'4px 8px'}}>
                                <i className="fa-solid fa-arrow-left"></i> Back to Inbox
                            </button>
                            <h3 style={{ margin: 0, color: 'var(--primary)' }}>{activeTicket.subject}</h3>
                        </div>
                        <span className={`ticket-status ${activeTicket.status}`}>
                            {activeTicket.status === 'open' ? 'Open Ticket' : 'Resolved'}
                        </span>
                    </div>

                    <div className="chat-history-container">
                        {activeTicket.messages?.map((msg, idx) => (
                            <div key={idx} className={`chat-bubble-wrapper ${msg.sender === 'seller' ? 'seller-bubble' : 'admin-bubble'}`}>
                                <div className="chat-bubble">
                                    {msg.text}
                                </div>
                                <span className="chat-time">
                                    {new Date(msg.time).toLocaleString([], {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'short'})}
                                </span>
                            </div>
                        ))}
                    </div>

                    {activeTicket.status === 'open' && (
                        <form onSubmit={handleTicketReply} style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                            <input 
                                type="text" 
                                value={ticketMessage} 
                                onChange={(e) => setTicketMessage(e.target.value)} 
                                className="input-box" 
                                placeholder="Type your reply here..." 
                                required 
                                style={{flex: 1}} 
                            />
                            <button type="submit" className="btn-submit" style={{width: 'auto', margin: 0, padding: '10px 24px'}}>
                                Reply
                            </button>
                        </form>
                    )}
                </div>
            ) : (
                <div className="card">
                    <span className="section-subtitle">Your Tickets</span>
                    {supportTickets.length === 0 ? (
                        <p style={{color: 'var(--text-muted)'}}>You have no support tickets.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {supportTickets.map(ticket => (
                                <div key={ticket.id} className="ticket-card" onClick={() => setActiveTicket(ticket)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <strong style={{ color: 'var(--primary)', fontSize: '15px' }}>{ticket.subject}</strong>
                                        <span className={`ticket-status ${ticket.status}`}>
                                            {ticket.status === 'open' ? 'Open' : 'Resolved'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        Last updated: {ticket.messages && ticket.messages.length > 0 
                                            ? new Date(ticket.messages[ticket.messages.length - 1].time).toLocaleString() 
                                            : new Date(ticket.date).toLocaleString()} | ID: {ticket.id}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}