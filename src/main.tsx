import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { requestPersistence } from './db';
import { cleanCatalogOnce, seedIfEmpty } from './seed';
import { navigate, useRoute } from './router';
import { HomeScreen } from './screens/Home';
import { PlanEditor, PlansScreen } from './screens/Plans';
import { SessionScreen } from './screens/Session';
import { SettingsScreen } from './screens/Settings';
import { StatsScreen } from './screens/Stats';
import './styles.css';

const TABS = [
  { path: '/', label: 'Start' },
  { path: '/plans', label: 'Pläne' },
  { path: '/stats', label: 'Fortschritt' },
  { path: '/settings', label: 'Einstellungen' },
];

function Router({ route }: { route: string }) {
  let m: RegExpMatchArray | null;
  if ((m = route.match(/^\/plans\/([^/]+)$/))) return <PlanEditor id={m[1]} />;
  if ((m = route.match(/^\/train\/([^/]+)\/([^/]+)$/))) return <SessionScreen planId={m[1]} dayId={m[2]} />;
  switch (route) {
    case '/plans':
      return <PlansScreen />;
    case '/stats':
      return <StatsScreen />;
    case '/settings':
      return <SettingsScreen />;
    default:
      return <HomeScreen />;
  }
}

function App() {
  const route = useRoute();

  useEffect(() => {
    requestPersistence();
    seedIfEmpty().then(cleanCatalogOnce);
    if (!location.hash) navigate('/');
  }, []);

  const activeTab = '/' + (route.split('/')[1] ?? '');
  const tabActive = (path: string) => (path === '/' ? route === '/' : activeTab === path);

  return (
    <div class="app">
      <main>
        <Router route={route} />
      </main>
      <nav class="tabbar">
        {TABS.map((t) => (
          <a href={`#${t.path}`} class={tabActive(t.path) ? 'active' : ''}>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
