import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const apiKey = process.env.NEYNAR_API_KEY;

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
        addresses: address
      }
    });

    // Neynar API returns data in format: { "0xaddress": [user1, user2, ...] }
    const addressKey = address.toLowerCase();
    if (response.data && response.data[addressKey] && response.data[addressKey].length > 0) {
      const user = response.data[addressKey][0];
      return NextResponse.json({
        success: true,
        data: {
          fid: user.fid,
          username: user.username || '',
          displayName: user.display_name || user.username || '',
          pfpUrl: user.pfp_url || '',
          bio: user.profile?.bio?.text || '',
          followerCount: user.follower_count || 0,
          followingCount: user.following_count || 0,
          verifications: user.verifications || [],
          activeStatus: user.active_status || 'inactive'
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: null
    });

  } catch (error) {
    console.error('Error fetching Farcaster profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get Farcaster profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
