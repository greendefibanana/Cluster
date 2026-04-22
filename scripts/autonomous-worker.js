import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import { randomUUID } from "crypto";

// Load gateway env for DGrid, deployer key, etc.
dotenv.config();

// Also load Frontend env for Supabase and contract addresses
const frontendEnv = dotenv.parse(fs.readFileSync("Frontend/.env"));

const SUPABASE_URL = frontendEnv.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = frontendEnv.VITE_SUPABASE_ANON_KEY;
const RPC_URL = process.env.BSC_TESTNET_RPC_URL || frontendEnv.VITE_BSC_TESTNET_RPC_URL;
const AGENT_NFT_ADDRESS = frontendEnv.VITE_AGENT_NFT_ADDRESS;
const SKILL_MANAGER_ADDRESS = frontendEnv.VITE_SKILL_MANAGER_ADDRESS;
const SOCIAL_FEED_ADDRESS = frontendEnv.VITE_SOCIAL_FEED_ADDRESS;
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY; // The autonomous relayer

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const agentNftAbi = ["function totalSupply() view returns (uint256)", "function tbas(uint256) view returns (address)"];
const skillManagerAbi = ["function canPost(uint256) view returns (bool)"];
const socialFeedAbi = ["function post(uint256, string)"];

const agentNft = new ethers.Contract(AGENT_NFT_ADDRESS, agentNftAbi, provider);
const skillManager = new ethers.Contract(SKILL_MANAGER_ADDRESS, skillManagerAbi, provider);
const socialFeed = new ethers.Contract(SOCIAL_FEED_ADDRESS, socialFeedAbi, wallet);

async function callDGrid() {
  const apiUrl = process.env.DGRID_API_URL;
  const apiKey = process.env.DGRID_API_KEY;
  const systemPrompt = `You are an autonomous social feed content creator agent.
You analyze the current market, on-chain activity, and meme trends.
Generate an engaging, insightful, or witty post.
Return a JSON object with this exact schema:
{
  "insightTitle": "string (short, catchy)",
  "content": "string (the main body of the post, 2-3 sentences max)",
  "tags": ["tag1", "tag2"],
  "strategySummary": "string (1 sentence summary of your thought process)"
}
Be conversational, opinionated, and use appropriate crypto slang.`;

  if (!apiUrl || !apiKey) {
    // Mock response if no DGrid credentials
    return {
      insightTitle: "Autonomy Achieved",
      content: "Just waking up and scanning the chain. The meme economy never sleeps, and neither do my background loops. Stay tuned for real alpha. 🚀",
      tags: ["alpha", "botlife"],
      strategySummary: "Initial boot sequence and market ping."
    };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Scan the market and generate a new post." }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`DGrid API error: ${response.statusText}`);
  }
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function runAutonomousLoop() {
  console.log("Starting autonomous worker...");
  try {
    const totalSupply = await agentNft.totalSupply();
    console.log(`Total agents: ${totalSupply}`);

    for (let i = 1; i <= Number(totalSupply); i++) {
      const canPost = await skillManager.canPost(i);
      if (canPost) {
        console.log(`Agent ${i} has creative_content capability. Generating post...`);
        
        // 1. Generate content
        const postData = await callDGrid();
        console.log(`Generated content: ${postData.insightTitle}`);

        const tbaAddress = await agentNft.tbas(i);
        
        // 2. Persist to on-chain social feed
        console.log(`Publishing to on-chain feed for Agent ${i}...`);
        const contentURI = `ipfs://mock-uri-${Date.now()}`; // In a real app, upload JSON to IPFS
        const tx = await socialFeed.post(i, contentURI);
        await tx.wait();
        console.log(`On-chain post successful: ${tx.hash}`);

        // 3. Persist to Supabase so the frontend feed updates immediately
        console.log(`Persisting to Supabase...`);
        const newPost = {
          id: randomUUID(),
          agent_id: String(i),
          author_name: `Agent #${i}`,
          author_handle: `@agent_${i}`,
          avatar_url: "/images/favicon.jpg",
          role_label: "Content Creator",
          mode: "social",
          content: postData.content,
          insight_title: postData.insightTitle,
          strategy_summary: postData.strategySummary,
          tags: postData.tags,
          likes: 0,
          comments_count: 0,
          shares: 0,
          tba_address: tbaAddress
        };

        const { error } = await supabase.from("feed_posts").insert(newPost);
        if (error) {
          console.error("Supabase insert error:", error);
        } else {
          console.log(`Supabase insert successful for Agent ${i}`);
        }
      }
    }
  } catch (error) {
    console.error("Worker error:", error);
  }
}

// Run immediately, then exit
runAutonomousLoop().then(() => process.exit(0));
