// v2.2.0-alpha 网页版 - 用户协议页
//
// 用途：用户首次访问时通过 ConsentGate 中的链接打开阅读
// 设计：全屏 modal 形式，可独立关闭（关闭时回到 ConsentGate）
// 内容：用户使用本服务时需遵守的条款 + 数据采集使用承诺
//
// 层级约定（z-index 倒挂修复 v2.2.1.1）：
//   main app = 0
//   SettingsButton/Toast/SettingsModal = 40
//   ConsentGate = 150  (父 modal)
//   PrivacyPolicyPage = 200  (子 modal，必须高于父 modal 才能点击)
//   UserAgreementPage = 200  (同上)

import { X } from 'lucide-react';

interface UserAgreementPageProps {
  onClose: () => void;
}

export function UserAgreementPage({ onClose }: UserAgreementPageProps) {
  return (
    <div
      data-testid="user-agreement-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-agreement-title"
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* 头部 */}
        <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <h2 id="user-agreement-title" className="text-xl font-bold text-white">用户协议</h2>
          <button
            data-testid="user-agreement-close"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar text-slate-300 text-sm leading-relaxed space-y-5">
          <p className="text-xs text-slate-500">
            最后更新：2026-06-15 ｜ 协议版本 v1
          </p>

          <section>
            <h3 className="text-base font-bold text-white mb-2">一、服务性质</h3>
            <p>
              本服务为 <strong className="text-white">卡牌游戏 v2.2.0-alpha 网页版</strong>，处于<strong className="text-amber-400">技术探索与数据采集阶段</strong>。
              服务仅供个人游戏与研究使用，<strong className="text-white">非商业产品</strong>，不构成任何商业承诺。
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">二、数据采集与使用</h3>
            <p>使用本服务即表示您同意以下数据采集与使用方式：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>本服务会<strong className="text-white">自动记录</strong>您参与的每局对局数据（角色、技能、动作、胜负）</li>
              <li>记录的对局数据用于<strong className="text-white">游戏平衡性研究</strong>（卡牌游戏仿真分析）</li>
              <li>对局数据<strong className="text-white">不包含您的个人身份信息</strong>，仅含 IP / User-Agent 摘要</li>
              <li>数据<strong className="text-white">不与任何第三方共享</strong>，不用于商业广告</li>
            </ul>
            <p className="mt-2">详细说明请参阅 <strong className="text-white">《隐私政策》</strong>。</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">三、用户行为规范</h3>
            <p>使用本服务时，您承诺不从事以下行为：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>利用漏洞、自动化脚本、外挂等方式影响对局公平性</li>
              <li>尝试对服务端进行未授权访问、攻击、注入等行为</li>
              <li>上传含有恶意代码、虚假信息、违反法律法规的内容</li>
              <li>从事任何违反中华人民共和国法律法规的行为</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">四、知识产权</h3>
            <p>本服务的代码、设计、文案、卡牌设计、游戏机制等相关内容的知识产权归开发者所有。未经许可，不得用于商业用途。</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">五、服务变更与终止</h3>
            <p>本服务处于 alpha 阶段，可能随时调整、暂停或终止。开发者不承担因服务变更对用户造成的影响。</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">六、责任限制</h3>
            <p>本服务按"现状"提供，不对服务的可用性、准确性、适用性做任何明示或暗示的保证。用户因使用本服务产生的任何损失，开发者不承担责任。</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">七、协议变更</h3>
            <p>本协议可能随服务更新而修订。修订后，已同意旧版本的用户需重新阅读并同意新版本方可继续使用。</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">八、适用法律</h3>
            <p>本协议的订立、执行和解释均适用中华人民共和国法律法规。如发生争议，双方应友好协商解决。</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">九、联系方式</h3>
            <p>如您对本协议有任何疑问，请通过以下方式联系：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>邮箱：<code className="bg-slate-800 px-1.5 py-0.5 rounded">philip_tao.wh@foxmail.com</code></li>
              <li>项目主页：<code className="bg-slate-800 px-1.5 py-0.5 rounded">https://github.com/philiptaowh/CardGame-Web</code></li>
            </ul>
          </section>
        </div>

        {/* 底部 */}
        <div className="px-8 py-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            data-testid="user-agreement-back"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
          >
            我已阅读
          </button>
        </div>
      </div>
    </div>
  );
}
