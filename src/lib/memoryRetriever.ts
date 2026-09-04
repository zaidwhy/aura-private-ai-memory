/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryCategory, MemoryItem } from '../types';

export interface RetrievedMemoryCitation {
  memory: MemoryItem;
  score: number;
  matchedTerms: string[];
  reason: string;
}

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'did', 'do', 'does', 'doing', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'will', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

const CATEGORY_WEIGHTS: Record<MemoryCategory, number> = {
  preference: 1.3,
  goal: 1.25,
  project: 1.2,
  recurring_theme: 1.1,
  important_fact: 1.0,
};

/**
 * Tokenizes and sanitizes text for safe matching without regex injection.
 */
export function tokenizeText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Strips dangerous prompt delimiters and injection vectors from memory content
 * to prevent indirect prompt injection (OWASP LLM01).
 */
export function sanitizeMemoryForContext(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<\/?[^>]+(>|$)/g, '') // Strip XML/HTML tags
    .replace(/```[a-z]*[\s\S]*?```/gi, '[code block removed]') // Strip multi-line code blocks
    .replace(/(?:ignore previous instructions|system prompt|developer instructions)/gi, '[sanitized]')
    .trim();
}

/**
 * Core secure memory retrieval algorithm:
 * Combines lexical TF overlap, title boost, category salience, importance rating, and recency decay.
 */
export function retrieveRelevantMemories(
  query: string,
  memories: MemoryItem[],
  options: {
    maxK?: number;
    threshold?: number;
    fallbackToTopSalient?: boolean;
  } = {}
): RetrievedMemoryCitation[] {
  const { maxK = 5, threshold = 0.15, fallbackToTopSalient = true } = options;

  if (!Array.isArray(memories) || memories.length === 0) {
    return [];
  }

  const queryTokens = tokenizeText(query);
  const now = Date.now();

  const scoredList: RetrievedMemoryCitation[] = [];

  for (const memory of memories) {
    if (!memory || !memory.title || !memory.content) continue;

    const titleTokens = new Set(tokenizeText(memory.title));
    const contentTokens = new Set(tokenizeText(memory.content));

    let lexicalScore = 0;
    const matchedTerms: string[] = [];

    for (const qToken of queryTokens) {
      let tokenMatched = false;
      if (titleTokens.has(qToken)) {
        lexicalScore += 2.5; // High weight for title match
        tokenMatched = true;
      }
      if (contentTokens.has(qToken)) {
        lexicalScore += 1.0; // Standard weight for body match
        tokenMatched = true;
      }
      if (tokenMatched) {
        matchedTerms.push(qToken);
      }
    }

    // Exact phrase or substring match boost
    const cleanQuery = query.toLowerCase().trim();
    if (cleanQuery.length > 4 && memory.title.toLowerCase().includes(cleanQuery)) {
      lexicalScore += 3.0;
    } else if (cleanQuery.length > 4 && memory.content.toLowerCase().includes(cleanQuery)) {
      lexicalScore += 1.5;
    }

    // Category weight multiplier
    const catWeight = CATEGORY_WEIGHTS[memory.category] || 1.0;

    // Importance multiplier (0.1 to 1.0)
    const importance = Math.max(0.1, Math.min(1.0, memory.importance || 0.5));

    // Recency decay: half-life ~ 60 days
    let recencyFactor = 1.0;
    if (memory.createdAt) {
      const ageInDays = Math.max(0, (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      recencyFactor = 1.0 / (1.0 + ageInDays * 0.015);
    }

    const totalScore = lexicalScore * catWeight * importance * recencyFactor;

    if (totalScore >= threshold) {
      scoredList.push({
        memory,
        score: Math.round(totalScore * 100) / 100,
        matchedTerms: Array.from(new Set(matchedTerms)),
        reason: `Matched terms: [${matchedTerms.slice(0, 3).join(', ')}] with ${memory.category} priority`
      });
    }
  }

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  if (scoredList.length > 0) {
    return scoredList.slice(0, maxK);
  }

  // Fallback: If no keyword matches, provide up to 2 highest importance goals or preferences
  if (fallbackToTopSalient) {
    const salient = [...memories]
      .filter(m => m.category === 'goal' || m.category === 'preference')
      .sort((a, b) => (b.importance || 0.5) - (a.importance || 0.5))
      .slice(0, 2);

    return salient.map(m => ({
      memory: m,
      score: Math.round((m.importance || 0.5) * 10) / 100,
      matchedTerms: [],
      reason: `High-salience core ${m.category} baseline`
    }));
  }

  return [];
}
