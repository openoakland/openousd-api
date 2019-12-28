const express = require('express');
const cors = require('cors');

const route = require('./routes/index');
const methodOverride = require('method-override');

const app = express()
app.use(cors({ origin: true }));
app.use(express.json());
app.use('/api', route);
app.use(methodOverride())
app.use((err, req, res, next) => {
    res.status(400).json({
        error: err.message });
});

module.exports = app;
