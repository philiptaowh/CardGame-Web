// v2.2.0-alpha 网页版 - 用户同意状态管理
//
// 国内合规要求：用户首次访问需明确同意《隐私政策》和《用户协议》后才能使用产品。
// 同意状态持久化到 localStorage（key: 'card-game-consent'），避免每次访问都要求重勾。
//
// 状态模型：
//   - privacyAccepted: 是否同意《隐私政策》
//   - agreementAccepted: 是否同意《用户协议》
//   - acceptedAt: 同意时间（Unix ms，统计用）
//   - version: 政策版本号（政策更新时递增，旧版本同意视为失效，需重勾）
//
// 设计原则：
//   - 政策版本独立管理：未来政策更新时改 CONSENT_POLICY_VERSION 常量
//   - 不与 settingsStore 混（settings 是偏好，consent 是法律合规）

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** 当前政策版本号 —— 政策文本更新时必须递增 */
export const CONSENT_POLICY_VERSION = 1;

interface ConsentStore {
  /** 是否同意《隐私政策》 */
  privacyAccepted: boolean;
  /** 是否同意《用户协议》 */
  agreementAccepted: boolean;
  /** 同意时间（Unix ms） */
  acceptedAt: number | null;
  /** 同意的政策版本（用于政策更新时强制重勾） */
  version: number | null;

  // --- Actions ---

  /** 一次性同意两份政策（仅当两个 checkbox 都勾才能调用） */
  accept: () => void;
  /** 撤销同意（开发/调试用，正常流程不调用） */
  reset: () => void;
  /** 检查是否完整同意当前版本 */
  isConsented: () => boolean;
}

export const useConsentStore = create<ConsentStore>()(
  persist(
    (set, get) => ({
      privacyAccepted: false,
      agreementAccepted: false,
      acceptedAt: null,
      version: null,

      accept: () => {
        set({
          privacyAccepted: true,
          agreementAccepted: true,
          acceptedAt: Date.now(),
          version: CONSENT_POLICY_VERSION,
        });
      },

      reset: () => {
        set({
          privacyAccepted: false,
          agreementAccepted: false,
          acceptedAt: null,
          version: null,
        });
      },

      isConsented: () => {
        const s = get();
        return (
          s.privacyAccepted &&
          s.agreementAccepted &&
          s.version === CONSENT_POLICY_VERSION
        );
      },
    }),
    {
      name: 'card-game-consent',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        privacyAccepted: state.privacyAccepted,
        agreementAccepted: state.agreementAccepted,
        acceptedAt: state.acceptedAt,
        version: state.version,
      }),
      version: 1,
    },
  ),
);
