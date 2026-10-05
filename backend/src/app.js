const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/userRoutes");
const caseRoutes = require("./routes/caseRoutes");
const evidenceRoutes = require("./routes/evidenceRoutes");
const custodyRoutes = require("./routes/custodyRoutes");
const auditRoutes = require("./routes/auditRoutes");
const alertRoutes = require("./routes/alertRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api", userRoutes);
app.use("/api", caseRoutes);
app.use("/api", evidenceRoutes);
app.use("/api", custodyRoutes);
app.use("/api", auditRoutes);
app.use("/api", alertRoutes);
app.use("/api", reportRoutes);

app.get("/", (req, res) => {
    res.send("Digital Evidence Chain of Custody System Backend Active");
});

module.exports = app;

