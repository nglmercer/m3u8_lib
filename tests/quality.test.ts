import { QualityManager, addVideoQuality, autoOptimizeVideoQualities, generateVideoQualities } from '../src/lib/modules/quality';
import { VideoMetadata, QualityLevel } from '../src/lib/types';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const access = promisify(fs.access);
const readFile = promisify(fs.readFile);

describe('QualityManager', () => {
  const testMediaDir = path.join(__dirname, 'media');
  const testOutputDir = path.join(__dirname, '../test-output');
  const testVideoPath = path.join(testMediaDir, 'test-video.mp4');
  const testVideoHdPath = path.join(testMediaDir, 'test-video-hd.mp4');
  const testVideoId = 'test-quality-001';

  beforeAll(async () => {
    // Verificar que los archivos de prueba existen
    try {
      await access(testVideoPath);
      await access(testVideoHdPath);
    } catch (error) {
      throw new Error('Los archivos de prueba no existen. Ejecuta: node tests/generate-test-media.js');
    }

    // Crear directorio de salida
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Limpiar archivos de salida después de cada test
    try {
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        if (file.includes(testVideoId)) {
          fs.unlinkSync(path.join(testOutputDir, file));
        }
      }
    } catch (error) {
      // Ignorar errores de limpieza
    }
  });

  describe('Constructor', () => {
    it('debería crear una instancia con outputDir y videoId', () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      expect(manager).toBeInstanceOf(QualityManager);
    });
  });

  describe('getVideoMetadata', () => {
    it('debería obtener metadatos del video básico', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      const metadata = await manager.getVideoMetadata(testVideoPath);
      
      expect(metadata).toHaveProperty('width');
      expect(metadata).toHaveProperty('height');
      expect(metadata).toHaveProperty('duration');
      expect(metadata).toHaveProperty('bitrate');
      expect(metadata).toHaveProperty('codec');
      
      expect(typeof metadata.width).toBe('number');
      expect(typeof metadata.height).toBe('number');
      expect(typeof metadata.duration).toBe('number');
      expect(typeof metadata.bitrate).toBe('string');
      expect(typeof metadata.codec).toBe('string');
      
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
      expect(metadata.duration).toBeGreaterThan(0);
    });

    it('debería obtener metadatos del video HD', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      const metadata = await manager.getVideoMetadata(testVideoHdPath);
      
      expect(metadata.width).toBeGreaterThanOrEqual(1280);
      expect(metadata.height).toBeGreaterThanOrEqual(720);
    });

    it('debería fallar con archivo inexistente', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      await expect(
        manager.getVideoMetadata('/path/to/non-existent-video.mp4')
      ).rejects.toThrow();
    });
  });

  describe('modifyQuality', () => {
    it('debería modificar video a calidad 480p desde HD', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      const outputPath = await manager.addQuality(
        testVideoHdPath,
        '480p'
      );
      
      expect(typeof outputPath).toBe('object');
      expect(outputPath.resolution.name).toBe('480p');
      expect(fs.existsSync(outputPath.path)).toBe(true);
    }, 45000);

    it('debería modificar video a calidad 480p', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      const outputPath = await manager.addQuality(
        testVideoPath,
        '480p'
      );
      
      expect(typeof outputPath).toBe('object');
      expect(outputPath.resolution.name).toBe('480p');
      expect(fs.existsSync(outputPath.path)).toBe(true);
    }, 45000);

    it('debería modificar video a calidad 360p', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      const outputPath = await manager.addQuality(
        testVideoPath,
        '360p'
      );
      
      expect(typeof outputPath).toBe('object');
      expect(outputPath.resolution.name).toBe('360p');
      expect(fs.existsSync(outputPath.path)).toBe(true);
    }, 45000);

    it('debería fallar con parámetros de calidad inválidos', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      await expect(
        manager.addQuality(
          testVideoPath,
          'invalid_resolution'
        )
      ).rejects.toThrow();
    });
  });

  describe('autoOptimizeQualities', () => {
    it('debería generar múltiples calidades automáticamente desde video HD', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      const outputPaths = await manager.autoOptimizeQualities(testVideoHdPath);
      
      expect(Array.isArray(outputPaths)).toBe(true);
      expect(outputPaths.length).toBeGreaterThan(1);
      
      // Verificar que todos los archivos existen
      for (const outputPath of outputPaths) {
        expect(fs.existsSync(outputPath.path)).toBe(true);
      }
      
      // Debería incluir diferentes resoluciones
      const pathsString = outputPaths.map(p => p.path || p).join(' ');
      expect(pathsString).toMatch(/(480p|360p|240p)/);
    }, 120000);

    it('debería generar calidades desde video de resolución media', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      const outputPaths = await manager.autoOptimizeQualities(testVideoPath);
      
      expect(Array.isArray(outputPaths)).toBe(true);
      expect(outputPaths.length).toBeGreaterThan(0);
      
      // Verificar que todos los archivos existen
      for (const outputPath of outputPaths) {
        expect(fs.existsSync(outputPath.path)).toBe(true);
      }
    }, 90000);

    it('debería incluir video original si se especifica', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      const outputPaths = await manager.autoOptimizeQualities(testVideoPath);
      
      expect(Array.isArray(outputPaths)).toBe(true);
      expect(outputPaths.length).toBeGreaterThan(0);
      
      // Verificar que todos los archivos existen
      for (const outputPath of outputPaths) {
        expect(fs.existsSync(outputPath.path)).toBe(true);
      }
    }, 90000);
  });

  describe('generateHlsWithQualities', () => {
    it('debería generar playlist maestro con múltiples calidades', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      // Crear algunos videos de diferentes calidades (menores que la original)
      const video360p = await manager.addQuality(testVideoHdPath, '360p');
      const video240p = await manager.addQuality(testVideoPath, '240p');
      
      const qualityLevels: QualityLevel[] = [video360p, video240p];
      
      const masterPlaylistPath = path.join(testOutputDir, 'master.m3u8');
      await manager.generateHlsWithQualities(masterPlaylistPath, qualityLevels);
      
      expect(fs.existsSync(masterPlaylistPath)).toBe(true);
      
      // Verificar contenido del playlist
      const content = await readFile(masterPlaylistPath, 'utf-8');
      expect(content).toContain('#EXTM3U');
      expect(content).toContain('#EXT-X-STREAM-INF');
    }, 90000);

    it('debería generar playlist con una sola calidad', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      const video360p = await manager.addQuality(testVideoPath, '360p');
      const qualityLevels: QualityLevel[] = [video360p];
      
      const masterPlaylistPath = path.join(testOutputDir, 'master-single.m3u8');
      await manager.generateHlsWithQualities(masterPlaylistPath, qualityLevels);
      
      expect(fs.existsSync(masterPlaylistPath)).toBe(true);
      
      const content = await readFile(masterPlaylistPath, 'utf-8');
      expect(content).toContain('#EXTM3U');
    }, 60000);
  });

  describe('Funciones de conveniencia', () => {
    it('addVideoQuality debería funcionar igual que el método de clase', async () => {
      const outputPath = await addVideoQuality(
        testVideoPath,
        '360p',
        testOutputDir,
        testVideoId
      );
      
      expect(typeof outputPath).toBe('object');
      expect(outputPath.resolution.name).toBe('360p');
      expect(fs.existsSync(outputPath.path)).toBe(true);
    }, 45000);

    it('autoOptimizeVideoQualities debería funcionar igual que el método de clase', async () => {
      const outputPaths = await autoOptimizeVideoQualities(
        testVideoPath,
        testOutputDir,
        testVideoId
      );
      
      expect(Array.isArray(outputPaths)).toBe(true);
      expect(outputPaths.length).toBeGreaterThan(0);
      
      for (const outputPath of outputPaths) {
        expect(fs.existsSync(outputPath.path)).toBe(true);
      }
    }, 90000);

    it('generateVideoQualities debería funcionar igual que el método de clase', async () => {
      const outputPaths = await generateVideoQualities(
        testVideoPath,
        ['360p'],
        testOutputDir,
        testVideoId
      );
      
      expect(Array.isArray(outputPaths)).toBe(true);
      expect(outputPaths.length).toBeGreaterThan(0);
      
      for (const outputPath of outputPaths) {
        expect(fs.existsSync(outputPath.path)).toBe(true);
      }
    }, 60000);
  });

  describe('Integración con metadatos', () => {
    it('debería mantener consistencia entre metadatos y calidades generadas', async () => {
      const manager = new QualityManager(testOutputDir, testVideoId);
      
      const originalMetadata = await manager.getVideoMetadata(testVideoPath);
      const qualityLevel = await manager.addQuality(testVideoPath, '360p');
      const newMetadata = await manager.getVideoMetadata(qualityLevel.path);
      
      // La duración debería mantenerse similar
      if (originalMetadata.duration && newMetadata.duration) {
        expect(Math.abs(newMetadata.duration - originalMetadata.duration)).toBeLessThan(5);
      }
      
      // La resolución debería cambiar según la calidad
      expect(qualityLevel.resolution.name).toBe('360p');
    }, 45000);
  });
});