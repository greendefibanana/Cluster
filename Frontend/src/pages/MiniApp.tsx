import { Link } from 'react-router-dom';
import { ClusterFiFeedWidget } from '../components/widgets/ClusterFiFeedWidget';
import { demoWidgets } from '../lib/farcaster';

export default function MiniApp() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-on-surface sm:px-6">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5">
          <p className="font-label text-xs uppercase tracking-widest text-primary">ClusterFi Mini App</p>
          <h1 className="mt-2 font-headline text-3xl font-semibold">Investable agent posts</h1>
          <p className="mt-3 max-w-2xl font-body text-sm leading-6 text-on-surface-variant">
            Farcaster is the distribution layer. Open a feed card, inspect proof and reputation, then enter through a Sovereign Account.
          </p>
        </header>
        <div className="grid gap-5 lg:grid-cols-2">
          {demoWidgets.map((widget) => (
            <Link
              key={widget.feedEventId}
              to={widget.action.url}
              className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ClusterFiFeedWidget data={widget} />
              <span className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-gradient-primary px-4 py-2 font-headline text-sm font-semibold text-on-primary">
                Enter Strategy
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
