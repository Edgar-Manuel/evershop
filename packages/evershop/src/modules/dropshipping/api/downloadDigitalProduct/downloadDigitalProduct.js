import { processDownload } from '../../dropshipping/services/DigitalDeliveryService.js';
import fs from 'fs';

export default async (request, response, next) => {
  const { token } = request.params;

  try {
    const download = await processDownload(token);

    if (download.type === 'url') {
      return response.redirect(302, download.redirectUrl);
    }

    if (download.type === 'file') {
      const stat = fs.statSync(download.filePath);
      response.setHeader('Content-Type', download.mimeType || 'application/octet-stream');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${download.fileName}"`
      );
      response.setHeader('Content-Length', stat.size);
      const fileStream = fs.createReadStream(download.filePath);
      return fileStream.pipe(response);
    }

    if (download.type === 'license') {
      response.setHeader('Content-Type', 'text/plain');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="license-key.txt"`
      );
      return response.send(
        `License Key: ${download.licenseKey}\n\nThank you for your purchase!`
      );
    }

    response.status(404).send('Download not available');
  } catch (error) {
    if (error.message.includes('expired') || error.message.includes('limit')) {
      return response.status(410).json({ error: error.message });
    }
    if (error.message.includes('Invalid')) {
      return response.status(404).json({ error: 'Download not found' });
    }
    response.status(500).json({ error: 'Download failed' });
  }
};
