import getMode from "../tools/getMode";
import mergeDeep from "../tools/merge";
//import downloadURI from "../tools/downloadURI";
import QRCanvas from "./QRCanvas";
import defaultOptions, { Options } from "./QROptions";
import qrcode from "qrcode-generator";

// type DownloadOptions = {
//   name?: string;
//   extension?: Extension;
// };

export default class QRCodeStyling {
  _options: Options;
  _container?: HTMLElement;
  _canvas?: QRCanvas;
  _qr?: QRCode;
  _drawingPromise?: Promise<void>;

  constructor(options?: Partial<Options>) {
    this._options = options ? (mergeDeep(defaultOptions, options) as Options) : defaultOptions;
    this.update();
  }

  static _clearContainer(container?: HTMLElement): void {
    if (container) {
      container.innerHTML = "";
    }
  }

  update(options?: Partial<Options>): void {
    QRCodeStyling._clearContainer(this._container);
    this._options = options ? (mergeDeep(this._options, options) as Options) : this._options;

    if (!this._options.data) {
      return;
    }

    this._qr = qrcode(this._options.qrOptions.typeNumber, this._options.qrOptions.errorCorrectionLevel);
    this._qr.addData(this._options.data, this._options.qrOptions.mode || getMode(this._options.data));
    this._qr.make();
    this._canvas = new QRCanvas(this._options);
    this._drawingPromise = this._canvas.drawQR(this._qr);
  }

  append(container?: HTMLElement): void {
    if (!container) {
      return;
    }

    if (typeof container.appendChild !== "function") {
      throw "Container should be a single DOM node";
    }

    if (!this._drawingPromise) {
      return;
    }

    this._drawingPromise.then(() => {
      if (this._canvas && this._canvas.context) {
        container.innerHTML = this._canvas.context.getSerializedSvg(false);
      }

      this._container = container;
    });
  }

  getSerializedSvg(): Promise<string> | undefined {
    if (!this._drawingPromise) {
      return;
    }

    return this._drawingPromise.then(() => {
      if (this._canvas && this._canvas.context) {
        return this._canvas.context.getSerializedSvg(false);
      }

      return "";
    });
  }

  // download(downloadOptions?: Partial<DownloadOptions> | string): void {
  //   if (!this._drawingPromise) return;

  //   this._drawingPromise.then(() => {
  //     if (!this._canvas) return;

  //     let extension = "png";
  //     let name = "qr";

  //     //TODO remove deprecated code in the v2
  //     if (typeof downloadOptions === "string") {
  //       extension = downloadOptions;
  //       console.warn(
  //         "Extension is deprecated as argument for 'download' method, please pass object { name: '...', extension: '...' } as argument"
  //       );
  //     } else if (typeof downloadOptions === "object" && downloadOptions !== null) {
  //       if (downloadOptions.name) {
  //         name = downloadOptions.name;
  //       }
  //       if (downloadOptions.extension) {
  //         extension = downloadOptions.extension;
  //       }
  //     }

  //     const data = this._canvas.getCanvas().toDataURL(`image/${extension}`);
  //     downloadURI(data, `${name}.${extension}`);
  //   });
  //}
}
