import { useEffect, useState } from 'preact/hooks';

/** Liefert den aktuellen Hash-Pfad, z. B. "/plans" für "#/plans". */
export function useRoute(): string {
  const read = () => location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  location.hash = path;
}
