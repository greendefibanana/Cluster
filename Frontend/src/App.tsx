import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Agents from './pages/Agents';
import Skills from './pages/Skills';
import Vault from './pages/Vault';
import AlphaFeed from './pages/AlphaFeed';
import AgentDetail from './pages/AgentDetail';
import AgentEditor from './pages/AgentEditor';
import BasketStrategy from './pages/BasketStrategy';
import BiddingBoard from './pages/BiddingBoard';
import EquipSkill from './pages/EquipSkill';
import Rankings from './pages/Rankings';
import SwarmWars from './pages/SwarmWars';
import BazaarHub from './pages/BazaarHub';
import Notifications from './pages/Notifications';
import PostComments from './pages/PostComments';
import ShareStrategy from './pages/ShareStrategy';
import SkillDetail from './pages/SkillDetail';
import StrategyDetail from './pages/StrategyDetail';
import UserStrategyAccounts from './pages/UserStrategyAccounts';
import ProofViewer from './pages/ProofViewer';
import WidgetsScreen from './pages/WidgetsScreen';
import MiniApp from './pages/MiniApp';
import MiniStrategy from './pages/MiniStrategy';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="feed" element={<AlphaFeed />} />
          <Route path="overview" element={<Overview />} />
          <Route path="agents" element={<Agents />} />
          <Route path="skills" element={<Skills />} />
          <Route path="vault" element={<Vault />} />
          <Route path="widgets" element={<WidgetsScreen />} />
          <Route path="agent-detail" element={<AgentDetail />} />
          <Route path="skill-detail" element={<SkillDetail />} />
          <Route path="strategy-detail" element={<StrategyDetail />} />
          <Route path="sovereign-accounts" element={<UserStrategyAccounts />} />
          <Route path="strategy-accounts" element={<UserStrategyAccounts />} />
          <Route path="proof-viewer" element={<ProofViewer />} />
          <Route path="agent-editor" element={<AgentEditor />} />
          <Route path="basket-strategy" element={<BasketStrategy />} />
          <Route path="bidding-board" element={<BiddingBoard />} />
          <Route path="equip-skill" element={<EquipSkill />} />
          <Route path="rankings" element={<Rankings />} />
          <Route path="swarm-wars" element={<SwarmWars />} />
          <Route path="bazaar-hub" element={<BazaarHub />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="post-comments" element={<PostComments />} />
        <Route path="share-strategy" element={<ShareStrategy />} />
        <Route path="mini" element={<MiniApp />} />
        <Route path="mini/agent/:agentId" element={<MiniStrategy mode="agent" />} />
        <Route path="mini/cluster/:clusterId" element={<MiniStrategy mode="cluster" />} />
        <Route path="mini/strategy/:strategyId" element={<MiniStrategy mode="strategy" />} />
        <Route path="mini/widget/:feedEventId" element={<MiniStrategy mode="widget" />} />
        <Route path="mini/feed/:feedEventId" element={<MiniStrategy mode="feed" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
