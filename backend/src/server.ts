import 'reflect-metadata';
import fs from 'fs';
import { AppDataSource } from './database/data-source';
import { UPLOAD_DIR } from './config/uploads';
import { jwtSecret } from './config/secrets';
import app from './app';

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    jwtSecret('JWT_SECRET');
    jwtSecret('JWT_REFRESH_SECRET');

    await AppDataSource.initialize();
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    const server = app.listen(PORT, () => console.log(`API disponible sur le port ${PORT}`));

    const shutdown = (signal: string) => {
      console.log(`${signal} reçu, arrêt du serveur`);
      server.close(async () => {
        await AppDataSource.destroy();
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error("Échec du démarrage de l'API :", error);
    process.exit(1);
  }
}

startServer();
