const reportModel = require("../models/reportModel");
const auditService = require("./auditService");

const generateReportNumber = async (prefix = "FAR") => {
    const latest = await reportModel.getLatestReportNumber();
    const year = new Date().getFullYear();
    if (!latest || !latest.report_number) {
        return `${prefix}-${year}-001`;
    }
    const parts = latest.report_number.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    const nextNum = String(lastNum + 1).padStart(3, "0");
    return `${prefix}-${year}-${nextNum}`;
};

const generateAutopsyNumber = async () => {
    const latest = await reportModel.getLatestAutopsyNumber();
    const year = new Date().getFullYear();
    if (!latest || !latest.autopsy_number) {
        return `AUT-${year}-001`;
    }
    const parts = latest.autopsy_number.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    const nextNum = String(lastNum + 1).padStart(3, "0");
    return `AUT-${year}-${nextNum}`;
};

const createForensicReport = async (reportData, userId) => {
    if (!reportData.report_number) {
        reportData.report_number = await generateReportNumber("FAR");
    }
    reportData.analyst_id = userId;
    const report = await reportModel.createForensicReport(reportData);
    await auditService.createAuditLog(
        userId,
        reportData.evidence_id,
        "REPORT_CREATED",
        `Created forensic report ${report.report_number}: ${report.report_title}`
    );
    return report;
};

const dispatchForensicReport = async (reportId, dispatchData, userId) => {
    const dispatched = await reportModel.dispatchForensicReport(reportId, dispatchData);
    await auditService.createAuditLog(
        userId,
        dispatched.evidence_id,
        "REPORT_DISPATCHED",
        `Dispatched forensic report ${dispatched.report_number} to ${dispatchData.recipient_agency || dispatchData.recipient_name} (${dispatchData.transmission_priority} Priority)`
    );
    return dispatched;
};

const createAutopsy = async (autopsyData, userId) => {
    if (!autopsyData.autopsy_number) {
        autopsyData.autopsy_number = await generateAutopsyNumber();
    }
    autopsyData.examiner_id = userId;
    const autopsy = await reportModel.createAutopsy(autopsyData);
    await auditService.createAuditLog(
        userId,
        autopsyData.evidence_id,
        "AUTOPSY_LOGGED",
        `Completed autopsy ${autopsy.autopsy_number} for device ${autopsy.device_type}`
    );
    return autopsy;
};

const dispatchAutopsy = async (autopsyId, dispatchData, userId) => {
    const dispatched = await reportModel.dispatchAutopsy(autopsyId, dispatchData);
    await auditService.createAuditLog(
        userId,
        dispatched.evidence_id,
        "AUTOPSY_DISPATCHED",
        `Dispatched autopsy report ${dispatched.autopsy_number} to ${dispatchData.dispatched_to}`
    );
    return dispatched;
};

module.exports = {
    createForensicReport,
    dispatchForensicReport,
    createAutopsy,
    dispatchAutopsy
};
