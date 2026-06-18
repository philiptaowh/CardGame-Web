import { useState } from 'react';
import { CharacterSelect } from './components/CharacterSelect';
import { GameBoard } from './components/GameBoard';
import { CoverPage } from './components/CoverPage';
import { Lobby } from './components/Lobby';
import { LANGame } from './components/LANGame';
import { TestPage } from './components/TestPage';
import { SettingsButton } from './components/SettingsButton';
import { SettingsModal } from './components/SettingsModal';
import { ToastContainer } from './components/Toast';
import { ConsentGate } from './components/ConsentGate';
import { TutorialOverlay } from './components/Tutorial/TutorialOverlay';
import { useSettingsStore } from './stores/settingsStore';

type Page = 'cover' | 'ai-select' | 'lobby' | 'game' | 'lan-game' | 'test';

function App() {
  const [page, setPage] = useState<Page>('cover');
  const openSettings = useSettingsStore((s) => s.open);

  const handleGoToTest = () => setPage('test');
  const handleGoToCover = () => setPage('cover');

  const renderPage = () => {
    if (page === 'cover') {
      return (
        <CoverPage
          onAI={() => setPage('ai-select')}
          onLAN={() => setPage('lobby')}
          onTest={handleGoToTest}
        />
      );
    }
    if (page === 'ai-select') {
      return (
        <CharacterSelect
          onStart={() => setPage('game')}
          onBack={handleGoToCover}
        />
      );
    }
    if (page === 'lobby') {
      return (
        <Lobby
          onGameStart={() => setPage('lan-game')}
          onBack={handleGoToCover}
        />
      );
    }
    if (page === 'lan-game') {
      return <LANGame onBack={handleGoToCover} />;
    }
    if (page === 'test') {
      return (
        <TestPage
          onBack={handleGoToCover}
          onStartGame={() => setPage('game')}
          onOpenSettings={() => openSettings('recording')}
        />
      );
    }
    return <GameBoard onBack={handleGoToCover} />;
  };

  // v2.2.0-alpha: 同意门包裹整个应用 — 未同意时阻止进入游戏主界面
  // 子 modal（PrivacyPolicyPage / UserAgreementPage）由 ConsentGate 内部管理
  return (
    <ConsentGate>
      <div className="min-h-screen bg-slate-900">
        {/* 顶部设置按钮 — 固定右上角，所有页面可见 */}
        <div className="fixed top-3 right-3 z-40" data-testid="settings-button-wrapper">
          <SettingsButton />
        </div>

        {/* 页面内容 */}
        {renderPage()}

        {/* 设置弹窗 — 按 isOpen 状态显示 */}
        <SettingsModal />

        {/* Toast 通知 — 固定右上角 */}
        <ToastContainer />

        {/* v2.2.1.5: 游戏教学 Overlay — 全局唯一挂载，由各页面通过 store 触发 */}
        <TutorialOverlay />
      </div>
    </ConsentGate>
  );
}

export default App;
