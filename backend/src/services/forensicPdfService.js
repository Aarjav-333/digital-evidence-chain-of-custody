const PDFDocument = require("pdfkit");
const reportModel = require("../models/reportModel");
const alertService = require("./alertService");

/**
 * Deterministically generates a comprehensive Digital Evidence Forensic Report PDF
 * based strictly on verified records from PostgreSQL and backend cryptographic hashes.
 *
 * @param {number|string} caseId
 * @param {import('stream').Writable} writeStream (typically Express `res` or a FileStream)
 * @returns {Promise<{ caseNumber: string, evidenceCount: number }>}
 */
const generateCaseForensicPdf = async (caseId, writeStream) => {
    const dossier = await reportModel.getCaseFullDossier(caseId);
    if (!dossier || !dossier.case) {
        throw new Error(`Case with ID ${caseId} not found in system records.`);
    }

    const c = dossier.case;
    const now = new Date();

    // Deterministic in-memory read-only integrity verification
    const verificationResults = [];
    for (const ev of dossier.evidence) {
        try {
            const check = await alertService.checkEvidenceIntegrity(ev);
            let resultStatus = "UNVERIFIED";
            let resultMessage = "Integrity verification has not been performed.";
            let currentHash = check.hash || check.calculatedHash || "Not available";

            if (check.status === "INTACT") {
                resultStatus = "VERIFIED";
                resultMessage = "VERIFIED";
            } else if (check.status === "HASH_MISMATCH") {
                resultStatus = "COMPROMISED";
                resultMessage = "Integrity verification failed (Cryptographic SHA-256 mismatch detected).";
            } else if (check.status === "CORRUPTED_CIPHERTEXT") {
                resultStatus = "COMPROMISED";
                resultMessage = "Integrity verification failed (Ciphertext corruption or AES-256-GCM authentication failure).";
            } else if (check.status === "FILE_MISSING") {
                resultStatus = "COMPROMISED";
                resultMessage = "Integrity verification failed (Evidence file missing from disk storage).";
            }

            verificationResults.push({
                evidence_id: ev.evidence_id,
                evidence_number: ev.evidence_number,
                evidence_name: ev.evidence_name,
                file_name: ev.file_name,
                evidence_type: ev.evidence_type || "Digital Media",
                description: ev.description || "Not available in system records.",
                uploaded_at: ev.uploaded_at ? new Date(ev.uploaded_at).toLocaleString() : "Not available in system records.",
                uploaded_by: ev.uploader_name || (ev.uploaded_by ? `User ID ${ev.uploaded_by}` : "Not available in system records."),
                stored_hash: ev.file_hash,
                current_hash: currentHash,
                resultStatus,
                resultMessage
            });
        } catch (err) {
            verificationResults.push({
                evidence_id: ev.evidence_id,
                evidence_number: ev.evidence_number,
                evidence_name: ev.evidence_name,
                file_name: ev.file_name,
                evidence_type: ev.evidence_type || "Digital Media",
                description: ev.description || "Not available in system records.",
                uploaded_at: ev.uploaded_at ? new Date(ev.uploaded_at).toLocaleString() : "Not available in system records.",
                uploaded_by: ev.uploader_name || (ev.uploaded_by ? `User ID ${ev.uploaded_by}` : "Not available in system records."),
                stored_hash: ev.file_hash,
                current_hash: "Error reading file",
                resultStatus: "COMPROMISED",
                resultMessage: `Integrity verification failed (${err.message})`
            });
        }
    }

    const verifiedCount = verificationResults.filter(v => v.resultStatus === "VERIFIED").length;
    const compromisedCount = verificationResults.filter(v => v.resultStatus === "COMPROMISED").length;
    const pendingCount = verificationResults.length - verifiedCount - compromisedCount;

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            margin: 40,
            bufferPages: true
        });

        doc.on("error", reject);
        writeStream.on("error", reject);
        writeStream.on("finish", () => {
            resolve({
                caseNumber: c.case_number,
                evidenceCount: verificationResults.length
            });
        });

        doc.pipe(writeStream);

        // Styling palette
        const primaryColor = "#0f2b48";
        const accentBlue = "#1d4ed8";
        const darkTextColor = "#0f172a";
        const mutedTextColor = "#475569";
        const lightBorderColor = "#cbd5e1";
        const lightBg = "#f8fafc";
        const leftMargin = 40;
        const rightBound = 555;
        const contentWidth = rightBound - leftMargin;

        const checkPageSpace = (neededHeight) => {
            if (doc.y + neededHeight > doc.page.height - 50) {
                doc.addPage();
            }
        };

        const drawSectionHeader = (title) => {
            checkPageSpace(45);
            doc.moveDown(0.8);
            doc.fillColor(primaryColor).fontSize(11).font("Helvetica-Bold").text(title, leftMargin);
            doc.moveTo(leftMargin, doc.y + 2).lineTo(rightBound, doc.y + 2).strokeColor(accentBlue).lineWidth(1).stroke();
            doc.moveDown(0.4);
        };

        // Title Block
        doc.fillColor(primaryColor).fontSize(18).font("Helvetica-Bold").text("DIGITAL EVIDENCE FORENSIC REPORT", { align: "center" });
        doc.moveDown(0.25);
        doc.fillColor(mutedTextColor).fontSize(9).font("Helvetica").text("Generated by: DIG_EVI Digital Evidence Management System", { align: "center" });
        doc.text(`Generated date/time: ${now.toUTCString()} (UTC)`, { align: "center" });
        doc.text(`Document Reference: FR-${now.getFullYear()}-${String(c.case_id).padStart(4, "0")}`, { align: "center" });
        doc.moveDown(0.6);

        // SECTION 1 — CASE INFORMATION
        drawSectionHeader("SECTION 1 — CASE INFORMATION");
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(darkTextColor);

        const caseFields = [
            ["Case Number:", c.case_number || "Not available in system records."],
            ["Case Title:", c.case_title || "Not available in system records."],
            ["Case Description:", c.case_description || "Not available in system records."],
            ["Case Status:", (c.status || "Not available in system records.").toUpperCase()],
            ["Investigating Officer:", c.officer_name ? `${c.officer_name} (Badge #${c.officer_badge || "N/A"})` : "Not available in system records."],
            ["Case Created Date:", c.created_at ? new Date(c.created_at).toLocaleString() : "Not available in system records."],
            ["Case Updated Date:", "Not available in system records."]
        ];

        for (const [key, val] of caseFields) {
            checkPageSpace(18);
            doc.font("Helvetica-Bold").text(key, leftMargin, doc.y, { continued: true, width: 140 });
            doc.font("Helvetica").text(`  ${val}`, { width: contentWidth - 140 });
            doc.moveDown(0.15);
        }

        // SECTION 2 — EVIDENCE INVENTORY
        drawSectionHeader("SECTION 2 — EVIDENCE INVENTORY");
        if (verificationResults.length === 0) {
            doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(mutedTextColor).text("No evidence items registered for this case in system records.", leftMargin);
        } else {
            verificationResults.forEach((ev, idx) => {
                checkPageSpace(75);
                doc.font("Helvetica-Bold").fontSize(8.5).fillColor(accentBlue).text(`Exhibit ${idx + 1}: ${ev.evidence_number} — ${ev.evidence_name}`, leftMargin);
                doc.moveDown(0.1);

                const itemRows = [
                    ["Original Filename:", ev.file_name],
                    ["Evidence Type:", ev.evidence_type],
                    ["Description:", ev.description],
                    ["Upload Date/Time:", ev.uploaded_at],
                    ["Uploaded By:", ev.uploaded_by],
                    ["Stored SHA-256:", ev.stored_hash],
                    ["Current SHA-256:", ev.current_hash],
                    ["Integrity Status:", ev.resultStatus]
                ];

                for (const [label, val] of itemRows) {
                    checkPageSpace(14);
                    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(darkTextColor).text(label, leftMargin + 10, doc.y, { continued: true, width: 120 });
                    if (label.includes("SHA-256")) {
                        doc.font("Courier").fontSize(7).text(`  ${val}`, { width: contentWidth - 130 });
                    } else {
                        doc.font("Helvetica").fontSize(7.5).text(`  ${val}`, { width: contentWidth - 130 });
                    }
                    doc.moveDown(0.1);
                }
                doc.moveDown(0.25);
            });
        }

        // SECTION 3 — INTEGRITY VERIFICATION
        drawSectionHeader("SECTION 3 — INTEGRITY VERIFICATION");
        checkPageSpace(30);
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(darkTextColor).text("Deterministic Summary:", leftMargin);
        doc.font("Helvetica").fontSize(8).text(
            `Total Evidence: ${verificationResults.length}   |   Verified: ${verifiedCount}   |   Compromised: ${compromisedCount}   |   Pending/Unavailable: ${pendingCount}`,
            leftMargin
        );
        doc.moveDown(0.3);

        if (verificationResults.length === 0) {
            doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(mutedTextColor).text("No evidence records available for integrity verification.", leftMargin);
        } else {
            verificationResults.forEach((ev) => {
                checkPageSpace(45);
                doc.font("Helvetica-Bold").fontSize(8).fillColor(accentBlue).text(`Evidence ID: ${ev.evidence_number}`, leftMargin + 5);

                doc.font("Helvetica-Bold").fontSize(7.5).fillColor(darkTextColor).text("Stored SHA-256:", leftMargin + 15, doc.y, { continued: true, width: 110 });
                doc.font("Courier").fontSize(7).text(`  ${ev.stored_hash}`, { width: contentWidth - 125 });
                doc.moveDown(0.1);

                doc.font("Helvetica-Bold").fontSize(7.5).fillColor(darkTextColor).text("Current SHA-256:", leftMargin + 15, doc.y, { continued: true, width: 110 });
                doc.font("Courier").fontSize(7).text(`  ${ev.current_hash}`, { width: contentWidth - 125 });
                doc.moveDown(0.1);

                doc.font("Helvetica-Bold").fontSize(7.5).fillColor(darkTextColor).text("Result:", leftMargin + 15, doc.y, { continued: true, width: 110 });
                const isVerified = ev.resultStatus === "VERIFIED";
                doc.font(isVerified ? "Helvetica-Bold" : "Helvetica").fillColor(isVerified ? "#15803d" : "#b91c1c").text(`  ${ev.resultMessage}`, { width: contentWidth - 125 });
                doc.moveDown(0.25);
            });
        }

        // SECTION 4 — CHAIN OF CUSTODY
        drawSectionHeader("SECTION 4 — CHAIN OF CUSTODY");
        if (dossier.custody.length === 0) {
            doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(mutedTextColor).text("No chain of custody handover events recorded for this case in system records.", leftMargin);
        } else {
            dossier.custody.forEach((cl, i) => {
                checkPageSpace(30);
                const timeStr = new Date(cl.created_at).toLocaleString();
                doc.font("Helvetica-Bold").fontSize(8).fillColor(darkTextColor).text(
                    `Event #${i + 1} [${timeStr}] — Exhibit: ${cl.evidence_number || `ID ${cl.evidence_id}`}`,
                    leftMargin + 5
                );
                doc.font("Helvetica").fontSize(7.5).fillColor(mutedTextColor);
                doc.text(
                    `From: ${cl.from_user_name || `User ID ${cl.from_user}`}   →   To: ${cl.to_user_name || `User ID ${cl.to_user}`}   |   Action: ${cl.action}`,
                    leftMargin + 15
                );
                doc.text(`Remarks: ${cl.remarks || "No remarks recorded"}`, leftMargin + 15);
                doc.moveDown(0.2);
            });
        }

        // SECTION 5 — AUDIT TRAIL
        drawSectionHeader("SECTION 5 — AUDIT TRAIL");
        if (dossier.auditLogs.length === 0) {
            doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(mutedTextColor).text("No audit log entries recorded for this case in system records.", leftMargin);
        } else {
            dossier.auditLogs.slice(0, 30).forEach((al) => {
                checkPageSpace(22);
                const timeStr = new Date(al.created_at).toLocaleString();
                doc.font("Helvetica-Bold").fontSize(7.5).fillColor(darkTextColor).text(
                    `${timeStr} | User: ${al.user_name || `User ID ${al.user_id}`} | Action: ${al.action} | Target: ${al.evidence_number || "Case"}`,
                    leftMargin + 5
                );
                doc.font("Helvetica").fontSize(7).fillColor(mutedTextColor).text(`Details: ${al.details || "No details recorded"}`, leftMargin + 15);
                doc.moveDown(0.12);
            });
            if (dossier.auditLogs.length > 30) {
                doc.font("Helvetica-Oblique").fontSize(7).fillColor(mutedTextColor).text(
                    `... (${dossier.auditLogs.length - 30} additional audit log events archived in database records)`,
                    leftMargin + 5
                );
            }
        }

        // SECTION 6 — TAMPER / SECURITY ALERTS
        drawSectionHeader("SECTION 6 — TAMPER / SECURITY ALERTS");
        if (dossier.alerts.length === 0) {
            doc.font("Helvetica").fontSize(8.5).fillColor(darkTextColor).text("No tamper alerts recorded for the selected case.", leftMargin);
        } else {
            dossier.alerts.forEach((alt) => {
                checkPageSpace(35);
                const timeStr = new Date(alt.detected_at).toLocaleString();
                const isResolved = alt.status === "RESOLVED";
                doc.font("Helvetica-Bold").fontSize(8).fillColor(isResolved ? "#15803d" : "#b91c1c").text(
                    `Alert #${alt.alert_id} [${alt.severity || "CRITICAL"}] — ${alt.alert_type} (${alt.status})`,
                    leftMargin + 5
                );
                doc.font("Helvetica").fontSize(7.5).fillColor(darkTextColor);
                doc.text(`Detected: ${timeStr}   |   Exhibit: ${alt.evidence_number || `ID ${alt.evidence_id}`}`, leftMargin + 15);
                doc.text(`Details: ${alt.message || "No message recorded"}`, leftMargin + 15);
                if (alt.resolved_at) {
                    doc.text(
                        `Resolved: ${new Date(alt.resolved_at).toLocaleString()} by ${alt.resolved_by_name || `User ID ${alt.resolved_by}`}. Notes: ${alt.resolution_notes || "None"}`,
                        leftMargin + 15
                    );
                }
                doc.moveDown(0.2);
            });
        }

        // SECTION 7 — FORENSIC / AUTOPSY RECORDS
        drawSectionHeader("SECTION 7 — FORENSIC / AUTOPSY RECORDS");
        const hasReports = dossier.reports.length > 0;
        const hasAutopsies = dossier.autopsies.length > 0;

        if (!hasReports && !hasAutopsies) {
            doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(mutedTextColor).text("No forensic examination or autopsy records logged for this case in system records.", leftMargin);
        } else {
            if (hasReports) {
                checkPageSpace(20);
                doc.font("Helvetica-Bold").fontSize(8.5).fillColor(accentBlue).text("Forensic Examination Records:", leftMargin + 5);
                dossier.reports.forEach((rep) => {
                    checkPageSpace(35);
                    doc.font("Helvetica-Bold").fontSize(8).fillColor(darkTextColor).text(
                        `Report ${rep.report_number}: ${rep.report_title} (${rep.status})`,
                        leftMargin + 10
                    );
                    doc.font("Helvetica").fontSize(7.5).fillColor(mutedTextColor);
                    doc.text(
                        `Analyst: ${rep.analyst_name || "Forensic Division"}   |   Tools Used: ${rep.tools_used || "Standard tools"}   |   Pre-Verification: ${rep.hash_verified ? "Confirmed" : "Flagged"}`,
                        leftMargin + 15
                    );
                    doc.text(`Findings: ${rep.findings || "No findings recorded"}`, leftMargin + 15);
                    if (rep.conclusion) doc.text(`Conclusion: ${rep.conclusion}`, leftMargin + 15);
                    if (rep.recipient_name) {
                        doc.text(
                            `Dispatched To: ${rep.recipient_name} (${rep.recipient_agency || "Agency"}) on ${rep.sent_at ? new Date(rep.sent_at).toLocaleString() : "Date unrecorded"}`,
                            leftMargin + 15
                        );
                    }
                    doc.moveDown(0.2);
                });
            }

            if (hasAutopsies) {
                checkPageSpace(20);
                doc.font("Helvetica-Bold").fontSize(8.5).fillColor(accentBlue).text("Device Autopsy Records:", leftMargin + 5);
                dossier.autopsies.forEach((aut) => {
                    checkPageSpace(35);
                    doc.font("Helvetica-Bold").fontSize(8).fillColor(darkTextColor).text(
                        `Autopsy ${aut.autopsy_number}: ${aut.subject_name || aut.device_type} (${aut.status})`,
                        leftMargin + 10
                    );
                    doc.font("Helvetica").fontSize(7.5).fillColor(mutedTextColor);
                    doc.text(
                        `Device Type: ${aut.device_type || "Storage Device"}   |   Condition: ${aut.hardware_condition || "Not recorded"}   |   Method: ${aut.extraction_method || "Bit-stream extraction"}`,
                        leftMargin + 15
                    );
                    doc.text(`Findings: ${aut.autopsy_findings || "No findings recorded"}`, leftMargin + 15);
                    if (aut.triage_summary) doc.text(`Triage Summary: ${aut.triage_summary}`, leftMargin + 15);
                    if (aut.dispatched_to) doc.text(`Dispatched To: ${aut.dispatched_to}`, leftMargin + 15);
                    doc.moveDown(0.2);
                });
            }
        }

        // SECTION 8 — SYSTEM-GENERATED SUMMARY
        drawSectionHeader("SECTION 8 — SYSTEM-GENERATED SUMMARY");
        checkPageSpace(80);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(darkTextColor);

        const summaryMetrics = [
            ["Total Evidence Items:", String(verificationResults.length)],
            ["Verified Evidence:", String(verifiedCount)],
            ["Compromised Evidence:", String(compromisedCount)],
            ["Custody Events:", String(dossier.custody.length)],
            ["Audit Events:", String(dossier.auditLogs.length)],
            ["Tamper Alerts:", String(dossier.alerts.length)],
            ["Forensic Examination Reports:", String(dossier.reports.length)],
            ["Device Autopsies:", String(dossier.autopsies.length)]
        ];

        for (const [sKey, sVal] of summaryMetrics) {
            checkPageSpace(13);
            doc.font("Helvetica-Bold").text(sKey, leftMargin + 10, doc.y, { continued: true, width: 220 });
            doc.font("Helvetica").text(`  ${sVal}`);
            doc.moveDown(0.12);
        }

        // SECTION 9 — REPORT DISCLAIMER (MANDATORY EXACT TEXT)
        checkPageSpace(85);
        doc.moveDown(0.6);
        const disclaimerY = doc.y;
        doc.rect(leftMargin, disclaimerY, contentWidth, 70).fillAndStroke(lightBg, lightBorderColor);

        doc.fillColor(darkTextColor).fontSize(8.5).font("Helvetica-Bold").text("REPORT DISCLAIMER", leftMargin + 12, disclaimerY + 8);
        doc.moveDown(0.2);
        doc.fontSize(7.5).font("Helvetica").fillColor("#334155").text(
            "This report is automatically generated from records maintained by the DIG_EVI Digital Evidence Management System. It presents system-recorded information and deterministic integrity-verification results.\n\nThis report does not constitute legal certification, expert testimony, or a determination of court admissibility.",
            leftMargin + 12,
            doc.y,
            { width: contentWidth - 24 }
        );

        // Page Numbering Footer
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(7.5).fillColor(mutedTextColor).text(
                `Page ${i + 1} of ${range.count}   •   DIG_EVI System-Generated Forensic Report   •   ${c.case_number}`,
                leftMargin,
                doc.page.height - 30,
                { align: "center", width: contentWidth }
            );
        }

        doc.end();
    });
};

module.exports = {
    generateCaseForensicPdf
};
