/**
 * Reserved session slugs. Anything that is or might become a top-level route on
 * the user-frontend domain (tuneslam.com/<slug>) must live here so admins can
 * never claim it as a session name. Keep this list extensible.
 */
export const RESERVED_SLUGS: ReadonlyArray<string> = [
  'about',
  'account',
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'blog',
  'callback',
  'careers',
  'contact',
  'dashboard',
  'developer',
  'developers',
  'docs',
  'faq',
  'health',
  'help',
  'home',
  'index',
  'join',
  'login',
  'logout',
  'oauth',
  'player',
  'press',
  'pricing',
  'privacy',
  'profile',
  'public',
  'register',
  'robots.txt',
  'session',
  'sessions',
  'settings',
  'signup',
  'sitemap.xml',
  'spotify',
  'static',
  'support',
  'terms',
  'tos',
  'tunes',
  'tuneslam',
  'user',
  'users',
];

const RESERVED_SET = new Set(RESERVED_SLUGS.map((s) => s.toLowerCase()));

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SET.has(slug.toLowerCase());
}
