'use client';

import React from 'react';
import type { CtaTemplateId } from '@/lib/banner-state';
import { CTA_TEMPLATES } from '@/lib/cta-templates';

type Props = {
  templateId: CtaTemplateId;
  text: string;
  showArrow?: boolean;
};

const CtaArrow = () => (
  <svg className="inline ml-2 w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8.59 16.58L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
  </svg>
);

export function CtaButton({ templateId, text, showArrow }: Props) {
  const template = CTA_TEMPLATES[templateId] ?? CTA_TEMPLATES['cta-orange-arrow'];
  const withArrow = showArrow ?? template.arrow;
  return (
    <button type="button" className={template.className} data-testid={`cta-${template.id}`}>
      {text}
      {withArrow && <CtaArrow />}
    </button>
  );
}
