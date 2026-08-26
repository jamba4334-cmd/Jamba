import React, { useState, useEffect, useMemo } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    deleteDoc
} from "firebase/firestore";
import "../styles/MasterControl.css";

/* =========================================================
   HELPERS
   ========================================================= */

const PILLARS = [
    { id: "active",   label: "Active",   icon: "fa-solid fa-signal" },
    { id: "accesses", label: "Accesses", icon: "fa-solid fa-clock" },
    { id: "admin",    label: "Admin",    icon: "fa-solid fa-user-shield" },
    { id: "history",  label: "History",  icon: "fa-solid fa-clock-rotate-left" }
];

const QUICK_PASSES = [
    { label: "30 min", minutes: 30 },
    { label: "1 hour", minutes: 60 },
    { label: "2 hours", minutes: 120 },
    { label: "Full day", minutes: 480 }
];

const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const initials = (admin) => {
    const first = (admin.firstName || "").trim();
    const last = (admin.lastName || "").trim();
    if (first && first.toLowerCase() !== "pending") {
        return `${first[0]}${last ? last[0] : ""}`.toUpperCase();
    }
    return (admin.email || "?").slice(0, 2).toUpperCase();
};

const displayName = (admin) => {
    const first = (admin.firstName || "").trim();
    if (!first || first.toLowerCase() === "pending") return "Awaiting first login";
    return `${first} ${(admin.lastName || "").trim()}`.trim();
};

const minutesToText = (minutes) => {
    const value = Number(minutes);
    if (!value || value <= 0) return "no limit";
    if (value < 60) return `${value} min`;
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    return rest ? `${hours}h ${rest}m` : `${hours} hour${hours > 1 ? "s" : ""}`;
};

const minutesOfDay = (hhmm) => {
    if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return null;
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
};

const isWithinWindow = (admin, now) => {
    const start = minutesOfDay(admin.accessStartTime);
    const end = minutesOfDay(admin.accessEndTime);
    if (start === null || end === null) return true;
    const current = now.getHours() * 60 + now.getMinutes();
    return start <= end
        ? current >= start && current <= end
        : current >= start || current <= end;
};

const formatClock = (totalSeconds) => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const relativeTime = (date, now) => {
    if (!date) return "";
    const diff = Math.max(0, now.getTime() - date.getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 30 ? `${days}d ago` : date.toLocaleDateString();
};

const actionTone = (action = "") => {
    const value = action.toUpperCase();
    if (value.includes("LOGIN")) return "ok";
    if (value.includes("TERMINAT") || value.includes("DELETE") || value.includes("REJECT")) return "danger";
    if (value.includes("LOGOUT")) return "warn";
    if (value.includes("EDIT") || value.includes("UPDATE") || value.includes("STATUS")) return "ink";
    return "";
};

const notify = (message) => {
    if (typeof window !== "undefined" && window.showToast) window.showToast(message);
};

/* =========================================================
   MASTER CONTROL
   ========================================================= */

export default function MasterControlTab({ db }) {
    const [pillar, setPillar] = useState("active");
    const [subAdmins, setSubAdmins] = useState([]);
    const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
    const [now, setNow] = useState(() => new Date());

    const [newEmail, setNewEmail] = useState("");
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const [savedId, setSavedId] = useState(null);

    const [logs, setLogs] = useState([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [logTarget, setLogTarget] = useState("all");
    const [logSearch, setLogSearch] = useState("");
    const [logAction, setLogAction] = useState("all");

    /* ---------- live roster ---------- */
    useEffect(() => {
        if (!db) return undefined;
        const unsubscribe = onSnapshot(
            query(collection(db, "admin_users")),
            (snapshot) => {
                const rows = [];
                snapshot.forEach((snap) => rows.push({ id: snap.id, ...snap.data() }));
                rows.sort((a, b) => {
                    if (!!b.isOnline !== !!a.isOnline) return b.isOnline ? 1 : -1;
                    return (a.email || "").localeCompare(b.email || "");
                });
                setSubAdmins(rows);
                setIsLoadingAdmins(false);
            },
            (error) => {
                console.error("Master Control roster error:", error);
                setIsLoadingAdmins(false);
            }
        );
        return () => unsubscribe();
    }, [db]);

    /* ---------- ticking clock ---------- */
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    /* ---------- audit logs ---------- */
    useEffect(() => {
        if (!db || pillar !== "history") return;
        let cancelled = false;

        const load = async () => {
            setIsLoadingLogs(true);
            try {
                const base = collection(db, "admin_audit_logs");
                const q = logTarget === "all"
                    ? query(base, orderBy("timestamp", "desc"))
                    : query(base, where("email", "==", logTarget), orderBy("timestamp", "desc"));
                const snapshot = await getDocs(q);
                const rows = [];
                snapshot.forEach((snap) => rows.push({ id: snap.id, ...snap.data() }));
                if (!cancelled) setLogs(rows);
            } catch (error) {
                console.error("Master Control audit error:", error);
                if (!cancelled) setLogs([]);
            } finally {
                if (!cancelled) setIsLoadingLogs(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [db, pillar, logTarget]);

    /* ---------- derived ---------- */
    const onlineAdmins = useMemo(() => subAdmins.filter((a) => a.isOnline), [subAdmins]);
    const offlineAdmins = useMemo(() => subAdmins.filter((a) => !a.isOnline), [subAdmins]);
    const authorizedCount = useMemo(() => subAdmins.filter((a) => a.isAuthorized).length, [subAdmins]);
    const revokedCount = subAdmins.length - authorizedCount;
    const openWindows = useMemo(
        () => subAdmins.filter((a) => a.isAuthorized && isWithinWindow(a, now)).length,
        [subAdmins, now]
    );

    const actionTypes = useMemo(() => {
        const set = new Set();
        logs.forEach((log) => { if (log.action) set.add(String(log.action).toUpperCase()); });
        return Array.from(set).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        const term = logSearch.trim().toLowerCase();
        return logs.filter((log) => {
            if (logAction !== "all" && String(log.action || "").toUpperCase() !== logAction) return false;
            if (!term) return true;
            const haystack = [log.action, log.email, log.details, log.target, log.description]
                .filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(term);
        });
    }, [logs, logAction, logSearch]);

    const groupedLogs = useMemo(() => {
        const groups = [];
        filteredLogs.forEach((log) => {
            const date = toDate(log.timestamp);
            const key = date ? date.toDateString() : "Unknown date";
            const last = groups[groups.length - 1];
            if (last && last.key === key) last.items.push(log);
            else groups.push({ key, date, items: [log] });
        });
        return groups;
    }, [filteredLogs]);

    /* ---------- writes ---------- */
    const flashSaved = (id) => {
        setSavedId(id);
        setTimeout(() => setSavedId((current) => (current === id ? null : current)), 1200);
    };

    const patchAdmin = async (adminId, patch) => {
        try {
            await updateDoc(doc(db, "admin_users", adminId), patch);
            flashSaved(adminId);
        } catch (error) {
            console.error("Master Control update failed:", error);
            alert("Could not save that change: " + error.message);
        }
    };

    const handleAuthorize = async (event) => {
        event.preventDefault();
        const email = newEmail.trim().toLowerCase();
        if (!email) return alert("Please provide a Gmail address.");
        if (subAdmins.some((a) => (a.email || "").toLowerCase() === email)) {
            return alert("That email is already in the ledger.");
        }

        setIsAuthorizing(true);
        try {
            await setDoc(doc(collection(db, "admin_users")), {
                email,
                firstName: "Pending",
                lastName: "Registration...",
                isAuthorized: true,
                isOnline: false,
                forceLogout: false,
                accessStartTime: "00:00",
                accessEndTime: "23:59",
                maxDuration: 60,
                createdAt: new Date().toISOString()
            });
            setNewEmail("");
            notify("Email authorized. Their name fills in on first login.");
        } catch (error) {
            console.error("Master Control authorize failed:", error);
            alert("Failed to authorize this admin: " + error.message);
        } finally {
            setIsAuthorizing(false);
        }
    };

    const handleTerminate = async (admin) => {
        if (!window.confirm(`Terminate the live session for ${admin.email}?`)) return;
        await patchAdmin(admin.id, { forceLogout: true });
        notify("Termination signal sent.");
    };

    const handleDeauthorize = async (admin) => {
        if (!window.confirm(`Revoke access for ${admin.email}? They will be signed out instantly.`)) return;
        await patchAdmin(admin.id, { isAuthorized: false, forceLogout: true });
        notify("Access revoked.");
    };

    const handleReauthorize = async (admin) => {
        await patchAdmin(admin.id, { isAuthorized: true, forceLogout: false });
        notify("Access restored.");
    };

    const handleDelete = async (admin) => {
        if (!window.confirm(`Permanently delete ${admin.email} from the admin ledger? This cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, "admin_users", admin.id));
            notify("Admin removed from the ledger.");
        } catch (error) {
            console.error("Master Control delete failed:", error);
            alert("Failed to delete this admin: " + error.message);
        }
    };

    const openHistoryFor = (email) => {
        setLogTarget(email);
        setLogAction("all");
        setLogSearch("");
        setPillar("history");
    };

    /* =========================================================
       RENDER
       ========================================================= */

    return (
        <div className="content-section active master-control-container">

            {/* ---------- Command header ---------- */}
            <div className="mc-command">
                <div className="mc-command-top">
                    <div>
                        <span className="mc-eyebrow">God Mode</span>
                        <h2 className="mc-title">Master Control</h2>
                        <p className="mc-sub">
                            Live sessions, time-gated passes, the admin ledger and the full action trail — one room.
                        </p>
                    </div>
                    <div className="mc-clock">
                        <div className="mc-clock-time">
                            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                        <div className="mc-clock-date">
                            {now.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" })}
                        </div>
                    </div>
                </div>

                <div className="mc-stat-strip">
                    <div className="mc-stat">
                        <div className="mc-stat-label">Authorized</div>
                        <div className="mc-stat-value">{authorizedCount}</div>
                    </div>
                    <div className="mc-stat">
                        <div className="mc-stat-label">Online now</div>
                        <div className={`mc-stat-value${onlineAdmins.length ? " is-live" : ""}`}>
                            {onlineAdmins.length ? <span className="mc-dot live" /> : null}
                            {onlineAdmins.length}
                        </div>
                    </div>
                    <div className="mc-stat">
                        <div className="mc-stat-label">Open windows</div>
                        <div className="mc-stat-value">{openWindows}</div>
                    </div>
                    <div className="mc-stat">
                        <div className="mc-stat-label">Revoked</div>
                        <div className="mc-stat-value">{revokedCount}</div>
                    </div>
                </div>
            </div>

            {/* ---------- Pillar nav ---------- */}
            <div className="mc-nav">
                {PILLARS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`mc-pill${pillar === item.id ? " active" : ""}`}
                        onClick={() => setPillar(item.id)}
                    >
                        <i className={item.icon}></i>
                        {item.label}
                        {item.id === "active" && onlineAdmins.length > 0 && (
                            <span className="mc-pill-count">{onlineAdmins.length}</span>
                        )}
                        {item.id === "admin" && subAdmins.length > 0 && (
                            <span className="mc-pill-count">{subAdmins.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {isLoadingAdmins && (
                <div className="mc-empty">
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Reading the admin ledger…
                </div>
            )}

            {/* =========================================================
                PILLAR 1 — ACTIVE
               ========================================================= */}
            {!isLoadingAdmins && pillar === "active" && (
                <div className="mc-split">
                    <div>
                        <div className="mc-section-head">
                            <span className="mc-section-title">Live sessions</span>
                            <span className="mc-section-note">Updates in real time</span>
                        </div>

                        {onlineAdmins.length === 0 ? (
                            <div className="mc-empty">
                                <i className="fa-regular fa-moon"></i>
                                Nobody is signed in right now.
                            </div>
                        ) : (
                            onlineAdmins.map((admin) => {
                                const started = toDate(admin.sessionStart) || toDate(admin.lastLogin);
                                const elapsedSeconds = started ? (now.getTime() - started.getTime()) / 1000 : null;
                                const limit = Number(admin.maxDuration) || 0;
                                const remaining = limit && elapsedSeconds !== null
                                    ? Math.max(0, limit * 60 - elapsedSeconds)
                                    : null;
                                const pct = limit && elapsedSeconds !== null
                                    ? Math.min(100, (elapsedSeconds / (limit * 60)) * 100)
                                    : 0;
                                const tone = pct >= 90 ? "danger" : pct >= 70 ? "warn" : "";

                                return (
                                    <div key={admin.id} className="mc-live-card">
                                        <div className="mc-live-top">
                                            <div className="mc-identity">
                                                <div className="mc-avatar live">{initials(admin)}</div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div className="mc-name">{displayName(admin)}</div>
                                                    <div className="mc-email">{admin.email}</div>
                                                </div>
                                            </div>
                                            <span className="mc-badge ok">
                                                <span className="mc-dot live" /> Live
                                            </span>
                                        </div>

                                        <div className="mc-live-meta">
                                            <div>
                                                <div className="mc-meta-label">Signed in</div>
                                                <div className="mc-meta-value">
                                                    {started
                                                        ? started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                                        : "—"}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="mc-meta-label">Elapsed</div>
                                                <div className="mc-meta-value">
                                                    {elapsedSeconds !== null ? formatClock(elapsedSeconds) : "—"}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="mc-meta-label">Remaining</div>
                                                <div className={`mc-meta-value ${tone}`}>
                                                    {remaining !== null ? formatClock(remaining) : "No limit"}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="mc-meta-label">Pass</div>
                                                <div className="mc-meta-value">{minutesToText(admin.maxDuration)}</div>
                                            </div>
                                        </div>

                                        {limit > 0 && (
                                            <div className="mc-track">
                                                <div className={`mc-track-fill ${tone}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        )}

                                        <div className="mc-live-actions">
                                            <button type="button" className="mc-btn danger" onClick={() => handleTerminate(admin)}>
                                                <i className="fa-solid fa-power-off"></i> Terminate session
                                            </button>
                                            <button type="button" className="mc-btn ghost" onClick={() => openHistoryFor(admin.email)}>
                                                <i className="fa-solid fa-clock-rotate-left"></i> Track history
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="mc-roster">
                        <div className="mc-section-head">
                            <span className="mc-section-title">Offline roster</span>
                            <span className="mc-section-note">{offlineAdmins.length} idle</span>
                        </div>

                        {offlineAdmins.length === 0 ? (
                            <div className="mc-section-note">Everyone authorized is currently online.</div>
                        ) : (
                            offlineAdmins.map((admin) => (
                                <div key={admin.id} className="mc-roster-row">
                                    <div className="mc-identity">
                                        <div className="mc-avatar">{initials(admin)}</div>
                                        <div style={{ minWidth: 0 }}>
                                            <div className="mc-name">{displayName(admin)}</div>
                                            <div className="mc-email">{admin.email}</div>
                                        </div>
                                    </div>
                                    <div className="mc-roster-time">
                                        {admin.isAuthorized
                                            ? (toDate(admin.lastSeen) ? relativeTime(toDate(admin.lastSeen), now) : "Idle")
                                            : "Revoked"}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* =========================================================
                PILLAR 2 — ACCESSES
               ========================================================= */}
            {!isLoadingAdmins && pillar === "accesses" && (
                <div>
                    <div className="mc-section-head">
                        <span className="mc-section-title">Time-gated passes</span>
                        <span className="mc-section-note">Changes save instantly</span>
                    </div>

                    {subAdmins.length === 0 ? (
                        <div className="mc-empty">
                            <i className="fa-regular fa-id-badge"></i>
                            No admins to gate yet. Authorize a Gmail address in the Admin pillar first.
                        </div>
                    ) : (
                        subAdmins.map((admin) => {
                            const open = isWithinWindow(admin, now);
                            return (
                                <div key={admin.id} className={`mc-pass${savedId === admin.id ? " saved" : ""}`}>
                                    <div className="mc-pass-head">
                                        <div className="mc-identity">
                                            <div className={`mc-avatar${admin.isOnline ? " live" : ""}`}>{initials(admin)}</div>
                                            <div style={{ minWidth: 0 }}>
                                                <div className="mc-name">{displayName(admin)}</div>
                                                <div className="mc-email">{admin.email}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            {!admin.isAuthorized && <span className="mc-badge danger">Revoked</span>}
                                            <span className={`mc-badge ${open ? "ok" : "warn"}`}>
                                                {open ? "In window" : "Out of window"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mc-pass-grid">
                                        <div>
                                            <label className="mc-label">Window opens</label>
                                            <input
                                                type="time"
                                                className="mc-input"
                                                value={admin.accessStartTime || ""}
                                                onChange={(e) => patchAdmin(admin.id, { accessStartTime: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="mc-label">Window closes</label>
                                            <input
                                                type="time"
                                                className="mc-input"
                                                value={admin.accessEndTime || ""}
                                                onChange={(e) => patchAdmin(admin.id, { accessEndTime: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="mc-label">Max session (minutes)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="mc-input"
                                                placeholder="e.g. 60"
                                                value={admin.maxDuration ?? ""}
                                                onChange={(e) => {
                                                    const parsed = parseInt(e.target.value, 10);
                                                    patchAdmin(admin.id, {
                                                        maxDuration: Number.isNaN(parsed) ? null : parsed
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mc-chips">
                                        {QUICK_PASSES.map((preset) => (
                                            <button
                                                key={preset.minutes}
                                                type="button"
                                                className="mc-chip"
                                                onClick={() => patchAdmin(admin.id, { maxDuration: preset.minutes })}
                                            >
                                                {preset.label} pass
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            className="mc-chip"
                                            onClick={() => patchAdmin(admin.id, {
                                                accessStartTime: "00:00",
                                                accessEndTime: "23:59"
                                            })}
                                        >
                                            Open all day
                                        </button>
                                    </div>

                                    <div className="mc-pass-summary">
                                        <i className="fa-solid fa-shield-halved"></i>
                                        <span>
                                            Can sign in {admin.accessStartTime || "00:00"}–{admin.accessEndTime || "23:59"}
                                            {" · "}{minutesToText(admin.maxDuration)} per session
                                            {admin.isOnline ? " · currently live" : ""}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* =========================================================
                PILLAR 3 — ADMIN LEDGER
               ========================================================= */}
            {!isLoadingAdmins && pillar === "admin" && (
                <div>
                    <div className="mc-kpis">
                        <div className="mc-kpi">
                            <div className="mc-kpi-label">Total in ledger</div>
                            <div className="mc-kpi-value">{subAdmins.length}</div>
                            <div className="mc-kpi-foot">Every Gmail ever authorized</div>
                        </div>
                        <div className="mc-kpi">
                            <div className="mc-kpi-label">Authorized</div>
                            <div className="mc-kpi-value">{authorizedCount}</div>
                            <div className="mc-kpi-foot">Can sign in today</div>
                        </div>
                        <div className="mc-kpi">
                            <div className="mc-kpi-label">Online</div>
                            <div className="mc-kpi-value">{onlineAdmins.length}</div>
                            <div className="mc-kpi-foot">Live sessions right now</div>
                        </div>
                        <div className="mc-kpi">
                            <div className="mc-kpi-label">Revoked</div>
                            <div className="mc-kpi-value">{revokedCount}</div>
                            <div className="mc-kpi-foot">Blocked from signing in</div>
                        </div>
                    </div>

                    <div className="mc-authorize">
                        <span className="mc-section-title">Grant access</span>
                        <form className="mc-authorize-form" onSubmit={handleAuthorize}>
                            <div className="mc-field">
                                <label className="mc-label">Authorize Gmail address</label>
                                <input
                                    type="email"
                                    className="mc-input"
                                    placeholder="name@gmail.com"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="mc-btn primary" disabled={isAuthorizing}>
                                <i className="fa-solid fa-user-plus"></i>
                                {isAuthorizing ? "Authorizing…" : "Authorize admin"}
                            </button>
                        </form>
                    </div>

                    {subAdmins.length === 0 ? (
                        <div className="mc-empty">
                            <i className="fa-regular fa-address-book"></i>
                            The ledger is empty. Authorize your first sub-admin above.
                        </div>
                    ) : (
                        <div className="mc-table-wrap">
                            <div className="mc-scroll">
                                <table className="mc-table">
                                    <thead>
                                        <tr>
                                            <th>Admin</th>
                                            <th>Status</th>
                                            <th>Window</th>
                                            <th>Pass</th>
                                            <th>Added</th>
                                            <th style={{ textAlign: "right" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subAdmins.map((admin) => (
                                            <tr key={admin.id}>
                                                <td>
                                                    <div className="mc-identity">
                                                        <div className={`mc-avatar${admin.isOnline ? " live" : ""}`}>
                                                            {initials(admin)}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div className="mc-name">{displayName(admin)}</div>
                                                            <div className="mc-email">{admin.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {!admin.isAuthorized ? (
                                                        <span className="mc-badge danger">Revoked</span>
                                                    ) : admin.isOnline ? (
                                                        <span className="mc-badge ok"><span className="mc-dot live" /> Online</span>
                                                    ) : (
                                                        <span className="mc-badge">Offline</span>
                                                    )}
                                                </td>
                                                <td className="mc-mono">
                                                    {(admin.accessStartTime || "00:00")}–{(admin.accessEndTime || "23:59")}
                                                </td>
                                                <td className="mc-mono">{minutesToText(admin.maxDuration)}</td>
                                                <td className="mc-mono">
                                                    {toDate(admin.createdAt)
                                                        ? toDate(admin.createdAt).toLocaleDateString()
                                                        : "—"}
                                                </td>
                                                <td>
                                                    <div className="mc-td-actions">
                                                        {admin.isOnline && (
                                                            <button type="button" className="mc-btn sm danger" onClick={() => handleTerminate(admin)}>
                                                                <i className="fa-solid fa-power-off"></i> Terminate
                                                            </button>
                                                        )}
                                                        {admin.isAuthorized ? (
                                                            <button type="button" className="mc-btn sm" onClick={() => handleDeauthorize(admin)}>
                                                                <i className="fa-solid fa-ban"></i> Revoke
                                                            </button>
                                                        ) : (
                                                            <button type="button" className="mc-btn sm" onClick={() => handleReauthorize(admin)}>
                                                                <i className="fa-solid fa-check"></i> Restore
                                                            </button>
                                                        )}
                                                        <button type="button" className="mc-btn sm ghost" onClick={() => openHistoryFor(admin.email)}>
                                                            <i className="fa-solid fa-clock-rotate-left"></i> History
                                                        </button>
                                                        <button type="button" className="mc-btn sm danger" onClick={() => handleDelete(admin)}>
                                                            <i className="fa-solid fa-trash"></i> Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* =========================================================
                PILLAR 4 — HISTORY (SHOWDOWN)
               ========================================================= */}
            {!isLoadingAdmins && pillar === "history" && (
                <div>
                    <div className="mc-section-head">
                        <span className="mc-section-title">The showdown</span>
                        <span className="mc-section-note">
                            {filteredLogs.length} {filteredLogs.length === 1 ? "entry" : "entries"}
                        </span>
                    </div>

                    <div className="mc-who">
                        <button
                            type="button"
                            className={`mc-who-chip${logTarget === "all" ? " active" : ""}`}
                            onClick={() => setLogTarget("all")}
                        >
                            <i className="fa-solid fa-layer-group"></i> Everyone
                        </button>
                        {subAdmins.map((admin) => (
                            <button
                                key={admin.id}
                                type="button"
                                className={`mc-who-chip${logTarget === admin.email ? " active" : ""}`}
                                onClick={() => setLogTarget(admin.email)}
                            >
                                {admin.isOnline && <span className="mc-dot live" />}
                                {admin.email}
                            </button>
                        ))}
                    </div>

                    <div className="mc-filters">
                        <div className="mc-search">
                            <i className="fa-solid fa-magnifying-glass"></i>
                            <input
                                type="text"
                                placeholder="Search actions, products, orders…"
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                            />
                        </div>
                        <select
                            className="mc-select"
                            value={logAction}
                            onChange={(e) => setLogAction(e.target.value)}
                        >
                            <option value="all">All action types</option>
                            {actionTypes.map((action) => (
                                <option key={action} value={action}>{action}</option>
                            ))}
                        </select>
                    </div>

                    {isLoadingLogs ? (
                        <div className="mc-empty">
                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                            Pulling the action trail…
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="mc-empty">
                            <i className="fa-regular fa-folder-open"></i>
                            No history matches this filter yet.
                        </div>
                    ) : (
                        <div className="mc-table-wrap">
                            <div className="mc-log-scroll">
                                {groupedLogs.map((group) => (
                                    <div key={group.key}>
                                        <div className="mc-day">
                                            {group.date
                                                ? group.date.toLocaleDateString([], {
                                                    weekday: "long", day: "2-digit", month: "long", year: "numeric"
                                                })
                                                : group.key}
                                        </div>
                                        {group.items.map((log, index) => {
                                            const date = toDate(log.timestamp);
                                            return (
                                                <div key={log.id || `${group.key}-${index}`} className="mc-log-row">
                                                    <div>
                                                        <span className={`mc-badge ${actionTone(log.action)}`}>
                                                            {String(log.action || "ACTION").toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div className="mc-log-target">
                                                            {log.details || log.target || log.description || "—"}
                                                        </div>
                                                        {logTarget === "all" && (
                                                            <div className="mc-log-who">{log.email}</div>
                                                        )}
                                                    </div>
                                                    <div className="mc-log-time">
                                                        <div>
                                                            {date
                                                                ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                                                : "—"}
                                                        </div>
                                                        <div className="mc-log-ago">{relativeTime(date, now)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
