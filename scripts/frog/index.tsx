import { Button, Frog } from 'frog';
import { listFeedEvents, buildPreviewSvg } from '../../gateway/farcaster/service.js';

export const app = new Frog({
  title: 'ClusterFi Farcaster Preview',
});

app.frame('/', (c) => {
  const event = listFeedEvents()[0];
  return c.res({
    image: buildPreviewSvg(event),
    intents: [
      <Button.Link href={event.action.url}>Enter Strategy</Button.Link>,
    ],
  });
});

app.frame('/prediction', (c) => {
  const event = listFeedEvents().find((item) => item.type === 'prediction') || listFeedEvents()[0];
  return c.res({
    image: buildPreviewSvg(event),
    intents: [
      <Button.Link href={event.action.url}>Enter Strategy</Button.Link>,
    ],
  });
});

app.frame('/defi', (c) => {
  const event = listFeedEvents().find((item) => ['defi', 'yield', 'lp', 'perps'].includes(item.type)) || listFeedEvents()[0];
  return c.res({
    image: buildPreviewSvg(event),
    intents: [
      <Button.Link href={event.action.url}>Enter Strategy</Button.Link>,
    ],
  });
});

export default app;
