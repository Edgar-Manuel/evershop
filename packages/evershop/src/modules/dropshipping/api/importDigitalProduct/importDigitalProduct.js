import { importDigitalProduct } from '../../dropshipping/services/ProductImportService.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const {
    name,
    description,
    price,
    categoryId,
    fileUrl,
    filePath,
    fileName,
    downloadLimit,
    expiryDays,
    licenseType
  } = request.body;

  try {
    const result = await importDigitalProduct({
      name,
      description,
      price: parseFloat(price),
      categoryId: categoryId || null,
      fileUrl: fileUrl || null,
      filePath: filePath || null,
      fileName: fileName || null,
      downloadLimit: parseInt(downloadLimit || 5),
      expiryDays: parseInt(expiryDays || 30),
      licenseType: licenseType || 'single'
    });

    response.status(OK);
    response.$body = { data: result };
    next();
  } catch (error) {
    response.status(422);
    response.$body = { error: { status: 422, message: error.message } };
    next();
  }
};
