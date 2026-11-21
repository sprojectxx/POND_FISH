import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const { authenticateAdminAsync } = require('../../../../../lib/auth/admin-auth');

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await authenticateAdminAsync(request);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { success: false, error: { message: 'No file provided in form data' } },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate mime type
    const mime = file.type || '';
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowed.includes(mime)) {
      return NextResponse.json(
        { success: false, error: { message: 'Only image files (JPEG, PNG, WebP, GIF, SVG) are allowed.' } },
        { status: 400 }
      );
    }

    // Determine extension
    const extMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
    };
    const ext = extMap[mime] || path.extname(file.name) || '.png';

    // Unique filename
    const safeName = file.name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const filename = `${Date.now()}-${safeName}${ext}`;

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'fish');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const targetPath = path.join(uploadDir, filename);
    await fs.promises.writeFile(targetPath, buffer);

    const publicUrl = `/uploads/fish/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: buffer.length,
      mimeType: mime,
    });
  } catch (error) {
    console.error('Image upload failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code || 'UPLOAD_ERROR',
          message: error.message || 'File upload failed',
        },
      },
      { status: error.status || 500 }
    );
  }
}
