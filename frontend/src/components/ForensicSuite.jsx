import { useState, useEffect } from "react";

export default function ForensicSuite({ user, evidence = [], cases = [], onRefresh }) {
  const [activeTab, setActiveTab] = useState("workspace");
  const [usersList, setUsersList] = useState([]);
  const [pdfCaseId, setPdfCaseId] = useState(cases.length > 0 ? cases[0].case_id : "");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");

  // Reports state
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportForm, setReportForm] = useState({
    case_id: "",
    evidence_id: "",
    report_title: "",
    report_type: "DIGITAL_FORENSIC_EXAMINATION",
    tools_used: "Autopsy v4.21, Volatility 3, FTK Imager",
    hash_verified: true,
    findings: "",
    artifacts_recovered: "",
    conclusion: "",
    status: "FINALIZED"
  });
  const [reportCreateLoading, setReportCreateLoading] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");

  // Report dispatch modal
  const [dispatchingReport, setDispatchingReport] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({
    recipient_id: "",
    recipient_name: "",
    recipient_agency: "Cyber Crime Division",
    transmission_priority: "HIGH",
    dispatch_notes: ""
  });
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [dispatchError, setDispatchError] = useState("");

  // Autopsies state
  const [autopsies, setAutopsies] = useState([]);
  const [autopsiesLoading, setAutopsiesLoading] = useState(false);
  const [autopsyForm, setAutopsyForm] = useState({
    case_id: "",
    evidence_id: "",
    subject_name: "",
    device_type: "Solid State Drive (M.2 NVMe)",
    hardware_condition: "Intact, write-blocked during physical acquisition",
    extraction_method: "Bit-stream physical forensic image (E01 format)",
    autopsy_findings: "",
    triage_summary: "",
    status: "COMPLETED"
  });
  const [autopsyCreateLoading, setAutopsyCreateLoading] = useState(false);
  const [autopsyMessage, setAutopsyMessage] = useState("");
  const [autopsyError, setAutopsyError] = useState("");

  // Autopsy dispatch modal
  const [dispatchingAutopsy, setDispatchingAutopsy] = useState(null);
  const [autopsyDispatchForm, setAutopsyDispatchForm] = useState({
    dispatched_to: "Chief Forensic Lab & Lead Investigator",
    recipient_id: "",
    dispatch_notes: ""
  });
  const [autopsyDispatchLoading, setAutopsyDispatchLoading] = useState(false);

  const token = localStorage.getItem("token");

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3000/api/users", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (res.ok) setUsersList(data.data || []);
    } catch (err) {
      console.error("fetchUsers error:", err);
    }
  };

  const fetchReports = async () => {
    if (!token) return;
    setReportsLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/reports/forensic", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (res.ok) setReports(data.data || []);
    } catch (err) {
      console.error("fetchReports error:", err);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchAutopsies = async () => {
    if (!token) return;
    setAutopsiesLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/reports/autopsy", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (res.ok) setAutopsies(data.data || []);
    } catch (err) {
      console.error("fetchAutopsies error:", err);
    } finally {
      setAutopsiesLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchReports();
    fetchAutopsies();
  }, []);

  
  const handleDownloadPdfReport = async (caseIdToDownload) => {
    const targetCaseId = caseIdToDownload || pdfCaseId;
    if (!targetCaseId) {
      alert("Please select a case to generate the report.");
      return;
    }
    if (!token) return;

    setPdfDownloading(true);
    setPdfStatus("Generating deterministic forensic report PDF from database records...");

    try {
      const res = await fetch("http://localhost:3000/api/reports/forensic/" + targetCaseId + "/download", {
        method: "GET",
        headers: { Authorization: "Bearer " + token }
      });

      if (!res.ok) {
        let errMsg = "Failed to download forensic report";
        try {
          const errJson = await res.json();
          if (errJson.message) errMsg = errJson.message;
        } catch (_) {}
        throw new Error(errMsg);
      }

      let filename = "CASE-" + targetCaseId + "-forensic-report.pdf";
      const disposition = res.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, "").trim();
        }
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);

      setPdfStatus("Report downloaded successfully: " + filename);
      setTimeout(() => setPdfStatus(""), 4500);
    } catch (err) {
      console.error("PDF download error:", err);
      setPdfStatus("Download error: " + err.message);
      alert("Failed to download forensic report: " + err.message);
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleCreateReport = async (e) => {
    e.preventDefault();
    setReportMessage("");
    setReportError("");
    if (!token) return;
    setReportCreateLoading(true);

    try {
      const res = await fetch("http://localhost:3000/api/reports/forensic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          case_id: Number(reportForm.case_id),
          evidence_id: Number(reportForm.evidence_id),
          report_title: reportForm.report_title,
          report_type: reportForm.report_type,
          tools_used: reportForm.tools_used,
          hash_verified: reportForm.hash_verified,
          findings: reportForm.findings,
          artifacts_recovered: reportForm.artifacts_recovered,
          conclusion: reportForm.conclusion,
          status: "FINALIZED"
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReportMessage("Report " + data.data.report_number + " generated successfully!");
        setReportForm({
          case_id: "",
          evidence_id: "",
          report_title: "",
          report_type: "DIGITAL_FORENSIC_EXAMINATION",
          tools_used: "Autopsy v4.21, Volatility 3, FTK Imager",
          hash_verified: true,
          findings: "",
          artifacts_recovered: "",
          conclusion: "",
          status: "FINALIZED"
        });
        await fetchReports();
        setTimeout(() => setActiveTab("send-report"), 1500);
      } else {
        setReportError(data.message || "Failed to create report");
      }
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportCreateLoading(false);
    }
  };

  const handleConfirmDispatchReport = async (e) => {
    e.preventDefault();
    if (!dispatchingReport || !token) return;
    setDispatchLoading(true);
    setDispatchMessage("");
    setDispatchError("");

    try {
      const res = await fetch("http://localhost:3000/api/reports/forensic/" + dispatchingReport.report_id + "/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(dispatchForm)
      });
      const data = await res.json();
      if (res.ok) {
        setDispatchMessage("Report " + dispatchingReport.report_number + " securely dispatched!");
        await fetchReports();
        setTimeout(() => {
          setDispatchingReport(null);
          setDispatchMessage("");
        }, 1200);
      } else {
        setDispatchError(data.message || "Failed to dispatch report");
      }
    } catch (err) {
      setDispatchError(err.message);
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleCreateAutopsy = async (e) => {
    e.preventDefault();
    setAutopsyMessage("");
    setAutopsyError("");
    if (!token) return;
    setAutopsyCreateLoading(true);

    try {
      const res = await fetch("http://localhost:3000/api/reports/autopsy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          case_id: Number(autopsyForm.case_id),
          evidence_id: Number(autopsyForm.evidence_id),
          subject_name: autopsyForm.subject_name,
          device_type: autopsyForm.device_type,
          hardware_condition: autopsyForm.hardware_condition,
          extraction_method: autopsyForm.extraction_method,
          autopsy_findings: autopsyForm.autopsy_findings,
          triage_summary: autopsyForm.triage_summary,
          status: "COMPLETED"
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAutopsyMessage("Autopsy record " + data.data.autopsy_number + " created successfully!");
        setAutopsyForm({
          case_id: "",
          evidence_id: "",
          subject_name: "",
          device_type: "Solid State Drive (M.2 NVMe)",
          hardware_condition: "Intact, write-blocked during physical acquisition",
          extraction_method: "Bit-stream physical forensic image (E01 format)",
          autopsy_findings: "",
          triage_summary: "",
          status: "COMPLETED"
        });
        await fetchAutopsies();
      } else {
        setAutopsyError(data.message || "Failed to log autopsy record");
      }
    } catch (err) {
      setAutopsyError(err.message);
    } finally {
      setAutopsyCreateLoading(false);
    }
  };

  const handleConfirmDispatchAutopsy = async (e) => {
    e.preventDefault();
    if (!dispatchingAutopsy || !token) return;
    setAutopsyDispatchLoading(true);

    try {
      const res = await fetch("http://localhost:3000/api/reports/autopsy/" + dispatchingAutopsy.autopsy_id + "/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(autopsyDispatchForm)
      });
      const data = await res.json();
      if (res.ok) {
        setDispatchingAutopsy(null);
        await fetchAutopsies();
      } else {
        alert(data.message || "Failed to dispatch autopsy");
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAutopsyDispatchLoading(false);
    }
  };

  return (
    <div>
      <header className="dashboard-header">
        <div>
          <h1>🔬 Forensic Laboratory & Digital Autopsy Suite</h1>
          <p>Cryptographic Examination, Memory Extraction Reports & Verified Dispatches</p>
        </div>

        <div className="user-info">
          <strong>{user?.full_name}</strong>
          <span>{user?.employee_id} ({user?.role_name || "Forensic Analyst"})</span>
        </div>
      </header>

      {/* SUBNAV TABS */}
      <div className="subnav-tabs">
        <button
          className={"subnav-tab " + (activeTab === "workspace" ? "active" : "")}
          onClick={() => setActiveTab("workspace")}
        >
          🔬 Forensic Workspace
        </button>
        <button
          className={"subnav-tab " + (activeTab === "create-report" ? "active" : "")}
          onClick={() => setActiveTab("create-report")}
        >
          📝 Generate Forensic Report
        </button>
        <button
          className={"subnav-tab " + (activeTab === "send-report" ? "active" : "")}
          onClick={() => setActiveTab("send-report")}
        >
          🚀 Transmit & Dispatch Reports ({reports.length})
        </button>
        <button
          className={"subnav-tab " + (activeTab === "autopsy" ? "active" : "")}
          onClick={() => setActiveTab("autopsy")}
        >
          ⚡ Digital Autopsy Suite ({autopsies.length})
        </button>
      </div>

      {/* TAB 1: WORKSPACE */}
      {activeTab === "workspace" && (
        <>
          <section className="stats" style={{ marginBottom: "25px" }}>
            <div className="card">
              <h3>Evidence in Vault</h3>
              <p className="stat-number">{evidence.length}</p>
              <span className="stat-label">Available for forensic analysis</span>
            </div>
            <div className="card">
              <h3>Forensic Reports</h3>
              <p className="stat-number">{reports.length}</p>
              <span className="stat-label">Technical examination records</span>
            </div>
            <div className="card">
              <h3>Digital Autopsies</h3>
              <p className="stat-number">{autopsies.length}</p>
              <span className="stat-label">Hardware triages completed</span>
            </div>
            <div className="card">
              <h3>Registered Cases</h3>
              <p className="stat-number">{cases.length}</p>
              <span className="stat-label">Active investigations</span>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Evidence Awaiting Forensic Analysis</h2>
                <p>Select evidence to initiate a forensic examination or hardware autopsy</p>
              </div>
            </div>

            {evidence.length === 0 && (
              <div className="evidence-page-message">No evidence currently registered in vault.</div>
            )}

            {evidence.length > 0 && (
              <div className="evidence-table">
                <div className="table-header" style={{ gridTemplateColumns: "1.2fr 1.5fr 1fr 2fr 1.5fr" }}>
                  <span>Evidence Number</span>
                  <span>Evidence Name</span>
                  <span>Type</span>
                  <span>Case</span>
                  <span>Forensic Actions</span>
                </div>

                {evidence.map(item => (
                  <div className="table-row" key={item.evidence_id} style={{ gridTemplateColumns: "1.2fr 1.5fr 1fr 2fr 1.5fr" }}>
                    <span><strong>{item.evidence_number}</strong></span>
                    <span>{item.evidence_name}</span>
                    <span>{item.evidence_type}</span>
                    <span>{item.case_title || item.case_number || ("Case #" + item.case_id)}</span>
                    <span style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="table-action-btn"
                        onClick={() => {
                          setReportForm(prev => ({
                            ...prev,
                            case_id: item.case_id || "",
                            evidence_id: item.evidence_id,
                            report_title: "Digital Forensic Examination of " + item.evidence_name
                          }));
                          setActiveTab("create-report");
                        }}
                      >
                        📝 Draft Report
                      </button>
                      <button
                        className="table-action-btn green"
                        onClick={() => {
                          setAutopsyForm(prev => ({
                            ...prev,
                            case_id: item.case_id || "",
                            evidence_id: item.evidence_id,
                            subject_name: item.evidence_name
                          }));
                          setActiveTab("autopsy");
                        }}
                      >
                        ⚡ Autopsy
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* TAB 2: CREATE REPORT */}
      {activeTab === "create-report" && (
        <section className="dashboard-section">
          <div className="section-header">
            <div>
              <h2>System-Generated Forensic Report</h2>
              <p>Compile technical findings, memory carving artifacts, and cryptographic conclusions</p>
            </div>
          </div>

          {/* DETERMINISTIC PDF GENERATION CARD */}
          <div className="pdf-generation-card" style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", padding: "20px", marginBottom: "25px", maxWidth: "800px" }}>
            <h3 style={{ color: "#38bdf8", marginTop: 0, fontSize: "16px" }}>📄 Official Case Forensic Report (Deterministic PDF)</h3>
            <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.5" }}>
              Generates a deterministic system report containing case records, complete SHA-256 evidence hashes, verification results, chain of custody logs, audit trails, and tamper alerts directly from verified database records. Does not rely on external AI APIs.
            </p>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "15px", flexWrap: "wrap" }}>
              <select
                value={pdfCaseId}
                onChange={(e) => setPdfCaseId(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "6px", background: "#0f172a", color: "#f8fafc", border: "1px solid #475569", minWidth: "240px" }}
              >
                <option value="">Select a Case to Generate PDF</option>
                {cases.map(c => (
                  <option key={c.case_id} value={c.case_id}>
                    {c.case_number} - {c.case_title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="primary-button"
                style={{ background: "#2563eb", padding: "9px 18px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                disabled={!pdfCaseId || pdfDownloading}
                onClick={() => handleDownloadPdfReport(pdfCaseId)}
              >
                {pdfDownloading ? "Generating PDF Report..." : "📥 Download Official Forensic Report (PDF)"}
              </button>
            </div>
            {pdfStatus && (
              <div style={{ marginTop: "12px", fontSize: "13px", color: pdfStatus.includes("error") || pdfStatus.includes("Error") ? "#f87171" : "#38bdf8" }}>
                {pdfStatus}
              </div>
            )}
          </div>


          <form onSubmit={handleCreateReport} className="upload-form" style={{ maxWidth: "800px" }}>
            <div className="form-grid-2col">
              <div className="form-group">
                <label>Associated Case *</label>
                <select
                  value={reportForm.case_id}
                  onChange={(e) => setReportForm({ ...reportForm, case_id: e.target.value })}
                  required
                >
                  <option value="">Select a Case</option>
                  {cases.map(c => (
                    <option key={c.case_id} value={c.case_id}>
                      {c.case_number} - {c.case_title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Evidence Item *</label>
                <select
                  value={reportForm.evidence_id}
                  onChange={(e) => setReportForm({ ...reportForm, evidence_id: e.target.value })}
                  required
                >
                  <option value="">Select Evidence</option>
                  {evidence.map(e => (
                    <option key={e.evidence_id} value={e.evidence_id}>
                      {e.evidence_number} - {e.evidence_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group form-full-col">
                <label>Forensic Report Title *</label>
                <input
                  type="text"
                  value={reportForm.report_title}
                  onChange={(e) => setReportForm({ ...reportForm, report_title: e.target.value })}
                  placeholder="e.g., Cryptographic Hash Verification & Volatile Memory Analysis"
                  required
                />
              </div>

              <div className="form-group">
                <label>Forensic Toolchain Used *</label>
                <input
                  type="text"
                  value={reportForm.tools_used}
                  onChange={(e) => setReportForm({ ...reportForm, tools_used: e.target.value })}
                  placeholder="e.g., Autopsy v4.21, Volatility 3, FTK Imager"
                  required
                />
              </div>

              <div className="form-group" style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", marginTop: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={reportForm.hash_verified}
                    onChange={(e) => setReportForm({ ...reportForm, hash_verified: e.target.checked })}
                    style={{ width: "18px", height: "18px", margin: 0 }}
                  />
                  <span>Cryptographic SHA-256 Pre-Verification Confirmed</span>
                </label>
              </div>

              <div className="form-group form-full-col">
                <label>Technical Examination Findings *</label>
                <textarea
                  rows={4}
                  value={reportForm.findings}
                  onChange={(e) => setReportForm({ ...reportForm, findings: e.target.value })}
                  placeholder="Document partition layout, hidden files, timestamps, volatile artifacts, deleted records..."
                  required
                />
              </div>

              <div className="form-group form-full-col">
                <label>Recovered Digital Artifacts</label>
                <textarea
                  rows={3}
                  value={reportForm.artifacts_recovered}
                  onChange={(e) => setReportForm({ ...reportForm, artifacts_recovered: e.target.value })}
                  placeholder="List specific artifacts: SQLite databases, browser history, exfiltrated files, chat transcripts..."
                />
              </div>

              <div className="form-group form-full-col">
                <label>Forensic Conclusion & Expert Opinion *</label>
                <textarea
                  rows={3}
                  value={reportForm.conclusion}
                  onChange={(e) => setReportForm({ ...reportForm, conclusion: e.target.value })}
                  placeholder="State professional opinion regarding data authenticity, signs of tampering, or attribution..."
                  required
                />
              </div>
            </div>

            <button type="submit" className="primary-button" disabled={reportCreateLoading}>
              {reportCreateLoading ? "Saving Examination Record..." : "Save Technical Examination Record"}
            </button>

            {reportMessage && <div className="success-message">{reportMessage}</div>}
            {reportError && <div className="error-message">{reportError}</div>}
          </form>
        </section>
      )}

      {/* TAB 3: DISPATCH REPORTS */}
      {activeTab === "send-report" && (
        <section className="dashboard-section">
          <div className="section-header">
            <div>
              <h2>Transmitted & Available Forensic Reports</h2>
              <p>Securely dispatch examination reports to Case Managers, Investigators, or Admin</p>
            </div>
            <button className="secondary-button" onClick={fetchReports}>↻ Refresh</button>
          </div>

          {reportsLoading && <div className="evidence-page-message">Loading reports...</div>}

          {!reportsLoading && reports.length === 0 && (
            <div className="evidence-page-message">
              No forensic reports generated yet. Use the "Generate Forensic Report" tab to create one.
            </div>
          )}

          {!reportsLoading && reports.length > 0 && (
            <div className="evidence-table reports-table-grid">
              <div className="table-header">
                <span>Report Number</span>
                <span>Title & Case</span>
                <span>Evidence</span>
                <span>Analyst</span>
                <span>Status</span>
                <span>Dispatched To</span>
                <span>Actions</span>
              </div>

              {reports.map(rep => (
                <div className="table-row" key={rep.report_id}>
                  <span><strong>{rep.report_number}</strong></span>

                  <span>
                    <div><strong>{rep.report_title}</strong></div>
                    <div style={{ fontSize: "11px", color: "#9ca3af" }}>{rep.case_number || ("Case #" + rep.case_id)}</div>
                  </span>

                  <span>
                    <strong>{rep.evidence_number || ("EV-#" + rep.evidence_id)}</strong>
                    <div style={{ fontSize: "11px", color: "#9ca3af" }}>{rep.evidence_name}</div>
                  </span>

                  <span>{rep.analyst_name || ("Analyst #" + rep.analyst_id)}</span>

                  <span>
                    <span className={"badge " + (rep.status === "DISPATCHED" ? "badge-dispatched" : "badge-resolved")}>
                      {rep.status}
                    </span>
                  </span>

                  <span style={{ fontSize: "12px" }}>
                    {rep.recipient_name ? (
                      <div>
                        <strong>{rep.recipient_name}</strong>
                        <div style={{ fontSize: "11px", color: "#9ca3af" }}>{rep.recipient_agency}</div>
                      </div>
                    ) : (
                      <span style={{ color: "#9ca3af" }}>Not dispatched yet</span>
                    )}
                  </span>

                  <span>
                    <button
                      className="table-action-btn green"
                      style={{ marginRight: "6px" }}
                      onClick={() => handleDownloadPdfReport(rep.case_id)}
                      title="Download Official Case Forensic Report PDF"
                    >
                      📥 PDF
                    </button>
                    <button
                      className="table-action-btn"
                      onClick={() => {
                        setDispatchingReport(rep);
                        setDispatchForm({
                          recipient_id: usersList[0]?.user_id || "",
                          recipient_name: usersList[0]?.full_name || "Investigating Officer",
                          recipient_agency: "Cyber Crime Division",
                          transmission_priority: "HIGH",
                          dispatch_notes: "Transmitting forensic findings for report " + rep.report_number + "."
                        });
                      }}
                    >
                      🚀 Dispatch Report
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: DIGITAL AUTOPSY SUITE */}
      {activeTab === "autopsy" && (
        <>
          <section className="dashboard-section" style={{ marginBottom: "30px" }}>
            <div className="section-header">
              <div>
                <h2>Digital Device Autopsy & Hardware Triage</h2>
                <p>Document physical hardware examination, write-blocking verification, and raw image extraction</p>
              </div>
            </div>

            <form onSubmit={handleCreateAutopsy} className="upload-form" style={{ maxWidth: "800px" }}>
              <div className="form-grid-2col">
                <div className="form-group">
                  <label>Associated Case *</label>
                  <select
                    value={autopsyForm.case_id}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, case_id: e.target.value })}
                    required
                  >
                    <option value="">Select a Case</option>
                    {cases.map(c => (
                      <option key={c.case_id} value={c.case_id}>
                        {c.case_number} - {c.case_title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Evidence Reference *</label>
                  <select
                    value={autopsyForm.evidence_id}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, evidence_id: e.target.value })}
                    required
                  >
                    <option value="">Select Evidence</option>
                    {evidence.map(e => (
                      <option key={e.evidence_id} value={e.evidence_id}>
                        {e.evidence_number} - {e.evidence_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Subject Device Name *</label>
                  <input
                    type="text"
                    value={autopsyForm.subject_name}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, subject_name: e.target.value })}
                    placeholder="e.g., Seized Samsung Galaxy S23 / Kingston 512GB SSD"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Device Type *</label>
                  <select
                    value={autopsyForm.device_type}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, device_type: e.target.value })}
                  >
                    <option value="Solid State Drive (M.2 NVMe)">Solid State Drive (M.2 NVMe)</option>
                    <option value="Mechanical Hard Drive (SATA HDD)">Mechanical Hard Drive (SATA HDD)</option>
                    <option value="Smartphone (Android)">Smartphone (Android)</option>
                    <option value="Smartphone (Apple iOS)">Smartphone (Apple iOS)</option>
                    <option value="USB Flash Drive / SD Card">USB Flash Drive / SD Card</option>
                    <option value="Server / NAS Appliance">Server / NAS Appliance</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Physical Hardware Condition *</label>
                  <input
                    type="text"
                    value={autopsyForm.hardware_condition}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, hardware_condition: e.target.value })}
                    placeholder="e.g., Intact, write-blocked during physical acquisition"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Extraction / Imaging Method *</label>
                  <input
                    type="text"
                    value={autopsyForm.extraction_method}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, extraction_method: e.target.value })}
                    placeholder="e.g., Bit-stream physical forensic image (E01 format)"
                    required
                  />
                </div>

                <div className="form-group form-full-col">
                  <label>Autopsy Findings & Partition Analysis *</label>
                  <textarea
                    rows={3}
                    value={autopsyForm.autopsy_findings}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, autopsy_findings: e.target.value })}
                    placeholder="Record partition layout, firmware metadata, bad sector analysis, unallocated space carving..."
                    required
                  />
                </div>

                <div className="form-group form-full-col">
                  <label>Triage & Health Summary</label>
                  <textarea
                    rows={2}
                    value={autopsyForm.triage_summary}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, triage_summary: e.target.value })}
                    placeholder="Summary of hardware stability, write-block certification, integrity confirmation..."
                  />
                </div>
              </div>

              <button type="submit" className="primary-button" disabled={autopsyCreateLoading}>
                {autopsyCreateLoading ? "Recording..." : "Log Digital Autopsy Record"}
              </button>

              {autopsyMessage && <div className="success-message">{autopsyMessage}</div>}
              {autopsyError && <div className="error-message">{autopsyError}</div>}
            </form>
          </section>

          {/* AUTOPSY LOGS TABLE */}
          <section className="dashboard-section">
            <div className="section-header">
              <div>
                <h2>Digital Autopsy Records</h2>
                <p>{autopsies.length} hardware autopsy triage record{autopsies.length !== 1 ? "s" : ""}</p>
              </div>
              <button className="secondary-button" onClick={fetchAutopsies}>↻ Refresh</button>
            </div>

            {autopsiesLoading && <div className="evidence-page-message">Loading autopsies...</div>}

            {!autopsiesLoading && autopsies.length === 0 && (
              <div className="evidence-page-message">No device autopsy records logged yet.</div>
            )}

            {!autopsiesLoading && autopsies.length > 0 && (
              <div className="evidence-table autopsy-table-grid">
                <div className="table-header">
                  <span>Autopsy ID</span>
                  <span>Device & Subject</span>
                  <span>Device Type</span>
                  <span>Extraction Method</span>
                  <span>Status</span>
                  <span>Dispatched To</span>
                  <span>Actions</span>
                </div>

                {autopsies.map(item => (
                  <div className="table-row" key={item.autopsy_id}>
                    <span><strong>{item.autopsy_number}</strong></span>

                    <span>
                      <strong>{item.subject_name}</strong>
                      <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                        {item.evidence_number ? (item.evidence_number + " - ") : ""}{item.hardware_condition}
                      </div>
                    </span>

                    <span>{item.device_type}</span>
                    <span style={{ fontSize: "12px" }}>{item.extraction_method}</span>

                    <span>
                      <span className={"badge " + (item.status === "DISPATCHED" ? "badge-dispatched" : "badge-resolved")}>
                        {item.status}
                      </span>
                    </span>

                    <span style={{ fontSize: "12px" }}>
                      {item.dispatched_to ? (
                        <div>
                          <strong>{item.dispatched_to}</strong>
                          <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                            {item.dispatched_at ? new Date(item.dispatched_at).toLocaleDateString() : ""}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>In Lab</span>
                      )}
                    </span>

                    <span>
                      <button
                        className="table-action-btn green"
                        onClick={() => {
                          setDispatchingAutopsy(item);
                          setAutopsyDispatchForm({
                            dispatched_to: "Lead Investigator & Evidence Vault",
                            recipient_id: usersList[0]?.user_id || "",
                            dispatch_notes: "Hardware examination completed for " + item.autopsy_number + ". Bit-stream image archived."
                          });
                        }}
                      >
                        🚀 Send Autopsy
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* DISPATCH REPORT MODAL */}
      {dispatchingReport && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Securely Dispatch Report {dispatchingReport.report_number}</h3>
              <button className="modal-close-btn" onClick={() => setDispatchingReport(null)}>✕</button>
            </div>

            <div style={{ marginBottom: "16px", padding: "12px", background: "#11151d", borderRadius: "8px" }}>
              <div><strong>Title:</strong> {dispatchingReport.report_title}</div>
              <div><strong>Evidence:</strong> {dispatchingReport.evidence_number} ({dispatchingReport.evidence_name})</div>
            </div>

            <form onSubmit={handleConfirmDispatchReport}>
              <div className="form-group">
                <label>Recipient Officer / Personnel</label>
                <select
                  value={dispatchForm.recipient_id}
                  onChange={(e) => {
                    const sel = usersList.find(u => String(u.user_id) === e.target.value);
                    setDispatchForm({
                      ...dispatchForm,
                      recipient_id: e.target.value,
                      recipient_name: sel ? sel.full_name : dispatchForm.recipient_name
                    });
                  }}
                  required
                >
                  <option value="">Select Recipient User</option>
                  {usersList.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name} ({u.role_name || ("Role #" + u.role_id)}) - {u.employee_id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Recipient Agency / Department</label>
                <input
                  type="text"
                  value={dispatchForm.recipient_agency}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, recipient_agency: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Transmission Priority</label>
                <select
                  value={dispatchForm.transmission_priority}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, transmission_priority: e.target.value })}
                >
                  <option value="CRITICAL">CRITICAL (Immediate Judicial / Court Action)</option>
                  <option value="HIGH">HIGH (Active Criminal Investigation)</option>
                  <option value="STANDARD">STANDARD (Archival / Record-Keeping)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Transmission & Chain of Custody Notes</label>
                <textarea
                  rows={3}
                  value={dispatchForm.dispatch_notes}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, dispatch_notes: e.target.value })}
                  placeholder="Enter dispatch notes, cryptographic verification confirmation..."
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="secondary-button" onClick={() => setDispatchingReport(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={dispatchLoading}>
                  {dispatchLoading ? "Transmitting..." : "Authorize & Send Report"}
                </button>
              </div>

              {dispatchMessage && <div className="success-message" style={{ marginTop: "12px" }}>{dispatchMessage}</div>}
              {dispatchError && <div className="error-message" style={{ marginTop: "12px" }}>{dispatchError}</div>}
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH AUTOPSY MODAL */}
      {dispatchingAutopsy && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Dispatch Autopsy Record {dispatchingAutopsy.autopsy_number}</h3>
              <button className="modal-close-btn" onClick={() => setDispatchingAutopsy(null)}>✕</button>
            </div>

            <form onSubmit={handleConfirmDispatchAutopsy}>
              <div className="form-group">
                <label>Dispatched To (Authority / Department)</label>
                <input
                  type="text"
                  value={autopsyDispatchForm.dispatched_to}
                  onChange={(e) => setAutopsyDispatchForm({ ...autopsyDispatchForm, dispatched_to: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Recipient Officer (Optional)</label>
                <select
                  value={autopsyDispatchForm.recipient_id}
                  onChange={(e) => setAutopsyDispatchForm({ ...autopsyDispatchForm, recipient_id: e.target.value })}
                >
                  <option value="">Select Recipient Officer</option>
                  {usersList.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name} ({u.role_name || ("Role #" + u.role_id)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Dispatch Notes</label>
                <textarea
                  rows={3}
                  value={autopsyDispatchForm.dispatch_notes}
                  onChange={(e) => setAutopsyDispatchForm({ ...autopsyDispatchForm, dispatch_notes: e.target.value })}
                  placeholder="Enter notes on bit-stream storage location or custody handover..."
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="secondary-button" onClick={() => setDispatchingAutopsy(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={autopsyDispatchLoading}>
                  {autopsyDispatchLoading ? "Dispatching..." : "Confirm Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
