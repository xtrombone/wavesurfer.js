import Drawer from "./drawer";
import * as util from "./util";
import CanvasEntry from "./drawer.canvasentry";

/**
 * MultiCanvas renderer for wavesurfer. Is currently the default and sole
 * builtin renderer.
 *
 * A `MultiCanvas` consists of one or more `CanvasEntry` instances, depending
 * on the zoom level.
 */
export default class MultiCanvas extends Drawer {
    /**
     * @param {HTMLElement} container The container node of the wavesurfer instance
     * @param {WavesurferParams} params The wavesurfer initialisation options
     */
    constructor(container, params) {
        super(container, params);

        /**
         * @type {number}
         */
        this.maxCanvasWidth = params.maxCanvasWidth;

        /**
         * @type {number}
         */
        this.maxCanvasElementWidth = Math.round(
            params.maxCanvasWidth / params.pixelRatio
        );

        /**
         * Whether or not the progress wave is rendered. If the `waveColor`
         * and `progressColor` are the same color it is not.
         *
         * @type {boolean}
         */
        this.hasProgressCanvas = params.waveColor != params.progressColor;

        /**
         * @type {number}
         */
        this.halfPixel = 0.5 / params.pixelRatio;

        /**
         * List of `CanvasEntry` instances.
         *
         * @type {Array}
         */
        this.canvases = [];

        /**
         * @type {HTMLElement}
         */
        this.progressWave = null;

        /**
         * Class used to generate entries.
         *
         * @type {function}
         */
        this.EntryClass = CanvasEntry;

        /**
         * Canvas 2d context attributes.
         *
         * @type {object}
         */
        this.canvasContextAttributes = params.drawingContextAttributes;

        /**
         * Overlap added between entries to prevent vertical white stripes
         * between `canvas` elements.
         *
         * @type {number}
         */
        this.overlap = 2 * Math.ceil(params.pixelRatio / 2);

        /**
         * The radius of the wave bars. Makes bars rounded
         *
         * @type {number}
         */
        this.barRadius = params.barRadius || 0;

        /**
         * Conditional for clip-path-based progress
         *
         * @type {boolean}
         */
        this.isIE = !!window.document.documentMode;
    }

    /**
     * Initialize the drawer
     */
    init() {
        this.createWrapper();
        this.createElements();
    }

    /**
     * Create the canvas elements and style them
     *
     */
    createElements() {
        this.progressWave = this.wrapper.appendChild(
            this.style(document.createElement("wave"), {
                position: "absolute",
                zIndex: 3,
                left: 0,
                top: 0,
                bottom: 0,
                overflow: "hidden",
                width: "0",
                display: "none",
                boxSizing: "border-box",
                borderRightStyle: "solid",
                pointerEvents: "none",
            })
        );

        this.addCanvas();
        this.updateCursor();
    }

    /**
     * Update cursor style
     */
    updateCursor() {
        this.style(this.progressWave, {
            borderRightWidth: this.params.cursorWidth + "px",
            borderRightColor: this.params.cursorColor,
        });
    }

    /**
     * Adjust to the updated size by adding or removing canvases
     */
    updateSize() {
        const totalWidth = Math.round(this.width / this.params.pixelRatio);
        const requiredCanvases = Math.ceil(
            totalWidth / (this.maxCanvasElementWidth + this.overlap)
        );

        // add required canvases
        while (this.canvases.length < requiredCanvases) {
            this.addCanvas();
        }

        // remove older existing canvases, if any
        while (this.canvases.length > requiredCanvases) {
            this.removeCanvas();
        }

        let canvasWidth = this.maxCanvasWidth + this.overlap;
        const lastCanvas = this.canvases.length - 1;
        this.canvases.forEach((entry, i) => {
            if (i == lastCanvas) {
                canvasWidth = this.width - this.maxCanvasWidth * lastCanvas;
            }
            this.updateDimensions(entry, canvasWidth, this.height);

            entry.clearWave();
        });

        if (!this.isIE) {
            this.style(this.progressWave, { width: totalWidth + "px" });
            let cStyle = this.makeInset(totalWidth);
            this.style(this.progressWave, {
                "clip-path": cStyle,
                "-webkit-clip-path": cStyle,
            });
        }
    }

    /**
     * Add a canvas to the canvas list
     *
     */
    addCanvas() {
        const entry = new this.EntryClass();
        entry.canvasContextAttributes = this.canvasContextAttributes;
        entry.hasProgressCanvas = this.hasProgressCanvas;
        entry.halfPixel = this.halfPixel;
        const leftOffset = this.maxCanvasElementWidth * this.canvases.length;

        // wave
        entry.initWave(
            this.wrapper.appendChild(
                this.style(document.createElement("canvas"), {
                    position: "absolute",
                    zIndex: 2,
                    left: leftOffset + "px",
                    top: 0,
                    bottom: 0,
                    height: "100%",
                    pointerEvents: "none",
                })
            )
        );

        // progress
        if (this.hasProgressCanvas) {
            entry.initProgress(
                this.progressWave.appendChild(
                    this.style(document.createElement("canvas"), {
                        position: "absolute",
                        left: leftOffset + "px",
                        top: 0,
                        bottom: 0,
                        height: "100%",
                    })
                )
            );
        }

        this.canvases.push(entry);
    }

    /**
     * Pop single canvas from the list
     *
     */
    removeCanvas() {
        let lastEntry = this.canvases[this.canvases.length - 1];

        // wave
        lastEntry.wave.parentElement.removeChild(lastEntry.wave);

        // progress
        if (this.hasProgressCanvas) {
            lastEntry.progress.parentElement.removeChild(lastEntry.progress);
        }

        // cleanup
        if (lastEntry) {
            lastEntry.destroy();
            lastEntry = null;
        }

        this.canvases.pop();
    }

    /**
     * Update the dimensions of a canvas element
     *
     * @param {CanvasEntry} entry Target entry
     * @param {number} width The new width of the element
     * @param {number} height The new height of the element
     */
    updateDimensions(entry, width, height) {
        const elementWidth = Math.round(width / this.params.pixelRatio);
        const totalWidth = Math.round(this.width / this.params.pixelRatio);

        // update canvas dimensions
        entry.updateDimensions(elementWidth, totalWidth, width, height);

        // style element
        this.style(this.progressWave, { display: "block" });
    }

    /**
     * Clear the whole multi-canvas
     */
    clearWave() {
        util.frame(() => {
            this.canvases.forEach((entry) => entry.clearWave());
        })();
    }

    /**
     * Draw a waveform with bars
     *
     * @param {number[]|Number.<Array[]>} peaks Can also be an array of arrays
     * for split channel rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0. Must be an integer.
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that should be
     * rendered
     * @returns {void}
     */
    drawBars(peaks, channelIndex, start, end) {
        return this.prepareDraw(
            peaks,
            channelIndex,
            start,
            end,
            ({ absmax, hasMinVals, height, offsetY, halfH, peaks }) => {
                // if drawBars was called within ws.empty we don't pass a start and
                // don't want anything to happen
                if (start === undefined) {
                    return;
                }
                // Skip every other value if there are negatives.
                const peakIndexScale = hasMinVals ? 2 : 1;
                const length = peaks.length / peakIndexScale;
                const bar = this.params.barWidth * this.params.pixelRatio;
                const gap =
                    this.params.barGap === null
                        ? Math.max(this.params.pixelRatio, ~~(bar / 2))
                        : Math.max(
                              this.params.pixelRatio,
                              this.params.barGap * this.params.pixelRatio
                          );
                const step = bar + gap;

                const scale = length / this.width;
                const first = start;
                const last = end;
                let i = first;
                let halfHmod = this.params.reflection ? 1 : 2;

                for (i; i < last; i += step) {
                    const peak =
                        peaks[Math.floor(i * scale * peakIndexScale)] || 0;
                    let h;

                    if (this.params.reflection) {
                        h = Math.round((peak / absmax) * halfH);
                    } else {
                        h = Math.abs(Math.round((peak / absmax) * halfH));
                    }

                    /* in case of silences, allow the user to specify that we
                     * always draw *something* (normally a 1px high bar) */
                    if (h == 0 && this.params.barMinHeight)
                        h = this.params.barMinHeight;

                    this.fillRect(
                        i + this.halfPixel,
                        halfH * halfHmod - h * halfHmod + offsetY,
                        bar + this.halfPixel,
                        h * 2 * halfHmod,
                        this.barRadius
                    );
                }
            }
        );
    }

    /**
     * Draw a waveform
     *
     * @param {number[]|Number.<Array[]>} peaks Can also be an array of arrays
     * for split channel rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number?} start The x-offset of the beginning of the area that
     * should be rendered (If this isn't set only a flat line is rendered)
     * @param {number?} end The x-offset of the end of the area that should be
     * rendered
     * @returns {void}
     */
    drawWave(peaks, channelIndex, start, end) {
        return this.prepareDraw(
            peaks,
            channelIndex,
            start,
            end,
            ({
                absmax,
                hasMinVals,
                height,
                offsetY,
                halfH,
                peaks,
                channelIndex,
            }) => {
                if (!hasMinVals) {
                    const reflectedPeaks = [];
                    const len = peaks.length;
                    let i = 0;
                    for (i; i < len; i++) {
                        reflectedPeaks[2 * i] = peaks[i];
                        reflectedPeaks[2 * i + 1] = -peaks[i];
                    }
                    peaks = reflectedPeaks;
                }

                // if drawWave was called within ws.empty we don't pass a start and
                // end and simply want a flat line
                if (start !== undefined) {
                    this.drawLine(
                        peaks,
                        absmax,
                        halfH,
                        offsetY,
                        start,
                        end,
                        channelIndex
                    );
                }

                // always draw a median line
                this.fillRect(
                    0,
                    halfH + offsetY - this.halfPixel,
                    this.width,
                    this.halfPixel,
                    this.barRadius
                );
            }
        );
    }

    /**
     * Tell the canvas entries to render their portion of the waveform
     *
     * @param {number[]} peaks Peaks data
     * @param {number} absmax Maximum peak value (absolute)
     * @param {number} halfH Half the height of the waveform
     * @param {number} offsetY Offset to the top
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that
     * should be rendered
     * @param {channelIndex} channelIndex The channel index of the line drawn
     */
    drawLine(peaks, absmax, halfH, offsetY, start, end, channelIndex) {
        const { waveColor, progressColor } =
            this.params.splitChannelsOptions.channelColors[channelIndex] || {};
        this.canvases.forEach((entry, i) => {
            this.setFillStyles(entry, waveColor, progressColor);
            entry.drawLines(peaks, absmax, halfH, offsetY, start, end);
        });
    }

    /**
     * Draw a rectangle on the multi-canvas
     *
     * @param {number} x X-position of the rectangle
     * @param {number} y Y-position of the rectangle
     * @param {number} width Width of the rectangle
     * @param {number} height Height of the rectangle
     * @param {number} radius Radius of the rectangle
     */
    fillRect(x, y, width, height, radius) {
        const startCanvas = Math.floor(x / this.maxCanvasWidth);
        const endCanvas = Math.min(
            Math.ceil((x + width) / this.maxCanvasWidth) + 1,
            this.canvases.length
        );
        let i = startCanvas;
        for (i; i < endCanvas; i++) {
            const entry = this.canvases[i];
            const leftOffset = i * this.maxCanvasWidth;

            const intersection = {
                x1: Math.max(x, i * this.maxCanvasWidth),
                y1: y,
                x2: Math.min(
                    x + width,
                    i * this.maxCanvasWidth + entry.wave.width
                ),
                y2: y + height,
            };

            if (intersection.x1 < intersection.x2) {
                this.setFillStyles(entry);

                entry.fillRects(
                    intersection.x1 - leftOffset,
                    intersection.y1,
                    intersection.x2 - intersection.x1,
                    intersection.y2 - intersection.y1,
                    radius
                );
            }
        }
    }

    /**
     * Returns whether to hide the channel from being drawn based on params.
     *
     * @param {number} channelIndex The index of the current channel.
     * @returns {bool} True to hide the channel, false to draw.
     */
    hideChannel(channelIndex) {
        return (
            this.params.splitChannels &&
            this.params.splitChannelsOptions.filterChannels.includes(
                channelIndex
            )
        );
    }

    /**
     * Performs preparation tasks and calculations which are shared by `drawBars`
     * and `drawWave`
     *
     * @param {number[]|Number.<Array[]>} peaks Can also be an array of arrays for
     * split channel rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number?} start The x-offset of the beginning of the area that
     * should be rendered. If this isn't set only a flat line is rendered
     * @param {number?} end The x-offset of the end of the area that should be
     * rendered
     * @param {function} fn The render function to call, e.g. `drawWave`
     * @param {number} drawIndex The index of the current channel after filtering.
     * @returns {void}
     */
    prepareDraw(peaks, channelIndex, start, end, fn, drawIndex) {
        return util.frame(() => {
            // Split channels and call this function with the channelIndex set
            if (peaks[0] instanceof Array) {
                const channels = peaks;

                if (this.params.splitChannels) {
                    const filteredChannels = channels.filter(
                        (c, i) => !this.hideChannel(i)
                    );
                    if (!this.params.splitChannelsOptions.overlay) {
                        this.setHeight(
                            Math.max(filteredChannels.length, 1) *
                                this.params.height *
                                this.params.pixelRatio
                        );
                    }

                    return channels.forEach((channelPeaks, i) =>
                        this.prepareDraw(
                            channelPeaks,
                            i,
                            start,
                            end,
                            fn,
                            filteredChannels.indexOf(channelPeaks)
                        )
                    );
                }
                peaks = channels[0];
            }

            // Return and do not draw channel peaks if hidden.
            if (this.hideChannel(channelIndex)) {
                return;
            }

            // calculate maximum modulation value, either from the barHeight
            // parameter or if normalize=true from the largest value in the peak
            // set
            let absmax = 1 / this.params.barHeight;
            if (this.params.normalize) {
                

                let min = peaks[0], max = peaks[0];
                for(let i = 1; i < peaks.length; i++){
                    let value = peaks[i];
                    min = (value < min) ? value : min;
                    max = (value > max) ? value : max;
                }
                // const max = Math.max.apply(null, peaks);
                // const min = Math.min.apply(null, peaks);
                absmax = -min > max ? -min : max;
            }

            // Bar wave draws the bottom only as a reflection of the top,
            // so we don't need negative values
            const hasMinVals = [].some.call(peaks, (val) => val < 0);
            const height = this.params.height * this.params.pixelRatio;
            const offsetY = height * drawIndex || 0;
            const halfH = height / 2;

            return fn({
                absmax: absmax,
                hasMinVals: hasMinVals,
                height: height,
                offsetY: offsetY,
                halfH: halfH,
                peaks: peaks,
                channelIndex: channelIndex,
            });
        })();
    }

    /**
     * Set the fill styles for a certain entry (wave and progress)
     *
     * @param {CanvasEntry} entry Target entry
     * @param {string} waveColor Wave color to draw this entry
     * @param {string} progressColor Progress color to draw this entry
     */
    setFillStyles(
        entry,
        waveColor = this.params.waveColor,
        progressColor = this.params.progressColor
    ) {
        entry.setFillStyles(waveColor, progressColor);
    }

    /**
     * Return image data of the multi-canvas
     *
     * When using a `type` of `'blob'`, this will return a `Promise`.
     *
     * @param {string} format='image/png' An optional value of a format type.
     * @param {number} quality=0.92 An optional value between 0 and 1.
     * @param {string} type='dataURL' Either 'dataURL' or 'blob'.
     * @return {string|string[]|Promise} When using the default `'dataURL'`
     * `type` this returns a single data URL or an array of data URLs,
     * one for each canvas. When using the `'blob'` `type` this returns a
     * `Promise` that resolves with an array of `Blob` instances, one for each
     * canvas.
     */
    getImage(format, quality, type) {
        if (type === "blob") {
            return Promise.all(
                this.canvases.map((entry) => {
                    return entry.getImage(format, quality, type);
                })
            );
        } else if (type === "dataURL") {
            let images = this.canvases.map((entry) =>
                entry.getImage(format, quality, type)
            );
            return images.length > 1 ? images : images[0];
        }
    }

    /**
     * build a css inset string for masking off portions of the progessWave
     *
     * In order to avoid browser layout passes, we leave our progress wave at full width
     * but mask a portion of it off using the `clip-path` CSS property.
     *
     * @param {number} rightInset=number of pixels to clip off the right
     * @return {string} css
     */
    makeInset(rightInset) {
        return `inset(0px ${rightInset}px 0px 0px)`;
    }

    /**
     * Render the new progress
     *
     * @param {number} position X-offset of progress position in pixels
     */
    updateProgress(position) {
        if (this.isIE) {
            this.style(this.progressWave, { width: position + "px" });
        } else {
            let actualWidth = this.width / this.params.pixelRatio;
            let cStyle = this.makeInset(actualWidth - position);
            this.style(this.progressWave, {
                "clip-path": cStyle,
                "-webkit-clip-path": cStyle,
            });
        }
    }
}
