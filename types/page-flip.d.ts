// Khai báo tối thiểu cho thư viện lật trang "page-flip" (StPageFlip) — gói không kèm types.
declare module "page-flip" {
  export type FlipSetting = {
    width: number; height: number; size?: "fixed" | "stretch"; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number;
    showCover?: boolean; drawShadow?: boolean; maxShadowOpacity?: number; flippingTime?: number; usePortrait?: boolean;
    mobileScrollSupport?: boolean; startPage?: number; autoSize?: boolean; showPageCorners?: boolean; disableFlipByClick?: boolean;
  };
  export class PageFlip {
    constructor(el: HTMLElement, setting: FlipSetting);
    loadFromImages(images: string[]): void;
    updateFromImages(images: string[]): void;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    on(event: "flip" | "changeState" | "init", cb: (e: { data: unknown }) => void): PageFlip;
    destroy(): void;
  }
}
