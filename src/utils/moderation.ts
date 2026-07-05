import { checkExplicitContent } from '../lib/moderation';

export function containsAdultContent(text: string): boolean {
  return checkExplicitContent(text).isExplicit;
}
