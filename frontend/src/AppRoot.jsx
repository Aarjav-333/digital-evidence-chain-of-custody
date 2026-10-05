import AlertCenter from "./components/AlertCenter";
import ForensicSuite from "./components/ForensicSuite";
import { useState, useEffect } from "react";
import "./App.css";
import "./layout.css";

function App() {
  // =========================
  // LOGIN STATE
  // =========================

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // =========================
  // PAGE STATE
  // =========================

  const [currentPage, setCurrentPage] = useState("dashboard");

  // =========================
  // USER STATE
  // =========================

  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem("token")
  );

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // =========================
  // EVIDENCE STATE
  // =========================

  const [evidence, setEvidence] = useState([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  // =========================
// CASE STATE
// =========================
const [cases, setCases] = useState([]);
const [casesLoading, setCasesLoading] = useState(false);
const [caseForm, setCaseForm] = useState({
  case_title: "",
  case_description: "",
  investigating_officer: ""
});

const [caseCreateLoading, setCaseCreateLoading] = useState(false);
const [caseMessage, setCaseMessage] = useState("");
const [caseError, setCaseError] = useState("");
const [selectedCaseId, setSelectedCaseId] = useState("");

const [verificationResults, setVerificationResults] = useState({});
  const [verifyingId, setVerifyingId] = useState(null);

  // =========================
  // UPLOAD STATE
  // =========================

  const [uploadForm, setUploadForm] = useState({
    case_id: "",
    evidence_name: "",
    evidence_type: "",
    description: "",
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
    // =========================
  // CHAIN OF CUSTODY STATE
  // =========================

  const [selectedCustodyEvidence, setSelectedCustodyEvidence] = useState("");
  const [custodyLogs, setCustodyLogs] = useState([]);
  const [custodyLoading, setCustodyLoading] = useState(false);

  const [transferForm, setTransferForm] = useState({
    to_user: "7",
    action: "TRANSFERRED",
    remarks: "",
  });

  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const [transferError, setTransferError] = useState("");
  // =========================
// AUDIT LOG STATE
// =========================

const [auditLogs, setAuditLogs] = useState([]);
const [auditLoading, setAuditLoading] = useState(false);
// =========================
// FETCH EVIDENCE
// =========================

const fetchEvidence = async (attempt = 1) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return;
  }

  setEvidenceLoading(true);

  try {
    const response = await fetch(
      "http://localhost:3000/api/evidence",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    // Token expired / invalid
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      setUser(null);
      setLoggedIn(false);
      setEvidence([]);

      return;
    }

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to fetch evidence"
      );
    }

    setEvidence(data.data || []);

  } catch (error) {
    console.error(
      `Evidence fetch attempt ${attempt} failed:`,
      error
    );

    // Retry automatically up to 3 times
    if (attempt < 3) {
      setTimeout(() => {
        fetchEvidence(attempt + 1);
      }, 1000);
    }

  } finally {
    setEvidenceLoading(false);
  }
};
// =========================
// FETCH CASES
// =========================
const fetchCases = async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    return;
  }

  setCasesLoading(true);

  try {
    const response = await fetch(
      "http://localhost:3000/api/cases",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to fetch cases"
      );
    }

    setCases(data.data || []);
  } catch (error) {
    console.error("Cases fetch error:", error);
    setCases([]);
  } finally {
    setCasesLoading(false);
  }
};
// =========================
// CREATE CASE
// =========================

const handleCaseChange = (e) => {
  const { name, value } = e.target;

  setCaseForm((previous) => ({
    ...previous,
    [name]: value
  }));
};

const handleCreateCase = async (e) => {
  e.preventDefault();

  setCaseMessage("");
  setCaseError("");

  const token = localStorage.getItem("token");

  if (!token) {
    setCaseError("You are not logged in.");
    return;
  }

  setCaseCreateLoading(true);

  try {
    const response = await fetch(
      "http://localhost:3000/api/cases",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          case_title: caseForm.case_title,
          case_description: caseForm.case_description,
          investigating_officer: Number(
            caseForm.investigating_officer
          )
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to create case"
      );
    }

    setCaseMessage(
      `Case created successfully: ${data.data.case_number}`
    );

    setCaseForm({
      case_title: "",
      case_description: "",
      investigating_officer: ""
    });

    await fetchCases();

  } catch (error) {
    console.error("Case creation error:", error);
    setCaseError(error.message);

  } finally {
    setCaseCreateLoading(false);
  }
};
  // =========================
  // LOAD EVIDENCE AFTER LOGIN
  // =========================

useEffect(() => {
  if (loggedIn) {
    fetchEvidence();

    if (currentPage === "audit") {
      fetchAuditLogs();
    }

    if (
      currentPage === "upload" ||
      currentPage === "cases" ||
      currentPage === "dashboard" ||
      currentPage === "evidence"
    ) {
      fetchCases();
    }
  }
}, [loggedIn, currentPage]);

// MANDATORY DEFAULT CASE
useEffect(() => {
  if (!selectedCaseId && cases.length > 0) {
    setSelectedCaseId(cases[0].case_id);
  }
}, [cases, selectedCaseId]);
  // =========================
  // VERIFY EVIDENCE
  // =========================

  const handleVerify = async (evidenceId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    setVerifyingId(evidenceId);

    try {
      const response = await fetch(
        `http://localhost:3000/api/evidence/${evidenceId}/verify`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Verification failed"
        );
      }

      setVerificationResults((previous) => ({
        ...previous,
        [evidenceId]: data.data,
      }));
    } catch (error) {
      console.error("Verification error:", error);

      setVerificationResults((previous) => ({
        ...previous,
        [evidenceId]: {
          integrity_status: "ERROR",
          message: error.message,
        },
      }));
    } finally {
      setVerifyingId(null);
    }
  };
  const handleDecrypt = async (evidenceId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must be logged in to decrypt evidence.");
        return;
      }

      const response = await fetch(
        `http://localhost:3000/api/evidence/${evidenceId}/decrypt`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let errMessage = "Failed to decrypt evidence";
        try {
          const errData = await response.json();
          if (errData && errData.message) errMessage = errData.message;
        } catch (_) {}
        alert(errMessage);
        return;
      }

      // Extract filename from Content-Disposition header if available
      let filename = `evidence-${evidenceId}-decrypted`;
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.includes("filename=")) {
        const matches = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, "").trim();
        }
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = objectUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(objectUrl);

      alert(`Evidence decrypted and securely downloaded: ${filename}\n\nNo plaintext copy remains stored on the server.`);
    } catch (error) {
      console.error("Decryption download error:", error);
      alert("Failed to decrypt and download evidence: " + error.message);
    }
  };

  // =========================
  // HANDLE UPLOAD FORM CHANGE
  // =========================

  const handleUploadChange = (e) => {
    const { name, value } = e.target;

    setUploadForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // =========================
  // HANDLE FILE CHANGE
  // =========================

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    setSelectedFile(file || null);
  };

  // =========================
  // UPLOAD EVIDENCE
  // =========================

  const handleUpload = async (e) => {
    e.preventDefault();

    setUploadMessage("");
    setUploadError("");

    if (!selectedFile) {
      setUploadError("Please select an evidence file.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setUploadError("You are not logged in.");
      return;
    }

    setUploadLoading(true);

    try {
      const formData = new FormData();

      formData.append(
        "case_id",
        uploadForm.case_id
      );

      formData.append(
        "evidence_name",
        uploadForm.evidence_name
      );

      formData.append(
        "evidence_type",
        uploadForm.evidence_type
      );

      formData.append(
        "description",
        uploadForm.description
      );

      formData.append(
        "evidenceFile",
        selectedFile
      );


      const response = await fetch(
        "http://localhost:3000/api/evidence",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Evidence upload failed"
        );
      }

      setUploadMessage(
        `Evidence uploaded successfully: ${data.data.evidence_number}`
      );

      // Clear form
      setUploadForm({
        case_id: "",
        evidence_name: "",
        evidence_type: "",
        description: "",
      });

      setSelectedFile(null);

      // Reset file input
      document.getElementById(
        "evidenceFile"
      ).value = "";

      // Refresh evidence
      await fetchEvidence();

    } catch (error) {
      console.error("Upload error:", error);

      setUploadError(error.message);
    } finally {
      setUploadLoading(false);
    }
  };
    // ============================================================
  // CHAIN OF CUSTODY FUNCTIONS
  // ============================================================

  const fetchCustodyLogs = async (evidenceId) => {
    const token = localStorage.getItem("token");

    if (!token || !evidenceId) {
      return;
    }

    setCustodyLoading(true);
    setTransferMessage("");
    setTransferError("");

    try {
      const response = await fetch(
        `http://localhost:3000/api/custody/${evidenceId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch custody history"
        );
      }

      setCustodyLogs(data.data || []);
    } catch (error) {
      console.error("Custody fetch error:", error);

      setCustodyLogs([]);
      setTransferError(error.message);
    } finally {
      setCustodyLoading(false);
    }
  };


  const handleCustodyEvidenceChange = (e) => {
    const evidenceId = e.target.value;

    setSelectedCustodyEvidence(evidenceId);
    setCustodyLogs([]);
    setTransferMessage("");
    setTransferError("");

    if (evidenceId) {
      fetchCustodyLogs(evidenceId);
    }
  };


  const handleTransferChange = (e) => {
    const { name, value } = e.target;

    setTransferForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };


  const handleTransfer = async (e) => {
    e.preventDefault();

    setTransferMessage("");
    setTransferError("");

    if (!selectedCustodyEvidence) {
      setTransferError("Please select evidence first.");
      return;
    }

    if (!transferForm.to_user) {
      setTransferError("Please select a recipient.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setTransferError("You are not logged in.");
      return;
    }

    setTransferLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/custody",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            evidence_id: Number(selectedCustodyEvidence),
            to_user: Number(transferForm.to_user),
            action: transferForm.action,
            remarks: transferForm.remarks,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Evidence transfer failed"
        );
      }

      setTransferMessage(
        "Evidence transferred successfully."
      );

      setTransferForm({
        to_user: "7",
        action: "TRANSFERRED",
        remarks: "",
      });

      await fetchCustodyLogs(selectedCustodyEvidence);

    } catch (error) {
      console.error("Transfer error:", error);

      setTransferError(error.message);

    } finally {
      setTransferLoading(false);
    }
  };
  // =========================
// FETCH AUDIT LOGS
// =========================

const fetchAuditLogs = async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    return;
  }

  setAuditLoading(true);

  try {
    const response = await fetch(
      "http://localhost:3000/api/audit-logs",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to fetch audit logs"
      );
    }

    setAuditLogs(data.data || []);

  } catch (error) {
    console.error("Audit logs fetch error:", error);
    setAuditLogs([]);

  } finally {
    setAuditLoading(false);
  }
};


  // =========================
  // LOGIN
  // =========================
  // =========================
  // LOGIN
  // =========================

  const handleLogin = async (e) => {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employee_id: employeeId,
            password: password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Login failed"
        );
      }

      localStorage.setItem(
        "token",
        data.data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.data.user)
      );

      setUser(data.data.user);
      setLoggedIn(true);
      if (data.data.user.role_id === 4) {
        setCurrentPage("forensic");
      } else {
        setCurrentPage("dashboard");
      }

    } catch (error) {
      setMessage(error.message);

    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (empId, pass) => {
    setEmployeeId(empId);
    setPassword(pass);
    setMessage(`Prefilled credentials for ${empId}. Click "Sign In" or press Enter.`);
  };

  // =========================
  // LOGOUT
  // =========================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
    setLoggedIn(false);
    setEvidence([]);
    setVerificationResults({});
    setCurrentPage("dashboard");
  };

  // ============================================================
  // DASHBOARD PAGE
  // ============================================================

  const renderDashboard = () => {
    const verifiedCount = Object.values(
      verificationResults
    ).filter(
      (result) =>
        result.integrity_status === "VALID"
    ).length;

    const tamperedCount = Object.values(
      verificationResults
    ).filter(
      (result) =>
        result.integrity_status === "TAMPERED"
    ).length;

    return (
      <>
        <header className="dashboard-header">

          <div>
            <h1>Dashboard</h1>

            <p>
              Welcome back, {user?.full_name}
            </p>
          </div>

          <div className="user-info">

            <strong>
              {user?.full_name}
            </strong>

            <span>
              {user?.employee_id}
            </span>

          </div>

        </header>

        {/* STATISTICS */}

        <section className="stats">

          <div className="stat-card">
            <span>Total Evidence</span>

            <strong>
              {evidence.length}
            </strong>
          </div>

        <div className="stat-card">
          <span>Total Cases</span>

          <strong>
            {cases.length}
          </strong>
        </div>
          <div className="stat-card">
            <span>Verified</span>

            <strong>
              {verifiedCount}
            </strong>
          </div>

          <div className="stat-card alert-card">
            <span>Tamper Alerts</span>

            <strong>
              {tamperedCount}
            </strong>
          </div>

        </section>

        {/* RECENT EVIDENCE */}

        <section className="dashboard-section">

          <div className="section-header">

            <div>
              <h2>Recent Evidence</h2>

              <p>
                Recently added digital evidence
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() =>
                setCurrentPage("upload")
              }
            >
              + Upload Evidence
            </button>

          </div>

          <div className="evidence-table">

            <div className="table-header">

              <span>Evidence No.</span>
              <span>Name</span>
              <span>Type</span>
              <span>Uploaded By</span>

            </div>

            {evidenceLoading && (
              <div className="table-row">
                <span>
                  Loading evidence...
                </span>
              </div>
            )}

            {!evidenceLoading &&
              evidence.length === 0 && (
                <div className="table-row">
                  <span>
                    No evidence found
                  </span>
                </div>
              )}

            {!evidenceLoading &&
              evidence.length > 0 &&
              evidence
                .slice(0, 5)
                .map((item) => (

                  <div
                    className="table-row"
                    key={item.evidence_id}
                  >

                    <span>
                      {item.evidence_number}
                    </span>

                    <span>
                      {item.evidence_name}
                    </span>

                    <span>
                      {item.evidence_type}
                    </span>

                    <span>
                      User {item.uploaded_by}
                    </span>

                  </div>

                ))}

          </div>

        </section>

        {/* SECURITY OVERVIEW */}

        <section className="dashboard-section">

          <div className="section-header">

            <div>
              <h2>Security Overview</h2>

              <p>
                Evidence security and system activity
              </p>
            </div>

          </div>

          <div className="security-grid">

            <div className="security-item">

              <span>🔐</span>

              <div>
                <strong>
                  Encryption
                </strong>

                <p>
                  AES-256-GCM enabled
                </p>
              </div>

            </div>

            <div className="security-item">

              <span>🛡️</span>

              <div>
                <strong>
                  Integrity
                </strong>

                <p>
                  SHA-256 verification
                </p>
              </div>

            </div>

            <div className="security-item">

              <span>🔗</span>

              <div>
                <strong>
                  Chain of Custody
                </strong>

                <p>
                  Tracking enabled
                </p>
              </div>

            </div>

            <div className="security-item">

              <span>📋</span>

              <div>
                <strong>
                  Audit Logging
                </strong>

                <p>
                  System activity recorded
                </p>
              </div>

            </div>

          </div>

        </section>
      </>
    );
  };

  // ============================================================
  // EVIDENCE PAGE
  // ============================================================

  const renderEvidencePage = () => {
    const selectedCase = cases.find(
      (c) => String(c.case_id) === String(selectedCaseId)
    );

    const caseEvidence = evidence.filter(
      (item) =>
        String(item.case_id) === String(selectedCaseId)
    );

    return (
      <>
        <header className="dashboard-header">
          <div>
            <h1>Evidence Vault</h1>
            <p>
              Select an investigation case to view its digital evidence.
            </p>
          </div>

          <div className="user-info">
            <strong>{user?.full_name}</strong>
            <span>{user?.employee_id}</span>
          </div>
        </header>

        <section className="dashboard-section">
          {/* CASE SELECTOR */}
          <div className="evidence-case-selector">
            <label htmlFor="evidence-case-select">
              Select Investigation Case
            </label>

            <select
              id="evidence-case-select"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              disabled={casesLoading}
            >
              <option value="">Select a case</option>

              {cases.map((item) => (
                <option
                  key={item.case_id}
                  value={item.case_id}
                >
                  {item.case_number} — {item.case_title}
                </option>
              ))}
            </select>
          </div>

          {/* SELECTED CASE OVERVIEW */}
          {selectedCase && (
            <div className="evidence-case-overview">
              <span>Selected Investigation</span>
              <h2>{selectedCase.case_number}</h2>
              <p>{selectedCase.case_title}</p>
              <strong>
                {caseEvidence.length} Evidence Records
              </strong>
            </div>
          )}

          {/* EVIDENCE SECTION HEADER */}
          <div className="evidence-list-header">
            <div>
              <h2>Evidence</h2>
              <p>
                {caseEvidence.length} evidence record{caseEvidence.length !== 1 ? "s" : ""}
              </p>
            </div>

            <button
              className="primary-button"
              onClick={fetchEvidence}
            >
              ↻ Refresh
            </button>
          </div>

          {evidenceLoading && (
            <div className="evidence-page-message">
              Loading evidence...
            </div>
          )}

          {!evidenceLoading && !selectedCaseId && (
            <div className="evidence-page-message">
              Please select an investigation case to view evidence.
            </div>
          )}

          {!evidenceLoading && selectedCaseId && caseEvidence.length === 0 && (
            <div className="evidence-page-message">
              No evidence found.
            </div>
          )}

          {!evidenceLoading && selectedCaseId && caseEvidence.length > 0 && (
            <div className="evidence-cards">
              {caseEvidence.map((item) => {
                const verification =
                  verificationResults[
                    item.evidence_id
                  ];

                return (
                  <div
                    className="evidence-card"
                    key={item.evidence_id}
                  >
                    <div className="evidence-card-header">
                      <div>
                        <span className="evidence-number">
                          {item.evidence_number}
                        </span>

                        <h3>
                          {item.evidence_name}
                        </h3>
                      </div>

                      <span className="evidence-type">
                        {item.evidence_type}
                      </span>
                    </div>

                    <div className="evidence-details">
                      <div>
                        <span>File</span>
                        <strong>
                          {item.file_name}
                        </strong>
                      </div>

                      <div>
                        <span>Uploaded By</span>
                        <strong>
                          User {item.uploaded_by}
                        </strong>
                      </div>

                      <div>
                        <span>Uploaded At</span>
                        <strong>
                          {new Date(
                            item.uploaded_at
                          ).toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    {item.description && (
                      <div className="evidence-description">
                        <span>
                          Description
                        </span>
                        <p>
                          {item.description}
                        </p>
                      </div>
                    )}

                    <div className="evidence-actions">
                      <button
                        className="verify-button"
                        onClick={() =>
                          handleVerify(
                            item.evidence_id
                          )
                        }
                        disabled={
                          verifyingId ===
                          item.evidence_id
                        }
                      >
                        {verifyingId ===
                        item.evidence_id
                          ? "Verifying..."
                          : "🛡 Verify Integrity"}
                      </button>

                      <button
                        className="decrypt-button"
                        onClick={() =>
                          handleDecrypt(item.evidence_id)
                        }
                      >
                        🔓 Decrypt Evidence
                      </button>

                      {verification && (
                        <div
                          className={`verification-result ${
                            verification.integrity_status ===
                            "VALID"
                              ? "valid"
                              : verification.integrity_status ===
                                "TAMPERED"
                              ? "tampered"
                              : "error"
                          }`}
                        >
                          <strong>
                            {verification.integrity_status ===
                            "VALID"
                              ? "✓ VALID"
                              : verification.integrity_status ===
                                "TAMPERED"
                              ? "⚠ TAMPERED"
                              : "✕ ERROR"}
                          </strong>

                          {verification.integrity_status ===
                            "VALID" && (
                            <span>
                              File integrity verified
                              successfully.
                            </span>
                          )}

                          {verification.integrity_status ===
                            "TAMPERED" && (
                            <span>
                              Evidence may have been
                              modified.
                            </span>
                          )}

                          {verification.message &&
                            verification.integrity_status ===
                              "ERROR" && (
                              <span>
                                {
                                  verification.message
                                }
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </>
    );
  };

  // ============================================================
  // UPLOAD EVIDENCE PAGE
  // ============================================================

  const renderUploadPage = () => {
    return (
      <>
        <header className="dashboard-header">

          <div>
            <h1>Upload Evidence</h1>

            <p>
              Add new digital evidence to the system
            </p>
          </div>

          <div className="user-info">

            <strong>
              {user?.full_name}
            </strong>

            <span>
              {user?.employee_id}
            </span>

          </div>

        </header>

        <section className="dashboard-section">

          <div className="section-header">

            <div>
              <h2>Evidence Information</h2>

              <p>
                Provide the details of the evidence
              </p>
            </div>

          </div>

          <form
            className="upload-form"
            onSubmit={handleUpload}
          >

            {/* CASE ID */}

            <div className="form-group">

        <label htmlFor="case_id">
          Select Case
        </label>

        <select
          id="case_id"
          name="case_id"
          value={uploadForm.case_id}
          onChange={handleUploadChange}
          required
        >
          <option value="">
            {casesLoading
              ? "Loading cases..."
              : "Select a case"}
          </option>

          {cases.map((item) => (
            <option
              key={item.case_id}
              value={item.case_id}
            >
              {item.case_number} — {item.case_title}
            </option>
          ))}
        </select>
            </div>

            {/* EVIDENCE NAME */}

            <div className="form-group">

              <label htmlFor="evidence_name">
                Evidence Name
              </label>

              <input
                id="evidence_name"
                name="evidence_name"
                type="text"
                placeholder="Enter evidence name"
                value={uploadForm.evidence_name}
                onChange={handleUploadChange}
                required
              />

            </div>

            {/* EVIDENCE TYPE */}

            <div className="form-group">

              <label htmlFor="evidence_type">
                Evidence Type
              </label>

              <select
                id="evidence_type"
                name="evidence_type"
                value={uploadForm.evidence_type}
                onChange={handleUploadChange}
                required
              >

                <option value="">
                  Select evidence type
                </option>

                <option value="Image">
                  Image
                </option>

                <option value="Video">
                  Video
                </option>

                <option value="Audio">
                  Audio
                </option>

                <option value="Document">
                  Document
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>

            {/* DESCRIPTION */}

            <div className="form-group">

              <label htmlFor="description">
                Description
              </label>

              <textarea
                id="description"
                name="description"
                placeholder="Enter evidence description"
                value={uploadForm.description}
                onChange={handleUploadChange}
                rows="4"
              />

            </div>

            {/* FILE */}

            <div className="form-group">

              <label htmlFor="evidenceFile">
                Evidence File
              </label>

              <input
                id="evidenceFile"
                type="file"
                onChange={handleFileChange}
                required
              />

              {selectedFile && (
                <p className="selected-file">
                  Selected file:{" "}
                  <strong>
                    {selectedFile.name}
                  </strong>
                </p>
              )}

            </div>

            {/* SECURITY INFO */}

            <div className="upload-security-info">

              <span>🔐</span>

              <div>
                <strong>
                  Secure Upload
                </strong>

                <p>
                  The file will be hashed using
                  SHA-256 and encrypted using
                  AES-256-GCM before storage.
                </p>
              </div>

            </div>

            {/* MESSAGES */}

            {uploadMessage && (
              <div className="upload-success">
                ✓ {uploadMessage}
              </div>
            )}

            {uploadError && (
              <div className="upload-error">
                ✕ {uploadError}
              </div>
            )}

            {/* BUTTONS */}

            <div className="upload-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setCurrentPage("evidence");
                  setUploadMessage("");
                  setUploadError("");
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={uploadLoading}
              >
                {uploadLoading
                  ? "Uploading..."
                  : "🔐 Upload Evidence"}
              </button>

            </div>

          </form>

        </section>
      </>
    );
  };
     // ============================================================
  // CHAIN OF CUSTODY PAGE
  // ============================================================

  const renderCustodyPage = () => {
    const selectedEvidence = evidence.find(
      (item) =>
        String(item.evidence_id) ===
        String(selectedCustodyEvidence)
    );

    return (
      <>
        <header className="dashboard-header">
          <div>
            <h1>Chain of Custody</h1>

            <p>
              Track the movement and handling of digital evidence
            </p>
          </div>

          <div className="user-info">
            <strong>{user?.full_name}</strong>
            <span>{user?.employee_id}</span>
          </div>
        </header>


        {/* SELECT EVIDENCE */}

        <section className="dashboard-section">

          <div className="section-header">
            <div>
              <h2>Evidence History</h2>

              <p>
                Select an evidence record to view its custody history
              </p>
            </div>
          </div>


          <div className="form-group">

            <label htmlFor="custodyEvidence">
              Select Evidence
            </label>

              <select
                id="custodyEvidence"
                value={selectedCustodyEvidence}
                onChange={handleCustodyEvidenceChange}
                disabled={evidenceLoading}
              >
                <option value="">
                  {evidenceLoading
                    ? "Loading evidence..."
                    : evidence.length === 0
                    ? "No evidence available"
                    : "Select an evidence record"}
                </option>

                {evidence.map((item) => (
                  <option
                    key={item.evidence_id}
                    value={item.evidence_id}
                  >
                    {item.evidence_number} — {item.evidence_name}
                  </option>
                ))}
              </select>

          </div>


          {selectedEvidence && (
            <div className="custody-evidence-summary">

              <span className="evidence-number">
                {selectedEvidence.evidence_number}
              </span>

              <h3>
                {selectedEvidence.evidence_name}
              </h3>

              <p>
                Case ID: {selectedEvidence.case_id}
              </p>

            </div>
          )}


          {custodyLoading && (
            <div className="evidence-page-message">
              Loading custody history...
            </div>
          )}


          {!custodyLoading &&
            selectedCustodyEvidence &&
            custodyLogs.length === 0 && (
              <div className="evidence-page-message">
                No custody records found for this evidence.
              </div>
            )}


          {!custodyLoading &&
            custodyLogs.length > 0 && (

              <div className="custody-timeline">

                {custodyLogs.map((log, index) => (

                  <div
                    className="custody-item"
                    key={log.custody_id}
                  >

                    <div className="custody-dot">
                      {index + 1}
                    </div>

                    <div className="custody-content">

                      <div className="custody-action">
                        {log.action}
                      </div>

                      <div className="custody-transfer">

                        <strong>
                          {log.from_user_name ||
                            `User ${log.from_user}`}
                        </strong>

                        <span>→</span>

                        <strong>
                          {log.to_user_name ||
                            `User ${log.to_user}`}
                        </strong>

                      </div>

                      <div className="custody-date">
                        {new Date(
                          log.created_at
                        ).toLocaleString()}
                      </div>

                      {log.remarks && (
                        <p className="custody-remarks">
                          {log.remarks}
                        </p>
                      )}

                    </div>

                  </div>

                ))}

              </div>

            )}

        </section>


        {/* TRANSFER EVIDENCE */}

        <section className="dashboard-section">

          <div className="section-header">

            <div>
              <h2>Transfer Evidence</h2>

              <p>
                Record the transfer of evidence to another authorized user
              </p>
            </div>

          </div>


          <form
            className="upload-form"
            onSubmit={handleTransfer}
          >

            <div className="form-group">

              <label>
                Evidence
              </label>

              <input
                type="text"
                value={
                  selectedEvidence
                    ? `${selectedEvidence.evidence_number} — ${selectedEvidence.evidence_name}`
                    : "Select evidence above"
                }
                readOnly
              />

            </div>


            <div className="form-group">

              <label htmlFor="to_user">
                Transfer To
              </label>

              <select
                id="to_user"
                name="to_user"
                value={transferForm.to_user}
                onChange={handleTransferChange}
                required
              >

                <option value="7">
                  Forensic Officer — POL2026003
                </option>

                <option value="6">
                  System Administrator — POL2026002
                </option>

              </select>

            </div>


            <div className="form-group">

              <label htmlFor="action">
                Action
              </label>

              <select
                id="action"
                name="action"
                value={transferForm.action}
                onChange={handleTransferChange}
                required
              >

                <option value="TRANSFERRED">
                  TRANSFERRED
                </option>

                <option value="RECEIVED">
                  RECEIVED
                </option>

              </select>

            </div>


            <div className="form-group">

              <label htmlFor="remarks">
                Remarks
              </label>

              <textarea
                id="remarks"
                name="remarks"
                rows="4"
                placeholder="Enter transfer remarks"
                value={transferForm.remarks}
                onChange={handleTransferChange}
              />

            </div>


            {transferMessage && (
              <div className="upload-success">
                ✓ {transferMessage}
              </div>
            )}


            {transferError && (
              <div className="upload-error">
                ✕ {transferError}
              </div>
            )}


            <div className="upload-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedCustodyEvidence("");
                  setCustodyLogs([]);
                  setTransferMessage("");
                  setTransferError("");
                }}
              >
                Clear
              </button>


              <button
                type="submit"
                className="primary-button"
                disabled={
                  transferLoading ||
                  !selectedCustodyEvidence
                }
              >
                {transferLoading
                  ? "Transferring..."
                  : "🔗 Transfer Evidence"}
              </button>

            </div>

          </form>

        </section>
      </>
    );
  };
  // ============================================================
// AUDIT LOGS PAGE
// ============================================================

const renderAuditPage = () => {
  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Audit Logs</h1>

          <p>
            Track system activities and evidence operations
          </p>
        </div>

        <div className="user-info">
          <strong>{user?.full_name}</strong>
          <span>{user?.employee_id}</span>
        </div>
      </header>

      <section className="dashboard-section">

        <div className="section-header">
          <div>
            <h2>System Activity</h2>

            <p>
              {auditLogs.length} audit record
              {auditLogs.length !== 1 ? "s" : ""}
            </p>
          </div>

          <button
            className="primary-button"
            onClick={fetchAuditLogs}
          >
            ↻ Refresh
          </button>
        </div>

        {auditLoading && (
          <div className="evidence-page-message">
            Loading audit logs...
          </div>
        )}

        {!auditLoading && auditLogs.length === 0 && (
          <div className="evidence-page-message">
            No audit logs found.
          </div>
        )}

        {!auditLoading && auditLogs.length > 0 && (
          <div className="evidence-table">

            <div className="table-header">
              <span>Action</span>
              <span>User</span>
              <span>Evidence</span>
              <span>Details</span>
              <span>Date & Time</span>
            </div>

            {auditLogs.map((log) => (
              <div
                className="table-row"
                key={log.audit_id}
              >

                <span>
                  <strong>{log.action}</strong>
                </span>

                <span>
                  {log.user_name ||
                    `User ${log.user_id}`}
                </span>

                <span>
                  {log.evidence_number || "—"}
                </span>

                <span>
                  {log.details || "—"}
                </span>

                <span>
                  {new Date(
                    log.created_at
                  ).toLocaleString()}
                </span>

              </div>
            ))}

          </div>
        )}

      </section>
    </>
  );

}
// ============================================================
// CASES PAGE
// ============================================================

const renderCasesPage = () => {
  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Cases</h1>
          <p>
            Manage investigations and their associated evidence
          </p>
        </div>

        <div className="user-info">
          <strong>{user?.full_name}</strong>
          <span>{user?.employee_id}</span>
        </div>
      </header>

      {/* CREATE CASE */}
      <section className="dashboard-section">
        <div className="section-header">
          <div>
            <h2>Create New Case</h2>
            <p>
              Create an investigation before adding evidence
            </p>
          </div>
        </div>

        <form
          className="upload-form"
          onSubmit={handleCreateCase}
        >
          <div className="form-group">
            <label htmlFor="case_title">
              Case Title
            </label>

            <input
              id="case_title"
              name="case_title"
              type="text"
              placeholder="Enter case title"
              value={caseForm.case_title}
              onChange={handleCaseChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="case_description">
              Case Description
            </label>

            <textarea
              id="case_description"
              name="case_description"
              placeholder="Describe the investigation"
              value={caseForm.case_description}
              onChange={handleCaseChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="investigating_officer">
              Investigating Officer
            </label>

            <input
              id="investigating_officer"
              name="investigating_officer"
              type="number"
              placeholder="Enter officer user ID"
              value={caseForm.investigating_officer}
              onChange={handleCaseChange}
              required
            />
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={caseCreateLoading}
          >
            {caseCreateLoading
              ? "Creating..."
              : "Create Case"}
          </button>

          {caseMessage && (
            <div className="success-message">
              {caseMessage}
            </div>
          )}

          {caseError && (
            <div className="error-message">
              {caseError}
            </div>
          )}
        </form>
      </section>

      {/* EXISTING CASES */}
      <section className="dashboard-section   cases-section">
        <div className="section-header">
          <div>
            <h2>Existing Cases</h2>
            <p>
              {cases.length} case
              {cases.length !== 1 ? "s" : ""}
            </p>
          </div>

          <button
            className="primary-button"
            onClick={fetchCases}
          >
            ↻ Refresh
          </button>
        </div>

        {casesLoading && (
          <div className="evidence-page-message">
            Loading cases...
          </div>
        )}

        {!casesLoading && cases.length === 0 && (
          <div className="evidence-page-message">
            No cases found.
          </div>
        )}

        {!casesLoading && cases.length > 0 && (
          <div className="evidence-table">

            <div className="table-header">
              <span>Case Number</span>
              <span>Case Title</span>
              <span>Officer</span>
              <span>Status</span>
              <span>Created</span>
            </div>

            {cases.map((item) => (
              <div
                className="table-row"
                key={item.case_id}
              >
                <span>
                  <strong>
                    {item.case_number}
                  </strong>
                </span>

                <span>
                  {item.case_title}
                </span>

                <span>
                  User {item.investigating_officer}
                </span>

                <span>
                  {item.status}
                </span>

                <span>
                  {new Date(
                    item.created_at
                  ).toLocaleString()}
                </span>
              </div>
            ))}

          </div>
        )}
      </section>
    </>
  );
};

  // ============================================================
  // LOGGED-IN APPLICATION
  // ============================================================

  if (loggedIn) {
    return (
      <div className="dashboard">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <div className="brand">

            <div className="logo-circle">
              DE
            </div>

            <div>
              <h2>Digital Evidence</h2>

              <span>
                Management System
              </span>
            </div>

          </div>

          <nav>
            {user?.role_id === 4 ? (
              /* FORENSIC ANALYST NAVIGATION */
              <>
                <button
                  className={`nav-item ${currentPage === "forensic" || currentPage === "reports" ? "active" : ""}`}
                  onClick={() => setCurrentPage("forensic")}
                  style={{ color: "#c084fc", fontWeight: "bold" }}
                >
                  🔬 Forensic Suite
                </button>
                <button
                  className={`nav-item ${currentPage === "evidence" ? "active" : ""}`}
                  onClick={() => setCurrentPage("evidence")}
                >
                  Evidence Vault
                </button>
                <button
                  className={`nav-item ${currentPage === "cases" ? "active" : ""}`}
                  onClick={() => setCurrentPage("cases")}
                >
                  Cases
                </button>
                <button
                  className={`nav-item ${currentPage === "custody" ? "active" : ""}`}
                  onClick={() => setCurrentPage("custody")}
                >
                  Chain of Custody
                </button>
                <button
                  className={`nav-item ${currentPage === "audit" ? "active" : ""}`}
                  onClick={() => setCurrentPage("audit")}
                >
                  Audit Logs
                </button>
              </>
            ) : user?.role_id === 1 ? (
              /* SYSTEM ADMINISTRATOR NAVIGATION */
              <>
                <button
                  className={`nav-item ${currentPage === "dashboard" ? "active" : ""}`}
                  onClick={() => setCurrentPage("dashboard")}
                >
                  Dashboard
                </button>
                <button
                  className={`nav-item ${currentPage === "alerts" ? "active" : ""}`}
                  onClick={() => setCurrentPage("alerts")}
                  style={{ color: "#f87171", fontWeight: "bold" }}
                >
                  ⚠️ Tamper Alerts
                </button>
                <button
                  className={`nav-item ${currentPage === "reports" || currentPage === "forensic" ? "active" : ""}`}
                  onClick={() => setCurrentPage("reports")}
                >
                  📑 Forensic Reports & Autopsies
                </button>
                <button
                  className={`nav-item ${currentPage === "evidence" ? "active" : ""}`}
                  onClick={() => setCurrentPage("evidence")}
                >
                  Evidence Vault
                </button>
                <button
                  className={`nav-item ${currentPage === "upload" ? "active" : ""}`}
                  onClick={() => setCurrentPage("upload")}
                >
                  Upload Evidence
                </button>
                <button
                  className={`nav-item ${currentPage === "cases" ? "active" : ""}`}
                  onClick={() => setCurrentPage("cases")}
                >
                  Cases
                </button>
                <button
                  className={`nav-item ${currentPage === "custody" ? "active" : ""}`}
                  onClick={() => setCurrentPage("custody")}
                >
                  Chain of Custody
                </button>
                <button
                  className={`nav-item ${currentPage === "audit" ? "active" : ""}`}
                  onClick={() => setCurrentPage("audit")}
                >
                  Audit Logs
                </button>
              </>
            ) : (
              /* POLICE OFFICER / CASE MANAGER NAVIGATION */
              <>
                <button
                  className={`nav-item ${currentPage === "dashboard" ? "active" : ""}`}
                  onClick={() => setCurrentPage("dashboard")}
                >
                  Dashboard
                </button>
                <button
                  className={`nav-item ${currentPage === "evidence" ? "active" : ""}`}
                  onClick={() => setCurrentPage("evidence")}
                >
                  Evidence Vault
                </button>
                <button
                  className={`nav-item ${currentPage === "upload" ? "active" : ""}`}
                  onClick={() => setCurrentPage("upload")}
                >
                  Upload Evidence
                </button>
                <button
                  className={`nav-item ${currentPage === "cases" ? "active" : ""}`}
                  onClick={() => setCurrentPage("cases")}
                >
                  Cases
                </button>
                <button
                  className={`nav-item ${currentPage === "custody" ? "active" : ""}`}
                  onClick={() => setCurrentPage("custody")}
                >
                  Chain of Custody
                </button>
                <button
                  className={`nav-item ${currentPage === "audit" ? "active" : ""}`}
                  onClick={() => setCurrentPage("audit")}
                >
                  Audit Logs
                </button>
                <button
                  className={`nav-item ${currentPage === "reports" || currentPage === "forensic" ? "active" : ""}`}
                  onClick={() => setCurrentPage("reports")}
                >
                  📑 Forensic Reports
                </button>
              </>
            )}
          </nav>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>

        </aside>

        {/* MAIN CONTENT */}

        <main className="dashboard-content">

          {currentPage === "dashboard" &&
          renderDashboard()}

          {currentPage === "evidence" &&
          renderEvidencePage()}

          {currentPage === "upload" &&
          renderUploadPage()}

          {currentPage === "cases" &&
          renderCasesPage()}

         {currentPage === "custody" &&
        renderCustodyPage()}

        {currentPage === "audit" &&
         renderAuditPage()}

        {currentPage === "alerts" && (
          <AlertCenter user={user} onRefresh={() => { fetchEvidence(); fetchCases(); }} />
        )}

        {(currentPage === "reports" || currentPage === "forensic") && (
          <ForensicSuite user={user} evidence={evidence} cases={cases} onRefresh={() => { fetchEvidence(); fetchCases(); }} />
        )}


        </main>

      </div>
    );
  }

  // ============================================================
  // LOGIN PAGE
  // ============================================================

  return (
    <div className="login-page">

      <div className="login-card">

        <div className="logo-circle">
          DE
        </div>

        <h1>
          Digital Evidence
        </h1>

        <p className="subtitle">
          Evidence Management System
        </p>

        <form onSubmit={handleLogin}>

          <label>
            Employee ID / Username / Email
          </label>

          <input
            type="text"
            placeholder="e.g. admin, FOR2026001, POL2026002"
            value={employeeId}
            onChange={(e) =>
              setEmployeeId(e.target.value)
            }
            required
          />

          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Enter password (e.g. Admin@123)"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>

        </form>

        {message && (
          <p className="message">
            {message}
          </p>
        )}

        {/* QUICK DEMO LOGIN ACCOUNTS */}
        <div className="demo-accounts-box">
          <div className="demo-title">Quick Demo Login Accounts</div>
          <div className="demo-presets-grid">
            <button
              type="button"
              className="preset-btn"
              onClick={() => handleQuickLogin("admin", "Admin@123")}
            >
              <span className="preset-title">🛡️ System Admin</span>
              <span className="preset-desc">admin / Admin@123</span>
            </button>

            <button
              type="button"
              className="preset-btn"
              onClick={() => handleQuickLogin("FOR2026001", "Admin@123")}
            >
              <span className="preset-title">🔬 Forensic Analyst</span>
              <span className="preset-desc">FOR2026001 / Admin@123</span>
            </button>

            <button
              type="button"
              className="preset-btn"
              onClick={() => handleQuickLogin("POL2026001", "Admin@123")}
            >
              <span className="preset-title">👮 Police Officer</span>
              <span className="preset-desc">POL2026001 / Admin@123</span>
            </button>

            <button
              type="button"
              className="preset-btn"
              onClick={() => handleQuickLogin("CAS2026001", "Admin@123")}
            >
              <span className="preset-title">📂 Case Manager</span>
              <span className="preset-desc">CAS2026001 / Admin@123</span>
            </button>
          </div>
        </div>

        <p className="security-text">
          🔒 Secure evidence management system
        </p>
      </div>

    </div>
  );
}

export default App;