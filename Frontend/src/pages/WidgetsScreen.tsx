import React from 'react';
import { WidgetRenderer } from '../components/widgets/WidgetRenderer';
import { widgets } from '../components/widgets';

const WidgetsScreen: React.FC = () => {
  const availableWidgets = Object.keys(widgets);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-display font-bold text-on-surface mb-2">Widgets Gallery</h1>
        <p className="text-on-surface-variant font-body">
          Programmatically pulling widgets by their registered names.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {availableWidgets.map((widgetName) => (
          <section key={widgetName} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-headline font-semibold text-primary">{widgetName}</h2>
              <code className="text-xs bg-surface-container-high px-2 py-1 rounded text-primary-fixed font-label">
                &lt;WidgetRenderer name="{widgetName}" /&gt;
              </code>
            </div>
            
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 flex justify-center items-center">
              <div className="w-full max-w-[600px]">
                <WidgetRenderer name={widgetName} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default WidgetsScreen;
