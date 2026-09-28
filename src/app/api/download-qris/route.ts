import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedUrl = searchParams.get('url') || '/images/qris-disbudpora.png';

    // If external URL (http / https), fetch and stream
    if (requestedUrl.startsWith('http://') || requestedUrl.startsWith('https://')) {
      const response = await fetch(requestedUrl);
      if (!response.ok) {
        return new NextResponse('Failed to fetch external QRIS image', { status: 502 });
      }
      const contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();

      return new NextResponse(Buffer.from(arrayBuffer), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': 'attachment; filename="QRIS-DISBUDPORA-BEKASI.png"',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }

    // Local file inside public folder
    const cleanPath = requestedUrl.split('?')[0].replace(/^\/+/, '');
    const normalizedPath = path.normalize(cleanPath);

    // Prevent directory traversal
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      return new NextResponse('Invalid file path', { status: 400 });
    }

    const publicDir = path.join(process.cwd(), 'public');
    let filePath = path.join(publicDir, normalizedPath);

    if (!fs.existsSync(filePath)) {
      // Fallback to default QRIS
      filePath = path.join(publicDir, 'images', 'qris-disbudpora.png');
      if (!fs.existsSync(filePath)) {
        return new NextResponse('QRIS image not found', { status: 404 });
      }
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment; filename="QRIS-DISBUDPORA-BEKASI.png"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: unknown) {
    console.error('Error serving QRIS download:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
