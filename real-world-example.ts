/**
 * Ejemplo de uso real del sistema de conversión HLS
 * Demuestra el uso completo con video, subtítulos y audio
 */

import { HlsConverter } from './src/lib/core/converter';
import { SubtitleManager } from './src/lib/modules/subtitles';
import { AudioManager } from './src/lib/modules/audio';
import { QualityManager } from './src/lib/modules/quality';
import { M3U8Builder } from './src/lib/utils/m3u8-builder';
import { VideoMetadata, SubtitleTrack, AudioTrack, QualityLevel, VideoResolution } from './src/lib/types';
import path from 'path';
import fs from 'fs';

// Configuración de rutas
const MEDIA_DIR = path.join(__dirname, 'tests', 'media');
const OUTPUT_DIR = path.join(__dirname, 'example-output');
const VIDEO_ID = 'real-world-demo';

// Archivos de entrada
const INPUT_VIDEO = path.join(MEDIA_DIR, 'test-video-hd.mp4');
const EXTERNAL_AUDIO = path.join(MEDIA_DIR, 'test-audio.mp3');
const SPANISH_SUBTITLES = path.join(MEDIA_DIR, 'test-subtitles-es.srt');
const ENGLISH_SUBTITLES = path.join(MEDIA_DIR, 'test-subtitles-en.srt');

async function ensureDirectoryExists(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function realWorldExample(): Promise<void> {
  console.log('🎬 Iniciando ejemplo de uso real del sistema HLS');
  console.log('=' .repeat(60));

  try {
    // 1. Verificar archivos de entrada
    console.log('\n📁 Verificando archivos de entrada...');
    const files = [
      { path: INPUT_VIDEO, name: 'Video HD' },
      { path: EXTERNAL_AUDIO, name: 'Audio externo' },
      { path: SPANISH_SUBTITLES, name: 'Subtítulos en español' },
      { path: ENGLISH_SUBTITLES, name: 'Subtítulos en inglés' }
    ];

    for (const file of files) {
      const exists = await checkFileExists(file.path);
      console.log(`  ${exists ? '✅' : '❌'} ${file.name}: ${file.path}`);
      if (!exists) {
        throw new Error(`Archivo requerido no encontrado: ${file.path}`);
      }
    }

    // 2. Crear directorio de salida
    await ensureDirectoryExists(OUTPUT_DIR);
    console.log(`\n📂 Directorio de salida creado: ${OUTPUT_DIR}`);

    // Obtener metadatos del video original
    console.log('\n🔍 Analizando video original...');
    const qualityManager = new QualityManager(OUTPUT_DIR, VIDEO_ID);
    const originalMetadata = await qualityManager.getVideoMetadata(INPUT_VIDEO);
    
    console.log('  📊 Metadatos del video:',originalMetadata);

    // 4. Gestión de audio
    console.log('\n🎵 Procesando pistas de audio...');
    const audioManager = new AudioManager(OUTPUT_DIR, VIDEO_ID);
    
    // Extraer pistas de audio existentes
    const existingAudioTracks = await audioManager.extractAudioTracks(INPUT_VIDEO);
    console.log(`  📻 Pistas de audio existentes: ${existingAudioTracks.length}`);
    existingAudioTracks.forEach((track, index) => {
      console.log(`    ${index + 1}. ${track.label} (${track.language}) - ${track.codec} ${track.bitrate} ${track.isDefault ? '[DEFAULT]' : ''}`);
    });

    // Añadir pista de audio externa
    const audioInfo: Omit<AudioTrack, 'id'> = {
      language: 'es',
      label: 'Audio en Español (Externo)',
      codec: 'aac',
      bitrate: '128k',
      channels: 2,
      isDefault: false
    };

    console.log('  ➕ Añadiendo pista de audio externa...');
    const videoWithExternalAudio = await audioManager.addAudioTrack(
      INPUT_VIDEO,
      EXTERNAL_AUDIO,
      audioInfo
    );
    console.log(`  ✅ Video con audio externo: ${path.basename(videoWithExternalAudio)}`);

    // 5. Gestión de subtítulos
    console.log('\n📝 Procesando subtítulos...');
    const subtitleManager = new SubtitleManager(OUTPUT_DIR, VIDEO_ID);
    
    // Añadir subtítulos en español
    console.log('  ➕ Añadiendo subtítulos en español...');
    const spanishSubtitleInfo: Omit<SubtitleTrack, 'path'> = {
      id: 'spanish_subtitles',
      language: 'es',
      label: 'Español',
      format: 'srt',
      isDefault: false
    };
    
    const videoWithSpanishSubs = await subtitleManager.addSubtitle(
      videoWithExternalAudio,
      SPANISH_SUBTITLES,
      spanishSubtitleInfo
    );
    console.log(`  ✅ Subtítulos en español añadidos: ${path.basename(videoWithSpanishSubs)}`);

    // Añadir subtítulos en inglés
    console.log('  ➕ Añadiendo subtítulos en inglés...');
    const englishSubtitleInfo: Omit<SubtitleTrack, 'path'> = {
      id: 'english_subtitles',
      language: 'en',
      label: 'English',
      format: 'srt',
      isDefault: true
    };
    
    const videoWithAllSubs = await subtitleManager.addSubtitle(
      videoWithSpanishSubs,
      ENGLISH_SUBTITLES,
      englishSubtitleInfo
    );
    console.log(`  ✅ Subtítulos en inglés añadidos: ${path.basename(videoWithAllSubs)}`);

    // Listar todos los subtítulos
    const allSubtitles = await subtitleManager.listSubtitles(videoWithAllSubs);
    console.log(`  📋 Total de subtítulos: ${allSubtitles.length}`);
    allSubtitles.forEach((sub, index) => {
      console.log(`    ${index + 1}. ${sub.label} (${sub.language}) - ${sub.format} ${sub.isDefault ? '[DEFAULT]' : ''}`);
    });

    // 6. Gestión de calidades
    console.log('\n🎯 Generando múltiples calidades...');
    
    // Generar calidades automáticamente
    console.log('  🔄 Optimización automática de calidades...');
    const optimizedVideos = await qualityManager.autoOptimizeQualities(videoWithAllSubs);
    console.log(`  ✅ Calidades generadas: ${optimizedVideos.length}`);
    
    // Crear información de calidades para HLS
    const qualityLevels: QualityLevel[] = [];
    
    for (let i = 0; i < optimizedVideos.length; i++) {
      const videosData = optimizedVideos[i];
      const metadata = await qualityManager.getVideoMetadata(videosData.path);
      const resolutionName = `${metadata.height}p`;
      
      const resolution: VideoResolution = {
        name: resolutionName,
        size: `${metadata.width}x${metadata.height}`,
        bitrate: metadata.bitrate
      };
      
      qualityLevels.push({
        id: `quality_${i}`,
        resolution,
        path: videosData.path,
        bandwidth: parseInt(metadata.bitrate.replace('k', '')) * 1000
      });
      
      console.log(`    • ${resolutionName}: ${metadata.width}x${metadata.height} @ ${metadata.bitrate}`);
    }

    // 7. Conversión a HLS
    console.log('\n🔄 Convirtiendo a HLS...');
    const hlsConverter = new HlsConverter({
      proxyBaseUrlTemplate: 'http://localhost:3000/example-output/{videoId}/'
    }, OUTPUT_DIR);
    
    // Convertir cada calidad a HLS
    const hlsOutputs: { outputDir: string; masterPlaylistUrl: string; resolution: string }[] = [];
    for (const quality of qualityLevels) {
      console.log(`  🎬 Convirtiendo ${quality.resolution.name}...`);
      const hlsOutput = await hlsConverter.convertToHls(
        quality.path,
        {
          videoId: `${VIDEO_ID}_${quality.resolution.name}`,
          basePath: ''
        }
      );
      hlsOutputs.push({
        outputDir: hlsOutput.outputDir,
        masterPlaylistUrl: hlsOutput.masterPlaylistUrl,
        resolution: quality.resolution.name
      });
      console.log(`    ✅ HLS ${quality.resolution.name}: ${path.basename(hlsOutput.outputDir)}`);
    }

    // 8. Generar playlist maestro con todas las calidades
    console.log('\n📋 Generando playlist maestro...');
    const masterPlaylistPath = path.join(OUTPUT_DIR, 'master.m3u8');
    
    // Crear playlist maestro usando M3U8Builder para mayor seguridad
    const m3u8Builder = new M3U8Builder({ version: 3 });
    
    // Agregar información de subtítulos
    m3u8Builder
      .addSubtitles({
        name: 'English',
        language: 'en',
        uri: 'english_subtitles.vtt',
        isDefault: true
      })
      .addSubtitles({
        name: 'Español',
        language: 'es',
        uri: 'spanish_subtitles.vtt',
        isDefault: false
      })
      // Agregar información de audio
      .addAudio({
        name: 'Audio Principal',
        language: 'und',
        uri: 'audio.m3u8',
        isDefault: true
      });
    
    // Ordenar por bandwidth para mejor experiencia de usuario
    const sortedOutputs = hlsOutputs.sort((a, b) => {
      const aQuality = qualityLevels.find(q => q.resolution.name === a.resolution);
      const bQuality = qualityLevels.find(q => q.resolution.name === b.resolution);
      return (aQuality?.bandwidth || 0) - (bQuality?.bandwidth || 0);
    });
    
    // Agregar streams de video
    for (const hlsOutput of sortedOutputs) {
      const quality = qualityLevels.find(q => q.resolution.name === hlsOutput.resolution);
      if (quality) {
        // Apuntar directamente al playlist de la calidad específica
        const playlistUrl = `http://localhost:3000/example-output/${VIDEO_ID}_${hlsOutput.resolution}/${hlsOutput.resolution}/playlist.m3u8`;
        
        m3u8Builder.addStreamInfo({
          bandwidth: quality.bandwidth,
          resolution: quality.resolution.size,
          audio: 'audio',
          subtitles: 'subs',
          uri: playlistUrl
        });
      }
    }
    
    // Generar el contenido del playlist y escribir al archivo
    const masterContent = m3u8Builder.build();
    await fs.promises.writeFile(masterPlaylistPath, masterContent);
    
    // Mostrar estadísticas del playlist generado
    const stats = m3u8Builder.getStats();
    console.log(`  ✅ Playlist maestro: ${path.basename(masterPlaylistPath)}`);
    console.log(`    • Pistas de audio: ${stats.audioTracks}`);
    console.log(`    • Pistas de subtítulos: ${stats.subtitleTracks}`);
    console.log(`    • Streams de video: ${stats.streamInfos}`);

    // 8.1. Los archivos HLS ya se generaron directamente en el directorio de salida
    console.log('\n📁 Archivos HLS generados en el directorio de salida...');
    for (const hlsOutput of hlsOutputs) {
      console.log(`    ✅ Generado ${hlsOutput.resolution}: ${path.basename(hlsOutput.outputDir)}`);
    }

    // 9. El audio ya está integrado en el master playlist
    console.log('\n🎵 Audio integrado en el playlist maestro');
    console.log(`  ✅ Información de audio añadida al playlist`);

    // 10. Los subtítulos ya están integrados en el master playlist
    console.log('\n📝 Subtítulos integrados en el playlist maestro');
    console.log(`  ✅ Información de subtítulos añadida al playlist`);

    // 11. Resumen final
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 ¡Conversión completada exitosamente!');
    console.log('=' .repeat(60));
    
    console.log('\n📊 Resumen del procesamiento:');
    console.log(`  • Video original: ${path.basename(INPUT_VIDEO)}`);
    console.log(`  • Calidades generadas: ${qualityLevels.length}`);
    console.log(`  • Pistas de audio: 1`);
    console.log(`  • Subtítulos: ${allSubtitles.length}`);
    console.log(`  • Playlist maestro: ${path.basename(masterPlaylistPath)}`);
    
    console.log('\n📁 Archivos de salida:');
    const outputFiles = fs.readdirSync(OUTPUT_DIR);
    outputFiles.forEach(file => {
      const filePath = path.join(OUTPUT_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`  • ${file} (${sizeKB} KB)`);
    });

    console.log('\n🌐 Para reproducir el contenido HLS:');
    console.log(`  1. Servir el directorio: ${OUTPUT_DIR}`);
    console.log(`  2. Acceder al playlist: ${path.basename(masterPlaylistPath)}`);
    console.log(`  3. El reproductor HLS detectará automáticamente:`);
    console.log(`     - Múltiples calidades de video`);
    console.log(`     - Pistas de audio disponibles`);
    console.log(`     - Subtítulos en múltiples idiomas`);

    console.log('\n✨ Ejemplo completado exitosamente!');

  } catch (error) {
    console.error('\n❌ Error durante el procesamiento:');
    console.error(error);
    process.exit(1);
  }
}

// Función para limpiar archivos de salida
async function cleanupOutput(): Promise<void> {
  if (fs.existsSync(OUTPUT_DIR)) {
    console.log('🧹 Limpiando archivos de salida anteriores...');
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    console.log('✅ Limpieza completada');
  }
}

// Ejecutar el ejemplo si se llama directamente
if (require.main === module) {
  (async () => {
    console.log('🚀 Iniciando ejemplo de uso real...');
    console.log('\n⚠️  Asegúrate de que los archivos de prueba existen.');
    console.log('   Ejecuta: node tests/generate-test-media.js\n');
    
    // Preguntar si limpiar archivos anteriores
    const args = process.argv.slice(2);
    if (args.includes('--clean') || args.includes('-c')) {
      await cleanupOutput();
    }
    
    await realWorldExample();
  })().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

export {
  realWorldExample,
  cleanupOutput,
  OUTPUT_DIR,
  VIDEO_ID
};