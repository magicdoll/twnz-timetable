require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/announcements', require('./src/routes/announcements'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/payment', require('./src/routes/payment'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/teachers', require('./src/routes/teachers'));
app.use('/api/subjects', require('./src/routes/subjects'));
app.use('/api/grades', require('./src/routes/grades'));
app.use('/api/assignments', require('./src/routes/assignments'));
app.use('/api/fixed-slots', require('./src/routes/fixed-slots'));
app.use('/api/schedule', require('./src/routes/schedule'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`));
