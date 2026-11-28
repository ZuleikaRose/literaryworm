// @piper-plus/g2p ships types for its main entry only; the English entry used by lib/onDeviceEngine.ts.
declare module "@piper-plus/g2p/en" {
  export class EnglishG2P {
    static create(options?: { cmuDict?: Record<string, string> | Map<string, string> }): Promise<EnglishG2P>;
    phonemize(text: string): { tokens: string[]; prosody: null[] };
  }
}
