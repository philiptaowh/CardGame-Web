// v2.2.0-alpha 网页版 - 用户同意门
//
// 用途：未同意《隐私政策》和《用户协议》前，阻止用户进入游戏主界面
// 行为：
//   - 监听 useConsentStore.isConsented()
//   - 若未同意：渲染全屏 modal（含两个必勾 checkbox + 政策链接 + 同意按钮）
//   - 同意按钮：仅当两个 checkbox 都勾时才能点
//   - 子 modal：PrivacyPolicyPage / UserAgreementPage（点链接时弹）
//
// UX 细节：
//   - 政策链接在 modal 内弹（不跳走，避免离开本页面）
//   - 拒绝按钮：用户可选择"不同意并离开"（关闭窗口或显示提示）
//   - 数据-testid 覆盖：便于未来 Playwright 自动化
//
// 层级约定（z-index v2.2.1.1 修复）：
//   main app = 0
//   SettingsButton/Toast/SettingsModal = 40
//   ConsentGate（本组件）= 150
//   PrivacyPolicyPage / UserAgreementPage（子 modal）= 200
//
// 修复历史：v2.2.0-alpha 初始版把子 modal 设为 z-120 < 父 modal z-150，导致
//   子 modal 渲染但被父 modal 覆盖，用户点击"打开隐私政策"无视觉反馈
//   （"处于没有用的状态"）。本版本统一提到 z-200 修复此 bug。

import { useState, type ReactNode } from 'react';
import { ShieldCheck, FileText, X } from 'lucide-react';
import { useConsentStore } from '../stores/consentStore';
import { PrivacyPolicyPage } from './PrivacyPolicyPage';
import { UserAgreementPage } from './UserAgreementPage';

interface ConsentGateProps {
  children: ReactNode;
}

export function ConsentGate({ children }: ConsentGateProps) {
  const isConsented = useConsentStore((s) =>
    s.privacyAccepted && s.agreementAccepted && s.version === 1,
  );
  const accept = useConsentStore((s) => s.accept);

  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  if (isConsented) {
    return <>{children}</>;
  }

  const canAccept = privacyChecked && agreementChecked;

  const handleAccept = () => {
    if (!canAccept) return;
    accept();
  };

  return (
    <>
      {/* 主应用：渲染但视觉被全屏 modal 覆盖（避免重新挂载丢失状态） */}
      <div className="pointer-events-none opacity-30 select-none">{children}</div>

      {/* 同意门 modal */}
      <div
        data-testid="consent-gate"
        className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      >
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border border-indigo-700/40 rounded-3xl w-full max-w-xl p-8 shadow-2xl">
          {/* 头部 */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">使用前请阅读并同意</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                卡牌游戏 v2.2.0-alpha 网页版 · 数据采集阶段
              </p>
            </div>
          </div>

          {/* 说明文字 */}
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            在开始游戏前，请阅读并同意以下两份协议。不同意将无法继续使用本服务。
          </p>

          {/* 政策链接区 */}
          <div className="space-y-3 mb-6">
            <button
              data-testid="consent-open-privacy"
              onClick={() => setShowPrivacy(true)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <div className="text-sm font-medium text-white">《隐私政策》</div>
                  <div className="text-xs text-slate-500">采集范围、用途、保留期</div>
                </div>
              </div>
              <span className="text-xs text-indigo-400">查看 →</span>
            </button>

            <button
              data-testid="consent-open-agreement"
              onClick={() => setShowAgreement(true)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <div className="text-sm font-medium text-white">《用户协议》</div>
                  <div className="text-xs text-slate-500">使用条款与责任限制</div>
                </div>
              </div>
              <span className="text-xs text-indigo-400">查看 →</span>
            </button>
          </div>

          {/* 勾选区 */}
          <div className="space-y-2 mb-6">
            <label
              data-testid="consent-checkbox-privacy"
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800/40"
            >
              <input
                type="checkbox"
                checked={privacyChecked}
                onChange={(e) => setPrivacyChecked(e.target.checked)}
                className="w-4 h-4 accent-indigo-500"
              />
              <span className="text-sm text-slate-300">
                我已阅读并同意 <span className="text-indigo-400">《隐私政策》</span>
              </span>
            </label>

            <label
              data-testid="consent-checkbox-agreement"
              className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800/40"
            >
              <input
                type="checkbox"
                checked={agreementChecked}
                onChange={(e) => setAgreementChecked(e.target.checked)}
                className="w-4 h-4 accent-indigo-500"
              />
              <span className="text-sm text-slate-300">
                我已阅读并同意 <span className="text-indigo-400">《用户协议》</span>
              </span>
            </label>
          </div>

          {/* 行动按钮 */}
          <div className="flex gap-3">
            <button
              data-testid="consent-reject"
              onClick={() => {
                if (confirm('不同意将无法使用本服务。\n\n点"确定"将关闭此页面，点"取消"返回继续阅读。')) {
                  window.close();
                  // 大部分浏览器不允许脚本关闭窗口，提示用户手动关闭
                  setTimeout(() => {
                    alert('如未自动关闭，请手动关闭此浏览器标签页。');
                  }, 200);
                }
              }}
              className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
            >
              不同意
            </button>
            <button
              data-testid="consent-accept"
              onClick={handleAccept}
              disabled={!canAccept}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                canAccept
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {canAccept ? '同意并开始游戏' : '请先勾选两份协议'}
            </button>
          </div>

          {/* 关闭提示 */}
          <div className="mt-4 text-center text-[10px] text-slate-600">
            政策版本 v1 · 同意状态将保存在本地浏览器
          </div>
        </div>
      </div>

      {/* 子 modal：政策页 */}
      {showPrivacy && <PrivacyPolicyPage onClose={() => setShowPrivacy(false)} />}
      {showAgreement && <UserAgreementPage onClose={() => setShowAgreement(false)} />}
    </>
  );
}
