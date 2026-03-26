/**
 * Create Digital Product with AI
 *
 * Full pipeline:
 * 1. Claude generates complete eBook content
 * 2. Optionally converts to audiobook via Google TTS
 * 3. Creates EverShop product with AI-generated description
 * 4. Sets up digital download for automatic delivery
 *
 * Body params:
 * - topic: string (e.g. "self improvement for beginners")
 * - category: string (e.g. "Self-Help & Personal Development")
 * - productType: 'ebook' | 'audiobook' | 'bundle'
 * - price: number (optional, auto-calculated if omitted)
 * - chapterCount: number (default 7)
 * - googleTtsApiKey: string (optional, needed for audiobooks)
 * - categoryId: number (EverShop category ID)
 */
import { generateEBook, generateAudiobookScript, textToSpeech } from '../../services/AIContentCreatorService.js';
import { importDigitalProduct } from '../../services/ProductImportService.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const {
    topic,
    category,
    productType = 'ebook',
    price,
    chapterCount = 7,
    targetAudience = 'beginners',
    tone = 'friendly and encouraging',
    googleTtsApiKey,
    categoryId
  } = request.body;

  if (!topic || !category) {
    response.status(422);
    response.$body = { error: { status: 422, message: 'topic and category are required' } };
    return next();
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    response.status(422);
    response.$body = {
      error: {
        status: 422,
        message: 'ANTHROPIC_API_KEY environment variable is required. Set it in your .env file.'
      }
    };
    return next();
  }

  try {
    // Step 1: Generate eBook with Claude AI
    console.log(`[Wizard] Generating ${productType} for topic: "${topic}"`);

    const ebook = await generateEBook(topic, category, {
      targetAudience,
      tone,
      chapterCount: parseInt(chapterCount),
      wordsPerChapter: 1200,
      includeExercises: true
    });

    console.log(`[Wizard] eBook generated: "${ebook.title}" (${ebook.wordCount} words)`);

    // Determine selling price
    const sellingPrice = price
      ? parseFloat(price)
      : calculateRecommendedPrice(category, productType, ebook.wordCount);

    const products = [];

    // Step 2: Create eBook product
    if (productType === 'ebook' || productType === 'bundle') {
      const ebookProduct = await importDigitalProduct({
        name: ebook.title,
        description: `<h2>${ebook.subtitle}</h2>${ebook.productDescription}`,
        price: sellingPrice,
        categoryId: categoryId || null,
        filePath: ebook.filePath,
        fileName: ebook.fileName,
        downloadLimit: 5,
        expiryDays: 365,
        licenseType: 'single'
      });

      products.push({
        type: 'ebook',
        ...ebookProduct,
        wordCount: ebook.wordCount,
        chapterCount: ebook.chapterCount
      });
    }

    // Step 3: Create audiobook product (if requested and TTS key available)
    if ((productType === 'audiobook' || productType === 'bundle') && googleTtsApiKey) {
      try {
        console.log('[Wizard] Converting to audiobook...');

        // Generate TTS-optimized script from eBook intro + first 2 chapters
        const sampleText = ebook.fullText.substring(0, 6000);
        const audioScript = await generateAudiobookScript(sampleText, ebook.title);

        // Convert to MP3
        const audioFileName = ebook.fileName.replace('.txt', '.mp3');
        const audioFilePath = await textToSpeech(audioScript, audioFileName, googleTtsApiKey);

        const audiobookPrice = productType === 'bundle' ? sellingPrice * 1.5 : sellingPrice * 1.3;

        const audiobookProduct = await importDigitalProduct({
          name: `${ebook.title} (Audiobook)`,
          description: `<h2>Audiobook Edition</h2>${ebook.productDescription}`,
          price: Math.round(audiobookPrice * 100) / 100,
          categoryId: categoryId || null,
          filePath: audioFilePath,
          fileName: audioFileName,
          downloadLimit: 3,
          expiryDays: 365,
          licenseType: 'single'
        });

        products.push({ type: 'audiobook', ...audiobookProduct });
        console.log('[Wizard] Audiobook created successfully');
      } catch (ttsErr) {
        console.warn('[Wizard] Audiobook creation failed (TTS error):', ttsErr.message);
        products.push({ type: 'audiobook', error: ttsErr.message });
      }
    } else if ((productType === 'audiobook' || productType === 'bundle') && !googleTtsApiKey) {
      products.push({
        type: 'audiobook',
        skipped: true,
        reason: 'Google TTS API key not provided. Add it in Settings > Dropshipping to enable audiobooks.'
      });
    }

    response.status(OK);
    response.$body = {
      data: {
        success: true,
        topic,
        category,
        title: ebook.title,
        subtitle: ebook.subtitle,
        wordCount: ebook.wordCount,
        chapterCount: ebook.chapterCount,
        keywords: ebook.keywords,
        products,
        estimatedMonthlyRevenue: Math.round(sellingPrice * 20),
        message: `Successfully created "${ebook.title}"!`
      }
    };
    next();
  } catch (error) {
    console.error('[Wizard] Digital product creation failed:', error.message);
    response.status(500);
    response.$body = {
      error: {
        status: 500,
        message: error.message,
        hint: error.message.includes('API') ? 'Check your ANTHROPIC_API_KEY in environment variables' : undefined
      }
    };
    next();
  }
};

/**
 * Recommend optimal selling price based on category and content
 */
function calculateRecommendedPrice(category, productType, wordCount) {
  const categoryPrices = {
    'Business & Entrepreneurship': 47,
    'Finance & Investing': 37,
    'AI & Technology': 29.99,
    'Self-Help & Personal Development': 24.99,
    'Relationships & Dating': 27,
    'Fitness & Health': 19.99,
    'Mindfulness & Spirituality': 17.99,
    'Productivity & Focus': 14.99
  };

  let base = categoryPrices[category] || 24.99;

  // Longer books justify higher price
  if (wordCount > 15000) base *= 1.2;
  if (wordCount > 20000) base *= 1.3;

  // Audiobooks priced higher than eBooks
  if (productType === 'audiobook') base *= 1.3;
  if (productType === 'bundle') base *= 1.7;

  // Round to .99
  return Math.floor(base) + 0.99;
}
