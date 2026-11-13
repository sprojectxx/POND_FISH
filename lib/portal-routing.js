/**
 * Shared Client-Side Subdomain-Aware Portal Navigation
 * Provides canonical URL paths for portals running either on dedicated subdomains
 * (e.g. admin.pondfish.in, worker.pondfish.in) or path prefixes (e.g. /admin, /worker).
 */

export function isPortalSubdomain(portal) {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  if (portal === 'admin') {
    return host.startsWith('admin.') || host.startsWith('pond-fish-admin') || host.includes('-admin-') || host.includes('-admin.');
  }
  if (portal === 'worker') {
    return host.startsWith('worker.') || host.startsWith('pond-fish-worker') || host.includes('-worker-') || host.includes('-worker.');
  }
  if (portal === 'tv') {
    return host.startsWith('tv.') || host.startsWith('pond-fish-tv') || host.includes('-tv-') || host.includes('-tv.');
  }
  return false;
}

export function getAdminLoginUrl(searchParams = '') {
  if (typeof window === 'undefined') {
    return `/admin/login${searchParams ? `?${searchParams}` : ''}`;
  }
  const isSubdomain = isPortalSubdomain('admin');
  const base = isSubdomain ? '/login' : '/admin/login';
  return searchParams ? `${base}?${searchParams}` : base;
}

export function getWorkerLoginUrl(searchParams = '') {
  if (typeof window === 'undefined') {
    return `/worker/login${searchParams ? `?${searchParams}` : ''}`;
  }
  const isSubdomain = isPortalSubdomain('worker');
  const base = isSubdomain ? '/login' : '/worker/login';
  return searchParams ? `${base}?${searchParams}` : base;
}
