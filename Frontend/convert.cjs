const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const pagesToMigrate = [
  { dir: 'agent_detail_history', name: 'AgentDetail' },
  { dir: 'agent_editor', name: 'AgentEditor' },
  { dir: 'basket_strategy_details', name: 'BasketStrategy' },
  { dir: 'bidding_board', name: 'BiddingBoard' },
  { dir: 'consolidated_financials', name: 'Financials' },
  { dir: 'equip_skill_nft', name: 'EquipSkill' },
  { dir: 'global_rankings', name: 'Rankings' },
  { dir: 'memory_stream_greenfield', name: 'MemoryStream' },
  { dir: 'swarm_wars_live', name: 'SwarmWars' },
  { dir: 'the_bazaar_hub', name: 'BazaarHub' },
  { dir: 'vault_notifications', name: 'Notifications' },
];

const basePath = path.join(__dirname, '..');

pagesToMigrate.forEach(page => {
  const htmlPath = path.join(basePath, page.dir, 'code.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const $ = cheerio.load(html, { xmlMode: true }); // Use xmlMode to handle self-closing tags correctly for JSX
    
    // Actually, xmlMode parses it as XML, so it self-closes img. 
    // Let's use standard HTML and fix tags manually because we just want the inner HTML.
    const $html = cheerio.load(html);
    let mainNode = $html('main');
    let mainContent = mainNode.html();
    let mainClass = mainNode.attr('class') || '';
    
    if(!mainContent) {
        mainContent = $html('body').html(); 
    }

    // Replace class to className, etc.
    mainContent = mainContent.replace(/class="/g, 'className="');
    mainContent = mainContent.replace(/for="/g, 'htmlFor="');
    mainContent = mainContent.replace(/stroke-width="/g, 'strokeWidth="');
    mainContent = mainContent.replace(/stroke-linecap="/g, 'strokeLinecap="');
    mainContent = mainContent.replace(/stroke-linejoin="/g, 'strokeLinejoin="');
    mainContent = mainContent.replace(/fill-rule="/g, 'fillRule="');
    mainContent = mainContent.replace(/clip-rule="/g, 'clipRule="');
    mainContent = mainContent.replace(/tabindex="/g, 'tabIndex="');
    
    // Close unclosed tags for JSX
    mainContent = mainContent.replace(/<img([^>]*[^\/])>/g, '<img$1/>');
    mainContent = mainContent.replace(/<input([^>]*[^\/])>/g, '<input$1/>');
    mainContent = mainContent.replace(/<br([^>]*[^\/])>/g, '<br$1/>');
    mainContent = mainContent.replace(/<hr([^>]*[^\/])>/g, '<hr$1/>');

    // Style conversions
    mainContent = mainContent.replace(/style="width:\s*([^"]+?);?"/g, 'style={{ width: \'$1\' }}');
    mainContent = mainContent.replace(/style="font-variation-settings:\s*'FILL'\s*1;?"/g, 'style={{ fontVariationSettings: "\\\'FILL\\\' 1" }}');
    mainContent = mainContent.replace(/style="background-image:\s*url\('([^']+)'\);?"/g, 'style={{ backgroundImage: `url($1)` }}');
    mainContent = mainContent.replace(/style="color:\s*([^"]+?);?"/g, 'style={{ color: \'$1\' }}');

    // Remove empty classNames or fix multiple classNames
    
    // Replace HTML comments
    mainContent = mainContent.replace(/<!--(.*?)-->/gs, '{/* $1 */}');

    const componentCode = `export default function ${page.name}() {
  return (
    <main className="${mainClass}">
      ${mainContent}
    </main>
  );
}
`;

    fs.writeFileSync(path.join(__dirname, 'src/pages', `${page.name}.tsx`), componentCode);
    console.log(`Generated ${page.name}.tsx`);
  } else {
    console.log(`File not found: ${htmlPath}`);
  }
});
