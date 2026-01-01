import { Vector2 } from 'three'

/**
 * A helper for {@link SelectionBox}.
 *
 * It visualizes the current selection box with a `div` container element.
 *
 * @three_import import { SelectionHelper } from 'three/addons/interactive/SelectionHelper.js';
 */
class SelectionHelper extends EventTarget {

  /**
   * Constructs a new selection helper.
   *
   * @param {(WebGPURenderer|WebGLRenderer)} renderer - The renderer.
   * @param {string} cssClassName - The CSS class name of the `div`.
   */
  constructor(renderer, cssClassName, button) {
    super()
    /**
     * The visualization of the selection box.
     *
     * @type {HTMLDivElement}
     */
    this.element = document.createElement('div')
    this.element.classList.add(cssClassName)
    this.element.style.pointerEvents = 'none'

    /**
     * A reference to the renderer.
     *
     * @type {(WebGPURenderer|WebGLRenderer)}
     */
    this.renderer = renderer

    /**
     * Whether the mouse or pointer is pressed down.
     *
     * @type {boolean}
     * @default false
     */
    this.isDown = false

    /**
     * Whether helper is enabled or not.
     *
     * @type {boolean}
     * @default true
     */
    this.enabled = true

    // private

    this._startPoint = new Vector2()
    this._pointTopLeft = new Vector2()
    this._pointBottomRight = new Vector2()

    this._onPointerDown = (event) => {
      if (!this.enabled) return
      if (event.button !== button) return;
      this.isDown = true
      this._onSelectStart(event)
    }

    this._onPointerMove = (event) => {
      if (!this.enabled) return
      if (this.isDown) {
        this._onSelectMove(event)
      }
    }

    this._onPointerUp = (event) => {
      if (!(this.enabled && this.isDown)) return
      this.isDown = false
      this._onSelectOver(event)
    }

    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp)

  }

  /**
   * Call this method if you no longer want use to the controls. It frees all internal
   * resources and removes all event listeners.
   */
  dispose () {

    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove)
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp)

    this.element.remove() // in case disposal happens while dragging

  }

  // private

  _onSelectStart (event) {
    this.element.style.display = 'none'
    this.renderer.domElement.parentElement.appendChild(this.element)
    this.element.style.left = event.clientX + 'px'
    this.element.style.top = event.clientY + 'px'
    this.element.style.width = '0px'
    this.element.style.height = '0px'
    this._startPoint.x = event.clientX
    this._startPoint.y = event.clientY
    this.dispatchEvent(new CustomEvent("selectStart", {
      detail: event
    }))
  }

  _onSelectMove (event) {
    this.element.style.display = 'block'
    this._pointBottomRight.x = Math.max(this._startPoint.x, event.clientX)
    this._pointBottomRight.y = Math.max(this._startPoint.y, event.clientY)
    this._pointTopLeft.x = Math.min(this._startPoint.x, event.clientX)
    this._pointTopLeft.y = Math.min(this._startPoint.y, event.clientY)
    this.element.style.left = this._pointTopLeft.x + 'px'
    this.element.style.top = this._pointTopLeft.y + 'px'
    this.element.style.width = (this._pointBottomRight.x - this._pointTopLeft.x) + 'px'
    this.element.style.height = (this._pointBottomRight.y - this._pointTopLeft.y) + 'px'
    this.dispatchEvent(new CustomEvent("selectMove", {
      detail: event
    }))
  }

  _onSelectOver (event) {
    this.element.remove()
    this.dispatchEvent(new CustomEvent("selectOver", {
      detail: event
    }))
  }

}

export { SelectionHelper }
