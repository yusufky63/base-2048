export interface FarcasterProfile {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  verifications: string[];
  activeStatus: string;
}

/**
 * Get Farcaster profile by wallet address via backend API
 * @param address - Wallet address (0x...)
 * @returns Farcaster profile or null if not found
 */
export async function getFarcasterProfileByAddress(address: string): Promise<FarcasterProfile | null> {
  try {
    const response = await fetch(`/api/game/farcaster-profile/${address}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Farcaster profile:', error);
    return null;
  }
}

/**
 * Get multiple Farcaster profiles by wallet addresses
 * @param addresses - Array of wallet addresses
 * @returns Array of Farcaster profiles
 */
export async function getFarcasterProfilesByAddresses(addresses: string[]): Promise<FarcasterProfile[]> {
  try {
    const response = await fetch('/api/game/farcaster-profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ addresses }),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching Farcaster profiles:', error);
    return [];
  }
}

/**
 * Get Farcaster profile by FID (Farcaster ID)
 * @param fid - Farcaster ID
 * @returns Farcaster profile or null if not found
 */
export async function getFarcasterProfileByFid(fid: number): Promise<FarcasterProfile | null> {
  try {
    const response = await fetch(`/api/game/farcaster-profile-by-fid/${fid}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Farcaster profile by FID:', error);
    return null;
  }
}
