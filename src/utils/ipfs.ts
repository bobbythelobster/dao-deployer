/**
 * DAO Deployer - IPFS Integration
 * 
 * IPFS integration for off-chain proposal storage.
 * Uploads markdown proposals to IPFS, retrieves content, pins content,
 * and generates content hashes.
 */

import {
  IPFS_ENDPOINTS,
  DEFAULT_IPFS_CONFIG,
  type IPFSConfig,
  PROPOSAL_CONFIG,
} from './constants.ts';
import {
  IPFSError,
  IPFSUploadError,
  IPFSDownloadError,
  IPFSPinError,
  ValidationError,
} from './errors.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface IPFSContent {
  cid: string;
  content: string | Uint8Array;
  size: number;
  pinned: boolean;
}

export interface ProposalContent {
  title: string;
  description: string;
  body: string;
  discussionUrl?: string;
  resources?: { name: string; url: string }[];
  author: string;
  createdAt: string;
  version: string;
}

export interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export interface NFTStorageResponse {
  ok: boolean;
  value: {
    cid: string;
    size: number;
  };
}

// ============================================================================
// IPFS CLIENT
// ============================================================================

export class IPFSClient {
  private config: IPFSConfig;
  private apiKey?: string;

  constructor(config?: IPFSConfig, apiKey?: string) {
    this.config = config || DEFAULT_IPFS_CONFIG;
    this.apiKey = apiKey;
  }

  /**
   * Update the client configuration
   */
  setConfig(config: IPFSConfig, apiKey?: string): void {
    this.config = config;
    this.apiKey = apiKey;
  }

  /**
   * Get the gateway URL for a CID
   */
  getGatewayUrl(cid: string): string {
    return `${this.config.gateway}${cid}`;
  }

  /**
   * Validate proposal content
   */
  private validateProposal(content: ProposalContent): void {
    if (!content.title || content.title.length < PROPOSAL_CONFIG.minTitleLength) {
      throw new ValidationError(
        `Title must be at least ${PROPOSAL_CONFIG.minTitleLength} characters`,
        'title',
        content.title
      );
    }

    if (content.title.length > PROPOSAL_CONFIG.maxTitleLength) {
      throw new ValidationError(
        `Title must not exceed ${PROPOSAL_CONFIG.maxTitleLength} characters`,
        'title',
        content.title
      );
    }

    if (!content.body || content.body.length < PROPOSAL_CONFIG.minBodyLength) {
      throw new ValidationError(
        `Body must be at least ${PROPOSAL_CONFIG.minBodyLength} characters`,
        'body',
        content.body
      );
    }

    if (content.body.length > PROPOSAL_CONFIG.maxBodyLength) {
      throw new ValidationError(
        `Body must not exceed ${PROPOSAL_CONFIG.maxBodyLength} characters`,
        'body',
        content.body
      );
    }

    if (!content.author) {
      throw new ValidationError('Author address is required', 'author', content.author);
    }
  }

  /**
   * Convert proposal content to markdown
   */
  private toMarkdown(content: ProposalContent): string {
    const resourcesSection = content.resources && content.resources.length > 0
      ? `\n## Resources\n\n${content.resources.map(r => `- [${r.name}](${r.url})`).join('\n')}`
      : '';

    const discussionSection = content.discussionUrl
      ? `\n## Discussion\n\nJoin the discussion: [${content.discussionUrl}](${content.discussionUrl})`
      : '';

    return `# ${content.title}

**Author:** ${content.author}  
**Created:** ${content.createdAt}  
**Version:** ${content.version}

## Summary

${content.description}

## Details

${content.body}${discussionSection}${resourcesSection}
`;
  }

  /**
   * Parse markdown back to proposal content
   */
  private fromMarkdown(markdown: string): Partial<ProposalContent> {
    const lines = markdown.split('\n');
    const content: Partial<ProposalContent> = {};

    // Extract title from first h1
    const titleMatch = markdown.match(/^# (.+)$/m);
    if (titleMatch) {
      content.title = titleMatch[1];
    }

    // Extract metadata
    const authorMatch = markdown.match(/\*\*Author:\*\* (.+)/);
    if (authorMatch) {
      content.author = authorMatch[1].trim();
    }

    const createdMatch = markdown.match(/\*\*Created:\*\* (.+)/);
    if (createdMatch) {
      content.createdAt = createdMatch[1].trim();
    }

    const versionMatch = markdown.match(/\*\*Version:\*\* (.+)/);
    if (versionMatch) {
      content.version = versionMatch[1].trim();
    }

    // Extract sections
    const summaryMatch = markdown.match(/## Summary\n\n([\s\S]*?)(?=\n## |$)/);
    if (summaryMatch) {
      content.description = summaryMatch[1].trim();
    }

    const detailsMatch = markdown.match(/## Details\n\n([\s\S]*?)(?=\n## |$)/);
    if (detailsMatch) {
      content.body = detailsMatch[1].trim();
    }

    const discussionMatch = markdown.match(/## Discussion\n\nJoin the discussion: \[(.+?)\]/);
    if (discussionMatch) {
      content.discussionUrl = discussionMatch[1];
    }

    // Extract resources
    const resourcesMatch = markdown.match(/## Resources\n\n([\s\S]*?)(?=\n## |$)/);
    if (resourcesMatch) {
      const resourcesText = resourcesMatch[1];
      const resourceMatches = resourcesText.matchAll(/- \[(.+?)\]\((.+?)\)/g);
      content.resources = Array.from(resourceMatches).map(match => ({
        name: match[1],
        url: match[2],
      }));
    }

    return content;
  }

  /**
   * Upload content to IPFS
   */
  async upload(
    content: string | Uint8Array,
    filename: string = 'content.md',
    pin: boolean = true
  ): Promise<IPFSContent> {
    try {
      // Check if we're using a pinning service
      if (this.config.pinningService === 'pinata' && this.apiKey) {
        return await this.uploadToPinata(content, filename, pin);
      }

      if (this.config.pinningService === 'nft.storage' && this.apiKey) {
        return await this.uploadToNFTStorage(content, filename);
      }

      // Default: use public gateway (read-only)
      throw new IPFSUploadError(
        'No pinning service configured. Please provide an API key for Pinata or NFT.Storage.'
      );
    } catch (error) {
      if (error instanceof IPFSError) throw error;
      throw new IPFSUploadError(
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Upload to Pinata
   */
  private async uploadToPinata(
    content: string | Uint8Array,
    filename: string,
    pin: boolean
  ): Promise<IPFSContent> {
    if (!this.apiKey) {
      throw new IPFSUploadError('Pinata API key required');
    }

    const formData = new FormData();
    const blob = content instanceof Uint8Array 
      ? new Blob([content])
      : new Blob([content], { type: 'text/markdown' });
    
    formData.append('file', blob, filename);
    
    if (pin) {
      formData.append('pinataMetadata', JSON.stringify({ name: filename }));
    }

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new IPFSUploadError(`Pinata upload failed: ${error}`);
    }

    const data: PinataResponse = await response.json();

    return {
      cid: data.IpfsHash,
      content,
      size: data.PinSize,
      pinned: pin,
    };
  }

  /**
   * Upload to NFT.Storage
   */
  private async uploadToNFTStorage(
    content: string | Uint8Array,
    filename: string
  ): Promise<IPFSContent> {
    if (!this.apiKey) {
      throw new IPFSUploadError('NFT.Storage API key required');
    }

    const blob = content instanceof Uint8Array 
      ? new Blob([content])
      : new Blob([content], { type: 'text/markdown' });
    
    const formData = new FormData();
    formData.append('file', blob, filename);

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new IPFSUploadError(`NFT.Storage upload failed: ${error}`);
    }

    const data: NFTStorageResponse = await response.json();

    if (!data.ok) {
      throw new IPFSUploadError('NFT.Storage upload failed');
    }

    return {
      cid: data.value.cid,
      content,
      size: data.value.size,
      pinned: true,
    };
  }

  /**
   * Upload a proposal to IPFS
   */
  async uploadProposal(
    content: ProposalContent,
    pin: boolean = true
  ): Promise<IPFSContent> {
    this.validateProposal(content);

    const markdown = this.toMarkdown(content);
    const filename = `proposal-${content.title.toLowerCase().replace(/\s+/g, '-')}.md`;

    return this.upload(markdown, filename, pin);
  }

  /**
   * Retrieve content from IPFS
   */
  async retrieve(cid: string): Promise<string> {
    try {
      const url = this.getGatewayUrl(cid);
      const response = await fetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      throw new IPFSDownloadError(
        cid,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Retrieve and parse a proposal from IPFS
   */
  async retrieveProposal(cid: string): Promise<ProposalContent> {
    const markdown = await this.retrieve(cid);
    const partial = this.fromMarkdown(markdown);

    // Validate required fields
    if (!partial.title || !partial.body || !partial.author) {
      throw new IPFSDownloadError(cid, new Error('Invalid proposal format'));
    }

    return partial as ProposalContent;
  }

  /**
   * Pin content to IPFS
   */
  async pin(cid: string): Promise<void> {
    if (!this.config.pinningService || !this.apiKey) {
      throw new IPFSPinError(cid, new Error('No pinning service configured'));
    }

    try {
      if (this.config.pinningService === 'pinata') {
        await this.pinToPinata(cid);
      } else if (this.config.pinningService === 'nft.storage') {
        // NFT.Storage pins automatically on upload
        return;
      } else {
        throw new IPFSPinError(cid, new Error(`Unsupported pinning service: ${this.config.pinningService}`));
      }
    } catch (error) {
      throw new IPFSPinError(
        cid,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Pin content to Pinata
   */
  private async pinToPinata(cid: string): Promise<void> {
    const response = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hashToPin: cid,
        pinataMetadata: { name: `dao-proposal-${cid}` },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata pin failed: ${error}`);
    }
  }

  /**
   * Unpin content from IPFS
   */
  async unpin(cid: string): Promise<void> {
    if (this.config.pinningService !== 'pinata' || !this.apiKey) {
      throw new IPFSPinError(cid, new Error('Unpinning only supported with Pinata'));
    }

    const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new IPFSPinError(cid, new Error(`Pinata unpin failed: ${error}`));
    }
  }

  /**
   * Generate a content hash (CID preview)
   * Note: This is a simplified version - real CID generation requires IPFS node
   */
  generateContentHash(content: string): string {
    // In a real implementation, this would use IPFS hashing (sha2-256)
    // For now, return a placeholder that indicates this is a hash
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    
    // Simple hash for demonstration (not a real CID)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `Qm${Math.abs(hash).toString(16).padStart(44, '0')}`;
  }

  /**
   * Check if content is available on IPFS
   */
  async isAvailable(cid: string): Promise<boolean> {
    try {
      const url = this.getGatewayUrl(cid);
      const response = await fetch(url, {
        method: 'HEAD',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get content size from IPFS
   */
  async getSize(cid: string): Promise<number | null> {
    try {
      const url = this.getGatewayUrl(cid);
      const response = await fetch(url, {
        method: 'HEAD',
      });
      
      if (!response.ok) return null;
      
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : null;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// DEFAULT INSTANCE
// ============================================================================

let defaultClient: IPFSClient | null = null;

/**
 * Get the default IPFS client instance
 */
export function getIPFSClient(config?: IPFSConfig, apiKey?: string): IPFSClient {
  if (!defaultClient || config) {
    defaultClient = new IPFSClient(config, apiKey);
  }
  return defaultClient;
}

/**
 * Set the default IPFS client configuration
 */
export function configureIPFS(config: IPFSConfig, apiKey?: string): void {
  defaultClient = new IPFSClient(config, apiKey);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Quick upload helper
 */
export async function uploadToIPFS(
  content: string | Uint8Array,
  filename?: string,
  config?: IPFSConfig,
  apiKey?: string
): Promise<IPFSContent> {
  const client = getIPFSClient(config, apiKey);
  return client.upload(content, filename);
}

/**
 * Quick proposal upload helper
 */
export async function uploadProposalToIPFS(
  content: ProposalContent,
  config?: IPFSConfig,
  apiKey?: string
): Promise<IPFSContent> {
  const client = getIPFSClient(config, apiKey);
  return client.uploadProposal(content);
}

/**
 * Quick retrieve helper
 */
export async function retrieveFromIPFS(
  cid: string,
  config?: IPFSConfig
): Promise<string> {
  const client = config ? new IPFSClient(config) : getIPFSClient();
  return client.retrieve(cid);
}

/**
 * Quick proposal retrieve helper
 */
export async function retrieveProposalFromIPFS(
  cid: string,
  config?: IPFSConfig
): Promise<ProposalContent> {
  const client = config ? new IPFSClient(config) : getIPFSClient();
  return client.retrieveProposal(cid);
}

export { IPFS_ENDPOINTS, DEFAULT_IPFS_CONFIG };
export type { IPFSConfig };
