import path from 'path';
import fs from 'fs';

// Configuración global para tests
const TEST_OUTPUT_DIR = path.join(__dirname, '../test-output');
const TEST_MEDIA_DIR = path.join(__dirname, 'media');

// Declarar tipos globales
declare global {
  var TEST_OUTPUT_DIR: string;
  var TEST_MEDIA_DIR: string;
}

// Crear directorios de test si no existen
beforeAll(() => {
  if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEST_MEDIA_DIR)) {
    fs.mkdirSync(TEST_MEDIA_DIR, { recursive: true });
  }
});

// Limpiar archivos de test después de cada suite
afterAll(() => {
  // Opcional: limpiar archivos de test
  // fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
});

// Variables globales para tests
(global as any).TEST_OUTPUT_DIR = TEST_OUTPUT_DIR;
(global as any).TEST_MEDIA_DIR = TEST_MEDIA_DIR;

// Extender timeout para operaciones de video
jest.setTimeout(30000);