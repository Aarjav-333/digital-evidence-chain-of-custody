const express = require("express");

const app = express();

// Allows Express to read JSON from requests
app.use(express.json());

const userRoutes = require("./routes/userRoutes");
const caseRoutes = require("./routes/caseRoutes");

app.use("/api", userRoutes);
app.use("/api", caseRoutes);

app.get("/", (req, res) => {
    res.send("Digital Evidence Chain of Custody System Backend");
});

module.exports = app;