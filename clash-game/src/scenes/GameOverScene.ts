import { CANVAS_HEIGHT, CANVAS_WIDTH, FONT_UI } from '../config/constants';
import { FRECKLES } from '../characters/Freckles';
import { SLADE } from '../characters/Slade';
import type { GameContext, GameOverParams } from '../core/StateManager';
import { idlePose } from '../rendering/SpriteRenderer';
import { Scene } from './Scene';

const INPUT_DELAY = 40;

export class GameOverScene extends Scene {
  private index = 0;
  private t = 0;
  private confetti: { x: number; y: number; vx: number; vy: number; rot: number; vr: number; color: string }[] = [];

  constructor(game: GameContext, private readonly params: GameOverParams) {
    super(game);
    if (params.victory) {
      const palette = [params.accent, '#ffffff', '#8a4dff', '#ff6a2a', '#39f3ff'];
      for (let i = 0; i < 90; i++) {
        this.confetti.push({
          x: Math.random() * CANVAS_WIDTH,
          y: -Math.random() * CANVAS_HEIGHT,
          vx: (Math.random() - 0.5) * 1.2,
          vy: 1 + Math.random() * 2,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.2,
          color: palette[i % palette.length],
        });
      }
    }
  }

  enter(): void {
    if (this.params.victory) this.game.audio.startMusic('victory');
    else {
      this.game.audio.stopMusic();
      this.game.audio.playKO();
    }
  }

  update(): void {
    this.t++;
    for (const c of this.confetti) {
      c.x += c.vx + Math.sin((this.t + c.rot * 40) * 0.05) * 0.6;
      c.y += c.vy;
      c.rot += c.vr;
      if (c.y > CANVAS_HEIGHT + 10) {
        c.y = -10;
        c.x = Math.random() * CANVAS_WIDTH;
      }
    }
    if (this.t < INPUT_DELAY || this.game.scenes.transitioning) return;
    const m = this.game.input.menu();
    const n = this.params.options.length;
    if (m.up) {
      this.index = (this.index + n - 1) % n;
      this.game.audio.playSelect();
    }
    if (m.down) {
      this.index = (this.index + 1) % n;
      this.game.audio.playSelect();
    }
    if (m.confirm) {
      this.game.audio.playConfirm();
      const opt = this.params.options[this.index];
      this.game.scenes.go(opt.scene, opt.params);
    } else if (m.back) {
      this.game.audio.playBack();
      this.game.scenes.go('title', {});
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const p = this.params;
    const time = g.time;
    g.renderer.drawStage(p.victory ? 'sanctuary' : 'facility', 0, 0, time, CANVAS_WIDTH);
    ctx.save();
    ctx.fillStyle = p.victory ? 'rgba(8,6,18,0.62)' : 'rgba(18,2,6,0.78)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    const hasPortrait = !!p.portrait;
    const cx = hasPortrait ? 600 : CANVAS_WIDTH / 2;

    if (p.portrait) {
      const def = p.portrait === 'slade' ? SLADE : FRECKLES;
      const slide = Math.min(1, this.t / 20);
      const px = 210 - 260 * (1 - slide) ** 2;
      ctx.save();
      const gl = ctx.createRadialGradient(px, 330, 10, px, 330, 220);
      gl.addColorStop(0, `${p.accent}55`);
      gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, 480, CANVAS_HEIGHT);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(px, 470, 80, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!p.victory) ctx.globalAlpha = 0.75;
      g.sprites.drawBody(ctx, def.archetype, 'normal', idlePose(def.archetype, p.victory ? time : time * 0.4), px, 470, 1, 2.1, time);
      ctx.restore();
    }

    const drop = Math.min(1, this.t / 14);
    const titleScale = 1 + (1 - drop) * 0.8;
    ctx.save();
    ctx.translate(cx, 120);
    ctx.scale(titleScale, titleScale);
    g.ui.text(ctx, p.title, 0, 0, 64, '#ffffff', { stroke: '#000', strokeWidth: 8, shadow: p.accent, alpha: drop });
    ctx.restore();
    g.ui.text(ctx, p.subtitle, cx, 156, 14, p.accent, { template: FONT_UI, alpha: drop });

    const panelW = 420;
    const panelY = 180;
    const panelH = 30 + p.lines.length * 26;
    g.ui.panel(ctx, cx - panelW / 2, panelY, panelW, panelH, 'rgba(8,6,18,0.86)');
    p.lines.forEach((line, i) => {
      const appear = Math.min(1, Math.max(0, (this.t - 16 - i * 6) / 10));
      g.ui.text(ctx, line, cx, panelY + 32 + i * 26, 16, '#ffffff', { alpha: appear, stroke: '#000', strokeWidth: 3 });
    });

    const menuY = panelY + panelH + 50;
    const ready = this.t >= INPUT_DELAY;
    g.ui.menu(
      ctx,
      p.options.map((o) => o.label),
      ready ? this.index : -1,
      cx,
      menuY,
      time,
      38,
      p.options.map(() => !ready),
    );

    if (this.confetti.length) {
      ctx.save();
      for (const c of this.confetti) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.scale(Math.cos(c.rot * 3), 1);
        ctx.fillStyle = c.color;
        ctx.fillRect(-3, -5, 6, 10);
        ctx.restore();
      }
      ctx.restore();
    }
    g.ui.text(ctx, 'W / S or arrows to choose  ·  J / Enter to confirm', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16, 11, 'rgba(255,255,255,0.45)', {
      template: FONT_UI,
    });
    g.renderer.drawVignette();
  }
}
