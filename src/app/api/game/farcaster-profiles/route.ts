import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const { addresses } = await request.json();
    const apiKey = process.env.NEYNAR_API_KEY;

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json({
        success: false,
        error: 'Addresses array is required'
      }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Neynar API key not configured'
      }, { status: 500 });
    }

    const response = await axios.get('https://api.neynar.com/v2/farcaster/user/bulk-by-address', {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      params: {
        addresses: addresses.join(',')
      }
    });

    // Neynar API returns data in format: { "0xaddress1": [user1], "0xaddress2": [user2], ... }
    const profiles = [];
    for (const address of addresses) {
      const addressKey = address.toLowerCase();
      if (response.data && response.data[addressKey] && response.data[addressKey].length > 0) {
        const user = response.data[addressKey][0];
        profiles.push({
          fid: user.fid,
          username: user.username || '',
          displayName: user.display_name || user.username || '',
          pfpUrl: user.pfp_url || '',
          bio: user.profile?.bio?.text || '',
          followerCount: user.follower_count || 0,
          followingCount: user.following_count || 0,
          verifications: user.verifications || [],
          activeStatus: user.active_status || 'inactive'
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: profiles
    });

  } catch (error) {
    console.error('Error fetching Farcaster profiles:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get Farcaster profiles',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
