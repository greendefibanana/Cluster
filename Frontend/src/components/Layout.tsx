import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAppContext } from "../hooks/useAppContext";
import { truncateAddress } from "../lib/format";
import { appEnv, runtimeMode } from "../lib/env";

export default function Layout() {
  const location = useLocation();
  const path = location.pathname;
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { wallet, notifications, discoveredProviders, connectWallet, disconnectWallet, ensureCorrectNetwork, resetToChain } =
    useAppContext();

  const unreadCount = notifications.length;
  const walletLabel =
    wallet.status === "connected" && wallet.account
      ? truncateAddress(wallet.account)
      : wallet.status === "connecting"
        ? "Connecting..."
        : runtimeMode.hasDynamic
          ? "Connect with Dynamic"
          : "Connect Wallet";

  const [showWalletPicker, setShowWalletPicker] = useState(false);

  const handleConnect = async (provider?: unknown) => {
    setShowWalletPicker(false);
    await connectWallet(provider);
  };

  const toggleMobileMenu = () => setShowMobileMenu((current) => !current);
  const closeMobileMenu = () => setShowMobileMenu(false);

  return (
    <div className="font-body min-h-screen flex flex-col antialiased selection:bg-primary selection:text-on-primary">
      {/* Desktop header */}
      <header className="flex justify-between items-center w-full px-6 py-4 max-w-full docked top-0 sticky z-50 bg-[#131314]/80 backdrop-blur-xl border-b border-[#3c494e]/20 shadow-[0_4px_30px_rgba(0,0,0,0.1)] hidden md:flex">
        <div className="flex items-center gap-4">
          <Link
            to="/overview"
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
          >
            <img src="/logotype.svg" alt="Kinetic Vault" className="h-10 w-auto" />
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <nav className="flex gap-4 lg:gap-6 font-['Space_Grotesk'] tracking-tight">
            <Link className={`transition-all duration-300 px-3 py-2 rounded-md ${path === '/' || path === '/overview' ? 'text-[#a4e6ff] font-bold bg-white/5' : 'text-[#e5e2e3]/60 hover:bg-[#a4e6ff]/10 hover:text-[#a4e6ff]'}`} to="/overview">Overview</Link>
            <Link className={`transition-all duration-300 px-3 py-2 rounded-md ${path === '/agents' ? 'text-[#a4e6ff] font-bold bg-white/5' : 'text-[#e5e2e3]/60 hover:bg-[#a4e6ff]/10 hover:text-[#a4e6ff]'}`} to="/agents">Agents</Link>
            <Link className={`transition-all duration-300 px-3 py-2 rounded-md ${path === '/skills' ? 'text-[#a4e6ff] font-bold bg-white/5' : 'text-[#e5e2e3]/60 hover:bg-[#a4e6ff]/10 hover:text-[#a4e6ff]'}`} to="/skills">Skills</Link>
            <Link className={`transition-all duration-300 px-3 py-2 rounded-md ${path === '/sovereign-accounts' || path === '/strategy-accounts' ? 'text-[#a4e6ff] font-bold bg-white/5' : 'text-[#e5e2e3]/60 hover:bg-[#a4e6ff]/10 hover:text-[#a4e6ff]'}`} to="/sovereign-accounts">Sovereign</Link>

            <div className="relative group">
              <button className="flex items-center gap-1 transition-all duration-300 px-3 py-2 rounded-md text-[#e5e2e3]/60 hover:bg-[#a4e6ff]/10 hover:text-[#a4e6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Hub <span className="material-symbols-outlined text-sm" aria-hidden="true">keyboard_arrow_down</span>
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-[#1c1b1c] border border-[#3c494e]/20 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[60] py-2">
                <div className="px-4 py-1 text-[10px] uppercase tracking-widest text-[#a4e6ff]/40 font-bold text-left">Analytics &amp; Social</div>
                <Link className="block px-4 py-2 text-sm text-[#e5e2e3]/60 hover:text-[#a4e6ff] hover:bg-white/5 text-left" to="/rankings">Global Rankings</Link>
                <Link className="block px-4 py-2 text-sm text-[#e5e2e3]/60 hover:text-[#a4e6ff] hover:bg-white/5 text-left" to="/swarm-wars">Swarm Wars</Link>

                <div className="px-4 py-1 mt-2 text-[10px] uppercase tracking-widest text-[#a4e6ff]/40 font-bold text-left">Management</div>
                <Link className="block px-4 py-2 text-sm text-[#e5e2e3]/60 hover:text-[#a4e6ff] hover:bg-white/5 text-left" to="/bidding-board">Bidding Board</Link>
                <Link className="block px-4 py-2 text-sm text-[#e5e2e3]/60 hover:text-[#a4e6ff] hover:bg-white/5 text-left" to="/notifications">Notifications {unreadCount ? `(${unreadCount})` : ""}</Link>

                <div className="px-4 py-1 mt-2 text-[10px] uppercase tracking-widest text-[#a4e6ff]/40 font-bold text-left">Deep Dive Tools</div>
                <Link className="block px-4 py-2 text-sm text-[#e5e2e3]/60 hover:text-[#a4e6ff] hover:bg-white/5 text-left" to="/agent-editor">Agent Editor</Link>
              </div>
            </div>
          </nav>

          <div className="relative">
            <button
              onClick={() => setShowSettings((current) => !current)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${showSettings ? 'bg-[#a4e6ff] text-[#131314]' : 'text-[#a4e6ff] hover:bg-[#a4e6ff]/10'}`}
              aria-label="Open settings"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">settings</span>
            </button>

            {showSettings ? (
              <div className="absolute top-full right-0 mt-4 w-72 bg-[#1c1b1c] border border-[#3c494e]/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[70] overflow-hidden">
                <div className="p-6 flex flex-col gap-4">
                  <div className="space-y-1">
                    <h3 className="font-headline text-lg font-bold text-on-surface">Vault Identity</h3>
                    <p className="font-body text-xs text-on-surface-variant">
                      Connect your wallet, keep the correct network selected, and refresh app state when new jobs or skills land.
                    </p>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        if (wallet.status === "connected") {
                          disconnectWallet();
                        } else if (!runtimeMode.hasDynamic && discoveredProviders.length > 1) {
                          setShowWalletPicker(!showWalletPicker);
                        } else {
                          connectWallet();
                        }
                      }}
                      className="w-full bg-gradient-to-br from-[#a4e6ff] to-[#00d1ff] text-[#001f28] font-headline font-bold text-sm py-3 rounded-lg shadow-[0_0_20px_rgba(164,230,255,0.2)] hover:shadow-[0_0_30px_rgba(164,230,255,0.4)] transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">account_balance_wallet</span>
                      {walletLabel}
                    </button>

                    {showWalletPicker && !runtimeMode.hasDynamic && wallet.status !== "connected" && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c1b1c] border border-[#3c494e]/30 rounded-lg shadow-xl z-[80] overflow-hidden flex flex-col">
                        {discoveredProviders.map((dp) => (
                          <button
                            key={dp.info.uuid}
                            onClick={() => handleConnect(dp.provider)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-xs text-[#e5e2e3]/80 hover:bg-white/5 transition-colors text-left"
                          >
                            <span className="material-symbols-outlined text-sm">wallet</span>
                            {dp.info.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {wallet.status === "connected" && wallet.account ? (
                    <div className="rounded-lg bg-surface-container-lowest border border-outline-variant/20 p-3 text-left">
                      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Connected account</p>
                      <p className="font-label text-sm text-primary mt-1">{truncateAddress(wallet.account, 6)}</p>
                      {wallet.providerName ? (
                        <p className="font-body text-xs text-on-surface-variant mt-1">
                          {wallet.source === "dynamic" ? "Dynamic" : wallet.providerName}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {wallet.error ? (
                    <p className="font-body text-xs text-error">{wallet.error}</p>
                  ) : null}

                  <div className="pt-2 border-t border-outline-variant/10">
                    <button
                      onClick={ensureCorrectNetwork}
                      className="w-full flex items-center gap-3 px-1 py-2 text-sm text-on-surface-variant hover:text-[#a4e6ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">lan</span>
                      Switch to {appEnv.chainName}
                    </button>
                    <button
                      onClick={resetToChain}
                      className="w-full flex items-center gap-3 px-1 py-2 text-sm text-on-surface-variant hover:text-[#a4e6ff] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">refresh</span>
                      Refresh app data (Reset to Chain)
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden flex flex-col w-full sticky top-0 z-[60] bg-[#131314]/90 backdrop-blur-md border-b border-[#3c494e]/20">
        <div className="flex justify-between items-center px-4 py-4 w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMobileMenu}
              className="w-10 h-10 flex items-center justify-center text-[#a4e6ff] hover:bg-[#a4e6ff]/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={showMobileMenu ? "Close mobile menu" : "Open mobile menu"}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{showMobileMenu ? "close" : "menu"}</span>
            </button>
            <Link
              to="/overview"
              className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
            >
              <img src="/logotype.svg" alt="Kinetic Vault" className="h-8 w-auto" />
            </Link>
          </div>
          <button
            onClick={wallet.status === "connected" ? disconnectWallet : connectWallet}
            className="px-3 py-2 rounded-lg bg-surface-container-low text-primary font-label text-xs border border-outline-variant/20"
          >
            {wallet.status === "connected" ? truncateAddress(wallet.account ?? "") : runtimeMode.hasDynamic ? "Dynamic" : "Connect"}
          </button>
        </div>

        {showMobileMenu ? (
          <div className="absolute top-full left-0 w-full bg-[#1c1b1c] border-b border-[#3c494e]/30 shadow-2xl animate-in slide-in-from-top-4 duration-300 overflow-y-auto max-h-[calc(100vh-80px)]">
            <nav className="flex flex-col p-4 font-['Space_Grotesk']">
              <Link onClick={closeMobileMenu} className={`px-4 py-3 rounded-md mb-1 ${path === '/' || path === '/overview' ? 'text-[#a4e6ff] font-bold bg-white/5' : 'text-[#e5e2e3]/60'}`} to="/overview">Overview</Link>
              <Link onClick={closeMobileMenu} className={`px-4 py-3 rounded-md mb-1 ${path === '/agents' ? 'text-[#a4e6ff] font-bold bg-white/5' : 'text-[#e5e2e3]/60'}`} to="/agents">Agents</Link>
              <Link onClick={closeMobileMenu} className={`px-4 py-3 rounded-md mb-4 ${path === '/skills' ? 'text-[#a4e6ff] font-bold bg-white/5' : 'text-[#e5e2e3]/60'}`} to="/skills">Skills</Link>
              <Link onClick={closeMobileMenu} className={`px-4 py-3 rounded-md mb-4 ${path === '/sovereign-accounts' || path === '/strategy-accounts' ? 'text-[#a4e6ff] font-bold bg-white/5' : 'text-[#e5e2e3]/60'}`} to="/sovereign-accounts">Sovereign Accounts</Link>
              <Link onClick={closeMobileMenu} className={`px-4 py-3 rounded-md mb-4 ${path === '/widgets' ? 'text-[#a4e6ff] font-bold bg-white/5' : 'text-[#e5e2e3]/60'}`} to="/widgets">Widgets</Link>

              <div className="h-px bg-[#3c494e]/20 mb-4"></div>

              <div className="px-4 py-1 text-[10px] uppercase tracking-widest text-[#a4e6ff]/40 font-bold mb-2">Analytics &amp; Social</div>
              <Link onClick={closeMobileMenu} className="px-4 py-2 text-[#e5e2e3]/60 text-sm" to="/rankings">Global Rankings</Link>
              <Link onClick={closeMobileMenu} className="px-4 py-2 text-[#e5e2e3]/60 text-sm mb-2" to="/swarm-wars">Swarm Wars</Link>

              <div className="px-4 py-1 text-[10px] uppercase tracking-widest text-[#a4e6ff]/40 font-bold mb-2">Management</div>
              <Link onClick={closeMobileMenu} className="px-4 py-2 text-[#e5e2e3]/60 text-sm" to="/bidding-board">Bidding Board</Link>
              <Link onClick={closeMobileMenu} className="px-4 py-2 text-[#e5e2e3]/60 text-sm mb-2" to="/notifications">Notifications {unreadCount ? `(${unreadCount})` : ""}</Link>

              <div className="px-4 py-1 text-[10px] uppercase tracking-widest text-[#a4e6ff]/40 font-bold mb-2">Deep Dive Tools</div>
              <Link onClick={closeMobileMenu} className="px-4 py-2 text-[#e5e2e3]/60 text-sm mb-3" to="/agent-editor">Agent Editor</Link>
              <button
                onClick={() => {
                  closeMobileMenu();
                  void resetToChain();
                }}
                className="mx-4 mt-2 rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-left text-[#e5e2e3]/80"
              >
                Refresh app data (Reset to Chain)
              </button>
            </nav>
          </div>
        ) : null}
      </header>

      <Outlet />

      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 py-3 pb-safe bg-[#1c1b1c]/90 backdrop-blur-2xl z-50 rounded-t-sm border-t border-[#3c494e]/20 shadow-[0_-10px_40px_rgba(164,230,255,0.06)] font-['Space_Grotesk'] text-[10px] uppercase tracking-tighter overflow-x-auto whitespace-nowrap gap-4">
        <Link className={`flex flex-col items-center justify-center p-2 rounded-md transition-all ${path === '/' || path === '/overview' ? 'bg-gradient-to-br from-[#a4e6ff] to-[#00d1ff] text-[#131314] shadow-[0_0_15px_rgba(164,230,255,0.4)] rounded-sm px-4 py-1.5' : 'text-[#e5e2e3]/40 hover:text-[#e5e2e3]/80 hover:bg-white/5'}`} to="/overview">
          <span className="material-symbols-outlined mb-1 text-[20px]" aria-hidden="true">dashboard</span>
          <span className={path === '/' || path === '/overview' ? 'font-bold' : ''}>Overview</span>
        </Link>
        <Link className={`flex flex-col items-center justify-center p-2 rounded-md transition-all ${path === '/agents' ? 'bg-gradient-to-br from-[#a4e6ff] to-[#00d1ff] text-[#131314] shadow-[0_0_15px_rgba(164,230,255,0.4)] rounded-sm px-4 py-1.5' : 'text-[#e5e2e3]/40 hover:text-[#e5e2e3]/80 hover:bg-white/5'}`} to="/agents">
          <span className="material-symbols-outlined mb-1 text-[20px]" aria-hidden="true">smart_toy</span>
          <span className={path === '/agents' ? 'font-bold' : ''}>Agents</span>
        </Link>
        <Link className={`flex flex-col items-center justify-center p-2 rounded-md transition-all ${path === '/skills' ? 'bg-gradient-to-br from-[#a4e6ff] to-[#00d1ff] text-[#131314] shadow-[0_0_15px_rgba(164,230,255,0.4)] rounded-sm px-4 py-1.5' : 'text-[#e5e2e3]/40 hover:text-[#e5e2e3]/80 hover:bg-white/5'}`} to="/skills">
          <span className="material-symbols-outlined mb-1 text-[20px]" aria-hidden="true">extension</span>
          <span className={path === '/skills' ? 'font-bold' : ''}>Skills</span>
        </Link>
      </nav>
    </div>
  );
}
