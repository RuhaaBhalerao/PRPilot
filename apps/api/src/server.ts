import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 PRPilot API server running`);
  console.log(`📡 URL: http://localhost:${env.PORT}`);
  console.log(`🩺 Health: http://localhost:${env.PORT}/api/v1/health`);
  console.log(`🌐 Allowed Origin: ${env.WEB_ORIGIN}`);
  console.log(`🌱 Environment: ${env.NODE_ENV}`);
  console.log(`=========================================`);
});

// Graceful shutdown handling
function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down PRPilot API gracefully...`);
  server.close(() => {
    console.log('PRPilot API server closed. Exiting process.');
    process.exit(0);
  });

  // Force shutdown if connections do not close within 5 seconds
  setTimeout(() => {
    console.error('Forcefully terminating server after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
