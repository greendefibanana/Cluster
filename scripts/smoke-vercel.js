const baseUrl = process.env.VERCEL_URL || "http://localhost:5173";

async function smokeTest() {
  console.log(`Running Vercel smoke tests against: ${baseUrl}\n`);
  
  const endpoints = [
    { path: "/", name: "SPA Index" },
    { path: "/.well-known/farcaster.json", name: "Farcaster Manifest JSON" },
    { path: "/mini", name: "Mini App Route Redirect Test" }
  ];

  let failed = false;

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep.path}`);
      if (!res.ok) {
        console.error(`❌ ${ep.name} failed: HTTP ${res.status}`);
        failed = true;
      } else {
        console.log(`✅ ${ep.name} OK (HTTP 200)`);
        
        // CORS check for manifest
        if (ep.path.includes("farcaster.json")) {
          const corsHeader = res.headers.get("access-control-allow-origin");
          if (corsHeader !== "*") {
            console.error(`   ⚠️ Missing or invalid CORS header on manifest (got: ${corsHeader})`);
            failed = true;
          } else {
             console.log(`   CORS check passed for manifest`);
          }
        }
      }
    } catch (e) {
      console.error(`❌ ${ep.name} failed: ${e.message}`);
      failed = true;
    }
  }

  if (failed) {
    console.error("\n❌ Vercel smoke tests failed.");
    process.exit(1);
  } else {
    console.log("\n✅ All Vercel smoke tests passed.");
    process.exit(0);
  }
}

smokeTest();
