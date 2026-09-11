const SESSION_ID_PATTERN = /^sess-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Session IDs are bearer capabilities: possession grants access to one campaign.
 * Use the full UUID entropy; short/predictable IDs are deliberately rejected by
 * public routes so campaigns cannot be enumerated.
 */
export function createSessionId(): string {
  return `sess-${crypto.randomUUID()}`;
}

export function isSecureSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}
