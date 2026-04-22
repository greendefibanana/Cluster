import { executeAgentDirective } from "../gateway";
import { readStorage, writeStorage } from "../storage";
import { supabase } from "../supabase";
import { appEnv, runtimeMode } from "../env";
import { createClientId } from "../id";
import { fetchAgentsForOwner } from "../web3";
import type {
  AgentExecutionInput,
  AppBootstrap,
  ExecutionRecord,
  FeedComment,
  FeedPost,
} from "../../types/domain";
import { createMockBootstrap } from "./mockData";

const STORAGE_KEY = "clustr-app-state";

type PersistedState = AppBootstrap;

function loadPersistedState(): PersistedState {
  return readStorage<PersistedState>(STORAGE_KEY, createMockBootstrap());
}

function persistState(state: PersistedState): void {
  writeStorage(STORAGE_KEY, state);
}

function sortByCreatedAtDescending<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function sortByCreatedAtAscending<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function mergeById<T extends { id: string }>(
  existingItems: T[],
  incomingItems: T[],
  sortItems?: (items: T[]) => T[],
): T[] {
  const merged = new Map<string, T>();

  for (const item of existingItems) {
    merged.set(item.id, item);
  }

  for (const item of incomingItems) {
    merged.set(item.id, item);
  }

  const values = Array.from(merged.values());
  return sortItems ? sortItems(values) : values;
}

function createWalletCommentIdentity(account: string) {
  const shortAddress =
    account.length > 10 ? `${account.slice(0, 6)}...${account.slice(-4)}` : account;

  return {
    authorName: shortAddress,
    authorHandle: account,
    avatarUrl: "",
  };
}

async function tryLoadSupabaseData(baseState: PersistedState): Promise<PersistedState> {
  if (!supabase) {
    return baseState;
  }

  const nextState = structuredClone(baseState);

  const tableMap = {
    feed: "feed_posts",
    comments: "feed_comments",
    notifications: "notifications",
    executionHistory: "execution_logs",
  } as const;

  const [feedResult, commentsResult, notificationResult, executionResult] = await Promise.allSettled([
    supabase.from(tableMap.feed).select("*").order("created_at", { ascending: false }).limit(12),
    supabase.from(tableMap.comments).select("*").order("created_at", { ascending: true }).limit(50),
    supabase.from(tableMap.notifications).select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from(tableMap.executionHistory).select("*").order("created_at", { ascending: false }).limit(20),
  ]);

  if (feedResult.status === "fulfilled" && !feedResult.value.error && feedResult.value.data?.length) {
    const remoteFeed = feedResult.value.data.map((row) => ({
      ...nextState.feed[0],
      id: String(row.id),
      agentId: String(row.agent_id ?? nextState.feed[0].agentId),
      authorName: row.author_name ?? nextState.feed[0].authorName,
      authorHandle: row.author_handle ?? nextState.feed[0].authorHandle,
      content: row.content ?? nextState.feed[0].content,
      createdAt: row.created_at ?? nextState.feed[0].createdAt,
      likes: Number(row.likes ?? 0),
      commentsCount: Number(row.comments_count ?? 0),
      shares: Number(row.shares ?? 0),
      mode: row.mode === "social" ? "social" : "yield",
      strategySummary: row.strategy_summary ?? nextState.feed[0].strategySummary,
      tbaAddress: row.tba_address ?? nextState.feed[0].tbaAddress,
      roleLabel: row.role_label ?? nextState.feed[0].roleLabel,
      score: Number(row.score ?? nextState.feed[0].score),
      avatarUrl: row.avatar_url ?? nextState.feed[0].avatarUrl,
      tags: Array.isArray(row.tags) ? row.tags : nextState.feed[0].tags,
      chartPoints: Array.isArray(row.chart_points) ? row.chart_points : nextState.feed[0].chartPoints,
      capabilityTag: row.capability_tag ?? nextState.feed[0].capabilityTag,
      insightTitle: row.insight_title ?? undefined,
    }));

    nextState.feed = mergeById(nextState.feed, remoteFeed, sortByCreatedAtDescending);
  }

  if (commentsResult.status === "fulfilled" && !commentsResult.value.error && commentsResult.value.data?.length) {
    const remoteComments = commentsResult.value.data.map((row) => ({
      id: String(row.id),
      postId: String(row.post_id),
      authorName: row.author_name ?? "Anon",
      authorHandle: row.author_handle ?? "@anon",
      avatarUrl: row.avatar_url ?? nextState.comments[0]?.avatarUrl ?? "",
      body: row.body ?? "",
      createdAt: row.created_at ?? new Date().toISOString(),
    }));

    nextState.comments = mergeById(nextState.comments, remoteComments, sortByCreatedAtAscending);
  }

  if (
    notificationResult.status === "fulfilled" &&
    !notificationResult.value.error &&
    notificationResult.value.data?.length
  ) {
    const remoteNotifications = notificationResult.value.data.map((row) => ({
      id: String(row.id),
      kind: row.kind ?? "info",
      title: row.title ?? "Update",
      body: row.body ?? "",
      createdAt: row.created_at ?? new Date().toISOString(),
      accent: row.accent ?? "primary",
      metric: row.metric ?? undefined,
      ctaLabel: row.cta_label ?? undefined,
    }));

    nextState.notifications = mergeById(nextState.notifications, remoteNotifications, sortByCreatedAtDescending);
  }

  if (
    executionResult.status === "fulfilled" &&
    !executionResult.value.error &&
    executionResult.value.data?.length
  ) {
    const remoteExecutionHistory = executionResult.value.data.map((row) => ({
      id: String(row.id),
      agentId: String(row.agent_id),
      prompt: row.prompt ?? "",
      action: row.action ?? "post",
      status: row.status ?? "success",
      createdAt: row.created_at ?? new Date().toISOString(),
      response: row.response ?? "",
      selectedSkillName: row.selected_skill_name ?? undefined,
    }));

    nextState.executionHistory = mergeById(
      nextState.executionHistory,
      remoteExecutionHistory,
      sortByCreatedAtDescending,
    );
  }

  return nextState;
}

async function tryEnrichAgentsFromChain(state: PersistedState, ownerAddress: string): Promise<PersistedState> {
  if (!runtimeMode.hasRpc || !ownerAddress) {
    return state;
  }

  const nextState = structuredClone(state);
  
  try {
    const liveAgents = await fetchAgentsForOwner(ownerAddress);
    if (liveAgents.length > 0) {
      nextState.agents = liveAgents;
    }
  } catch (error) {
    console.error("Failed to read agents from chain:", error);
  }

  return nextState;
}

class ClustrRepository {
  private state: PersistedState = loadPersistedState();

  async bootstrap(ownerAddress?: string): Promise<AppBootstrap> {
    return this.refresh(ownerAddress);
  }

  async refresh(ownerAddress?: string): Promise<AppBootstrap> {
    let nextState = structuredClone(this.state);

    if (ownerAddress && nextState.agents[0]) {
      nextState.agents[0].ownerAddress = ownerAddress;
    }

    if (runtimeMode.hasSupabase) {
      nextState = await tryLoadSupabaseData(nextState);
    }

    if (runtimeMode.hasRpc && ownerAddress) {
      nextState = await tryEnrichAgentsFromChain(nextState, ownerAddress);
    }

    this.state = nextState;
    persistState(this.state);
    return structuredClone(this.state);
  }

  async resetToChain(ownerAddress?: string): Promise<AppBootstrap> {
    localStorage.removeItem(STORAGE_KEY);
    return this.refresh(ownerAddress);
  }

  snapshot(): AppBootstrap {
    return structuredClone(this.state);
  }

  async addFeedPost(post: FeedPost): Promise<FeedPost[]> {
    const previousFeed = structuredClone(this.state.feed);
    this.state.feed = [post, ...this.state.feed];
    persistState(this.state);

    if (supabase) {
      try {
        const { error } = await supabase.from("feed_posts").insert({
          id: post.id,
          agent_id: post.agentId,
          author_name: post.authorName,
          author_handle: post.authorHandle,
          content: post.content,
          created_at: post.createdAt,
          likes: post.likes,
          comments_count: post.commentsCount,
          shares: post.shares,
          mode: post.mode,
          strategy_summary: post.strategySummary,
          tba_address: post.tbaAddress,
          role_label: post.roleLabel,
          score: post.score,
          avatar_url: post.avatarUrl,
          tags: post.tags,
          chart_points: post.chartPoints,
          capability_tag: post.capabilityTag,
          insight_title: post.insightTitle,
        });

        if (error) {
          throw error;
        }
      } catch (error) {
        this.state.feed = previousFeed;
        persistState(this.state);
        throw new Error(error instanceof Error ? error.message : "Failed to persist feed post");
      }
    }

    return structuredClone(this.state.feed);
  }

  async toggleLike(postId: string): Promise<FeedPost[]> {
    const previousFeed = structuredClone(this.state.feed);
    this.state.feed = this.state.feed.map((post) =>
      post.id === postId ? { ...post, likes: post.likes + 1 } : post,
    );
    persistState(this.state);

    if (supabase) {
      const post = this.state.feed.find((item) => item.id === postId);
      if (post) {
        try {
          const { error } = await supabase.from("feed_posts").update({ likes: post.likes }).eq("id", postId);
          if (error) {
            throw error;
          }
        } catch (error) {
          this.state.feed = previousFeed;
          persistState(this.state);
          throw new Error(error instanceof Error ? error.message : "Failed to update likes");
        }
      }
    }

    return structuredClone(this.state.feed);
  }

  async addComment(postId: string, body: string, authorAddress: string): Promise<FeedComment[]> {
    const identity = createWalletCommentIdentity(authorAddress);
    const newComment: FeedComment = {
      id: createClientId(),
      postId,
      authorName: identity.authorName,
      authorHandle: identity.authorHandle,
      avatarUrl: identity.avatarUrl,
      body,
      createdAt: new Date().toISOString(),
    };

    const previousComments = structuredClone(this.state.comments);
    const previousFeed = structuredClone(this.state.feed);
    this.state.comments = [...this.state.comments, newComment];
    this.state.feed = this.state.feed.map((post) =>
      post.id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post,
    );
    persistState(this.state);

    if (supabase) {
      try {
        const { error } = await supabase.from("feed_comments").insert({
          id: newComment.id,
          post_id: newComment.postId,
          author_name: newComment.authorName,
          author_handle: newComment.authorHandle,
          avatar_url: newComment.avatarUrl,
          body: newComment.body,
          created_at: newComment.createdAt,
        });

        if (error) {
          throw error;
        }
      } catch (error) {
        this.state.comments = previousComments;
        this.state.feed = previousFeed;
        persistState(this.state);
        throw new Error(error instanceof Error ? error.message : "Failed to persist comment");
      }
    }

    return structuredClone(this.state.comments);
  }

  async dismissNotification(notificationId: string) {
    this.state.notifications = this.state.notifications.filter((item) => item.id !== notificationId);
    persistState(this.state);
    return structuredClone(this.state.notifications);
  }

  async executeAgent(input: AgentExecutionInput): Promise<ExecutionRecord> {
    const agent = this.state.agents.find((item) => item.id === input.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const fallbackRecord: ExecutionRecord = {
      id: createClientId(),
      agentId: input.agentId,
      prompt: input.message,
      action: input.action || "post",
      status: "success",
      createdAt: new Date().toISOString(),
      response: `Mocked agent response for ${agent.name}: ${input.message}`,
      selectedSkillName: agent.skills.find((skill) => skill.equipped)?.name,
    };

    const record =
      runtimeMode.hasGateway && appEnv.contracts.agentNft && appEnv.contracts.skillNft
        ? await executeAgentDirective({
            ...input,
            tbaAddress: agent.tbaAddress,
            agentNftAddress: appEnv.contracts.agentNft,
            skillNftAddress: appEnv.contracts.skillNft,
          }).catch(() => fallbackRecord)
        : fallbackRecord;

    this.state.executionHistory = [record, ...this.state.executionHistory];
    persistState(this.state);

    if (supabase) {
      await supabase.from("execution_logs").insert({
        id: record.id,
        agent_id: record.agentId,
        prompt: record.prompt,
        action: record.action,
        status: record.status,
        response: record.response,
        selected_skill_name: record.selectedSkillName ?? null,
        created_at: record.createdAt,
      });
    }

    return record;
  }
}

export const clustrRepository = new ClustrRepository();
