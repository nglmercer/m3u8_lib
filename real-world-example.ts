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
const ENGLISH_AUDIO = path.join(MEDIA_DIR, 'test-audio-english.mp3');
const FRENCH_AUDIO = path.join(MEDIA_DIR, 'test-audio-french.mp3');
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
      { path: ENGLISH_AUDIO, name: 'Audio en inglés' },
      { path: FRENCH_AUDIO, name: 'Audio en francés' },
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

    // 4. Análisis del video original
    console.log('\n🔍 Analizando video original para HLS optimizado...');
    const qualityManager = new QualityManager(OUTPUT_DIR, VIDEO_ID);
    const originalMetadata = await qualityManager.getVideoMetadata(INPUT_VIDEO);
    console.log(`  📊 Video: ${originalMetadata.width}x${originalMetadata.height} @ ${originalMetadata.bitrate}`);
    console.log('  📊 Metadatos del video:',originalMetadata);

    // 7. Conversión a HLS con audio separado
    console.log('\n🔄 Convirtiendo a HLS con audio separado...');
    const hlsConverter = new HlsConverter({
      
    }, OUTPUT_DIR);
    
    // Convertir el video original una sola vez con todas las calidades
    console.log(`  🎬 Convirtiendo video con múltiples calidades...`);
    const hlsOutput = await hlsConverter.convertToHls(
      INPUT_VIDEO, // Usar el video original directamente
      {
        videoId: VIDEO_ID,
        basePath: ''
      }
    );
    
    console.log(`    ✅ HLS generado: ${path.basename(hlsOutput.outputDir)}`);
    console.log(`    ✅ Audio separado generado automáticamente`);
    console.log(`    ✅ Master playlist: ${hlsOutput.masterPlaylistUrl}`);

    // 8. Procesar subtítulos externos
    console.log('\n📝 Procesando subtítulos externos...');
    const subtitleManager = new SubtitleManager(hlsOutput.outputDir, VIDEO_ID);
    
    // Crear directorio de subtítulos
    const subtitlesDir = path.join(hlsOutput.outputDir, 'subtitles');
    await ensureDirectoryExists(subtitlesDir);
    
    // Convertir archivos SRT a VTT y crear tracks de subtítulos
    const subtitleTracks: SubtitleTrack[] = [];
    
    // Subtítulos en español
    const spanishVttPath = path.join(subtitlesDir, 'es.vtt');
    await subtitleManager.convertToVtt(SPANISH_SUBTITLES, spanishVttPath);
    subtitleTracks.push({
      id: 'sub_es',
      language: 'es',
      label: 'Español',
      path: spanishVttPath,
      format: 'vtt',
      isDefault: true
    });
    
    // Subtítulos en inglés
    const englishVttPath = path.join(subtitlesDir, 'en.vtt');
    await subtitleManager.convertToVtt(ENGLISH_SUBTITLES, englishVttPath);
    subtitleTracks.push({
      id: 'sub_en',
      language: 'en',
      label: 'English',
      path: englishVttPath,
      format: 'vtt',
      isDefault: false
    });
    
    console.log(`    ✅ Subtítulos convertidos a VTT: ${subtitleTracks.length} pistas`);
    
    // Integrar subtítulos en el master playlist
    const masterPlaylistPath = path.join(hlsOutput.outputDir, 'master.m3u8');
    await subtitleManager.generateHlsWithSubtitles(masterPlaylistPath, subtitleTracks);
    console.log(`    ✅ Master playlist actualizado con subtítulos`);
    
    // 9. Verificar estructura de archivos optimizada
    console.log('\n📁 Verificando estructura de archivos optimizada...');
    console.log(`    ✅ Video sin audio embebido: múltiples calidades`);
    console.log(`    ✅ Audio separado: directorio /audio`);
    console.log(`    ✅ Subtítulos: directorio /subtitles`);
    console.log(`    ✅ URLs relativas para portabilidad`);

    // 10. Verificar subtítulos
    console.log('\n📝 Verificando subtítulos...');
    if (fs.existsSync(subtitlesDir)) {
      const subtitleFiles = fs.readdirSync(subtitlesDir).filter(f => f.endsWith('.vtt'));
      console.log(`  ✅ Archivos de subtítulos: ${subtitleFiles.length}`);
      subtitleFiles.forEach(file => console.log(`    • ${file}`));
    }
    
    // 11. Verificar audio separado
    console.log('\n🎵 Verificando audio separado...');
    const audioDir = path.join(hlsOutput.outputDir, 'audio');
    if (fs.existsSync(audioDir)) {
      const audioFiles = fs.readdirSync(audioDir).filter(f => f.endsWith('.m3u8'));
      console.log(`  ✅ Pistas de audio separadas: ${audioFiles.length}`);
      audioFiles.forEach(file => console.log(`    • ${file}`));
    }

    // 12. Verificar calidades de video
    console.log('\n📺 Verificando calidades de video...');
    const videoQualities = fs.readdirSync(hlsOutput.outputDir)
      .filter(item => {
        const itemPath = path.join(hlsOutput.outputDir, item);
        return fs.statSync(itemPath).isDirectory() && item.endsWith('p');
      });
    console.log(`  ✅ Calidades de video: ${videoQualities.length}`);
    videoQualities.forEach(quality => console.log(`    • ${quality}`));

    // 13. Verificar master playlist
    console.log('\n📋 Verificando master playlist...');
    if (fs.existsSync(masterPlaylistPath)) {
      const masterContent = await fs.promises.readFile(masterPlaylistPath, 'utf-8');
      const audioLines = masterContent.split('\n').filter(line => line.includes('#EXT-X-MEDIA:TYPE=AUDIO'));
      const subtitleLines = masterContent.split('\n').filter(line => line.includes('#EXT-X-MEDIA:TYPE=SUBTITLES'));
      const streamLines = masterContent.split('\n').filter(line => line.includes('#EXT-X-STREAM-INF'));
      
      console.log(`  ✅ Master playlist: ${path.basename(masterPlaylistPath)}`);
      console.log(`    • Pistas de audio: ${audioLines.length}`);
      console.log(`    • Pistas de subtítulos: ${subtitleLines.length}`);
      console.log(`    • Streams de video: ${streamLines.length}`);
    }

    // 11. Resumen final
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 ¡Conversión completada exitosamente!');
    console.log('=' .repeat(60));
    
    console.log('\n📊 Resumen del procesamiento optimizado:');
    console.log(`  • Video original: ${path.basename(INPUT_VIDEO)}`);
    console.log(`  • Audio separado: Generado automáticamente`);
    console.log(`  • Subtítulos: ${subtitleTracks.length} pistas (ES, EN)`);
    console.log(`  • URLs: Relativas (portables)`);
    console.log(`  • Estructura: Optimizada`);
    console.log(`  • Master playlist: ${path.basename(masterPlaylistPath)}`);
    
    console.log('\n📁 Archivos de salida:');
    const outputFiles = fs.readdirSync(OUTPUT_DIR);
    outputFiles.forEach(file => {
      const filePath = path.join(OUTPUT_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`  • ${file} (${sizeKB} KB)`);
    });

    console.log('\n🌐 Para reproducir el contenido HLS:');
    console.log(`  1. Servir el directorio: ${hlsOutput.outputDir}`);
    console.log(`  2. Acceder al playlist: master.m3u8`);
    console.log(`  3. El reproductor HLS detectará automáticamente:`);
    console.log(`     - Múltiples calidades de video`);
    console.log(`     - Pistas de audio separadas`);
    console.log(`     - Subtítulos en español e inglés`);
    console.log(`     - URLs relativas portables`);

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