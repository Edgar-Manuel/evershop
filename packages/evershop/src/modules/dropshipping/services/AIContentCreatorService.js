/**
 * AI Content Creator Service
 *
 * Uses Claude (Anthropic API) to auto-generate:
 * - Full eBooks (10,000–20,000 words)
 * - Audiobook scripts (optimized for TTS)
 * - Product descriptions (SEO-optimized)
 * - Cover copy (headline + subtitle + bullets)
 * - Table of contents
 * - Chapter content
 *
 * Uses Google Text-to-Speech to convert eBooks to MP3 audiobooks.
 *
 * Revenue model:
 * - eBook at $9.99–$47: ~100% margin (zero production cost)
 * - Audiobook at $14.99–$37: ~100% margin
 * - Bundle (eBook + Audiobook): $24.99–$67
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getConfig } from '../../../lib/util/getConfig.js';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || getConfig('dropshipping.anthropicApiKey', '')
});

/**
 * Generate a complete eBook for a trending topic
 * Returns the full text and metadata
 */
export async function generateEBook(topic, category, options = {}) {
  const {
    targetAudience = 'beginners',
    tone = 'friendly and encouraging',
    chapterCount = 7,
    wordsPerChapter = 1500,
    includeExercises = true,
    language = 'English'
  } = options;

  console.log(`[AI Creator] Generating eBook: "${topic}" (${chapterCount} chapters)`);

  // Step 1: Generate the book outline
  const outlinePrompt = `You are a professional bestselling author specializing in ${category}.

Create a detailed, commercially compelling book outline for:
TITLE CONCEPT: "${topic}"

Requirements:
- Target audience: ${targetAudience}
- Tone: ${tone}
- ${chapterCount} chapters
- Include: catchy title, powerful subtitle, ${chapterCount} chapter titles with 3-4 subtopic bullets each
- The book must solve a REAL PROBLEM and deliver CLEAR VALUE
- Format as JSON

Respond with this exact JSON structure:
{
  "title": "Compelling Title Here",
  "subtitle": "Compelling subtitle that explains the benefit",
  "tagline": "One powerful sentence promise",
  "targetAudience": "Who this book is for",
  "mainBenefit": "The #1 transformation readers will experience",
  "chapters": [
    {
      "number": 1,
      "title": "Chapter Title",
      "description": "What this chapter covers",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

  const outlineResponse = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: outlinePrompt }]
  });

  let outline;
  try {
    const text = outlineResponse.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    outline = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error('Failed to parse book outline: ' + err.message);
  }

  console.log(`[AI Creator] Outline ready: "${outline.title}"`);

  // Step 2: Generate each chapter
  const chapters = [];
  for (const chapter of outline.chapters) {
    const chapterContent = await generateChapter({
      bookTitle: outline.title,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      chapterDescription: chapter.description,
      keyPoints: chapter.keyPoints,
      tone,
      targetWords: wordsPerChapter,
      includeExercises,
      category
    });
    chapters.push({ ...chapter, content: chapterContent });
    console.log(`[AI Creator] Chapter ${chapter.number}/${chapterCount} generated`);
  }

  // Step 3: Generate introduction and conclusion
  const [intro, conclusion] = await Promise.all([
    generateIntroduction(outline, tone, targetAudience),
    generateConclusion(outline, tone)
  ]);

  // Step 4: Build complete eBook text
  const fullText = buildEBookText(outline, intro, chapters, conclusion);

  // Step 5: Generate SEO-optimized product description
  const productDescription = await generateProductDescription(outline, category);

  // Step 6: Save to file
  const fileName = sanitizeFileName(outline.title) + '.txt';
  const filePath = await saveEBookFile(fileName, fullText);

  return {
    title: outline.title,
    subtitle: outline.subtitle,
    tagline: outline.tagline,
    targetAudience: outline.targetAudience,
    mainBenefit: outline.mainBenefit,
    keywords: outline.keywords,
    chapterCount: chapters.length,
    wordCount: fullText.split(/\s+/).length,
    productDescription,
    fullText,
    fileName,
    filePath,
    coverData: {
      title: outline.title,
      subtitle: outline.subtitle,
      category
    }
  };
}

/**
 * Generate a single chapter with full content
 */
async function generateChapter({
  bookTitle,
  chapterNumber,
  chapterTitle,
  chapterDescription,
  keyPoints,
  tone,
  targetWords,
  includeExercises,
  category
}) {
  const exerciseSection = includeExercises
    ? `\n- End with a practical "ACTION STEP" or exercise the reader can do immediately`
    : '';

  const prompt = `You are writing Chapter ${chapterNumber} of the book "${bookTitle}".

Chapter title: "${chapterTitle}"
What this chapter covers: ${chapterDescription}
Key points to address: ${keyPoints.join(', ')}

Write approximately ${targetWords} words in a ${tone} tone.
- Start with an engaging opening (story, statistic, or provocative question)
- Use headers (##) for subsections
- Include real, actionable advice
- Use examples and analogies to explain concepts
- Write in second person ("you") to directly engage the reader
- Include bullet points and numbered lists where appropriate${exerciseSection}

Write the full chapter content now (no meta-commentary, just the chapter):`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

/**
 * Generate book introduction
 */
async function generateIntroduction(outline, tone, targetAudience) {
  const prompt = `Write a compelling introduction (400–600 words) for the book "${outline.title}: ${outline.subtitle}".

The introduction should:
- Open with a powerful hook (story, shocking fact, or relatable problem)
- Identify exactly who this book is for: ${targetAudience}
- Clearly state the main transformation/benefit: ${outline.mainBenefit}
- Build credibility
- Tell readers what they'll learn in each chapter (brief preview)
- End with an inspiring call to action to keep reading

Tone: ${tone}
Write the full introduction:`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

/**
 * Generate book conclusion
 */
async function generateConclusion(outline, tone) {
  const prompt = `Write a powerful conclusion (300–500 words) for the book "${outline.title}".

The conclusion should:
- Celebrate the reader's journey through the book
- Summarize the key transformations
- Inspire action with the knowledge gained
- Provide a strong motivational close
- Include a brief next-steps section

Tone: ${tone}
Write the full conclusion:`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

/**
 * Generate SEO-optimized product description for the store
 */
export async function generateProductDescription(outline, category) {
  const prompt = `Write a compelling, SEO-optimized product description for this digital eBook:

Title: "${outline.title}"
Subtitle: "${outline.subtitle}"
Category: ${category}
Main Benefit: ${outline.mainBenefit}
Keywords: ${(outline.keywords || []).join(', ')}

The description should:
- Be 200-300 words
- Lead with the main benefit/transformation
- List 5–7 specific things readers will learn/gain (bullets)
- Include social proof signals ("thousands of readers", "proven strategies")
- Create urgency
- End with a strong call to action
- Be optimized for search (naturally include keywords)

Write the product description:`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

/**
 * Generate audiobook script (optimized for text-to-speech)
 * Converts eBook to audio-friendly format
 */
export async function generateAudiobookScript(ebookText, title) {
  const prompt = `Convert this eBook excerpt into an audiobook script optimized for text-to-speech narration.

Book: "${title}"

Rules for audiobook conversion:
- Remove markdown formatting (**, ##, -, etc.)
- Spell out abbreviations and symbols
- Add natural speech pauses with "..." or paragraph breaks
- Convert bullet lists to flowing sentences
- Add chapter transition phrases ("In the next section, we'll explore...")
- Keep a warm, conversational tone
- Format numbers as words ("three" not "3")
- Remove any web URLs or technical references

Convert this text to audiobook script:
${ebookText.substring(0, 3000)}

Write the audio-optimized version:`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

/**
 * Convert text to MP3 using Google Cloud TTS (requires API key)
 * Returns path to saved MP3 file
 */
export async function textToSpeech(text, outputFileName, googleTTSApiKey) {
  if (!googleTTSApiKey) {
    throw new Error('Google TTS API key required for audiobook generation');
  }

  // Split into chunks (Google TTS limit: 5000 chars per request)
  const chunks = splitTextIntoChunks(text, 4500);
  const audioBuffers = [];

  for (const chunk of chunks) {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleTTSApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: chunk },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-D', // Premium natural voice
            ssmlGender: 'MALE'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.95, // Slightly slower for comprehension
            pitch: 0.0,
            volumeGainDb: 0.0
          }
        })
      }
    );

    const data = await res.json();
    if (data.audioContent) {
      audioBuffers.push(Buffer.from(data.audioContent, 'base64'));
    }
  }

  // Concatenate all audio chunks
  const combined = Buffer.concat(audioBuffers);
  const filePath = getUploadPath(outputFileName);
  fs.writeFileSync(filePath, combined);

  return filePath;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the complete eBook as formatted text
 */
function buildEBookText(outline, intro, chapters, conclusion) {
  const lines = [
    `${'='.repeat(60)}`,
    `${outline.title.toUpperCase()}`,
    `${outline.subtitle}`,
    `${'='.repeat(60)}`,
    '',
    `"${outline.tagline}"`,
    '',
    '─'.repeat(60),
    'TABLE OF CONTENTS',
    '─'.repeat(60),
    '',
    'Introduction',
    ...chapters.map((c) => `Chapter ${c.number}: ${c.title}`),
    'Conclusion',
    '',
    '─'.repeat(60),
    'INTRODUCTION',
    '─'.repeat(60),
    '',
    intro,
    ''
  ];

  for (const chapter of chapters) {
    lines.push(
      '',
      '─'.repeat(60),
      `CHAPTER ${chapter.number}: ${chapter.title.toUpperCase()}`,
      '─'.repeat(60),
      '',
      chapter.content,
      ''
    );
  }

  lines.push(
    '',
    '─'.repeat(60),
    'CONCLUSION',
    '─'.repeat(60),
    '',
    conclusion,
    '',
    '─'.repeat(60),
    `© ${new Date().getFullYear()} All Rights Reserved`,
    `Published digitally. For personal use only.`,
    '─'.repeat(60)
  );

  return lines.join('\n');
}

/**
 * Save eBook text to disk
 */
async function saveEBookFile(fileName, content) {
  const uploadDir = path.join(process.cwd(), 'media', 'ebooks');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function getUploadPath(fileName) {
  const uploadDir = path.join(process.cwd(), 'media', 'audiobooks');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return path.join(uploadDir, fileName);
}

function sanitizeFileName(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

function splitTextIntoChunks(text, maxLen) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.substring(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
}

export default {
  generateEBook,
  generateProductDescription,
  generateAudiobookScript,
  textToSpeech
};
