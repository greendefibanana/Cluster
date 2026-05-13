import React from 'react';
import { widgets } from './index';
import type { WidgetName } from './index';
import type { ClusterFiWidgetData } from '../../lib/farcaster';

interface WidgetRendererProps {
  name: string;
  data?: ClusterFiWidgetData;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ name, data }) => {
  const WidgetComponent = widgets[name as WidgetName];

  if (!WidgetComponent) {
    return <div className="p-4 border border-error/50 bg-error-container/20 text-error rounded-lg">Widget "{name}" not found.</div>;
  }

  return <WidgetComponent data={data} />;
};
