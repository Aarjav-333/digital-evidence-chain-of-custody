import { useState, useEffect } from "react";
import { PageHeader, Card, Badge, Button, FormField, EmptyState } from "./common";

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
    <div className="dem-page-container">
      {/* PAGE HEADER */}
      <PageHeader
        title="Forensic Laboratory & Reports"
        subtitle="Cryptographic examination, memory extraction reports, digital autopsy suite, and verified judicial dispatches."
        user={user}
      />

      {/* SUBNAV TABS */}
      <div className="dem-tabs">
        <button
          type="button"
          className={"dem-tab " + (activeTab === "workspace" ? "active" : "")}
          onClick={() => setActiveTab("workspace")}
        >
          🔬 Forensic Workspace
        </button>
        <button
          type="button"
          className={"dem-tab " + (activeTab === "create-report" ? "active" : "")}
          onClick={() => setActiveTab("create-report")}
        >
          📝 Generate Forensic Report
        </button>
        <button
          type="button"
          className={"dem-tab " + (activeTab === "send-report" ? "active" : "")}
          onClick={() => setActiveTab("send-report")}
        >
          🚀 Transmit & Dispatch ({reports.length})
        </button>
        <button
          type="button"
          className={"dem-tab " + (activeTab === "autopsy" ? "active" : "")}
          onClick={() => setActiveTab("autopsy")}
        >
          ⚡ Digital Autopsy Suite ({autopsies.length})
        </button>
      </div>

      {/* TAB 1: WORKSPACE */}
      {activeTab === "workspace" && (
        <>
          {/* KPI GRID */}
          <div className="dem-kpi-grid">
            <div className="dem-kpi-card">
              <div className="dem-kpi-top">
                <span className="dem-kpi-label">Evidence in Vault</span>
                <span className="dem-kpi-icon">📦</span>
              </div>
              <div className="dem-kpi-val">{evidence.length}</div>
              <div className="dem-kpi-desc">Awaiting forensic examination</div>
            </div>

            <div className="dem-kpi-card">
              <div className="dem-kpi-top">
                <span className="dem-kpi-label">Forensic Reports</span>
                <span className="dem-kpi-icon">📝</span>
              </div>
              <div className="dem-kpi-val">{reports.length}</div>
              <div className="dem-kpi-desc">Technical examination records</div>
            </div>

            <div className="dem-kpi-card">
              <div className="dem-kpi-top">
                <span className="dem-kpi-label">Digital Autopsies</span>
                <span className="dem-kpi-icon">⚡</span>
              </div>
              <div className="dem-kpi-val">{autopsies.length}</div>
              <div className="dem-kpi-desc">Hardware triages completed</div>
            </div>

            <div className="dem-kpi-card">
              <div className="dem-kpi-top">
                <span className="dem-kpi-label">Registered Cases</span>
                <span className="dem-kpi-icon">📁</span>
              </div>
              <div className="dem-kpi-val">{cases.length}</div>
              <div className="dem-kpi-desc">Active investigations</div>
            </div>
          </div>

          {/* EVIDENCE AWAITING ANALYSIS */}
          <div>
            <div className="dem-section-header">
              <div>
                <h2 className="dem-section-title">Evidence Awaiting Forensic Analysis</h2>
                <p className="dem-section-subtitle">
                  Select digital evidence to initiate a forensic examination dossier or hardware device autopsy
                </p>
              </div>
            </div>

            {evidence.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No Evidence In Vault"
                message="No digital evidence is currently registered in the evidence vault."
              />
            ) : (
              <Card style={{ padding: "0", overflow: "hidden" }}>
                <div className="dem-table-container" style={{ border: "none" }}>
                  <table className="dem-table">
                    <thead>
                      <tr>
                        <th>Evidence ID</th>
                        <th>Evidence Name</th>
                        <th>Type</th>
                        <th>Associated Case</th>
                        <th style={{ textAlign: "right" }}>Forensic Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.map((item) => (
                        <tr key={item.evidence_id}>
                          <td>
                            <span className="dem-evidence-id-badge">
                              {item.evidence_number}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {item.evidence_name}
                          </td>
                          <td>
                            <Badge variant="accent">
                              {item.evidence_type || "File"}
                            </Badge>
                          </td>
                          <td style={{ color: "var(--text-secondary)" }}>
                            {item.case_title || item.case_number || `Case #${item.case_id}`}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "8px" }}>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setReportForm((prev) => ({
                                    ...prev,
                                    case_id: item.case_id || "",
                                    evidence_id: item.evidence_id,
                                    report_title: "Digital Forensic Examination of " + item.evidence_name
                                  }));
                                  setActiveTab("create-report");
                                }}
                              >
                                📝 Draft Report
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAutopsyForm((prev) => ({
                                    ...prev,
                                    case_id: item.case_id || "",
                                    evidence_id: item.evidence_id,
                                    subject_name: item.evidence_name
                                  }));
                                  setActiveTab("autopsy");
                                }}
                              >
                                ⚡ Autopsy
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* TAB 2: CREATE REPORT */}
      {activeTab === "create-report" && (
        <>
          {/* DETERMINISTIC PDF DOCKET CARD */}
          <Card style={{ background: "linear-gradient(135deg, #1A1D27 0%, #151822 100%)", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
            <div className="dem-card-header">
              <div>
                <h3 className="dem-section-title" style={{ color: "#DDD6FE" }}>📄 Official Case Forensic Docket (Deterministic PDF)</h3>
                <p className="dem-section-subtitle">
                  Generates an immutable system dossier containing case records, complete SHA-256 evidence digests, verification status, custody handovers, and audit trails directly from database records.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap", marginTop: "12px" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <FormField label="Select Target Investigation Case" id="pdfCaseId">
                  <select
                    id="pdfCaseId"
                    value={pdfCaseId}
                    onChange={(e) => setPdfCaseId(e.target.value)}
                    className="dem-select"
                  >
                    <option value="">-- Choose Case File --</option>
                    {cases.map((c) => (
                      <option key={c.case_id} value={c.case_id}>
                        {c.case_number} - {c.case_title}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <Button
                variant="primary"
                icon="📥"
                disabled={!pdfCaseId || pdfDownloading}
                loading={pdfDownloading}
                onClick={() => handleDownloadPdfReport(pdfCaseId)}
              >
                {pdfDownloading ? "Compiling PDF Docket..." : "Download Official Forensic Report (PDF)"}
              </Button>
            </div>

            {pdfStatus && (
              <div
                className={`dem-alert-banner ${
                  pdfStatus.toLowerCase().includes("error") ? "dem-alert-error" : "dem-alert-success"
                }`}
                style={{ marginTop: "14px" }}
              >
                <span>{pdfStatus}</span>
              </div>
            )}
          </Card>

          {/* REPORT CREATION FORM CARD */}
          <Card>
            <div className="dem-card-header">
              <div>
                <h2 className="dem-section-title">Forensic Technical Examination Intake</h2>
                <p className="dem-section-subtitle">
                  Document memory carvings, artifact extractions, and expert cryptographic conclusions
                </p>
              </div>
            </div>

            <form
              onSubmit={handleCreateReport}
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div className="dem-form-grid-2">
                <FormField label="Associated Case" id="report_case" required>
                  <select
                    id="report_case"
                    value={reportForm.case_id}
                    onChange={(e) => setReportForm({ ...reportForm, case_id: e.target.value })}
                    required
                    className="dem-select"
                  >
                    <option value="">-- Select Case --</option>
                    {cases.map((c) => (
                      <option key={c.case_id} value={c.case_id}>
                        {c.case_number} - {c.case_title}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Evidence Asset Item" id="report_evidence" required>
                  <select
                    id="report_evidence"
                    value={reportForm.evidence_id}
                    onChange={(e) => setReportForm({ ...reportForm, evidence_id: e.target.value })}
                    required
                    className="dem-select"
                  >
                    <option value="">-- Select Evidence --</option>
                    {evidence.map((e) => (
                      <option key={e.evidence_id} value={e.evidence_id}>
                        {e.evidence_number} - {e.evidence_name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Forensic Report Title" id="report_title" required>
                <input
                  id="report_title"
                  type="text"
                  value={reportForm.report_title}
                  onChange={(e) => setReportForm({ ...reportForm, report_title: e.target.value })}
                  placeholder="e.g. Cryptographic Hash Verification & Volatile Memory Analysis"
                  required
                  className="dem-input"
                />
              </FormField>

              <div className="dem-form-grid-2">
                <FormField label="Forensic Toolchain Used" id="tools_used" required>
                  <input
                    id="tools_used"
                    type="text"
                    value={reportForm.tools_used}
                    onChange={(e) => setReportForm({ ...reportForm, tools_used: e.target.value })}
                    placeholder="e.g. Autopsy v4.21, Volatility 3, FTK Imager"
                    required
                    className="dem-input"
                  />
                </FormField>

                <div style={{ display: "flex", alignItems: "center", paddingTop: "26px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "var(--text-primary)", fontSize: "14px" }}>
                    <input
                      type="checkbox"
                      checked={reportForm.hash_verified}
                      onChange={(e) => setReportForm({ ...reportForm, hash_verified: e.target.checked })}
                      style={{ width: "18px", height: "18px", accentColor: "var(--accent)" }}
                    />
                    <span>Cryptographic SHA-256 Pre-Verification Confirmed</span>
                  </label>
                </div>
              </div>

              <FormField label="Technical Examination Findings" id="findings" required>
                <textarea
                  id="findings"
                  rows={4}
                  value={reportForm.findings}
                  onChange={(e) => setReportForm({ ...reportForm, findings: e.target.value })}
                  placeholder="Document partition layout, hidden files, timestamps, volatile artifacts, deleted records..."
                  required
                  className="dem-textarea"
                />
              </FormField>

              <FormField label="Recovered Digital Artifacts" id="artifacts">
                <textarea
                  id="artifacts"
                  rows={3}
                  value={reportForm.artifacts_recovered}
                  onChange={(e) => setReportForm({ ...reportForm, artifacts_recovered: e.target.value })}
                  placeholder="List specific artifacts: SQLite databases, browser history, exfiltrated files, chat transcripts..."
                  className="dem-textarea"
                />
              </FormField>

              <FormField label="Forensic Conclusion & Expert Opinion" id="conclusion" required>
                <textarea
                  id="conclusion"
                  rows={3}
                  value={reportForm.conclusion}
                  onChange={(e) => setReportForm({ ...reportForm, conclusion: e.target.value })}
                  placeholder="State professional opinion regarding data authenticity, signs of tampering, or attribution..."
                  required
                  className="dem-textarea"
                />
              </FormField>

              {reportMessage && (
                <div className="dem-alert-banner dem-alert-success">
                  <span>✓</span>
                  <span>{reportMessage}</span>
                </div>
              )}

              {reportError && (
                <div className="dem-alert-banner dem-alert-error">
                  <span>✕</span>
                  <span>{reportError}</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
                <Button
                  type="submit"
                  variant="primary"
                  icon="💾"
                  loading={reportCreateLoading}
                >
                  {reportCreateLoading ? "Saving Examination Record..." : "Save Technical Examination Record"}
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}

      {/* TAB 3: DISPATCH REPORTS */}
      {activeTab === "send-report" && (
        <div>
          <div className="dem-section-header">
            <div>
              <h2 className="dem-section-title">Transmitted & Available Forensic Reports</h2>
              <p className="dem-section-subtitle">
                Securely dispatch technical reports to accredited Case Managers, Prosecutors, or Admin
              </p>
            </div>
            <Button variant="outline" icon="↻" onClick={fetchReports}>
              Refresh
            </Button>
          </div>

          {reportsLoading && (
            <Card>
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                <span className="dem-btn-spinner" style={{ display: "inline-block", marginBottom: "12px", width: "24px", height: "24px", borderColor: "rgba(139, 92, 246, 0.3)", borderTopColor: "var(--accent)" }} />
                <div>Loading forensic reports...</div>
              </div>
            </Card>
          )}

          {!reportsLoading && reports.length === 0 && (
            <EmptyState
              icon="📝"
              title="No Forensic Reports Generated"
              message="Use the 'Generate Forensic Report' tab to compile and certify your first technical examination."
            />
          )}

          {!reportsLoading && reports.length > 0 && (
            <Card style={{ padding: "0", overflow: "hidden" }}>
              <div className="dem-table-container" style={{ border: "none" }}>
                <table className="dem-table">
                  <thead>
                    <tr>
                      <th>Report Number</th>
                      <th>Title & Case</th>
                      <th>Evidence Item</th>
                      <th>Analyst</th>
                      <th>Status</th>
                      <th>Dispatched To</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((rep) => (
                      <tr key={rep.report_id}>
                        <td>
                          <span className="dem-evidence-id-badge">
                            {rep.report_number}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{rep.report_title}</div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {rep.case_number || `Case #${rep.case_id}`}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>
                            {rep.evidence_number || `EV-#${rep.evidence_id}`}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            {rep.evidence_name}
                          </div>
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>
                          {rep.analyst_name || `Analyst #${rep.analyst_id}`}
                        </td>
                        <td>
                          <Badge
                            variant={rep.status === "DISPATCHED" ? "valid" : "accent"}
                          >
                            {rep.status}
                          </Badge>
                        </td>
                        <td style={{ fontSize: "13px" }}>
                          {rep.recipient_name ? (
                            <div>
                              <strong style={{ color: "var(--text-primary)" }}>{rep.recipient_name}</strong>
                              <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{rep.recipient_agency}</div>
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-dim)" }}>In Laboratory</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadPdfReport(rep.case_id)}
                              title="Download Certified PDF Report"
                            >
                              📥 PDF
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
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
                              🚀 Dispatch
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 4: DIGITAL AUTOPSY SUITE */}
      {activeTab === "autopsy" && (
        <>
          {/* AUTOPSY INTAKE FORM */}
          <Card>
            <div className="dem-card-header">
              <div>
                <h2 className="dem-section-title">Digital Device Autopsy & Hardware Triage</h2>
                <p className="dem-section-subtitle">
                  Document physical hardware examination, write-blocking verification, and raw image extraction
                </p>
              </div>
            </div>

            <form
              onSubmit={handleCreateAutopsy}
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div className="dem-form-grid-2">
                <FormField label="Associated Case" id="autopsy_case" required>
                  <select
                    id="autopsy_case"
                    value={autopsyForm.case_id}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, case_id: e.target.value })}
                    required
                    className="dem-select"
                  >
                    <option value="">-- Select Case --</option>
                    {cases.map((c) => (
                      <option key={c.case_id} value={c.case_id}>
                        {c.case_number} - {c.case_title}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Evidence Reference" id="autopsy_evidence" required>
                  <select
                    id="autopsy_evidence"
                    value={autopsyForm.evidence_id}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, evidence_id: e.target.value })}
                    required
                    className="dem-select"
                  >
                    <option value="">-- Select Evidence --</option>
                    {evidence.map((e) => (
                      <option key={e.evidence_id} value={e.evidence_id}>
                        {e.evidence_number} - {e.evidence_name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Subject Device Name" id="subject_name" required>
                  <input
                    id="subject_name"
                    type="text"
                    value={autopsyForm.subject_name}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, subject_name: e.target.value })}
                    placeholder="e.g. Seized Samsung Galaxy S23 / Kingston 512GB SSD"
                    required
                    className="dem-input"
                  />
                </FormField>

                <FormField label="Device Type" id="device_type">
                  <select
                    id="device_type"
                    value={autopsyForm.device_type}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, device_type: e.target.value })}
                    className="dem-select"
                  >
                    <option value="Solid State Drive (M.2 NVMe)">Solid State Drive (M.2 NVMe)</option>
                    <option value="Mechanical Hard Drive (SATA HDD)">Mechanical Hard Drive (SATA HDD)</option>
                    <option value="Smartphone (Android)">Smartphone (Android)</option>
                    <option value="Smartphone (Apple iOS)">Smartphone (Apple iOS)</option>
                    <option value="USB Flash Drive / SD Card">USB Flash Drive / SD Card</option>
                    <option value="Server / NAS Appliance">Server / NAS Appliance</option>
                  </select>
                </FormField>

                <FormField label="Physical Hardware Condition" id="hardware_condition" required>
                  <input
                    id="hardware_condition"
                    type="text"
                    value={autopsyForm.hardware_condition}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, hardware_condition: e.target.value })}
                    placeholder="e.g. Intact, write-blocked during physical acquisition"
                    required
                    className="dem-input"
                  />
                </FormField>

                <FormField label="Extraction / Imaging Method" id="extraction_method" required>
                  <input
                    id="extraction_method"
                    type="text"
                    value={autopsyForm.extraction_method}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, extraction_method: e.target.value })}
                    placeholder="e.g. Bit-stream physical forensic image (E01 format)"
                    required
                    className="dem-input"
                  />
                </FormField>
              </div>

              <FormField label="Autopsy Findings & Partition Analysis" id="autopsy_findings" required>
                <textarea
                  id="autopsy_findings"
                  rows={3}
                  value={autopsyForm.autopsy_findings}
                  onChange={(e) => setAutopsyForm({ ...autopsyForm, autopsy_findings: e.target.value })}
                  placeholder="Record partition layout, firmware metadata, bad sector analysis, unallocated space carving..."
                  required
                  className="dem-textarea"
                />
              </FormField>

              <FormField label="Triage & Health Summary" id="triage_summary">
                <textarea
                  id="triage_summary"
                  rows={2}
                  value={autopsyForm.triage_summary}
                  onChange={(e) => setAutopsyForm({ ...autopsyForm, triage_summary: e.target.value })}
                  placeholder="Summary of hardware stability, write-block certification, integrity confirmation..."
                  className="dem-textarea"
                />
              </FormField>

              {autopsyMessage && (
                <div className="dem-alert-banner dem-alert-success">
                  <span>✓</span>
                  <span>{autopsyMessage}</span>
                </div>
              )}

              {autopsyError && (
                <div className="dem-alert-banner dem-alert-error">
                  <span>✕</span>
                  <span>{autopsyError}</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
                <Button
                  type="submit"
                  variant="primary"
                  icon="⚡"
                  loading={autopsyCreateLoading}
                >
                  {autopsyCreateLoading ? "Recording..." : "Log Digital Autopsy Record"}
                </Button>
              </div>
            </form>
          </Card>

          {/* AUTOPSY LOGS TABLE */}
          <div>
            <div className="dem-section-header">
              <div>
                <h2 className="dem-section-title">Digital Autopsy Records</h2>
                <p className="dem-section-subtitle">
                  {autopsies.length} hardware autopsy triage record{autopsies.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button variant="outline" icon="↻" onClick={fetchAutopsies}>
                Refresh
              </Button>
            </div>

            {autopsiesLoading && (
              <Card>
                <div style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                  <span className="dem-btn-spinner" style={{ display: "inline-block", marginBottom: "12px", width: "24px", height: "24px", borderColor: "rgba(139, 92, 246, 0.3)", borderTopColor: "var(--accent)" }} />
                  <div>Loading autopsies...</div>
                </div>
              </Card>
            )}

            {!autopsiesLoading && autopsies.length === 0 && (
              <EmptyState
                icon="⚡"
                title="No Device Autopsies Recorded"
                message="Use the form above to document the physical acquisition and extraction of a hardware device."
              />
            )}

            {!autopsiesLoading && autopsies.length > 0 && (
              <Card style={{ padding: "0", overflow: "hidden" }}>
                <div className="dem-table-container" style={{ border: "none" }}>
                  <table className="dem-table">
                    <thead>
                      <tr>
                        <th>Autopsy ID</th>
                        <th>Device & Subject</th>
                        <th>Device Type</th>
                        <th>Extraction Method</th>
                        <th>Status</th>
                        <th>Dispatched To</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {autopsies.map((item) => (
                        <tr key={item.autopsy_id}>
                          <td>
                            <span className="dem-evidence-id-badge">
                              {item.autopsy_number}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.subject_name}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              {item.evidence_number ? item.evidence_number + " - " : ""}{item.hardware_condition}
                            </div>
                          </td>
                          <td style={{ color: "var(--text-secondary)" }}>{item.device_type}</td>
                          <td style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{item.extraction_method}</td>
                          <td>
                            <Badge variant={item.status === "DISPATCHED" ? "valid" : "accent"}>
                              {item.status}
                            </Badge>
                          </td>
                          <td style={{ fontSize: "13px" }}>
                            {item.dispatched_to ? (
                              <div>
                                <strong style={{ color: "var(--text-primary)" }}>{item.dispatched_to}</strong>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                  {item.dispatched_at ? new Date(item.dispatched_at).toLocaleDateString() : ""}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-dim)" }}>In Lab</span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Button
                              variant="primary"
                              size="sm"
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
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* DISPATCH REPORT MODAL */}
      {dispatchingReport && (
        <div className="dem-modal-backdrop">
          <div className="dem-modal-card">
            <div className="dem-card-header">
              <h3 className="dem-section-title">Securely Dispatch Report {dispatchingReport.report_number}</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "18px", cursor: "pointer" }}
                onClick={() => setDispatchingReport(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "16px", padding: "14px", background: "var(--bg-input)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "14px", marginBottom: "4px" }}>
                <span style={{ color: "var(--text-muted)" }}>Title: </span>
                <strong>{dispatchingReport.report_title}</strong>
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                <span>Evidence: </span>
                {dispatchingReport.evidence_number} ({dispatchingReport.evidence_name})
              </div>
            </div>

            <form onSubmit={handleConfirmDispatchReport} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <FormField label="Recipient Officer / Personnel" id="disp_recip" required>
                <select
                  id="disp_recip"
                  value={dispatchForm.recipient_id}
                  onChange={(e) => {
                    const sel = usersList.find((u) => String(u.user_id) === e.target.value);
                    setDispatchForm({
                      ...dispatchForm,
                      recipient_id: e.target.value,
                      recipient_name: sel ? sel.full_name : dispatchForm.recipient_name
                    });
                  }}
                  required
                  className="dem-select"
                >
                  <option value="">-- Choose Recipient Officer --</option>
                  {usersList.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name} ({u.role_name || `Role #${u.role_id}`}) - {u.employee_id}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Recipient Agency / Department" id="disp_agency" required>
                <input
                  id="disp_agency"
                  type="text"
                  value={dispatchForm.recipient_agency}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, recipient_agency: e.target.value })}
                  required
                  className="dem-input"
                />
              </FormField>

              <FormField label="Transmission Priority" id="disp_prio">
                <select
                  id="disp_prio"
                  value={dispatchForm.transmission_priority}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, transmission_priority: e.target.value })}
                  className="dem-select"
                >
                  <option value="CRITICAL">CRITICAL (Immediate Judicial / Court Action)</option>
                  <option value="HIGH">HIGH (Active Criminal Investigation)</option>
                  <option value="STANDARD">STANDARD (Archival / Record-Keeping)</option>
                </select>
              </FormField>

              <FormField label="Transmission & Chain of Custody Notes" id="disp_notes">
                <textarea
                  id="disp_notes"
                  rows={3}
                  value={dispatchForm.dispatch_notes}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, dispatch_notes: e.target.value })}
                  placeholder="Enter dispatch notes, cryptographic verification confirmation..."
                  className="dem-textarea"
                />
              </FormField>

              {dispatchMessage && (
                <div className="dem-alert-banner dem-alert-success">
                  <span>✓</span>
                  <span>{dispatchMessage}</span>
                </div>
              )}

              {dispatchError && (
                <div className="dem-alert-banner dem-alert-error">
                  <span>✕</span>
                  <span>{dispatchError}</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
                <Button variant="secondary" onClick={() => setDispatchingReport(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={dispatchLoading}>
                  {dispatchLoading ? "Transmitting..." : "Authorize & Send Report"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH AUTOPSY MODAL */}
      {dispatchingAutopsy && (
        <div className="dem-modal-backdrop">
          <div className="dem-modal-card">
            <div className="dem-card-header">
              <h3 className="dem-section-title">Dispatch Autopsy Record {dispatchingAutopsy.autopsy_number}</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "18px", cursor: "pointer" }}
                onClick={() => setDispatchingAutopsy(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmDispatchAutopsy} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <FormField label="Dispatched To (Authority / Department)" id="disp_to" required>
                <input
                  id="disp_to"
                  type="text"
                  value={autopsyDispatchForm.dispatched_to}
                  onChange={(e) => setAutopsyDispatchForm({ ...autopsyDispatchForm, dispatched_to: e.target.value })}
                  required
                  className="dem-input"
                />
              </FormField>

              <FormField label="Recipient Officer (Optional)" id="autopsy_recip">
                <select
                  id="autopsy_recip"
                  value={autopsyDispatchForm.recipient_id}
                  onChange={(e) => setAutopsyDispatchForm({ ...autopsyDispatchForm, recipient_id: e.target.value })}
                  className="dem-select"
                >
                  <option value="">-- Select Recipient Officer --</option>
                  {usersList.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name} ({u.role_name || `Role #${u.role_id}`})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Dispatch Notes" id="autopsy_notes">
                <textarea
                  id="autopsy_notes"
                  rows={3}
                  value={autopsyDispatchForm.dispatch_notes}
                  onChange={(e) => setAutopsyDispatchForm({ ...autopsyDispatchForm, dispatch_notes: e.target.value })}
                  placeholder="Enter notes on bit-stream storage location or custody handover..."
                  className="dem-textarea"
                />
              </FormField>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
                <Button variant="secondary" onClick={() => setDispatchingAutopsy(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={autopsyDispatchLoading}>
                  {autopsyDispatchLoading ? "Dispatching..." : "Confirm Dispatch"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
