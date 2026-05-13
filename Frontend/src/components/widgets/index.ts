import { YieldAgentWidget } from './YieldAgentWidget';
import { PredictionWidget } from './PredictionWidget';
import { ClusterFiFeedWidget } from './ClusterFiFeedWidget';

export const widgets = {
  YieldAgentWidget,
  PredictionWidget,
  ClusterFiFeedWidget,
};

export type WidgetName = keyof typeof widgets;

export { YieldAgentWidget, PredictionWidget, ClusterFiFeedWidget };
