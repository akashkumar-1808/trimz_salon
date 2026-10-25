/**
 * TRIMZ Salon Global Typography Infrastructure
 * Provides 15 minimal, professional fonts with centralized CSS variable application
 * and business settings persistence.
 */

export interface AppFont {
  id: string;
  name: string;
  family: string;
  stack: string;
  category: 'Geometric' | 'Modern' | 'Humanist' | 'Grotesque' | 'Neo-Grotesque';
  description: string;
  previewSentence: string;
}

export const APP_FONTS: AppFont[] = [
  {
    id: 'Inter',
    name: 'Inter',
    family: 'Inter',
    stack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    category: 'Neo-Grotesque',
    description: 'Clean, neutral, and meticulously crafted for supreme UI legibility',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Roboto',
    name: 'Roboto',
    family: 'Roboto',
    stack: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    category: 'Neo-Grotesque',
    description: 'Modern geometric curves with friendly, open reading flow',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Open Sans',
    name: 'Open Sans',
    family: 'Open Sans',
    stack: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Humanist',
    description: 'Optimized for print, web, and mobile with warm, upright letterforms',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Lato',
    name: 'Lato',
    family: 'Lato',
    stack: "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Humanist',
    description: 'Harmonious proportions offering stability and subtle elegance',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Manrope',
    name: 'Manrope',
    family: 'Manrope',
    stack: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Modern',
    description: 'Contemporary crossover between modern geometric and techno grotesque',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'DM Sans',
    name: 'DM Sans',
    family: 'DM Sans',
    stack: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Geometric',
    description: 'Low-contrast geometric grotesque crafted for precision digital desks',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Plus Jakarta Sans',
    name: 'Plus Jakarta Sans',
    family: 'Plus Jakarta Sans',
    stack: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Geometric',
    description: 'Sophisticated modern clean font with a fresh executive character',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Outfit',
    name: 'Outfit',
    family: 'Outfit',
    stack: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Geometric',
    description: 'Delightful geometric proportions with a premium boutique feel',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Nunito Sans',
    name: 'Nunito Sans',
    family: 'Nunito Sans',
    stack: "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Humanist',
    description: 'Balanced, highly approachable sans with soft terminal precision',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Source Sans 3',
    name: 'Source Sans 3',
    family: 'Source Sans 3',
    stack: "'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Humanist',
    description: 'Professional editorial design crafted by Adobe for enterprise interfaces',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'IBM Plex Sans',
    name: 'IBM Plex Sans',
    family: 'IBM Plex Sans',
    stack: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Grotesque',
    description: 'Engineered corporate aesthetic balancing human and machine ergonomics',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Work Sans',
    name: 'Work Sans',
    family: 'Work Sans',
    stack: "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Grotesque',
    description: 'Optimized for screen readability with robust architectural strokes',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Montserrat',
    name: 'Montserrat',
    family: 'Montserrat',
    stack: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Geometric',
    description: 'Iconic urban geometric modernist styling inspired by old posters',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Poppins',
    name: 'Poppins',
    family: 'Poppins',
    stack: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Geometric',
    description: 'Striking geometric curves based on pure circles and clean lines',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
  {
    id: 'Urbanist',
    name: 'Urbanist',
    family: 'Urbanist',
    stack: "'Urbanist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Geometric',
    description: 'Low-contrast, neo-grotesque geometric font for high-fashion aesthetics',
    previewSentence: 'Experience luxury grooming and bespoke salon care at Trimz.',
  },
];

export const DEFAULT_FONT_ID = 'Inter';

export function getFontDefinition(fontId?: string | null): AppFont {
  if (!fontId) return APP_FONTS[0];
  const normalized = fontId.trim().toLowerCase();
  const found = APP_FONTS.find(
    (f) => f.id.toLowerCase() === normalized || f.name.toLowerCase() === normalized || f.family.toLowerCase() === normalized
  );
  return found || APP_FONTS[0];
}

export function applyGlobalFont(fontId?: string | null): string {
  if (typeof document === 'undefined') return DEFAULT_FONT_ID;
  const fontDef = getFontDefinition(fontId);
  document.documentElement.style.setProperty('--font-family-app', fontDef.stack);
  document.body.style.setProperty('--font-family-app', fontDef.stack);
  try {
    localStorage.setItem('trimz_global_font', fontDef.id);
  } catch (e) {
    // Ignore storage errors
  }
  return fontDef.id;
}

export function getInitialFont(): string {
  if (typeof window === 'undefined') return DEFAULT_FONT_ID;
  try {
    const saved = localStorage.getItem('trimz_global_font');
    if (saved) return saved;
  } catch (e) {
    // Ignore
  }
  return DEFAULT_FONT_ID;
}
