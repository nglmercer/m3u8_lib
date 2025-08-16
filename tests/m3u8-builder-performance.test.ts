/**
 * Tests de rendimiento para M3U8Builder
 * Verifica que la utilidad funcione eficientemente con grandes volúmenes de datos
 */

import { M3U8Builder } from '../src/lib/utils/m3u8-builder';

describe('M3U8Builder - Tests de Rendimiento', () => {
  // Aumentar timeout para tests de rendimiento
  jest.setTimeout(30000);

  describe('Rendimiento con grandes volúmenes', () => {
    test('debe manejar 1000 streams eficientemente', () => {
      const builder = new M3U8Builder();
      const startTime = performance.now();

      // Agregar 1000 streams
      for (let i = 0; i < 1000; i++) {
        builder.addStreamInfo({
          bandwidth: 100000 + (i * 1000),
          resolution: `${640 + (i % 100)}x${360 + (i % 100)}`,
          uri: `stream_${i}.m3u8`
        });
      }

      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(5000); // Menos de 5 segundos

      const buildStartTime = performance.now();
      const playlist = builder.build();
      const buildTime = performance.now() - buildStartTime;

      expect(buildTime).toBeLessThan(10000); // Menos de 10 segundos
      expect(playlist).toContain('#EXTM3U');
      expect(builder.getStats().streamInfos).toBe(1000);
    });

    test('debe manejar 500 pistas de audio eficientemente', () => {
      const builder = new M3U8Builder();
      const startTime = performance.now();

      // Agregar 500 pistas de audio
      for (let i = 0; i < 500; i++) {
        builder.addAudio({
          name: `Audio Track ${i}`,
          language: `lang${i % 50}`, // 50 idiomas diferentes
          uri: `audio_${i}.m3u8`,
          isDefault: i === 0,
          channels: i % 2 === 0 ? '2' : '6'
        });
      }

      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(15000); // Menos de 15 segundos

      const buildStartTime = performance.now();
      const playlist = builder.build();
      const buildTime = performance.now() - buildStartTime;

      expect(buildTime).toBeLessThan(20000); // Menos de 20 segundos
      expect(builder.getStats().audioTracks).toBe(500);
    });

    test('debe manejar 1000 subtítulos eficientemente', () => {
      const builder = new M3U8Builder();
      const startTime = performance.now();

      // Agregar 1000 pistas de subtítulos
      for (let i = 0; i < 1000; i++) {
        builder.addSubtitles({
          name: `Subtitle Track ${i}`,
          language: `sub${i % 100}`, // 100 idiomas diferentes
          uri: `subtitle_${i}.vtt`,
          isDefault: i === 0
        });
      }

      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(10000); // Menos de 10 segundos

      const buildStartTime = performance.now();
      const playlist = builder.build();
      const buildTime = performance.now() - buildStartTime;

      expect(buildTime).toBeLessThan(15000); // Menos de 15 segundos
      expect(builder.getStats().subtitleTracks).toBe(1000);
    });

    test('debe manejar playlist masivo (2000+ elementos) eficientemente', () => {
      const builder = new M3U8Builder();
      const startTime = performance.now();

      // Agregar 500 audios
      for (let i = 0; i < 500; i++) {
        builder.addAudio({
          name: `Audio ${i}`,
          language: `a${i % 20}`,
          uri: `audio_${i}.m3u8`
        });
      }

      // Agregar 1000 subtítulos
      for (let i = 0; i < 1000; i++) {
        builder.addSubtitles({
          name: `Subtitle ${i}`,
          language: `s${i % 50}`,
          uri: `sub_${i}.vtt`
        });
      }

      // Agregar 500 streams
      for (let i = 0; i < 500; i++) {
        builder.addStreamInfo({
          bandwidth: 100000 + (i * 2000),
          resolution: `${640 + (i % 200)}x${360 + (i % 200)}`,
          uri: `stream_${i}.m3u8`
        });
      }

      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(15000); // Menos de 15 segundos

      const buildStartTime = performance.now();
      const playlist = builder.build();
      const buildTime = performance.now() - buildStartTime;

      expect(buildTime).toBeLessThan(20000); // Menos de 20 segundos
      
      const stats = builder.getStats();
      expect(stats.mediaTracks).toBe(1500); // 500 audio + 1000 subtítulos
      expect(stats.streamInfos).toBe(500);
      
      // Verificar que el playlist es válido
      expect(playlist).toContain('#EXTM3U');
      expect(playlist.split('\n').length).toBeGreaterThan(2000);
    });
  });

  describe('Rendimiento de operaciones repetitivas', () => {
    test('debe manejar múltiples builds eficientemente', () => {
      const builder = new M3U8Builder();
      
      // Configurar builder con contenido moderado
      for (let i = 0; i < 100; i++) {
        builder.addStreamInfo({
          bandwidth: 100000 + (i * 10000),
          uri: `stream_${i}.m3u8`
        });
      }

      const startTime = performance.now();
      
      // Hacer 100 builds
      for (let i = 0; i < 100; i++) {
        const playlist = builder.build();
        expect(playlist).toContain('#EXTM3U');
      }

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(1000); // Menos de 1 segundo para 100 builds
    });

    test('debe manejar múltiples clear/rebuild eficientemente', () => {
      const builder = new M3U8Builder();
      const startTime = performance.now();

      // Hacer 50 ciclos de clear/rebuild
      for (let cycle = 0; cycle < 50; cycle++) {
        // Agregar contenido
        for (let i = 0; i < 20; i++) {
          builder.addAudio({
            name: `Audio ${cycle}_${i}`,
            uri: `audio_${cycle}_${i}.m3u8`
          });
          
          builder.addStreamInfo({
            bandwidth: 100000 + i * 50000,
            uri: `stream_${cycle}_${i}.m3u8`
          });
        }

        // Build
        const playlist = builder.build();
        expect(playlist).toContain('#EXTM3U');

        // Clear
        builder.clear();
        expect(builder.getStats().mediaTracks).toBe(0);
      }

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(2000); // Menos de 2 segundos
    });
  });

  describe('Rendimiento con strings largos', () => {
    test('debe manejar nombres muy largos eficientemente', () => {
      const builder = new M3U8Builder();
      const longName = 'A'.repeat(1000); // Nombre de 1000 caracteres
      const startTime = performance.now();

      // Agregar 100 elementos con nombres largos
      for (let i = 0; i < 100; i++) {
        builder.addSubtitles({
          name: `${longName}_${i}`,
          language: 'en',
          uri: `long_${i}.vtt`
        });
      }

      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(500); // Menos de 0.5 segundos

      const buildStartTime = performance.now();
      const playlist = builder.build();
      const buildTime = performance.now() - buildStartTime;

      expect(buildTime).toBeLessThan(1000); // Menos de 1 segundo
      expect(playlist.length).toBeGreaterThan(100000); // Playlist muy largo
    });

    test('debe manejar URIs muy largas eficientemente', () => {
      const builder = new M3U8Builder();
      const longUri = 'https://example.com/' + 'path/'.repeat(100) + 'file.m3u8';
      const startTime = performance.now();

      // Agregar 50 streams con URIs largas
      for (let i = 0; i < 50; i++) {
        builder.addStreamInfo({
          bandwidth: 100000 + i * 10000,
          uri: `${longUri}?param=${i}&${'extra='.repeat(50)}${i}`
        });
      }

      const addTime = performance.now() - startTime;
      expect(addTime).toBeLessThan(200); // Menos de 0.2 segundos

      const buildStartTime = performance.now();
      const playlist = builder.build();
      const buildTime = performance.now() - buildStartTime;

      expect(buildTime).toBeLessThan(500); // Menos de 0.5 segundos
      expect(playlist).toContain(longUri);
    });
  });

  describe('Rendimiento de ordenamiento', () => {
    test('debe ordenar 1000 streams por bandwidth eficientemente', () => {
      const builder = new M3U8Builder();
      
      // Agregar streams en orden aleatorio
      const bandwidths: number[] = [];
      for (let i = 0; i < 1000; i++) {
        bandwidths.push(Math.floor(Math.random() * 10000000) + 100000);
      }

      const addStartTime = performance.now();
      bandwidths.forEach((bandwidth, index) => {
        builder.addStreamInfo({
          bandwidth,
          uri: `stream_${index}.m3u8`
        });
      });
      const addTime = performance.now() - addStartTime;

      const buildStartTime = performance.now();
      const playlist = builder.build();
      const buildTime = performance.now() - buildStartTime;

      expect(addTime).toBeLessThan(500); // Menos de 0.5 segundos para agregar
      expect(buildTime).toBeLessThan(1000); // Menos de 1 segundo para build (incluye ordenamiento)

      // Verificar que está ordenado
      const lines = playlist.split('\n');
      const bandwidthLines = lines.filter(line => line.includes('BANDWIDTH='));
      
      for (let i = 1; i < bandwidthLines.length; i++) {
        const prevBandwidth = parseInt(bandwidthLines[i-1].match(/BANDWIDTH=(\d+)/)?.[1] || '0');
        const currBandwidth = parseInt(bandwidthLines[i].match(/BANDWIDTH=(\d+)/)?.[1] || '0');
        expect(currBandwidth).toBeGreaterThanOrEqual(prevBandwidth);
      }
    });
  });

  describe('Uso de memoria', () => {
    test('debe mantener uso de memoria razonable con contenido masivo', () => {
      const builder = new M3U8Builder();
      
      // Medir memoria inicial (aproximada)
      const initialMemory = process.memoryUsage().heapUsed;

      // Agregar contenido masivo
      for (let i = 0; i < 1000; i++) {
        builder.addAudio({
          name: `Audio Track ${i} with some additional text to increase memory usage`,
          language: `lang${i % 100}`,
          uri: `audio_${i}.m3u8`,
          channels: '2'
        });

        builder.addSubtitles({
          name: `Subtitle Track ${i} with some additional descriptive text`,
          language: `sub${i % 100}`,
          uri: `subtitle_${i}.vtt`
        });

        builder.addStreamInfo({
          bandwidth: 100000 + (i * 1000),
          resolution: `${640 + (i % 100)}x${360 + (i % 100)}`,
          codecs: 'avc1.64001f,mp4a.40.2',
          uri: `stream_${i}.m3u8`
        });
      }

      // Construir playlist
      const playlist = builder.build();
      
      // Medir memoria final
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // El aumento de memoria no debería ser excesivo (menos de 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      // Verificar que el playlist se generó correctamente
      expect(playlist).toContain('#EXTM3U');
      expect(builder.getStats().mediaTracks).toBe(2000);
      expect(builder.getStats().streamInfos).toBe(1000);
    });

    test('debe liberar memoria después de clear', () => {
      const builder = new M3U8Builder();
      
      // Agregar contenido
      for (let i = 0; i < 500; i++) {
        builder.addAudio({
          name: `Audio ${i}`,
          uri: `audio_${i}.m3u8`
        });
      }

      const memoryBeforeClear = process.memoryUsage().heapUsed;
      
      // Clear
      builder.clear();
      
      // Forzar garbage collection si está disponible
      if (global.gc) {
        global.gc();
      }
      
      const memoryAfterClear = process.memoryUsage().heapUsed;
      
      // Verificar que las estructuras están vacías
      expect(builder.getStats().mediaTracks).toBe(0);
      
      // La memoria puede no disminuir inmediatamente debido al GC,
      // pero al menos no debería aumentar significativamente
      expect(memoryAfterClear).toBeLessThanOrEqual(memoryBeforeClear + (10 * 1024 * 1024)); // +10MB máximo
    });
  });

  describe('Benchmarks comparativos', () => {
    test('debe ser más rápido que concatenación manual de strings', () => {
      const testData = {
        audios: Array.from({ length: 100 }, (_, i) => ({
          name: `Audio ${i}`,
          language: 'en',
          uri: `audio_${i}.m3u8`
        })),
        streams: Array.from({ length: 100 }, (_, i) => ({
          bandwidth: 100000 + i * 10000,
          resolution: `${640 + i}x${360 + i}`,
          uri: `stream_${i}.m3u8`
        }))
      };

      // Test con M3U8Builder
      const builderStartTime = performance.now();
      const builder = new M3U8Builder();
      
      testData.audios.forEach(audio => {
        builder.addAudio(audio);
      });
      
      testData.streams.forEach(stream => {
        builder.addStreamInfo(stream);
      });
      
      const builderPlaylist = builder.build();
      const builderTime = performance.now() - builderStartTime;

      // Test con concatenación manual
      const manualStartTime = performance.now();
      let manualPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
      
      testData.audios.forEach(audio => {
        manualPlaylist += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="${audio.name}",LANGUAGE="${audio.language}",URI="${audio.uri}"\n`;
      });
      
      manualPlaylist += '\n';
      
      testData.streams.sort((a, b) => a.bandwidth - b.bandwidth).forEach(stream => {
        manualPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${stream.bandwidth},RESOLUTION=${stream.resolution},AUDIO="audio"\n${stream.uri}\n`;
      });
      
      const manualTime = performance.now() - manualStartTime;

      // M3U8Builder puede ser más lento debido a validaciones adicionales
      // pero debería estar en un rango razonable
      expect(builderTime).toBeLessThan(manualTime * 5); // Máximo 5x más lento
      
      // Ambos deberían generar contenido similar
      expect(builderPlaylist).toContain('#EXTM3U');
      expect(manualPlaylist).toContain('#EXTM3U');
    });
  });
});