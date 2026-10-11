import sharp from 'sharp';
import { AppError } from '../middleware/errorHandler.js';

export async function normalizeUpload(data: string): Promise<Buffer> {
  const encoded = data.startsWith('data:')
    ? /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]*={0,2})$/.exec(data)?.[1]
    : data;
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new AppError('Upload a PNG, JPEG, WebP or GIF image', 400);
  }
  const input = Buffer.from(encoded, 'base64');
  if (!input.length || input.length > 5 * 1024 * 1024) {
    throw new AppError('Image must be at most 5 MB', 400);
  }
  // Reject vector/document inputs before passing untrusted bytes to the decoder.
  const raster = input.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ||
    input.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) ||
    ['GIF87a', 'GIF89a'].includes(input.toString('ascii', 0, 6)) ||
    (input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP');
  if (!raster) throw new AppError('Unsupported image content', 400);
  try {
    const image = sharp(input, { limitInputPixels: 16_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1 ||
        metadata.width > 8192 || metadata.height > 8192) {
      throw new Error('Unsupported image dimensions or animation');
    }
    const output = await image.rotate().webp({ quality: 85 }).toBuffer();
    if (output.length > 5 * 1024 * 1024) throw new Error('Output too large');
    return output;
  } catch {
    throw new AppError('Invalid image: use a static image up to 16 megapixels and 8192 pixels per side', 400);
  }
}
