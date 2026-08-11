import express from 'express';
import cors from 'cors';
import documentRoutes from './routes/document.routes.js';
import './workers/document.worker.js';

const app = express();
const PORT = process.env['PORT'] || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/documents', documentRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Servidor DocuMind corriendo correctamente' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});