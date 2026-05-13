import type { ClusterFiWidgetData } from '../../lib/farcaster';
import { demoWidgets, widgetForType } from '../../lib/farcaster';
import { PredictionWidget } from './PredictionWidget';
import { YieldAgentWidget } from './YieldAgentWidget';

interface ClusterFiFeedWidgetProps {
  type?: ClusterFiWidgetData['type'];
  data?: ClusterFiWidgetData;
}

export function ClusterFiFeedWidget({ type, data }: ClusterFiFeedWidgetProps) {
  const fallback = type === 'prediction' || type === 'meme' ? demoWidgets[0] : demoWidgets[1];
  const resolved = data || fallback;
  const mapped = widgetForType(type || resolved.type);
  if (mapped === 'prediction') return <PredictionWidget data={resolved} />;
  return <YieldAgentWidget data={resolved} />;
}
