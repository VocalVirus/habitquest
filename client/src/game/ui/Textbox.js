/**
 * Reusable RPG-style dialogue textbox (Zelda/Pokémon style).
 *
 * Anchored to the camera (scrollFactor 0) so it stays fixed on screen. Renders
 * a message with a typewriter effect and a blinking hint line when the message
 * finishes.
 *
 * Usage as a proximity prompt:
 *   this.textbox = new Textbox(this);
 *   this.textbox.show('You reach the door...', {
 *     speaker: 'General Store',
 *     hint: 'Press E to enter',
 *   });
 *   // hide it when the player walks away: this.textbox.hide();
 *   // detect a tap on the box (touch): this.textbox.containsPointer(p)
 *
 * Usage as advancing dialogue:
 *   this.textbox.show(line, { speaker, onDone });
 *   // hook a key/pointer to: this.textbox.advance();
 */
export class Textbox {
  constructor(scene, opts = {}) {
    this.scene   = scene;
    this.depth   = opts.depth ?? 200;
    this.speed   = opts.charDelay ?? 24;   // ms per character
    this.padding = 18;

    this.visible    = false;
    this.fullText   = '';
    this.hint       = '';
    this.onDone     = null;
    this.typeEvent  = null;
    this.typing     = false;

    this._build();
  }

  _build() {
    const cam = this.scene.cameras.main;
    const W   = cam.width;
    const H   = cam.height;

    const boxW = Math.min(620, W - 40);
    const boxH = 120;
    const x    = W / 2;
    const y    = H - boxH / 2 - 24;

    this.boxW = boxW;
    this.boxH = boxH;
    this.x    = x;   // fixed screen-space centre (scrollFactor 0)
    this.y    = y;

    // Drop shadow + panel + inner border for a layered "9-slice" feel
    this.shadow = this.scene.add.rectangle(x + 4, y + 4, boxW, boxH, 0x000000, 0.5)
      .setScrollFactor(0).setDepth(this.depth);
    this.panel = this.scene.add.rectangle(x, y, boxW, boxH, 0x12182b, 0.97)
      .setScrollFactor(0).setDepth(this.depth + 1)
      .setStrokeStyle(3, 0xffd700);
    this.inner = this.scene.add.rectangle(x, y, boxW - 10, boxH - 10, 0x000000, 0)
      .setScrollFactor(0).setDepth(this.depth + 1)
      .setStrokeStyle(1, 0x5566aa);

    // Speaker name tag (floats above the box's top-left)
    this.nameTag = this.scene.add.text(
      x - boxW / 2 + 14, y - boxH / 2 - 12, '',
      {
        fontSize: '12px', color: '#12182b', fontFamily: 'monospace',
        fontStyle: 'bold', backgroundColor: '#ffd700',
        padding: { x: 8, y: 3 },
      }
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(this.depth + 2);

    this.body = this.scene.add.text(
      x - boxW / 2 + this.padding,
      y - boxH / 2 + this.padding,
      '',
      {
        fontSize: '15px', color: '#ffffff', fontFamily: 'monospace',
        lineSpacing: 6,
        wordWrap: { width: boxW - this.padding * 2 },
      }
    ).setScrollFactor(0).setDepth(this.depth + 2);

    // Blinking hint / continue indicator (bottom-right of box)
    this.indicator = this.scene.add.text(
      x + boxW / 2 - 14, y + boxH / 2 - 14, '▼',
      { fontSize: '13px', color: '#ffd700', fontFamily: 'monospace' }
    ).setOrigin(1, 1).setScrollFactor(0).setDepth(this.depth + 2).setVisible(false);

    this.blinkTween = this.scene.tweens.add({
      targets: this.indicator, alpha: 0.2,
      duration: 450, yoyo: true, repeat: -1, paused: true,
    });

    this._setVisible(false);
  }

  _members() {
    return [this.shadow, this.panel, this.inner, this.nameTag, this.body, this.indicator];
  }

  _setVisible(v) {
    this.shadow.setVisible(v);
    this.panel.setVisible(v);
    this.inner.setVisible(v);
    this.body.setVisible(v);
    this.nameTag.setVisible(v && !!this.nameTag.text);
    this.indicator.setVisible(false);
  }

  isOpen() {
    return this.visible;
  }

  show(text, { speaker = '', hint = '', onDone = null } = {}) {
    this.fullText = text;
    this.hint     = hint;
    this.onDone   = onDone;
    this.visible  = true;

    this.nameTag.setText(speaker || '');
    this.body.setText('');
    this._setVisible(true);

    // Subtle pop-in
    this.panel.setScale(1, 0.85);
    this.scene.tweens.add({
      targets: this.panel, scaleY: 1, duration: 120, ease: 'Back.out',
    });

    this._startTyping();
    return this;
  }

  _startTyping() {
    this.typing = true;

    // Show the hint ("Press E to enter") right away so the prompt is never
    // missing while the flavor text types out; the ▼ is added once it finishes.
    if (this.hint) {
      this.indicator.setText(this.hint);
      this.indicator.setVisible(true);
      this.blinkTween.restart();
    } else {
      this.indicator.setVisible(false);
      this.blinkTween.pause();
    }

    let i = 0;
    this.typeEvent?.remove();
    this.typeEvent = this.scene.time.addEvent({
      delay: this.speed,
      repeat: this.fullText.length - 1,
      callback: () => {
        i += 1;
        this.body.setText(this.fullText.slice(0, i));
        if (i >= this.fullText.length) this._finishTyping();
      },
    });
  }

  _finishTyping() {
    this.typing = false;
    this.typeEvent?.remove();
    this.typeEvent = null;
    this.body.setText(this.fullText);
    this.indicator.setText(this.hint ? `${this.hint}  ▼` : '▼');
    this.indicator.setVisible(true);
    this.blinkTween.restart();
  }

  /** True when a pointer falls inside the box (used for tap-to-confirm on touch). */
  containsPointer(p) {
    if (!this.visible) return false;
    return Math.abs(p.x - this.x) <= this.boxW / 2
        && Math.abs(p.y - this.y) <= this.boxH / 2;
  }

  /**
   * Advance the box: if still typing, fast-forward to the full line; if the line
   * is complete, close it and fire onDone.
   */
  advance() {
    if (!this.visible) return;
    if (this.typing) { this._finishTyping(); return; }
    const cb = this.onDone;
    this.hide();
    cb?.();
  }

  hide() {
    this.visible = false;
    this.typing  = false;
    this.typeEvent?.remove();
    this.typeEvent = null;
    this.blinkTween.pause();
    this._setVisible(false);
  }

  destroy() {
    this.typeEvent?.remove();
    this.blinkTween?.remove();
    this._members().forEach((o) => o?.destroy());
  }
}
