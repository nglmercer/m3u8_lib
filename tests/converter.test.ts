import { HlsConverter, convertToHls, ensureDirExists } from '../src/lib/core/converter';
import { ConversionParams, HlsOptions } from '../src/lib/types';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const access = promisify(fs.access);
const readFile = promisify(fs.readFile);

describe('HlsConverter', () => {
  const testMediaDir = path.join(__dirname, 'media');
  const testOutputDir = path.join(__dirname, '../test-output');
  const testVideoPath = path.join(testMediaDir, 'test-video.mp4');
  const testVideoHdPath = path.join(testMediaDir, 'test-video-hd.mp4');
  const testVideoId = 'test-video-001';

  beforeAll(async () => {
    // Verificar que los archivos de prueba existen
    try {
      await access(testVideoPath);
      await access(testVideoHdPath);
    } catch (error) {
      throw new Error('Los archivos de prueba no existen. Ejecuta: node tests/generate-test-media.js');
    }
  });

  afterEach(async () => {
    // Limpiar archivos de salida después de cada test
    try {
      const outputPath = path.join(testOutputDir, testVideoId);
      if (fs.existsSync(outputPath)) {
        fs.rmSync(outputPath, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignorar errores de limpieza
    }
  });

  describe('Constructor', () => {
    it('debería crear una instancia con opciones por defecto', () => {
      const converter = new HlsConverter();
      expect(converter).toBeInstanceOf(HlsConverter);
    });

    it('debería crear una instancia con opciones personalizadas', () => {
      const customOptions: Partial<HlsOptions> = {
        hlsTime: 10,
        resolutions: [{
          name: '480p',
          size: '854x480',
          bitrate: '1000k'
        }]
      };
      const converter = new HlsConverter(customOptions);
      expect(converter).toBeInstanceOf(HlsConverter);
    });
  });

  describe('ensureDirExists', () => {
    it('debería crear un directorio si no existe', async () => {
      const testDir = path.join(testOutputDir, 'test-dir-creation');
      
      // Asegurar que el directorio no existe
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }

      await ensureDirExists(testDir);
      
      // Verificar que el directorio fue creado
      expect(fs.existsSync(testDir)).toBe(true);
      
      // Limpiar
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('no debería fallar si el directorio ya existe', async () => {
      const testDir = path.join(testOutputDir, 'existing-dir');
      
      // Crear el directorio primero
      fs.mkdirSync(testDir, { recursive: true });
      
      // No debería lanzar error
      await expect(ensureDirExists(testDir)).resolves.not.toThrow();
      
      // Limpiar
      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });

  describe('convertToHls', () => {
    it('debería convertir un video básico a HLS', async () => {
      const converter = new HlsConverter();
      const params: ConversionParams = {
        videoId: testVideoId,
        basePath: 'test/'
      };

      const result = await converter.convertToHls(testVideoPath, params);

      expect(result).toHaveProperty('message', 'Conversión HLS exitosa');
      expect(result).toHaveProperty('outputDir');
      expect(result).toHaveProperty('masterPlaylistPath');
      expect(result).toHaveProperty('masterPlaylistUrl');

      // Verificar que el archivo de playlist maestro fue creado
      expect(fs.existsSync(result.masterPlaylistPath)).toBe(true);

      // Verificar contenido del playlist maestro
      const playlistContent = await readFile(result.masterPlaylistPath, 'utf-8');
      expect(playlistContent).toContain('#EXTM3U');
      expect(playlistContent).toContain('#EXT-X-VERSION:3');
      expect(playlistContent).toContain('#EXT-X-STREAM-INF');
    }, 30000);

    it('debería manejar videos con diferentes resoluciones', async () => {
      const converter = new HlsConverter({
        resolutions: [
          { name: '360p', size: '640x360', bitrate: '800k' },
          { name: '480p', size: '854x480', bitrate: '1200k' }
        ]
      });
      
      const params: ConversionParams = {
        videoId: `${testVideoId}-multi-res`,
        basePath: 'test/'
      };

      const result = await converter.convertToHls(testVideoHdPath, params);

      expect(result).toHaveProperty('message', 'Conversión HLS exitosa');
      
      // Verificar que se crearon múltiples directorios de resolución
      const outputDir = result.outputDir;
      expect(fs.existsSync(path.join(outputDir, '360p'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, '480p'))).toBe(true);

      // Verificar playlist maestro con múltiples resoluciones
      const playlistContent = await readFile(result.masterPlaylistPath, 'utf-8');
      const streamLines = playlistContent.split('\n').filter(line => line.includes('#EXT-X-STREAM-INF'));
      expect(streamLines.length).toBeGreaterThan(1);
    }, 45000);

    it('debería fallar con un archivo de video inexistente', async () => {
      const converter = new HlsConverter();
      const params: ConversionParams = {
        videoId: 'non-existent-video',
        basePath: 'test/'
      };

      await expect(
        converter.convertToHls('/path/to/non-existent-video.mp4', params)
      ).rejects.toThrow();
    });

    it('debería incluir la resolución original en el resultado', async () => {
      const converter = new HlsConverter({
        resolutions: [
          { name: '360p', size: '640x360', bitrate: '800k' }
        ]
      });
      
      const params: ConversionParams = {
        videoId: `${testVideoId}-original`,
        basePath: 'test/'
      };

      const result = await converter.convertToHls(testVideoPath, params);

      // Verificar que el playlist maestro incluye tanto la resolución personalizada como la original
      const playlistContent = await readFile(result.masterPlaylistPath, 'utf-8');
      expect(playlistContent).toContain('360p');
      expect(playlistContent).toContain('480p'); // Resolución original del video de prueba
    }, 30000);
  });

  describe('Función de conveniencia convertToHls', () => {
    it('debería funcionar igual que el método de clase', async () => {
      const params: ConversionParams = {
        videoId: `${testVideoId}-convenience`,
        basePath: 'test/'
      };

      const result = await convertToHls(testVideoPath, params);

      expect(result).toHaveProperty('message', 'Conversión HLS exitosa');
      expect(result).toHaveProperty('outputDir');
      expect(result).toHaveProperty('masterPlaylistPath');
      expect(result).toHaveProperty('masterPlaylistUrl');

      // Verificar que el archivo fue creado
      expect(fs.existsSync(result.masterPlaylistPath)).toBe(true);
    }, 30000);
  });

  describe('Propiedades estáticas', () => {
    it('debería proporcionar PROCESSED_DIR', () => {
      expect(typeof HlsConverter.PROCESSED_DIR).toBe('string');
      expect(HlsConverter.PROCESSED_DIR).toContain('processed_videos');
    });

    it('debería proporcionar VIDEOS_DIR', () => {
      expect(typeof HlsConverter.VIDEOS_DIR).toBe('string');
      expect(HlsConverter.VIDEOS_DIR).toContain('videos');
    });
  });
});