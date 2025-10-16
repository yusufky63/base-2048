import { useState, useEffect } from 'react';
import { LeaderboardEntry } from '@/lib/types';
import { getFarcasterProfilesByAddresses, type FarcasterProfile } from '@/lib/neynarService';

export interface EnrichedLeaderboardEntry extends LeaderboardEntry {
  farcasterProfile?: FarcasterProfile;
}

export function useLeaderboardWithProfiles(entries: LeaderboardEntry[]) {
  const [enrichedEntries, setEnrichedEntries] = useState<EnrichedLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!entries.length) {
      setEnrichedEntries([]);
      return;
    }

    const enrichEntries = async () => {
      setIsLoading(true);
      try {
        // Get addresses from entries
        const addresses = entries.map(entry => entry.address);
        
        // Fetch Farcaster profiles for all addresses
        const profiles = await getFarcasterProfilesByAddresses(addresses);
        
        // Create a map of address -> profile for quick lookup
        const profileMap = new Map<string, FarcasterProfile>();
        profiles.forEach(profile => {
          profile.verifications.forEach(verification => {
            profileMap.set(verification.toLowerCase(), profile);
          });
        });
        
        // Enrich entries with profiles
        const enriched = entries.map(entry => ({
          ...entry,
          farcasterProfile: profileMap.get(entry.address.toLowerCase())
        }));
        
        setEnrichedEntries(enriched);
      } catch (error) {
        console.error('Error enriching leaderboard entries:', error);
        // Fallback to original entries without profiles
        setEnrichedEntries(entries);
      } finally {
        setIsLoading(false);
      }
    };

    enrichEntries();
  }, [entries]);

  return { enrichedEntries, isLoading };
}
