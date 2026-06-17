// v2.2.0-alpha 网页版 - 隐私政策页
//
// 用途：用户首次访问时通过 ConsentGate 中的链接打开阅读
// 设计：全屏 modal 形式，可独立关闭（关闭时回到 ConsentGate）
// 内容：国内合规最低要求 — 列明采集范围、用途、保留期、联系方式
//
// 层级约定（z-index 倒挂修复 v2.2.1.1）：
//   main app = 0
//   SettingsButton/Toast/SettingsModal = 40
//   ConsentGate = 150  (父 modal)
//   PrivacyPolicyPage = 200  (子 modal，必须高于父 modal 才能点击)
//   UserAgreementPage = 200  (同上)

import { X } from 'lucide-react';

interface PrivacyPolicyPageProps {
  onClose: () => void;
}

export function PrivacyPolicyPage({ onClose }: PrivacyPolicyPageProps) {
  return (
    <div
      data-testid="privacy-policy-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-policy-title"
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* 头部 */}
        <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <h2 id="privacy-policy-title" className="text-xl font-bold text-white">隐私政策</h2>
          <button
            data-testid="privacy-policy-close"
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
            最后更新：2026-06-15 ｜ 政策版本 v1
          </p>

          <section>
            <h3 className="text-base font-bold text-white mb-2">一、信息收集范围</h3>
            <p>本网页版（v2.2.0-alpha）服务在您使用过程中，仅收集以下信息：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>您的 <strong className="text-white">IP 地址</strong>（用于服务端访问统计和异常排查）</li>
              <li>您的 <strong className="text-white">浏览器 User-Agent</strong>（用于兼容性分析）</li>
              <li>您参与的<strong className="text-white">对局数据</strong>（角色选择、动作序列、胜负结果、最终状态），用于游戏平衡性研究</li>
            </ul>
            <p className="mt-2">本服务<strong className="text-red-400">不收集</strong>您的真实姓名、身份证号、联系方式、地理位置、Cookie 以外的其他个人身份信息。</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">二、信息使用方式</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>对局数据用于卡牌游戏的<strong className="text-white">角色强度分析</strong>与<strong className="text-white">平衡性研究</strong>（仿真分析平台 V2）</li>
              <li>IP / User-Agent 仅用于服务端日志和异常排查，<strong className="text-white">不与第三方共享</strong></li>
              <li>所有数据仅用于产品研发目的，<strong className="text-white">不用于商业广告投放</strong></li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">三、信息存储与保留</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>对局数据保存在阿里云 ECS 服务器的 MySQL 数据库中</li>
              <li>服务端日志保留期 <strong className="text-white">30 天</strong>，到期自动删除</li>
              <li>对局数据用于研究目的，<strong className="text-white">保留期限不设上限</strong>（数据为匿名化的对局动作序列，不含个人身份信息）</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">四、您的权利</h3>
            <p>作为用户，您拥有以下权利：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-white">知情权</strong>：本政策告知您所有被收集的数据类型与用途</li>
              <li><strong className="text-white">拒绝权</strong>：不同意本政策时，您可以选择不进入游戏（点击关闭按钮离开网页）</li>
              <li><strong className="text-white">撤回权</strong>：如您已同意但希望撤回，请清除浏览器 localStorage 与 Cookie 即可</li>
            </ul>
            <p className="mt-2">由于本服务<strong className="text-white">不收集个人身份信息</strong>，因此无法按 ID 精确删除您的对局数据；如确有需求，请通过下方联系方式申请。</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">五、未成年人保护</h3>
            <p>本服务面向 <strong className="text-white">14 周岁及以上</strong> 用户。14 周岁以下未成年人请在监护人同意下使用本服务。</p>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">六、联系方式</h3>
            <p>如您对本政策有任何疑问或需要行使上述权利，请通过以下方式联系：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>邮箱：<code className="bg-slate-800 px-1.5 py-0.5 rounded">philip_tao.wh@foxmail.com</code></li>
              <li>项目主页：<code className="bg-slate-800 px-1.5 py-0.5 rounded">https://github.com/philiptaowh/CardGame-Web</code></li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-white mb-2">七、政策更新</h3>
            <p>本服务可能在功能调整时更新本政策。更新后，已同意旧版本的用户需重新阅读并同意新版本方可继续使用。</p>
          </section>
        </div>

        {/* 底部 */}
        <div className="px-8 py-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            data-testid="privacy-policy-back"
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
