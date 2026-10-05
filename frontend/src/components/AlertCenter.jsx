import { useState, useEffect } from "react";

export default function AlertCenter({ user, onRefresh }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [stats, setStats] = useState({
    total_alerts: 0,
    active_alerts: 0,
    resolved_alerts: 0,
    critical_active: 0
  });

  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const [resolvingAlert, setResolvingAlert] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolvingLoading, setResolvingLoading] = useState(false);

  const token = localStorage.getItem("token");

  const fetchAlerts = async (statusFilter = filter) => {
    if (!token) return;
    setLoading(true);
    try {
      const url = statusFilter && statusFilter !== "ALL"
        ? "http://localhost:3000/api/alerts?status=" + statusFilter
        : "http://localhost:3000/api/alerts";

      const res = await fetch(url, {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (res.ok) {
        setAlerts(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3000/api/alerts/stats", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (res.ok) {
        setStats({
          total_alerts: Number(data.data.total_alerts || 0),
          active_alerts: Number(data.data.active_alerts || 0),
          resolved_alerts: Number(data.data.resolved_alerts || 0),
          critical_active: Number(data.data.critical_active || 0)
        });
      }
    } catch (err) {
      console.error("Failed to fetch alert stats:", err);
    }
  };

  useEffect(() => {
    fetchAlerts(filter);
    fetchStats();

    const interval = setInterval(() => {
      fetchAlerts(filter);
      fetchStats();
    }, 12000);

    return () => clearInterval(interval);
  }, [filter]);

  const handleRunScan = async () => {
    if (!token) return;
    setScanLoading(true);
    setScanResult(null);
    try {
      const res = await fetch("http://localhost:3000/api/alerts/run-check", {
        method: "POST",
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult({
          success: true,
          message: "Integrity scan finished! Scanned: " + data.data.scanned + " files | Verified intact: " + data.data.intact + " | Compromised: " + data.data.compromised + " | New alerts: " + data.data.new_alerts_dispatched
        });
        await fetchAlerts(filter);
        await fetchStats();
        if (onRefresh) onRefresh();
      } else {
        setScanResult({
          success: false,
          message: data.message || "Integrity scan failed"
        });
      }
    } catch (err) {
      setScanResult({
        success: false,
        message: err.message
      });
    } finally {
      setScanLoading(false);
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolvingAlert || !token) return;
    setResolvingLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/alerts/" + resolvingAlert.alert_id + "/resolve", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ resolution_notes: resolutionNotes })
      });
      const data = await res.json();
      if (res.ok) {
        setResolvingAlert(null);
        setResolutionNotes("");
        await fetchAlerts(filter);
        await fetchStats();
        if (onRefresh) onRefresh();
      } else {
        alert(data.message || "Failed to resolve alert");
      }
    } catch (err) {
      alert("Error resolving alert: " + err.message);
    } finally {
      setResolvingLoading(false);
    }
  };

  const displayedAlerts = alerts.filter(a => {
    if (filter === "ACTIVE") return a.status === "ACTIVE";
    if (filter === "RESOLVED") return a.status === "RESOLVED";
    if (filter === "CRITICAL") return a.severity === "CRITICAL" && a.status === "ACTIVE";
    return true;
  });

  return (
    <div>
      <header className="dashboard-header">
        <div>
          <h1>⚠️ Digital Vault Integrity & Tamper Alert Center</h1>
          <p>Continuous Cryptographic SHA-256 Monitoring & File Intrusion Detection</p>
        </div>

        <div className="user-info">
          <strong>{user?.full_name || "Administrator"}</strong>
          <span>{user?.employee_id || "POL2026002"}</span>
        </div>
      </header>

      {/* CRITICAL INCIDENT BANNER */}
      {stats.critical_active > 0 && (
        <div className="tamper-critical-banner">
          <div className="banner-left">
            <span className="banner-icon">🚨</span>
            <div>
              <div className="banner-title">CRITICAL FILE TAMPERING DETECTED</div>
              <p className="banner-desc">
                {stats.critical_active} active cryptographic SHA-256 hash mismatch or storage corruption incident(s) detected. Unauthorized file alteration or missing evidence detected!
              </p>
            </div>
          </div>
          <button
            className="primary-button"
            onClick={handleRunScan}
            disabled={scanLoading}
          >
            {scanLoading ? "Scanning..." : "Re-Scan Vault"}
          </button>
        </div>
      )}

      {/* SCAN TOAST */}
      {scanResult && (
        <div className={scanResult.success ? "success-message" : "error-message"} style={{ marginBottom: "20px" }}>
          {scanResult.message}
        </div>
      )}

      {/* CONTROLS BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={"subnav-tab " + (filter === "ALL" ? "active" : "")}
            onClick={() => setFilter("ALL")}
          >
            All Alerts ({stats.total_alerts})
          </button>
          <button
            className={"subnav-tab " + (filter === "ACTIVE" ? "active" : "")}
            onClick={() => setFilter("ACTIVE")}
            style={stats.active_alerts > 0 ? { color: "#fca5a5" } : {}}
          >
            Active Anomalies ({stats.active_alerts})
          </button>
          <button
            className={"subnav-tab " + (filter === "CRITICAL" ? "active" : "")}
            onClick={() => setFilter("CRITICAL")}
          >
            Critical ({stats.critical_active})
          </button>
          <button
            className={"subnav-tab " + (filter === "RESOLVED" ? "active" : "")}
            onClick={() => setFilter("RESOLVED")}
          >
            Resolved ({stats.resolved_alerts})
          </button>
        </div>

        <button
          className="primary-button"
          onClick={handleRunScan}
          disabled={scanLoading}
        >
          {scanLoading ? "Scanning Vault Evidence..." : "▶ Run Integrity Scan Now"}
        </button>
      </div>

      {/* STAT CARDS */}
      <section className="stats" style={{ marginBottom: "25px" }}>
        <div className="card">
          <h3>Total Vault Scans</h3>
          <p className="stat-number">{stats.total_alerts}</p>
          <span className="stat-label">Logged security events</span>
        </div>

        <div className="card" style={{ borderColor: stats.active_alerts > 0 ? "#ef4444" : undefined }}>
          <h3 style={stats.active_alerts > 0 ? { color: "#f87171" } : {}}>Active Mismatches</h3>
          <p className="stat-number" style={stats.active_alerts > 0 ? { color: "#f87171" } : {}}>
            {stats.active_alerts}
          </p>
          <span className="stat-label">Unresolved hash anomalies</span>
        </div>

        <div className="card">
          <h3>Critical Alerts</h3>
          <p className="stat-number" style={{ color: stats.critical_active > 0 ? "#fca5a5" : "#6ee7b7" }}>
            {stats.critical_active}
          </p>
          <span className="stat-label">Requires forensic audit</span>
        </div>

        <div className="card">
          <h3>Resolved Incidents</h3>
          <p className="stat-number" style={{ color: "#6ee7b7" }}>{stats.resolved_alerts}</p>
          <span className="stat-label">Audited & closed</span>
        </div>
      </section>

      {/* ALERTS TABLE */}
      <section className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Detected Tampering & Hash Anomalies</h2>
            <p>{displayedAlerts.length} incident record{displayedAlerts.length !== 1 ? "s" : ""} shown</p>
          </div>
          <button className="secondary-button" onClick={() => fetchAlerts(filter)}>
            ↻ Refresh
          </button>
        </div>

        {loading && <div className="evidence-page-message">Loading vault alerts...</div>}

        {!loading && displayedAlerts.length === 0 && (
          <div className="evidence-page-message" style={{ color: "#6ee7b7" }}>
            ✓ No active tampering detected. Evidence files match their registered cryptographic hashes.
          </div>
        )}

        {!loading && displayedAlerts.length > 0 && (
          <div className="evidence-table alerts-table-grid">
            <div className="table-header">
              <span>Alert ID & Severity</span>
              <span>Evidence File</span>
              <span>Case Number</span>
              <span>Anomaly Type</span>
              <span>Stored vs Detected Hash</span>
              <span>Detected At</span>
              <span>Status & Action</span>
            </div>

            {displayedAlerts.map(alert => (
              <div className="table-row" key={alert.alert_id}>
                <span>
                  <strong>#{alert.alert_id}</strong>
                  {" "}
                  <span className={"badge " + (alert.severity === "CRITICAL" ? "badge-critical" : "badge-active")}>
                    {alert.severity}
                  </span>
                </span>

                <span>
                  <strong>{alert.evidence_number || ("EV-#" + alert.evidence_id)}</strong>
                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>{alert.file_name || alert.file_path}</div>
                </span>

                <span>{alert.case_number || (alert.case_id ? ("CASE-#" + alert.case_id) : "N/A")}</span>

                <span>
                  <strong style={{ color: alert.alert_type === "HASH_MISMATCH" ? "#f87171" : "#fbbf24" }}>
                    {alert.alert_type}
                  </strong>
                  <div style={{ fontSize: "11px", color: "#9ca3af", maxWidth: "160px" }}>{alert.message}</div>
                </span>

                <span>
                  <div className="hash-diff-box">
                    <div>
                      <span className="hash-label">Stored:</span>
                      <span className="hash-val-stored">{alert.stored_hash ? alert.stored_hash.substring(0, 16) + "..." : "N/A"}</span>
                    </div>
                    <div>
                      <span className="hash-label">Detected:</span>
                      <span className="hash-val-detected">{alert.detected_hash ? alert.detected_hash.substring(0, 16) + "..." : "FAILED"}</span>
                    </div>
                  </div>
                </span>

                <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                  {new Date(alert.detected_at).toLocaleString()}
                </span>

                <span>
                  {alert.status === "ACTIVE" ? (
                    <button
                      className="table-action-btn"
                      onClick={() => {
                        setResolvingAlert(alert);
                        setResolutionNotes("Verified evidence #" + alert.evidence_id + ". Hash mismatch investigated and quarantined.");
                      }}
                    >
                      Investigate & Resolve
                    </button>
                  ) : (
                    <div>
                      <span className="badge badge-resolved">RESOLVED</span>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "3px" }}>
                        by {alert.resolved_by_name || "Admin"}
                      </div>
                    </div>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* RESOLVE ALERT MODAL */}
      {resolvingAlert && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Investigate & Resolve Alert #{resolvingAlert.alert_id}</h3>
              <button className="modal-close-btn" onClick={() => setResolvingAlert(null)}>✕</button>
            </div>

            <div style={{ marginBottom: "16px", padding: "12px", background: "#11151d", borderRadius: "8px", border: "1px solid #2c3240" }}>
              <div><strong>Evidence:</strong> {resolvingAlert.evidence_number} ({resolvingAlert.file_name})</div>
              <div><strong>Incident Type:</strong> <span style={{ color: "#f87171" }}>{resolvingAlert.alert_type}</span></div>
              <div style={{ marginTop: "6px", fontSize: "12px", color: "#d1d5db" }}>{resolvingAlert.message}</div>
            </div>

            <form onSubmit={handleResolveSubmit}>
              <div className="form-group">
                <label>Resolution & Investigation Notes (Audit Trail)</label>
                <textarea
                  rows={4}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Enter findings (e.g., Cryptographic re-hash completed, physical disk quarantined, authorized maintenance)..."
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="secondary-button" onClick={() => setResolvingAlert(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={resolvingLoading}>
                  {resolvingLoading ? "Saving..." : "Confirm & Mark Resolved"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
