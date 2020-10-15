import calculateImageSize from "../tools/calculateImageSize";
import errorCorrectionPercents from "../constants/errorCorrectionPercents";
import QRDot from "./QRDot";
import { Options } from "./QROptions";
import C2S, { SVGRenderingContext2D } from "@mithrandirii/canvas2svg";

type FilterFunction = (i: number, j: number) => boolean;

export default class QRCanvas {
  _ctx: SVGRenderingContext2D;
  _options: Options;
  _qr?: QRCode;

  //TODO don't pass all options to this class
  constructor(options: Options) {
    this._ctx = new C2S({
      width: options.width,
      height: options.height
    });
    this._options = options;
  }

  get context(): SVGRenderingContext2D | null {
    return this._ctx;
  }

  get width(): number {
    return this._options.width;
  }

  get height(): number {
    return this._options.height;
  }

  clear(): void {
    const canvasContext = this.context;

    if (canvasContext) {
      canvasContext.clearRect(0, 0, this._options.width, this._options.height);
    }
  }

  drawQR(qr: QRCode): Promise<void> {
    this.clear();
    this.drawBackground();
    this._qr = qr;

    if (this._options.image) {
      return this.drawImageAndDots();
    } else {
      this.drawDots();
      return Promise.resolve();
    }
  }

  drawBackground(): void {
    const canvasContext = this.context;
    const options = this._options;

    if (canvasContext) {
      canvasContext.fillStyle = options.backgroundOptions.color;
      canvasContext.fillRect(0, 0, this._options.width, this._options.height);
    }
  }

  drawDots(filter?: FilterFunction): void {
    if (!this._qr) {
      throw "QR code is not defined";
    }

    const canvasContext = this.context;

    if (!canvasContext) {
      throw "QR code is not defined";
    }

    const options = this._options;
    const count = this._qr.getModuleCount();

    if (count > options.width || count > options.height) {
      throw "The canvas is too small.";
    }

    const minSize = Math.min(options.width, options.height);
    const dotSize = Math.floor(minSize / count);
    const xBeginning = Math.floor((options.width - count * dotSize) / 2);
    const yBeginning = Math.floor((options.height - count * dotSize) / 2);
    const dot = new QRDot({ context: canvasContext, type: options.dotsOptions.type });

    for (let i = 0; i < count; i++) {
      for (let j = 0; j < count; j++) {
        if (filter && !filter(i, j)) {
          continue;
        }
        if (!this._qr.isDark(i, j)) {
          continue;
        }
        canvasContext.fillStyle = options.dotsOptions.color;
        dot.draw(
          xBeginning + i * dotSize,
          yBeginning + j * dotSize,
          dotSize,
          (xOffset: number, yOffset: number): boolean => {
            if (i + xOffset < 0 || j + yOffset < 0 || i + xOffset >= count || j + yOffset >= count) return false;
            if (filter && !filter(i + xOffset, j + yOffset)) return false;
            return !!this._qr && this._qr.isDark(i + xOffset, j + yOffset);
          }
        );
      }
    }
  }

  drawImageAndDots(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this._qr) {
        return reject("QR code is not defined");
      }

      const canvasContext = this.context;

      if (!canvasContext) {
        return reject("QR code is not defined");
      }

      const options = this._options;
      const count = this._qr.getModuleCount();
      const minSize = Math.min(options.width, options.height);
      const dotSize = Math.floor(minSize / count);
      const xBeginning = Math.floor((options.width - count * dotSize) / 2);
      const yBeginning = Math.floor((options.height - count * dotSize) / 2);
      const coverLevel =
        options.imageOptions.imageSize * errorCorrectionPercents[options.qrOptions.errorCorrectionLevel];

      if (!options.image) {
        return reject("Image is not defined");
      }

      return fetch(options.image)
        .then(res => res.text())
        .then(data => {
          const parser = new DOMParser();
          const svg = parser.parseFromString(data, "image/svg+xml").querySelector("svg");

          if (!svg) {
            throw "no svg found on given src";
          }

          const maxHiddenDots = Math.floor(coverLevel * count * count);
          const { width, height, hideXDots, hideYDots } = calculateImageSize({
            originalWidth: parseFloat(svg.getAttribute("width") || "64"),
            originalHeight: parseFloat(svg.getAttribute("height") || "64"),
            maxHiddenDots,
            maxHiddenAxisDots: count - 14,
            dotSize
          });

          this.drawDots((i: number, j: number): boolean => {
            if (!options.imageOptions.hideBackgroundDots) {
              return true;
            }
            return (
              i < (count - hideXDots) / 2 ||
              i >= (count + hideXDots) / 2 ||
              j < (count - hideYDots) / 2 ||
              j >= (count + hideYDots) / 2
            );
          });

          if (options.imageOptions.imageColor) {
            const paths = svg.getElementsByTagName("path");
            const lPath = paths[paths.length - 1];
            if (lPath) {
              lPath.setAttribute("fill", options.imageOptions.imageColor);
            }
          }

          canvasContext.drawImageSvg(
            svg,
            xBeginning + (count * dotSize - width) / 2,
            yBeginning + (count * dotSize - height) / 2,
            width,
            height
          );
        })
        .then(() => {
          resolve();
        });
    });
  }
}
