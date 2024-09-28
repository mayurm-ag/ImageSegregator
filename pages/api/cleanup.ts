import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    try {
      const files = await fs.promises.readdir(uploadsDir);
      for (const file of files) {
        await fs.promises.unlink(path.join(uploadsDir, file));
      }
      res.status(200).json({ message: 'Cleanup successful' });
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({ message: 'Cleanup failed' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}