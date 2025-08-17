// Tipos e interfaces para la librería HLS

export interface VideoResolution {
  name: string;
  size: string;
  bitrate: string;
  isOriginal?: boolean;
}

export interface HlsOptions {
  resolutions: VideoResolution[];
  hlsTime: number;
  hlsPlaylistType: 'vod' | 'event';
  copyCodecsThresholdHeight: number;
  audioCodec: string;
  audioBitrate: string;
  videoCodec: string;
  videoProfile: string;
  crf: number;
  gopSize: number;
  proxyBaseUrlTemplate: string;
  masterPlaylistName: string;
  segmentNameTemplate: string;
  resolutionPlaylistName: string;
}

export interface ConversionParams {
  videoId: string;
  basePath?: string;
}

export interface ConversionResult {
  message: string;
  outputDir: string;
  masterPlaylistPath: string;
  masterPlaylistUrl: string;
}

export interface ProcessedResolution {
  name: string;
  size: string;
  bitrate: string;
  bandwidth: number;
  playlistRelativePath: string;
}

export interface VideoMetadata {
  width: number;
  height: number;
  bitrate: string;
  duration?: number;
  codec?: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  path: string;
  format: 'srt' | 'vtt' | 'ass';
  isDefault?: boolean;
}

export interface AudioTrack {
  id: string;
  language: string;
  label: string;
  codec: string;
  bitrate: string;
  channels: number;
  isDefault?: boolean;
  uri?: string;
}

export interface QualityLevel {
  id: string;
  resolution: VideoResolution;
  path: string;
  bandwidth: number;
}