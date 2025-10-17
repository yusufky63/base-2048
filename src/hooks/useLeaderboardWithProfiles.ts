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

    const loadProfiles = async () => {
      setIsLoading(true);
      try {
        const addresses = entries.map(entry => entry.address);
        const profiles = await getFarcasterProfilesByAddresses(addresses);
        
        const profileMap = new Map<string, FarcasterProfile>();
        profiles.forEach(profile => {
          profile.verifications.forEach(verification => {
            profileMap.set(verification.toLowerCase(), profile);
          });
        });
        
        const enriched = entries.map(entry => ({
          ...entry,
          farcasterProfile: profileMap.get(entry.address.toLowerCase())
        }));
        
        setEnrichedEntries(enriched);
      } catch (error) {
        setEnrichedEntries(entries);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfiles();
  }, [entries]);

  return { enrichedEntries, isLoading };
}
