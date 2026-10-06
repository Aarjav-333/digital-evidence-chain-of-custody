import { useState, useEffect } from "react";
import { PageHeader, Card, Badge, Button, FormField, EmptyState } from "./common";
import { canAuthorReports } from "../utils/permissionHelper";

export default function ForensicSuite({ user, evidence = [], cases = [], onRefresh }) {
  const isAuthor = canAuthorReports(user);
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

  // Autopsy detail view modal
  const [selectedAutopsyDetail, setSelectedAutopsyDetail] = useState(null);

  // Autopsy dispatch modal
  const [dispatchingAutopsy, setDispatchingAutopsy] = useState(null);
  const [autopsyDispatchForm, setAutopsyDispatchForm] = useState({
    dispatched_to: "Chief Forensic Lab & Lead Investigator",
    recipient_id: "",
    dispatch_notes: ""
  });
  const [autopsyDispatchLoading, setAutopsyDispatchLoading] = useState(false);
  const [autopsyDispatchError, setAutopsyDispatchError] = useState("");

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
      setPdfStatus("Error: Please select a case file to generate the forensic report PDF.");
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
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleCreateReport = async (e) => {
    e.preventDefault();
    if (!isAuthor) {
      setReportError("Your role has view-only access to reports.");
      return;
    }
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
          status: reportForm.status
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReportMessage("Forensic report " + data.data.report_number + " created successfully!");
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
      } else {
        setReportError(data.message || (data.error === "FORBIDDEN" ? "Your role has view-only access to reports." : "Failed to create forensic report"));
      }
    } catch (err) {
      setReportError(err.message || "Failed to create forensic report");
    } finally {
      setReportCreateLoading(false);
    }
  };

  const handleConfirmDispatchReport = async (e) => {
    e.preventDefault();
    if (!isAuthor) {
      setDispatchError("Your role has view-only access to reports.");
      return;
    }
    if (!dispatchingReport || !token) return;
    setDispatchLoading(true);
    setDispatchError("");
    setDispatchMessage("");

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
        setDispatchError(data.message || (data.error === "FORBIDDEN" ? "Your role has view-only access to reports." : "Failed to dispatch report"));
      }
    } catch (err) {
      setDispatchError(err.message || "Failed to dispatch report");
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleCreateAutopsy = async (e) => {
    e.preventDefault();
    if (!isAuthor) {
      setAutopsyError("Your role has view-only access to reports.");
      return;
    }
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
        setAutopsyError(data.message || (data.error === "FORBIDDEN" ? "Your role has view-only access to reports." : "Failed to log autopsy record"));
      }
    } catch (err) {
      setAutopsyError(err.message || "Failed to log autopsy record");
    } finally {
      setAutopsyCreateLoading(false);
    }
  };

  const handleConfirmDispatchAutopsy = async (e) => {
    e.preventDefault();
    if (!isAuthor) {
      setAutopsyDispatchError("Your role has view-only access to reports.");
      return;
    }
    if (!dispatchingAutopsy || !token) return;
    setAutopsyDispatchLoading(true);
    setAutopsyDispatchError("");

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
        setAutopsyDispatchError(data.message || (data.error === "FORBIDDEN" ? "Your role has view-only access to reports." : "Failed to dispatch autopsy"));
      }
    } catch (err) {
      setAutopsyDispatchError(err.message || "Failed to dispatch autopsy");
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
        actions={
          !isAuthor ? (
            <Badge
              variant="neutral"
              style={{
                background: "rgba(148, 163, 184, 0.14)",
                color: "#cbd5e1",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600
              }}
            >
              🔒 View-Only Mode
            </Badge>
          ) : (
            <Badge
              variant="valid"
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600
              }}
            >
              ⚡ Authoring Authorized
            </Badge>
          )
        }
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
        {isAuthor && (
          <button
            type="button"
            className={"dem-tab " + (activeTab === "create-report" ? "active" : "")}
            onClick={() => setActiveTab("create-report")}
          >
            📝 Generate Forensic Report
          </button>
        )}
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
                  {isAuthor
                    ? "Select digital evidence to initiate a forensic examination dossier or hardware device autopsy"
                    : "Evidence inventory currently registered and available for laboratory examination"}
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
                            {isAuthor ? (
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
                            ) : (
                              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                                View Only
                              </span>
                            )}
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
        !isAuthor ? (
          <Card>
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔒</div>
              <h3 className="dem-section-title" style={{ fontSize: "20px", marginBottom: "8px" }}>
                Forensic Report Authoring Restricted
              </h3>
              <p className="dem-section-subtitle" style={{ maxWidth: "560px", margin: "0 auto 24px auto", fontSize: "14px", lineHeight: "1.6" }}>
                Your current role (<strong>{user?.role_name || "Investigator"}</strong>) has view-only access to reports.
                Drafting, authoring, and certifying official laboratory examination dossiers is strictly restricted to the <strong>Forensic Officer</strong>.
              </p>
              <div style={{ display: "inline-flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                <Button variant="primary" icon="📥" onClick={() => setActiveTab("send-report")}>
                  Go to Transmit & Dispatch to View Reports
                </Button>
                <Button variant="secondary" icon="🔬" onClick={() => setActiveTab("workspace")}>
                  Return to Workspace
                </Button>
              </div>
            </div>
          </Card>
        ) : (
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
                      <option value="">-- Select Case File --</option>
                      {cases.map((c) => (
                        <option key={c.case_id} value={c.case_id}>
                          {c.case_number} - {c.case_title}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Digital Evidence Item" id="report_ev" required>
                    <select
                      id="report_ev"
                      value={reportForm.evidence_id}
                      onChange={(e) => setReportForm({ ...reportForm, evidence_id: e.target.value })}
                      required
                      className="dem-select"
                    >
                      <option value="">-- Choose Evidence Item --</option>
                      {evidence.map((ev) => (
                        <option key={ev.evidence_id} value={ev.evidence_id}>
                          {ev.evidence_number} - {ev.evidence_name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="dem-form-grid-2">
                  <FormField label="Report Title / Subject" id="report_title" required>
                    <input
                      id="report_title"
                      type="text"
                      value={reportForm.report_title}
                      onChange={(e) => setReportForm({ ...reportForm, report_title: e.target.value })}
                      required
                      placeholder="e.g. Comprehensive Volatile Memory & Disk Analysis"
                      className="dem-input"
                    />
                  </FormField>

                  <FormField label="Examination Type" id="report_type">
                    <select
                      id="report_type"
                      value={reportForm.report_type}
                      onChange={(e) => setReportForm({ ...reportForm, report_type: e.target.value })}
                      className="dem-select"
                    >
                      <option value="DIGITAL_FORENSIC_EXAMINATION">Digital Forensic Examination</option>
                      <option value="MEMORY_ANALYSIS">Volatile Memory Analysis</option>
                      <option value="NETWORK_PACKET_INSPECTION">Network Packet Inspection</option>
                      <option value="MALWARE_TRIAGE">Malware Triage & Reverse Engineering</option>
                      <option value="CLOUD_AUDIT">Cloud Storage Artifact Recovery</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Tools & Frameworks Utilized" id="report_tools">
                  <input
                    id="report_tools"
                    type="text"
                    value={reportForm.tools_used}
                    onChange={(e) => setReportForm({ ...reportForm, tools_used: e.target.value })}
                    placeholder="e.g. Autopsy 4.21, FTK Imager, Volatility 3, Wireshark, Ghidra"
                    className="dem-input"
                  />
                </FormField>

                <FormField label="Forensic Findings & Technical Evidence" id="report_findings" required>
                  <textarea
                    id="report_findings"
                    rows={4}
                    value={reportForm.findings}
                    onChange={(e) => setReportForm({ ...reportForm, findings: e.target.value })}
                    required
                    placeholder="Detail specific artifacts located, offset positions, deleted timestamps, or communication traces..."
                    className="dem-textarea"
                  />
                </FormField>

                <FormField label="Recovered Artifacts & Cryptographic Proofs" id="report_artifacts">
                  <textarea
                    id="report_artifacts"
                    rows={3}
                    value={reportForm.artifacts_recovered}
                    onChange={(e) => setReportForm({ ...reportForm, artifacts_recovered: e.target.value })}
                    placeholder="List file signatures, SHA-256 hash trees, carving outputs, or decoded payloads..."
                    className="dem-textarea"
                  />
                </FormField>

                <FormField label="Expert Conclusion & Judicial Certification" id="report_conclusion" required>
                  <textarea
                    id="report_conclusion"
                    rows={3}
                    value={reportForm.conclusion}
                    onChange={(e) => setReportForm({ ...reportForm, conclusion: e.target.value })}
                    required
                    placeholder="Provide authoritative diagnostic summary certified under digital forensics standard ISO/IEC 27037..."
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
        )
      )}

      {/* TAB 3: DISPATCH REPORTS */}
      {activeTab === "send-report" && (
        <div>
          {/* DETERMINISTIC PDF DOCKET CARD - AVAILABLE TO ALL VIEWERS */}
          <Card style={{ background: "linear-gradient(135deg, #1A1D27 0%, #151822 100%)", border: "1px solid rgba(139, 92, 246, 0.25)", marginBottom: "24px" }}>
            <div className="dem-card-header">
              <div>
                <h3 className="dem-section-title" style={{ color: "#DDD6FE" }}>📄 Official Case Forensic Docket (Deterministic PDF)</h3>
                <p className="dem-section-subtitle">
                  Generate an immutable system dossier containing case records, complete SHA-256 evidence digests, verification status, custody handovers, and audit trails directly from database records.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap", marginTop: "12px" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <FormField label="Select Target Investigation Case" id="pdfCaseIdDispatch">
                  <select
                    id="pdfCaseIdDispatch"
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

          <div className="dem-section-header">
            <div>
              <h2 className="dem-section-title">Transmitted & Available Forensic Reports</h2>
              <p className="dem-section-subtitle">
                {isAuthor
                  ? "Securely dispatch technical reports to accredited Case Managers, Prosecutors, or Admin"
                  : "Review finalized laboratory examination records and download certified PDF dockets"}
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
              message={isAuthor
                ? "Use the 'Generate Forensic Report' tab to compile and certify your first technical examination."
                : "No forensic technical examination records have been authored yet."}
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
                            {isAuthor && (
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
                            )}
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
          {/* READ-ONLY BANNER FOR VIEW-ONLY ROLES */}
          {!isAuthor && (
            <div
              style={{
                background: "rgba(148, 163, 184, 0.08)",
                border: "1px solid rgba(148, 163, 184, 0.22)",
                borderRadius: "8px",
                padding: "12px 18px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}
            >
              <span style={{ fontSize: "18px" }}>ℹ️</span>
              <span style={{ fontSize: "13px", color: "#cbd5e1" }}>
                <strong>View-Only Autopsy Access:</strong> You can inspect completed hardware device autopsies and physical extraction details. Hardware triage and bit-stream physical extraction intake is strictly authorized for Forensic Officers.
              </span>
            </div>
          )}

          {/* AUTOPSY INTAKE FORM (RENDERED FOR FORENSIC OFFICER ONLY) */}
          {isAuthor && (
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
                      <option value="">-- Select Evidence Item --</option>
                      {evidence.map((ev) => (
                        <option key={ev.evidence_id} value={ev.evidence_id}>
                          {ev.evidence_number} - {ev.evidence_name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="dem-form-grid-2">
                  <FormField label="Subject Device / Manufacturer" id="autopsy_subject" required>
                    <input
                      id="autopsy_subject"
                      type="text"
                      value={autopsyForm.subject_name}
                      onChange={(e) => setAutopsyForm({ ...autopsyForm, subject_name: e.target.value })}
                      required
                      placeholder="e.g. Samsung 980 Pro NVMe / iPhone 13 Pro Max"
                      className="dem-input"
                    />
                  </FormField>

                  <FormField label="Hardware Device Category" id="autopsy_dev_type">
                    <select
                      id="autopsy_dev_type"
                      value={autopsyForm.device_type}
                      onChange={(e) => setAutopsyForm({ ...autopsyForm, device_type: e.target.value })}
                      className="dem-select"
                    >
                      <option value="Solid State Drive (M.2 NVMe)">Solid State Drive (M.2 NVMe)</option>
                      <option value="Mobile Phone (iOS / Android)">Mobile Phone (iOS / Android)</option>
                      <option value="Mechanical Hard Disk (SATA 3.5)">Mechanical Hard Disk (SATA 3.5)</option>
                      <option value="Removable Flash Memory (USB/SD)">Removable Flash Memory (USB/SD)</option>
                      <option value="Encrypted Hardware Token">Encrypted Hardware Token</option>
                      <option value="Embedded Automotive ECU">Embedded Automotive ECU</option>
                    </select>
                  </FormField>
                </div>

                <div className="dem-form-grid-2">
                  <FormField label="Physical Hardware Condition & Write-Blocking" id="autopsy_hw_cond">
                    <input
                      id="autopsy_hw_cond"
                      type="text"
                      value={autopsyForm.hardware_condition}
                      onChange={(e) => setAutopsyForm({ ...autopsyForm, hardware_condition: e.target.value })}
                      placeholder="e.g. Intact, Tableau T8u Forensic USB 3.0 bridge write-block confirmed"
                      className="dem-input"
                    />
                  </FormField>

                  <FormField label="Physical Imaging & Extraction Technique" id="autopsy_ext_method">
                    <input
                      id="autopsy_ext_method"
                      type="text"
                      value={autopsyForm.extraction_method}
                      onChange={(e) => setAutopsyForm({ ...autopsyForm, extraction_method: e.target.value })}
                      placeholder="e.g. Bit-stream physical forensic image (E01 format) via FTK Imager"
                      className="dem-input"
                    />
                  </FormField>
                </div>

                <FormField label="Triage & Visual Inspection Summary" id="autopsy_triage">
                  <textarea
                    id="autopsy_triage"
                    rows={3}
                    value={autopsyForm.triage_summary}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, triage_summary: e.target.value })}
                    placeholder="Describe external port condition, serial numbers, connector integrity, or forensic triage observations..."
                    className="dem-textarea"
                  />
                </FormField>

                <FormField label="Autopsy Findings & Carved Partition Structure" id="autopsy_find">
                  <textarea
                    id="autopsy_find"
                    rows={4}
                    value={autopsyForm.autopsy_findings}
                    onChange={(e) => setAutopsyForm({ ...autopsyForm, autopsy_findings: e.target.value })}
                    placeholder="Document GPT/MBR partition tables, BitLocker status, unallocated space clusters, or damaged sectors..."
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
                    {autopsyCreateLoading ? "Saving Autopsy Record..." : "Log Completed Hardware Autopsy"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* AUTOPSY RECORDS TABLE (AVAILABLE TO ALL ROLES) */}
          <div style={{ marginTop: isAuthor ? "32px" : "0" }}>
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
                message={isAuthor
                  ? "Use the form above to document the physical acquisition and extraction of a hardware device."
                  : "No device autopsy records are currently registered in the system."}
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
                            <div style={{ display: "inline-flex", gap: "8px" }}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAutopsyDetail(item)}
                                title="Inspect full autopsy findings and triage report"
                              >
                                🔍 View Details
                              </Button>
                              {isAuthor && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    setDispatchingAutopsy(item);
                                    setAutopsyDispatchError("");
                                    setAutopsyDispatchForm({
                                      dispatched_to: "Lead Investigator & Evidence Vault",
                                      recipient_id: usersList[0]?.user_id || "",
                                      dispatch_notes: "Hardware examination completed for " + item.autopsy_number + ". Bit-stream image archived."
                                    });
                                  }}
                                >
                                  🚀 Send Autopsy
                                </Button>
                              )}
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

      {/* AUTOPSY DETAIL MODAL (FOR ALL ROLES) */}
      {selectedAutopsyDetail && (
        <div className="dem-modal-backdrop">
          <div className="dem-modal-card" style={{ maxWidth: "700px" }}>
            <div className="dem-card-header">
              <div>
                <h3 className="dem-section-title">
                  Digital Device Autopsy: {selectedAutopsyDetail.autopsy_number}
                </h3>
                <p className="dem-section-subtitle">
                  Hardware extraction and forensic triage dossier
                </p>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "18px", cursor: "pointer" }}
                onClick={() => setSelectedAutopsyDetail(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "70vh", overflowY: "auto", paddingRight: "4px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", background: "var(--bg-input)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>Subject Device</div>
                  <div style={{ fontWeight: 600, marginTop: "2px" }}>{selectedAutopsyDetail.subject_name || "N/A"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>Device Category</div>
                  <div style={{ marginTop: "2px" }}>{selectedAutopsyDetail.device_type || "N/A"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>Associated Case</div>
                  <div style={{ marginTop: "2px" }}>{selectedAutopsyDetail.case_number ? `${selectedAutopsyDetail.case_number} - ${selectedAutopsyDetail.case_title || ""}` : `Case #${selectedAutopsyDetail.case_id}`}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>Evidence Item</div>
                  <div style={{ marginTop: "2px" }}>{selectedAutopsyDetail.evidence_number ? `${selectedAutopsyDetail.evidence_number} (${selectedAutopsyDetail.evidence_name || ""})` : `EV-#${selectedAutopsyDetail.evidence_id}`}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>Forensic Examiner</div>
                  <div style={{ marginTop: "2px" }}>{selectedAutopsyDetail.examiner_name || `Examiner #${selectedAutopsyDetail.examiner_id}`}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>Status</div>
                  <div style={{ marginTop: "2px" }}>
                    <Badge variant={selectedAutopsyDetail.status === "DISPATCHED" ? "valid" : "accent"}>
                      {selectedAutopsyDetail.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Hardware Condition & Write-Blocking</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", background: "var(--bg-card)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  {selectedAutopsyDetail.hardware_condition || "Not recorded"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Extraction Technique</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", background: "var(--bg-card)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  {selectedAutopsyDetail.extraction_method || "Not recorded"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Triage & Visual Inspection Summary</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", background: "var(--bg-card)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", whiteSpace: "pre-wrap" }}>
                  {selectedAutopsyDetail.triage_summary || "No summary provided"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Autopsy Findings & Carved Partition Structure</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", background: "var(--bg-card)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", whiteSpace: "pre-wrap" }}>
                  {selectedAutopsyDetail.autopsy_findings || "No findings recorded"}
                </div>
              </div>

              {selectedAutopsyDetail.dispatched_to && (
                <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "12px 16px", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#6ee7b7", marginBottom: "4px" }}>Chain of Custody Dispatch</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    Dispatched to <strong>{selectedAutopsyDetail.dispatched_to}</strong> on {selectedAutopsyDetail.dispatched_at ? new Date(selectedAutopsyDetail.dispatched_at).toLocaleString() : "N/A"}.
                    {selectedAutopsyDetail.dispatch_notes && (
                      <div style={{ marginTop: "4px", fontSize: "12px", fontStyle: "italic", color: "var(--text-muted)" }}>
                        Notes: "{selectedAutopsyDetail.dispatch_notes}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
              <Button variant="secondary" onClick={() => setSelectedAutopsyDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH REPORT MODAL (FORENSIC OFFICER ONLY) */}
      {isAuthor && dispatchingReport && (
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

      {/* DISPATCH AUTOPSY MODAL (FORENSIC OFFICER ONLY) */}
      {isAuthor && dispatchingAutopsy && (
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

              {autopsyDispatchError && (
                <div className="dem-alert-banner dem-alert-error">
                  <span>✕</span>
                  <span>{autopsyDispatchError}</span>
                </div>
              )}

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
