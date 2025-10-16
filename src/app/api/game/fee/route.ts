import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return the current fee amount
    return NextResponse.json({
      success: true,
      data: {
        feeAmount: '0.000013', // 0.000013 ETH
        currency: 'ETH'
      }
    });
  } catch (error) {
    console.error('Error getting fee:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get fee'
    }, { status: 500 });
  }
}
