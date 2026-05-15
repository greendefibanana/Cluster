const baseUrl = process.env.RENDER_URL || "http://localhost:3000";

async function smokeTest() {
  console.log(`Running Render smoke tests against: ${baseUrl}\n`);
  
  const endpoints = [
    { path: "/health", name: "Health Check" },
    { path: "/api/feed", name: "Feed API" },
    { path: "/api/farcaster/manifest", name: "Farcaster Manifest API" }
  ];

  let failed = false;

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep.path}`);
      if (!res.ok) {
        console.error(`❌ ${ep.name} failed: HTTP ${res.status}`);
        failed = true;
      } else {
        const body = await res.json();
        console.log(`✅ ${ep.name} OK (HTTP 200)`);
        if (ep.path === "/health") {
          console.log(`   Service: ${body.service}, Env: ${body.env}, Uptime: ${body.uptime}s`);
        }
      }
    } catch (e) {
      console.error(`❌ ${ep.name} failed: ${e.message}`);
      failed = true;
    }
  }

  if (failed) {
    console.error("\n❌ Render smoke tests failed.");
    process.exit(1);
  } else {
    console.log("\n✅ All Render smoke tests passed.");
    process.exit(0);
  }
}

smokeTest();
