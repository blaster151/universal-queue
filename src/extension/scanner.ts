import { ServiceConfig } from '@/common/types';

interface SelectorMatch {
  selector: string;
  matches: number;
  sampleValues: string[];
}

interface ScanResult {
  url: string;
  domain: string;
  possibleTitleSelectors: SelectorMatch[];
  possibleThumbnailSelectors: SelectorMatch[];
  possibleDurationSelectors: SelectorMatch[];
  isSeriesList: boolean;
  episodeData?: {
    seasonSelectors: SelectorMatch[];
    episodeSelectors: SelectorMatch[];
    listSelector: string;
    count: number;
    metadata: {
      hasProgress: boolean;
      hasSynopsis: boolean;
    };
  };
}

const COMMON_TITLE_PATTERNS = [
  '[role="heading"]',
  '[role="button"][aria-label*="Episode"]',
  'h1',
  '[class*="title"]',
  '[class*="name"]',
  '[aria-label*="title"]',
  '[data-testid*="title"]'
];

const COMMON_THUMBNAIL_PATTERNS = [
  '[role="img"]',
  'img[class*="thumb"]',
  'img[class*="poster"]',
  'img[class*="preview"]',
  '[class*="thumbnail"] img',
  '[class*="poster"] img',
  '[class*="imageWrapper"] img',
  '[class*="image-wrapper"] img'
];

const COMMON_DURATION_PATTERNS = [
  '[class*="duration"]',
  '[class*="time"]',
  '[class*="length"]',
  'time',
  'span[class*="duration"]',
  '[class*="metadata"] [class*="duration"]'
];

const COMMON_EPISODE_PATTERNS = {
  season: [
    '[class*="season"]',
    '[data-testid*="season"]',
    '[aria-label*="Season"]',
    '[role="tab"][aria-label*="Season"]',
    '[role="button"][aria-label*="Season"]'
  ],
  episode: [
    '[class*="episode"]',
    '[data-testid*="episode"]',
    '[aria-label*="Episode"]',
    '[role="button"][aria-label*="Episode"]',
    '[role="listitem"][aria-label*="Episode"]',
    '[class*="episode-item"]',
    '[class*="titleCard"]'
  ],
  list: [
    '[class*="episode-list"]',
    '[class*="episodes"]',
    '[class*="season-content"]',
    '[role="list"]',
    '[role="tabpanel"]'
  ]
};

const EPISODE_METADATA_PATTERNS = {
  number: [
    '[class*="index"]',
    '[class*="episode-number"]',
    '[class*="episode_num"]'
  ],
  synopsis: [
    '[class*="synopsis"]',
    '[class*="description"]',
    '[class*="overview"]'
  ],
  progress: [
    'progress',
    '[class*="progress"]',
    '[role="progressbar"]'
  ]
};

export class StreamingServiceScanner {
  private url: string;
  private domain: string;

  constructor() {
    this.url = window.location.href;
    this.domain = window.location.hostname;
  }

  private findMatches(patterns: string[]): SelectorMatch[] {
    console.log('SCANNER: Testing patterns:', patterns);
    
    return patterns.map(pattern => {
      const elements = document.querySelectorAll(pattern);
      const sampleValues = Array.from(elements)
        .slice(0, 3)
        .map(el => el.textContent?.trim() || (el as HTMLImageElement).src || '')
        .filter(Boolean);

      console.log('SCANNER: Pattern', pattern, 'found', elements.length, 'matches');
      if (sampleValues.length > 0) {
        console.log('SCANNER: Sample values:', sampleValues);
      }

      return {
        selector: pattern,
        matches: elements.length,
        sampleValues,
      };
    }).filter(match => match.matches > 0);
  }

  private detectSeriesList(): { isSeriesList: boolean; episodeData?: any } {
    console.log('SCANNER: Checking for series list...');
    
    const episodePatterns = COMMON_EPISODE_PATTERNS;
    const seasonMatches = this.findMatches(episodePatterns.season);
    const episodeMatches = this.findMatches(episodePatterns.episode);
    const listMatches = this.findMatches(episodePatterns.list);

    const hasMetadata = Object.values(EPISODE_METADATA_PATTERNS).some(patterns => 
      this.findMatches(patterns).length > 0
    );

    const isSeriesList = (seasonMatches.length > 0 || episodeMatches.length > 0) && hasMetadata;
    console.log('SCANNER: Is series list?', isSeriesList);

    if (!isSeriesList) return { isSeriesList };

    const listSelector = listMatches[0]?.selector;
    const count = listSelector ? document.querySelector(listSelector)?.children.length || 0 : 0;

    const numberMatches = this.findMatches(EPISODE_METADATA_PATTERNS.number);
    const episodeCount = Math.max(
      count,
      numberMatches.reduce((max, match) => Math.max(max, match.matches), 0)
    );

    return {
      isSeriesList,
      episodeData: {
        seasonSelectors: seasonMatches,
        episodeSelectors: episodeMatches,
        listSelector,
        count: episodeCount,
        metadata: {
          hasProgress: this.findMatches(EPISODE_METADATA_PATTERNS.progress).length > 0,
          hasSynopsis: this.findMatches(EPISODE_METADATA_PATTERNS.synopsis).length > 0
        }
      },
    };
  }

  public async scan(): Promise<ScanResult> {
    console.log('SCANNER: Starting scan for', this.url);
    
    const titleMatches = this.findMatches(COMMON_TITLE_PATTERNS);
    const thumbnailMatches = this.findMatches(COMMON_THUMBNAIL_PATTERNS);
    const durationMatches = this.findMatches(COMMON_DURATION_PATTERNS);
    const { isSeriesList, episodeData } = this.detectSeriesList();

    const result: ScanResult = {
      url: this.url,
      domain: this.domain,
      possibleTitleSelectors: titleMatches,
      possibleThumbnailSelectors: thumbnailMatches,
      possibleDurationSelectors: durationMatches,
      isSeriesList,
      ...(isSeriesList && { episodeData }),
    };

    console.log('SCANNER: Scan complete', result);
    return result;
  }

  public static generateConfig(scanResult: ScanResult): Partial<ServiceConfig> {
    console.log('SCANNER: Generating config from scan result');
    
    const domain = scanResult.domain.replace(/^www\./, '');
    const name = domain.split('.')[0] as any;

    const config: Partial<ServiceConfig> = {
      name,
      urlPattern: `${domain}/*`,
      titleSelector: scanResult.possibleTitleSelectors[0]?.selector,
      thumbnailSelector: scanResult.possibleThumbnailSelectors[0]?.selector,
      durationSelector: scanResult.possibleDurationSelectors[0]?.selector,
      completionDetector: {
        type: 'time',
        value: 'video.currentTime >= video.duration - 0.5',
      },
    };

    if (scanResult.isSeriesList) {
      config.isSeries = () => true;
      // Add series-specific selectors and logic
    }

    console.log('SCANNER: Generated config:', config);
    return config;
  }
}

// Example usage in content script:
/*
const scanner = new StreamingServiceScanner();
scanner.scan().then(result => {
  console.log('Scan result:', result);
  const config = StreamingServiceScanner.generateConfig(result);
  console.log('Generated config:', config);
});
*/ 