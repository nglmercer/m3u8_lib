const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MEDIA_DIR = path.join(__dirname, 'media');

// Crear directorio de media si no existe
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

console.log('🎬 Verificando archivos de prueba...');

const filesToGenerate = [
  {
    name: 'test-video.mp4',
    description: 'video básico',
    command: 'ffmpeg -f lavfi -i testsrc=duration=5:size=854x480:rate=30 -f lavfi -i sine=frequency=1000:duration=5 -c:v libx264 -c:a aac -shortest'
  },
  {
    name: 'test-video-multi-audio.mp4',
    description: 'video con múltiples audios',
    command: 'ffmpeg -f lavfi -i testsrc=duration=5:size=854x480:rate=30 -f lavfi -i sine=frequency=1000:duration=5 -f lavfi -i sine=frequency=500:duration=5 -c:v libx264 -c:a aac -map 0:v -map 1:a -map 2:a -metadata:s:a:0 language=eng -metadata:s:a:0 title="English" -metadata:s:a:1 language=spa -metadata:s:a:1 title="Spanish" -shortest'
  },
  {
    name: 'test-audio.mp3',
    description: 'audio separado',
    command: 'ffmpeg -f lavfi -i sine=frequency=800:duration=5 -c:a mp3'
  },
  {
    name: 'test-video-hd.mp4',
    description: 'video HD para pruebas de calidad',
    command: 'ffmpeg -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:duration=5 -c:v libx264 -c:a aac -shortest'
  },
  {
    name: 'test-audio-english.mp3',
    description: 'audio en inglés',
    command: 'ffmpeg -f lavfi -i sine=frequency=600:duration=5 -c:a mp3'
  },
  {
    name: 'test-audio-french.mp3',
    description: 'audio en francés',
    command: 'ffmpeg -f lavfi -i sine=frequency=400:duration=5 -c:a mp3'
  }
];

try {
  let generatedCount = 0;
  
  // Generar archivos de video/audio solo si no existen
  for (const file of filesToGenerate) {
    const filePath = path.join(MEDIA_DIR, file.name);
    if (!fs.existsSync(filePath)) {
      console.log(`📹 Generando ${file.description}...`);
      execSync(`${file.command} -y "${filePath}"`, { stdio: 'pipe' });
      generatedCount++;
    }
  }
  
  // Generar subtítulos solo si no existen
  const subtitleFiles = [
    {
      name: 'test-subtitles-es.srt',
      description: 'subtítulos en español',
      content: `1\n00:00:00,000 --> 00:00:02,000\nHola, este es un subtítulo de prueba\n\n2\n00:00:02,000 --> 00:00:04,000\nSegundo subtítulo en español\n\n3\n00:00:04,000 --> 00:00:05,000\nFin del video de prueba\n`
    },
    {
      name: 'test-subtitles-en.srt',
      description: 'subtítulos en inglés',
      content: `1\n00:00:00,000 --> 00:00:02,000\nHello, this is a test subtitle\n\n2\n00:00:02,000 --> 00:00:04,000\nSecond subtitle in English\n\n3\n00:00:04,000 --> 00:00:05,000\nEnd of test video\n`
    }
  ];
  
  for (const subtitle of subtitleFiles) {
    const subtitlePath = path.join(MEDIA_DIR, subtitle.name);
    if (!fs.existsSync(subtitlePath)) {
      console.log(`📝 Generando ${subtitle.description}...`);
      fs.writeFileSync(subtitlePath, subtitle.content);
      generatedCount++;
    }
  }
  
  if (generatedCount > 0) {
    console.log(`✅ ${generatedCount} archivos generados exitosamente!`);
  } else {
    console.log('✅ Todos los archivos de prueba ya existen.');
  }
  
  console.log('📁 Ubicación:', MEDIA_DIR);
  
  // Verificar que todos los archivos necesarios existen
  const allFiles = [...filesToGenerate.map(f => f.name), ...subtitleFiles.map(f => f.name)];
  const missingFiles = allFiles.filter(file => !fs.existsSync(path.join(MEDIA_DIR, file)));
  
  if (missingFiles.length === 0) {
    console.log('📋 Todos los archivos de prueba están listos.');
  } else {
    console.log('⚠️  Archivos faltantes:', missingFiles.join(', '));
  }
  
} catch (error) {
  console.error('❌ Error generando archivos de prueba:', error.message);
  console.log('💡 Asegúrate de que FFmpeg esté instalado y disponible en PATH');
  process.exit(1);
}