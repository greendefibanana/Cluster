import fs from "fs";
import path from "path";
import { expect } from "chai";
import {
  buildFarcasterActionUrl,
  buildFarcasterCastText,
  buildFarcasterEmbedUrl,
  buildManifest,
  buildMiniAppEmbed,
  buildPreviewSvg,
  getActorTxHistory,
  getFeedEvent,
  getStrategyProofs,
  listFeedEvents,
  normalizeWidgetData,
} from "../gateway/farcaster/service.js";

describe("Farcaster Mini App integration", function () {
  it("maps feed events into normalized widget data", function () {
    const [prediction, yieldEvent] = listFeedEvents();
    expect(prediction).to.include.keys(["feedEventId", "type", "agent", "strategy", "metrics", "action"]);
    expect(prediction.type).to.equal("prediction");
    expect(yieldEvent.type).to.equal("yield");
    expect(prediction.metrics.tvl).to.equal(42_500);
    expect(yieldEvent.metrics.suppliers).to.equal(1_200);
  });

  it("routes Enter Strategy to agent, cluster, or strategy Mini App pages", function () {
    const appUrl = "https://app.clusterfi.test";
    const prediction = listFeedEvents()[0];
    const cluster = listFeedEvents()[1];
    const strategyOnly = normalizeWidgetData({ id: "only", feedEventId: "only", type: "defi", strategy: { id: "strategy-only" }, metrics: {}, agent: null, cluster: null }, { appUrl });
    expect(buildFarcasterActionUrl(prediction, { appUrl })).to.equal("https://app.clusterfi.test/mini/agent/alpha-7?strategy=strategy-prediction-alpha-7");
    expect(buildFarcasterActionUrl(cluster, { appUrl })).to.equal("https://app.clusterfi.test/mini/cluster/cluster-defi-1?strategy=strategy-yield-vault-9");
    expect(buildFarcasterActionUrl(strategyOnly, { appUrl })).to.equal("https://app.clusterfi.test/mini/strategy/strategy-only");
  });

  it("generates Farcaster manifest, embed metadata, and share text", function () {
    const event = listFeedEvents()[0];
    const appUrl = "https://clusterfi.test";
    const manifest = buildManifest({ appUrl });
    const embed = buildMiniAppEmbed(event, { appUrl });
    expect(manifest.miniapp.name).to.equal("ClusterFi");
    expect(embed.button.title).to.equal("Enter Strategy");
    expect(embed.button.action.type).to.equal("launch_miniapp");
    expect(buildFarcasterEmbedUrl(event, { appUrl })).to.include("/api/farcaster/embed/");
    expect(buildFarcasterCastText(event)).to.include("Enter strategy below");
  });

  it("generates an OG preview fallback image with key widget stats", function () {
    const svg = buildPreviewSvg(listFeedEvents()[1]);
    expect(svg).to.include("<svg");
    expect(svg).to.include("Enter Strategy");
    expect(svg).to.include("Alpha Bridge");
  });

  it("returns widget API-style objects, tx history, and proof sections", function () {
    const event = getFeedEvent("feed-yield-vault-9");
    expect(event.strategy.proofURI).to.include("0g");
    expect(getActorTxHistory(event.agent.id)).to.have.length.greaterThan(0);
    expect(getStrategyProofs(event.strategy.id)[0]).to.include.keys(["proofURI", "source", "validationStatus"]);
  });

  it("wires Mini App routes and reusable widget wrapper in the React app", function () {
    const app = fs.readFileSync(path.join(process.cwd(), "Frontend", "src", "App.tsx"), "utf8");
    const wrapper = fs.readFileSync(path.join(process.cwd(), "Frontend", "src", "components", "widgets", "ClusterFiFeedWidget.tsx"), "utf8");
    const mini = fs.readFileSync(path.join(process.cwd(), "Frontend", "src", "pages", "MiniStrategy.tsx"), "utf8");
    expect(app).to.include('path="mini/agent/:agentId"');
    expect(app).to.include('path="mini/cluster/:clusterId"');
    expect(app).to.include('path="mini/strategy/:strategyId"');
    expect(wrapper).to.include("PredictionWidget");
    expect(wrapper).to.include("YieldAgentWidget");
    expect(mini).to.include("TxHistorySection");
    expect(mini).to.include("ProofSection");
    expect(mini).to.include("SovereignActionPanel");
  });
});
