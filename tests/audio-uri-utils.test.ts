import { AudioUriUtils } from '../src/lib/modules/audio';
import { AudioTrack } from '../src/lib/types';

describe('AudioUriUtils', () => {
  describe('normalizeAudioUri', () => {
    it('should remove duplicate audio/ prefixes', () => {
      const uri = 'audio/audio/track.m3u8';
      const result = AudioUriUtils.normalizeAudioUri(uri);
      expect(result).toBe('audio/track.m3u8');
    });

    it('should add audio/ prefix if missing', () => {
      const uri = 'track.m3u8';
      const result = AudioUriUtils.normalizeAudioUri(uri);
      expect(result).toBe('audio/track.m3u8');
    });

    it('should remove double slashes', () => {
      const uri = 'audio//track.m3u8';
      const result = AudioUriUtils.normalizeAudioUri(uri);
      expect(result).toBe('audio/track.m3u8');
    });

    it('should handle empty string', () => {
      const uri = '';
      const result = AudioUriUtils.normalizeAudioUri(uri);
      expect(result).toBe('');
    });

    it('should handle complex duplications', () => {
      const uri = 'audio/audio/audio/track.m3u8';
      const result = AudioUriUtils.normalizeAudioUri(uri);
      expect(result).toBe('audio/track.m3u8');
    });
  });

  describe('validateAudioUri', () => {
    it('should validate correct URI', () => {
      const uri = 'audio/track.m3u8';
      const result = AudioUriUtils.validateAudioUri(uri);
      expect(result).toBe(true);
    });

    it('should reject URI without audio/ prefix', () => {
      const uri = 'track.m3u8';
      const result = AudioUriUtils.validateAudioUri(uri);
      expect(result).toBe(false);
    });

    it('should reject URI without .m3u8 extension', () => {
      const uri = 'audio/track';
      const result = AudioUriUtils.validateAudioUri(uri);
      expect(result).toBe(false);
    });

    it('should reject empty string', () => {
      const uri = '';
      const result = AudioUriUtils.validateAudioUri(uri);
      expect(result).toBe(false);
    });
  });

  describe('generateAudioUri', () => {
    it('should generate correct URI from track ID', () => {
      const trackId = 'es';
      const result = AudioUriUtils.generateAudioUri(trackId);
      expect(result).toBe('audio/es.m3u8');
    });

    it('should clean audio/ prefix from track ID', () => {
      const trackId = 'audio/es';
      const result = AudioUriUtils.generateAudioUri(trackId);
      expect(result).toBe('audio/es.m3u8');
    });

    it('should handle empty track ID', () => {
      const trackId = '';
      const result = AudioUriUtils.generateAudioUri(trackId);
      expect(result).toBe('');
    });
  });

  describe('fixAudioTracksUris', () => {
    it('should fix URIs in audio tracks array', () => {
      const tracks: AudioTrack[] = [
        {
          id: 'es',
          language: 'es',
          label: 'Español',
          codec: 'aac',
          bitrate: '128k',
          channels: 2,
          isDefault: true,
          uri: 'audio/audio/es.m3u8' // URI duplicada
        },
        {
          id: 'en',
          language: 'en',
          label: 'English',
          codec: 'aac',
          bitrate: '128k',
          channels: 2,
          isDefault: false,
          uri: 'en.m3u8' // URI sin prefijo
        },
        {
          id: 'fr',
          language: 'fr',
          label: 'Français',
          codec: 'aac',
          bitrate: '128k',
          channels: 2,
          isDefault: false
          // URI faltante
        }
      ];

      const result = AudioUriUtils.fixAudioTracksUris(tracks);

      expect(result[0].uri).toBe('audio/es.m3u8');
      expect(result[1].uri).toBe('audio/en.m3u8');
      expect(result[2].uri).toBe('audio/fr.m3u8');
    });
  });
});