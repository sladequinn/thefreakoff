import type { Archetype } from '../physics/Types';
import type { Dims, DrawOpts, Palette, Pose, Skeleton, V } from './SpriteRenderer';

type Ctx = CanvasRenderingContext2D;
type Point = [number, number];
const INK = '#10121f';
const lit = (hex: string, amount: number): string => {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number): number => Math.round(((value >> shift) & 255) * (1 - amount) + 255 * amount);
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
};
const at = (a: V, x: number, y: number): V => ({ x: a.x + x, y: a.y + y });
const mix = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const along = (a: V, b: V, n: number): V => ({ x: a.x + b.x * n, y: a.y + b.y * n });

/** Flat, authored light planes. No gradients or texture noise: each mass must read at combat size. */
class Ink {
  constructor(readonly c: Ctx, readonly o: DrawOpts) {}
  poly(points: Point[], color: string, edge = true): void {
    const c = this.c;
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath(); c.fillStyle = this.o.tint ?? color; c.fill();
    if (edge) { c.strokeStyle = this.o.tint ?? INK; c.lineWidth = 1.15; c.lineJoin = 'round'; c.stroke(); }
  }
  line(a: V, b: V, width: number, color: string): void {
    const c = this.c; c.strokeStyle = this.o.tint ?? color; c.lineWidth = width; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  }
  path(points: V[], width: number, color: string): void {
    const c = this.c; c.strokeStyle = this.o.tint ?? color; c.lineWidth = width;
    c.beginPath(); points.forEach((v, i) => i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)); c.stroke();
  }
  jewel(x: number, y: number, r: number, color: string): void {
    this.poly([[x-r,y],[x,y-r],[x+r,y],[x,y+r]],color,false);
  }
  /** A fitted sleeve/limb, with a swelling muscle plane and a narrower articulated joint. */
  limb(a: V, b: V, w0: number, w1: number, base: string, shadow: string, light: string, front = true, material: 'cloth' | 'skin' | 'metal' = 'cloth'): void {
    const dx=b.x-a.x, dy=b.y-a.y, l=Math.hypot(dx,dy)||1;
    const n={x:-dy/l,y:dx/l};
    const q=(t:number,w:number):Point=>[a.x+dx*t+n.x*w,a.y+dy*t+n.y*w];
    const left=[q(0,-w0*.40),q(.17,-w0*.49),q(.4,-w0*.47),q(.72,-w1*.55),q(1,-w1*.4)];
    const right=[q(1,w1*.4),q(.7,w1*.46),q(.35,w0*.46),q(.12,w0*.45),q(0,w0*.32)];
    this.poly([...left,...right],front?base:shadow,false);
    // Only silhouette edges are inked; cross-joint seams made the limbs look bolted together.
    for(const edge of [left,right])this.path(edge.map(([x,y])=>({x,y})),.9,INK);
    if (!this.o.tint) {
      const band=material==='metal'?.13:material==='skin'?.23:.32;
      this.poly([q(.08,-w0*band),q(.26,-w0*(band+.05)),q(.68,-w1*band),q(.9,-w1*.16),q(.73,-w1*.03),q(.3,w0*.07)],front?light:base,false);
      if(material==='metal'&&front){
        this.path([q(.16,-w0*.36),q(.4,-w0*.33),q(.7,-w1*.34)].map(([x,y])=>({x,y})),1.5,'#f3f7ff');
        this.poly([q(.55,w0*.12),q(.7,w1*.13),q(.88,w1*.27),q(.57,w0*.3)],shadow,false);
      }else if(material==='cloth'){
        this.poly([q(.65,w1*.35),q(.81,-w1*.15),q(.91,w1*.31)],shadow,false);
      }
    }
  }
  band(a:V,b:V,t:number,span:number,width:number,color:string):void {
    const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,n={x:-dy/l,y:dx/l};
    const x=mix(a,b,t),y=mix(a,b,t+span);
    this.poly([[x.x-n.x*width/2,x.y-n.y*width/2],[x.x+n.x*width/2,x.y+n.y*width/2],[y.x+n.x*width/2,y.y+n.y*width/2],[y.x-n.x*width/2,y.y-n.y*width/2]],color,false);
  }

  hand(p: V, r: number, skin: string, shadow: string, glove = false): void {
    this.poly([[p.x-r,p.y-r*.65],[p.x-r*.5,p.y-r],[p.x+r*.65,p.y-r*.8],[p.x+r,p.y-r*.1],[p.x+r*.65,p.y+r*.85],[p.x-r*.55,p.y+r*.8],[p.x-r*.8,p.y+r*.25],[p.x-r*.35,p.y-r*.05]], skin);
    this.poly([[p.x-r*.8,p.y-r*.5],[p.x-r*.2,p.y-r*.25],[p.x-r*.25,p.y+r*.3],[p.x-r*.65,p.y+r*.45]],shadow,false);
    this.poly([[p.x-r*.7,p.y+r*.15],[p.x+r*.65,p.y],[p.x+r*.6,p.y+r*.7],[p.x-r*.65,p.y+r*.65]],shadow,false);
    if(!this.o.tint) {
      this.line(at(p,-r*.25,-r*.4),at(p,-r*.15,r*.05),.75,shadow);
      this.line(at(p,r*.25,-r*.45),at(p,r*.3,r*.05),.75,shadow);
      this.line(at(p,-r*.4,-r*.7),at(p,r*.4,-r*.72),glove?1.2:.8,glove?'#cbd2e2':lit(skin,.18));
    }
  }
  boot(p: V, w: number, base: string, light: string): void {
    this.poly([[p.x-w*.5,p.y-5],[p.x+w*.25,p.y-5],[p.x+w*.65,p.y-1],[p.x+w,p.y],[p.x+w,p.y+3],[p.x-w*.65,p.y+3],[p.x-w*.7,p.y]],base);
    this.line(at(p,-w*.42,1.8),at(p,w*.85,1.8),1.8,light);
    this.poly([[p.x-w*.28,p.y-4],[p.x+w*.12,p.y-4],[p.x+w*.45,p.y-1],[p.x-w*.3,p.y-1]],light,false);
  }
}

function bodySpace(i: Ink, J: Skeleton, fn:()=>void): void {
  const width = 1 - Math.abs(J.turn) * 0.22;
  i.c.save(); i.c.transform(J.perp.x * width,J.perp.y * width,-J.up.x,-J.up.y,J.neck.x + J.turn * 2,J.neck.y); fn(); i.c.restore();
}
function headSpace(i: Ink,J:Skeleton,p:Pose,fn:()=>void):void {
  i.c.save(); i.c.translate(J.head.x,J.head.y); i.c.rotate(p.lean+p.head); fn(); i.c.restore();
}
function face(i:Ink,r:number,skin:string,shade:string,eye:string,kind:'stern'|'sad'|'beard'='stern'):void {
  i.poly([[-r*.7,-r*.65],[r*.35,-r*.84],[r*.7,-r*.4],[r*.72,-.5],[r*.98,r*.13],[r*.68,r*.29],[r*.62,r*.72],[r*.1,r*.96],[-r*.56,r*.7],[-r*.83,r*.1]],skin);
  i.poly([[-r*.67,-r*.38],[-r*.18,-r*.3],[-r*.12,r*.38],[r*.15,r*.83],[-r*.47,r*.63],[-r*.7,r*.15]],shade,false);
  i.poly([[r*.2,r*.1],[r*.63,r*.29],[r*.62,r*.45],[r*.17,r*.35]],shade,false);
  if(i.o.tint)return;
  if(kind==='sad') {
    i.line({x:-2,y:-1.5},{x:0,y:-2.7},1.2,eye);i.line({x:2.8,y:-2.7},{x:5.5,y:-1.7},1.2,eye);
    i.poly([[4,.1],[2.8,3.9],[5,3]],eye,false);
    i.poly([[.5,6.7],[2.6,5.1],[4.9,6.5],[4.7,7.4],[2.6,6.5]],eye,false);
    i.line({x:-2,y:-1.5},{x:.4,y:-1},1.2,eye);
    i.line({x:3.4,y:-1},{x:5.7,y:-1.5},1.2,eye);
  } else {
    i.line({x:-1.4,y:-2.6},{x:1.4,y:-1.7},1.4,eye);i.line({x:3.5,y:-1.8},{x:6,y:-2.4},1.3,eye);
    i.line({x:0,y:-.3},{x:1,y:-.3},1.1,eye);i.line({x:4.4,y:-.5},{x:5.4,y:-.5},1.1,eye);
    if(kind!=='beard')i.line({x:1.5,y:5.4},{x:5,y:5.4},1.1,eye);
  }
}
function scarf(i:Ink,J:Skeleton,time:number,motion:number,base:string,light:string):void {
  const x=J.neck.x-5,y=J.neck.y-1,w=Math.sin(time*.13)*3;
  i.poly([[x,y-3],[x-15,y-7],[x-30-motion*8,y-5+w],[x-44-motion*12,y-12+w],[x-39-motion*12,y-1+w],[x-24,y+3+w],[x-10,y+3],[x,y+4]],base);
  i.poly([[x-7,y-2],[x-18,y-5],[x-29-motion*8,y-3+w],[x-36-motion*12,y-7+w],[x-29,y+1+w],[x-14,y+1]],light,false);
}

function ninja(i:Ink,J:Skeleton,p:Pose,d:Dims,pal:Palette,o:DrawOpts):void {
  scarf(i,J,o.time,o.motion,pal.scarf,pal.scarfTip);
  const leg=(k:V,f:V,front:boolean)=>{
    i.limb(front?J.hipR:J.hipL,k,14,10,pal.gi,pal.giDark,pal.gi2,front); i.limb(k,f,11,7,pal.gi,pal.giDark,pal.gi2,front);
    i.limb(mix(k,f,.43),f,10,8,pal.wrap,pal.giDark,pal.trim,front);
    if(front)i.line(at(mix(k,f,.12),-3.3,-.5),at(mix(k,f,.37),-3.3,-.5),1.8,lit(pal.gi2,.18));
    for(let n=0;n<3;n++){const q=mix(k,f,.53+n*.13);i.line(at(q,-3,-1),at(q,3,1),1,front?pal.scarfTip:pal.gi2);}
    if(front)i.line(at(mix(J.hipR,k,.3),-3,-1),at(mix(J.hipR,k,.6),-3,-1),1.25,pal.gi2);
    i.boot(f,8,pal.giDark,front?lit(pal.gi2,.22):pal.gi2);
  };
  const arm=(s:V,e:V,h:V,front:boolean)=>{i.limb(s,e,12,8,pal.gi,pal.giDark,pal.gi2,front);i.limb(e,h,9,7,pal.wrap,pal.giDark,pal.trim,front);};
  leg(J.kneeL,J.footL,false);arm(J.shL,J.elL,J.hdL,false);i.hand(J.hdL,4,pal.gi2,pal.giDark,true);
  bodySpace(i,J,()=>{
    const h=d.torso;
    i.poly([[-10,-2],[7,-3],[13,4],[10,16],[8,h],[-9,h],[-12,13]],pal.gi);
    i.poly([[-10,0],[-4,3],[-2,18],[-7,h],[-10,h],[-12,13]],pal.giDark,false);
    i.poly([[-4,2],[5,-1],[10,5],[6,13],[-1,12]],pal.gi2,false);
    i.poly([[5,-1],[10,3],[-3,23],[-8,20]],pal.giDark);
    i.poly([[5,1],[8,3],[-4,21],[-6,20]],pal.gi2,false);
    i.line({x:7,y:3},{x:-5,y:21},1.5,pal.trim);
    i.poly([[-4,13],[2,14],[-3,20],[-7,18]],pal.gi2,false);
    i.line({x:2,y:23},{x:7,y:24},1,pal.giDark);
    i.poly([[-9,h-5],[9,h-5],[9,h],[-9,h]],pal.wrap);
    i.jewel(1,h-2,2.4,pal.scarfTip);
    i.poly([[-7,h],[-1,h],[1,h+13],[-4,h+9]],pal.scarf);
    i.line({x:1,y:15},{x:5,y:20},1.1,pal.gi2);
    i.poly([[-12,2],[-6,0],[-2,6],[-8,11],[-14,8]],pal.gi2);
    i.line({x:-11,y:3},{x:-6,y:2},1.4,pal.scarfTip);
  });
  leg(J.kneeR,J.footR,true);
  headSpace(i,J,p,()=>{
    i.poly([[-8,-6],[-3,-10],[5,-9],[9,-4],[10,4],[4,9],[-5,8],[-9,2]],pal.gi);
    i.poly([[-7,-5],[-2,-8],[3,-7],[0,-1],[-6,2]],pal.gi2,false);
    i.poly([[-2,-3],[3,-1.9],[9,-4],[8,-.2],[3,0],[-1,-.6]],pal.giDark,false);
    i.poly([[-3,1],[9,-.6],[8,6],[3,9],[-5,6]],pal.wrap);
    i.poly([[-1,-2],[2,-1.3],[1,-.6],[-1,-1]],pal.eye,false);i.poly([[4,-1.4],[8,-3],[7,-1],[4,-.6]],pal.eye,false);
    i.line({x:-2,y:2},{x:6,y:2},1.2,pal.gi2);
    i.poly([[-9,-4],[-5,-6],[-3,-3],[-6,0]],pal.trim);
  });
  arm(J.shR,J.elR,J.hdR,true);
  const v={x:Math.sin(J.foreR+p.weapon),y:Math.cos(J.foreR+p.weapon)},n={x:-v.y,y:v.x},g=along(J.hdR,v,4),tip=along(g,v,d.blade);
  i.line(along(J.hdR,v,-8),g,4,pal.hilt);
  i.line(along(g,n,-5),along(g,n,5),3,pal.trim);
  i.poly([[g.x-n.x*2.5,g.y-n.y*2.5],[tip.x,tip.y],[g.x+n.x*3,g.y+n.y*3]],pal.blade);
  i.line(g,tip,1,pal.scarfTip);i.hand(J.hdR,4.5,pal.gi2,pal.giDark,true);
  if(o.blade&&o.toScreen)o.blade(o.toScreen(tip),o.toScreen(mix(g,tip,.45)));
}

function harlequin(i:Ink,J:Skeleton,p:Pose,d:Dims,pal:Palette,o:DrawOpts):void {
  // Two broad, asymmetric twin-tails; folds rather than round ropes.
  headSpace(i,J,p,()=>{
    const w=Math.sin(o.time*.13)*3;
    i.poly([[-6,-6],[-14,-4],[-17,7],[-12,18+w],[-19,29+w],[-10,25+w],[-5,14],[-8,3]],pal.hair1);
    i.poly([[5,-5],[12,-3],[15,9],[11,19-w],[19,26-w],[10,26-w],[6,16],[9,3]],pal.hair2);
    i.line({x:-12,y:1},{x:-10,y:16},1.5,pal.dark2);
    i.line({x:11,y:2},{x:10,y:14},1.5,pal.white2);
  });
  const leg=(k:V,f:V,front:boolean)=>{
    i.limb(front?J.hipR:J.hipL,k,12,8,pal.stock1,pal.dark,pal.dark2,front);i.limb(k,f,9,6,pal.stock1,pal.dark,pal.dark2,front);
    const a=mix(front?J.hipR:J.hipL,k,.2);
    for(let n=0;n<3;n++) {
      i.band(a,k,n/3,.15,9.4-n*.9,front?pal.stock2:pal.white2);
    }
    for(let n=0;n<2;n++){i.band(k,f,.12+n*.27,.14,7.5-n*.6,front?pal.stock2:pal.white2);}
    i.limb(mix(k,f,.62),f,9,7,pal.boots,pal.dark,pal.dark2,front);i.boot(f,9,pal.boots,pal.dark2);
  };
  const arm=(s:V,e:V,h:V,front:boolean)=>{
    i.limb(s,e,11,7,pal.dark,pal.paint,pal.dark2,front);i.limb(e,h,7.5,6,pal.dark,pal.paint,pal.dark2,front);
    const q=mix(e,h,.7);i.limb(q,h,9,8,pal.glove,pal.glove2,pal.white,front);
    i.hand(h,5.3,front?pal.glove:pal.glove2,pal.dark2,true);
    for(let n=0;n<3;n++)i.jewel(h.x-2+n*2.3,h.y-4.7,1.8,pal.knuckle);
  };
  leg(J.kneeL,J.footL,false);arm(J.shL,J.elL,J.hdL,false);
  bodySpace(i,J,()=>{
    const h=d.torso;
    i.poly([[-10,1],[7,0],[11,7],[6,17],[8,25],[13,h+5],[2,h+9],[-2,h+5],[-10,h+8],[-13,h+3],[-7,24],[-6,17],[-11,8]],pal.dark);
    i.poly([[-9,5],[-4,8],[-3,18],[-6,26],[-10,29],[-7,17]],pal.dark2,false);
    i.poly([[1,8],[7,7],[5,20],[8,26],[3,26]],pal.white2,false);
    i.poly([[-11,0],[8,-1],[12,5],[6,5],[3,8],[-1,5],[-5,8],[-8,5],[-13,5]],pal.white);
    for(let n=0;n<4;n++){
      i.line({x:-2,y:11+n*3.2},{x:3,y:14+n*3.2},1.1,pal.lace);
      i.line({x:3,y:11+n*3.2},{x:-2,y:14+n*3.2},1.1,pal.lace);
    }
    i.line({x:-7,y:27},{x:8,y:27},2,pal.buckle);
    i.jewel(-7,h+3,2.5,pal.white);i.jewel(8,h+2,2.5,pal.white);
  });
  leg(J.kneeR,J.footR,true);
  headSpace(i,J,p,()=>{
    face(i,9,pal.skin,pal.skinDark,pal.paint,'sad');
    i.poly([[-9,0],[-11,-8],[-17,-13],[-9,-16],[-2,-12],[4,-13],[14,-16],[18,-10],[11,-9],[8,-1],[6,-6],[1,-8],[-4,-5]],pal.hood);
    i.poly([[0,-11],[5,-12],[14,-16],[18,-10],[11,-9],[8,-1],[6,-6],[1,-8]],pal.hood2);
    i.jewel(-17,-12,3.1,pal.dark2);i.jewel(18,-10,3.1,pal.dark2);
    i.jewel(-17,-12.4,2.4,pal.bell);i.jewel(18,-10.4,2.4,pal.bell);
    i.line({x:-5,y:-4},{x:-2,y:-6},1.5,pal.dark2);
  });
  arm(J.shR,J.elR,J.hdR,true);
}

function kingpin(i:Ink,J:Skeleton,p:Pose,d:Dims,pal:Palette,o:DrawOpts):void {
  const leg=(k:V,f:V,front:boolean)=>{i.limb(front?J.hipR:J.hipL,k,19,13,pal.pants,pal.pants2,'#535063',front);i.limb(k,f,13,10,pal.pants,pal.pants2,'#535063',front);i.boot(f,11,pal.shoe,pal.sole);};
  const arm=(s:V,e:V,h:V,front:boolean)=>{i.limb(s,e,17,13,pal.shirt,pal.shirt2,lit(pal.shirt,.16),front);i.limb(e,h,12,9,pal.skin,pal.skinDark,lit(pal.skin,.2),front,'skin');i.line(at(mix(e,h,.78),-4,0),at(mix(e,h,.78),4,0),2,pal.gold);};
  leg(J.kneeL,J.footL,false);arm(J.shL,J.elL,J.hdL,false);i.hand(J.hdL,5,pal.skin,pal.skinDark);
  bodySpace(i,J,()=>{
    const h=d.torso;
    i.poly([[-17,0],[-7,-3],[9,-3],[19,2],[26,15],[28,25],[25,33],[19,h+5],[-17,h+5],[-22,24],[-21,9]],pal.shirt);
    i.poly([[-8,-1],[7,-1],[18,17],[20,26],[16,h+3],[-7,h+3],[-11,17]],pal.tee);
    i.poly([[8,8],[13,14],[18,24],[14,h+3],[10,h+3],[13,24]],lit(pal.tee,.07),false);
    i.poly([[-18,2],[-14,3],[-16,14],[-14,24],[-17,h+3],[-21,22]],pal.shirt2,false);
    i.line({x:-16,y:6},{x:-17,y:14},1.2,pal.shirt2);
    i.poly([[8,0],[15,2],[24,18],[25,26],[20,h+2],[16,h+3],[18,26],[12,14]],lit(pal.shirt,.14),false);
    i.poly([[-8,-2],[-1,4],[-7,11],[-12,3]],pal.shirt);
    i.poly([[7,-2],[2,4],[9,11],[13,3]],pal.shirt);
    i.poly([[2,4],[8,6],[9,11]],pal.shirt2,false);
    i.poly([[-7,11],[-3,7],[-6,14],[-9,17]],pal.shirt2,false);
    i.poly([[14,17],[18,24],[16,h+2],[13,h+3],[14,26]],pal.shirt2,false);
    i.path([{x:-5,y:5},{x:-2,y:14},{x:4,y:17},{x:9,y:13},{x:9,y:5}],2,pal.gold);
    i.path([{x:-4,y:5},{x:-1,y:10},{x:4,y:12},{x:8,y:9}],1.5,pal.gold);
    i.jewel(4,18,3,pal.gold);i.jewel(4,17.3,1,'#fff7c2');
    i.line({x:15,y:13},{x:20,y:12},1.1,pal.shirt2);
    for(let n=0;n<3;n++)i.jewel(13,23+n*4, .8,pal.shirt2);
    i.line({x:-7,y:h+3},{x:14,y:h+3},2,pal.pants2);
  });
  headSpace(i,J,p,()=>{
    face(i,11,pal.skin,pal.skinDark,pal.beard,'beard');
    i.poly([[-8,0],[-5,5],[0,6],[4,4],[7,3],[7,8],[2,11],[-5,9],[-8,5]],pal.beard);
    i.poly([[-5,5],[-1,7],[4,6],[4,9],[0,11],[-4,9]],lit(pal.beard,.18),false);
    i.line({x:0,y:6},{x:4,y:6},1.3,pal.mouth);
    i.poly([[-9,-4],[-9,-10],[-4,-13],[5,-12],[9,-7],[14,-5],[14,-3]],pal.cap);
    i.poly([[-9,-4],[0,-6],[13,-5],[14,-3],[1,-2]],pal.capBrim);
    i.line({x:-5,y:-10},{x:3,y:-11},1,'#ffffff');i.jewel(3,-9,2,pal.logo);
    i.poly([[-3,-2],[2,-2],[2,2],[-3,1]],pal.glasses);
    i.poly([[4,-2],[9,-3],[9,1],[4,2]],pal.glasses);
    i.line({x:1,y:-1},{x:5,y:-1},1.5,pal.glasses);
    i.line({x:-2,y:-1},{x:1,y:-1},.8,'#8b9dad');
  });
  leg(J.kneeR,J.footR,true);arm(J.shR,J.elR,J.hdR,true);
  const v={x:Math.sin(J.foreR+p.weapon),y:Math.cos(J.foreR+p.weapon)},tip=along(J.hdR,v,16);
  i.path([along(J.hdR,v,-5),at(J.hdR,-9,15),at(J.hip,-17,25),at(J.hip,-12,31)],1.1,pal.mic);
  i.line(along(J.hdR,v,-5),tip,4,pal.mic);
  i.hand(J.hdR,5.2,pal.skin,pal.skinDark);
  i.line(along(J.hdR,v,3),along(J.hdR,v,9),3,pal.mic);
  i.c.save();i.c.translate(tip.x,tip.y);i.c.rotate(-Math.atan2(v.x,v.y));
  i.poly([[-4,-3],[-3,-6],[2,-7],[4,-4],[4,1],[1,3],[-3,2]],pal.micHead);
  for(let n=0;n<3;n++)i.line({x:-3,y:-4+n*2},{x:3,y:-4+n*2},.9,pal.micHead2);
  i.c.restore();void o;
}

function fiddler(i:Ink,J:Skeleton,p:Pose,d:Dims,pal:Palette,o:DrawOpts):void {
  scarf(i,J,o.time,o.motion,pal.band,pal.band);
  const leg=(k:V,f:V,front:boolean)=>{i.limb(front?J.hipR:J.hipL,k,15,10,pal.pants,pal.pants2,lit(pal.pants,.24),front);i.limb(k,f,12,7,pal.pants,pal.pants2,lit(pal.pants,.24),front);i.boot(f,8,pal.belt,pal.giDark);};
  const arm=(s:V,e:V,h:V,front:boolean)=>{i.limb(s,e,13,9,pal.gi,pal.giDark,lit(pal.gi,.2),front);i.limb(e,h,8,6,pal.skin,pal.skinDark,lit(pal.skin,.25),front,'skin');};
  leg(J.kneeL,J.footL,false);arm(J.shL,J.elL,J.hdL,false);
  bodySpace(i,J,()=>{
    i.poly([[-11,0],[-4,-2],[7,0],[12,6],[8,20],[9,d.torso+5],[-10,d.torso+4],[-8,17],[-12,7]],pal.gi);
    i.poly([[-11,4],[-5,7],[-3,20],[-7,d.torso],[-10,d.torso]],pal.giDark,false);
    i.poly([[-3,-1],[2,7],[7,0],[5,12],[-2,20],[-5,9]],pal.skin);
    i.poly([[6,0],[10,3],[-2,24],[-6,23]],pal.gi);
    i.line({x:8,y:4},{x:-3,y:22},1,pal.giDark);
    i.poly([[-9,d.torso-5],[9,d.torso-5],[9,d.torso],[-9,d.torso]],pal.belt);
    i.poly([[2,d.torso],[5,d.torso],[8,d.torso+14],[4,d.torso+12]],pal.belt);
    i.poly([[0,d.torso],[-3,d.torso],[-7,d.torso+10],[-3,d.torso+11]],pal.belt);
  });
  headSpace(i,J,p,()=>{
    i.poly([[-6,-5],[-11,-2],[-12,7],[-8,13],[-12,19],[-6,16],[-5,6]],pal.hair);
    face(i,9,pal.skin,pal.skinDark,pal.eye);
    i.poly([[-8,1],[-9,-6],[-5,-10],[2,-11],[8,-7],[7,-4],[2,-6],[-3,-3],[-4,2]],pal.hair);
    i.poly([[-8,-5],[7,-6],[8,-3],[-8,-2]],pal.band);
    i.line({x:-5,y:-8},{x:0,y:-9},1.5,pal.wood);
  });
  leg(J.kneeR,J.footR,true);
  // The neck is gripped at the origin. Body sits behind it beneath the chin, never across the face.
  i.c.save();i.c.translate(J.hdL.x,J.hdL.y);i.c.rotate(.18+p.lean*.2);
  i.poly([[-8,-3],[-11,-6],[-17,-7],[-21,-4],[-22,0],[-18,3],[-22,6],[-20,11],[-14,13],[-8,10],[-7,6],[-10,3],[-6,2]],pal.wood);
  i.poly([[-16,-6],[-12,-5],[-12,-1],[-15,2],[-12,5],[-13,8],[-17,7],[-18,5],[-16,2],[-19,-1]],lit(pal.wood,.24),false);
  i.poly([[-13,-1],[8,-1],[9,2],[-13,3]],pal.woodDark);
  i.line({x:-18,y:1},{x:8,y:.5},1,pal.strings);
  i.line({x:-15,y:-3},{x:-15,y:6},1.2,pal.giDark);
  i.path([{x:-18,y:3},{x:-17,y:5},{x:-15,y:5}],1,pal.woodDark);
  i.jewel(9,.5,2,pal.wood);i.line({x:4,y:-3},{x:4,y:4},1.4,pal.frog);
  i.c.restore();i.hand(J.hdL,3.5,pal.skin,pal.skinDark);
  arm(J.shR,J.elR,J.hdR,true);
  const v={x:Math.sin(J.foreR+p.weapon),y:Math.cos(J.foreR+p.weapon)},tip=along(J.hdR,v,d.blade),back=along(J.hdR,v,-7);
  i.line(back,tip,2.8,pal.woodDark);i.line(at(back,1,-1),at(tip,1,-1),1,pal.bowHair);
  i.hand(J.hdR,4,pal.skin,pal.skinDark);
  if(o.blade&&o.toScreen)o.blade(o.toScreen(tip),o.toScreen(mix(J.hdR,tip,.45)));
}

function bat(i:Ink,J:Skeleton,p:Pose,d:Dims,pal:Palette,o:DrawOpts):void {
  const w=Math.sin(o.time*.1)*3;
  const lag=Math.sin(o.time*.12-1.2)*(1+o.motion*3);
  bodySpace(i,J,()=>{
    i.poly([[-8,-3],[-17,6],[-20-o.motion*9,29],[-27-o.motion*10,65+w],[-17-o.motion*8+lag,60],[-13-o.motion*7+lag,68],[-5-o.motion*5+lag,60],[2-o.motion*3,64],[10,51],[10,5]],pal.cape);
    i.poly([[-8,1],[-12,21],[-18,53],[-13,60],[-7,47],[-3,22]],lit(pal.cape,.16),false);
    i.poly([[-4,8],[1,38],[-5,58],[1,61],[8,50],[7,6]],pal.capeIn,false);
  });
  const leg=(k:V,f:V,front:boolean)=>{i.limb(front?J.hipR:J.hipL,k,12,8,pal.suit,pal.suit2,lit(pal.suit,.26),front);i.limb(k,f,10,6,pal.suit,pal.suit2,lit(pal.suit,.26),front);i.limb(mix(k,f,.28),f,10,7,pal.cowl,pal.trunks,lit(pal.cowl2,.22),front);i.boot(f,10.5,pal.cowl,front?lit(pal.cowl2,.3):pal.cowl2);};
  const arm=(s:V,e:V,h:V,front:boolean)=>{i.limb(s,e,15,9,pal.suit,pal.suit2,lit(pal.suit,.26),front);i.limb(e,h,11,8,pal.cowl,pal.trunks,lit(pal.cowl2,.2),front);const q=mix(e,h,.5);i.poly([[q.x-4,q.y-3],[q.x-9,q.y-7],[q.x-6,q.y+1],[q.x-9,q.y+3],[q.x-3,q.y+7]],pal.cowl);i.hand(h,5,pal.cowl2,pal.cowl,true);};
  leg(J.kneeL,J.footL,false);arm(J.shL,J.elL,J.hdL,false);
  bodySpace(i,J,()=>{
    i.poly([[-15,-1],[-7,-3],[8,-3],[17,1],[19,6],[13,13],[8,23],[7,d.torso],[-7,d.torso],[-9,22],[-16,10],[-18,4]],pal.suit);
    i.poly([[-12,1],[-7,-1],[-1,3],[-3,10],[-10,9],[-14,5]],lit(pal.suit,.2),false);
    i.poly([[1,2],[8,-1],[13,3],[12,8],[4,10]],lit(pal.suit,.26),false);
    i.poly([[-7,18],[-1,20],[-2,24],[-7,23]],pal.suit2,false);
    i.poly([[1,20],[7,17],[6,24],[1,25]],pal.suit2,false);
    i.poly([[-10,2],[-3,3],[-1,12],[-5,23],[-7,28],[-9,14]],pal.suit2,false);
    
    i.poly([[-5,11],[8,10],[9,15],[2,19],[-5,16]],pal.emblem);
    i.poly([[-4,12],[0,14],[1,11],[3,14],[7,11],[5,16],[1,17]],pal.emblemBat,false);
    i.poly([[-7,27],[7,27],[9,34],[1,39],[-8,34]],pal.trunks);
    i.line({x:-8,y:28},{x:8,y:28},4,pal.belt);
    for(let n=0;n<4;n++)i.line({x:-6+n*4,y:26.5},{x:-6+n*4,y:29.5},1.3,pal.trunks);
  });
  headSpace(i,J,p,()=>{
    face(i,9,pal.skin,'#ba907a',pal.mouth);
    i.poly([[-8,4],[-9,-7],[-7,-18],[-3,-10],[4,-10],[8,-18],[10,-6],[9,2],[5,2],[2,0],[-1,3]],pal.cowl);
    i.poly([[-6,-7],[-3,-9],[1,-7],[0,-1],[-5,0]],pal.cowl2,false);
    i.poly([[-2,-2],[1,-1],[1,0],[-2,0]],pal.eye,false);
    i.poly([[4,-1],[8,-3],[7,0],[4,0]],pal.eye,false);
    i.poly([[-.5,6],[4,5.5],[5.5,6.5],[1,7.2]],pal.mouth,false);
    i.line({x:0,y:8},{x:3.7,y:8},1,pal.skin);
  });
  leg(J.kneeR,J.footR,true);arm(J.shR,J.elR,J.hdR,true);
}

function bishop(i:Ink,J:Skeleton,p:Pose,d:Dims,pal:Palette,o:DrawOpts):void {
  const leg=(k:V,f:V,front:boolean)=>{i.limb(front?J.hipR:J.hipL,k,13,10,pal.robe,pal.robe2,lit(pal.robe,.15),front);i.limb(k,f,11,7,pal.robe,pal.robe2,lit(pal.robe,.15),front);i.boot(f,8,pal.shoe,pal.gold);};
  const arm=(s:V,e:V,h:V,front:boolean)=>{i.limb(s,e,15,12,pal.robe,pal.robe2,lit(pal.robe,.15),front);i.limb(e,h,14,9,pal.robe,pal.robe2,lit(pal.robe,.15),front);const q=mix(e,h,.8);i.line(at(q,-4,0),at(q,4,0),2,pal.gold);i.hand(h,3.9,pal.skin,pal.skinDark);};
  leg(J.kneeL,J.footL,false);leg(J.kneeR,J.footR,true);arm(J.shL,J.elL,J.hdL,false);
  bodySpace(i,J,()=>{
    const h=d.torso;
    const hem=Math.sin(o.time*.14-1.3)*(1+o.motion*3)-o.motion*5;
    i.poly([[-10,0],[8,0],[13,6],[9,26],[12,h+10],[18+hem,h+26],[6+hem*.5,h+27],[0,h+18],[-5+hem*.5,h+29],[-18+hem,h+26],[-10,h+9],[-9,20],[-13,7]],pal.robe);
    i.poly([[-10,5],[-4,9],[-3,28],[-9,h+22],[-14,h+24],[-8,h+5]],pal.robe2,false);
    i.poly([[3,16],[8,15],[7,h+7],[13,h+23],[8,h+24],[1,h+10]],pal.robe2,false);
    i.poly([[-9,1],[-3,2],[-4,h+15],[-10,h+16],[-6,22]],pal.sash);
    i.poly([[4,1],[9,2],[8,24],[12,h+14],[6,h+17],[4,22]],pal.sash);
    i.line({x:-9,y:h-7},{x:9,y:h-7},3,pal.gold);
    i.path([{x:-3,y:2},{x:0,y:12},{x:5,y:4}],1,pal.gold);
    i.line({x:1,y:12},{x:1,y:20},2,pal.gold);i.line({x:-2,y:15},{x:4,y:15},2,pal.gold);
    for(let n=0;n<3;n++)i.jewel(-6,h+n*4,1.2,pal.mitre);
  });
  headSpace(i,J,p,()=>{
    face(i,8.5,pal.skin,pal.skinDark,pal.eye);
    i.poly([[1,-4.4],[5.7,-4.8],[6.4,-2.9],[2,-2.2]],pal.hair,false);
    i.poly([[4,-1],[7,2],[6,3],[3,2]],pal.skinDark,false);
    i.line({x:2,y:4},{x:1,y:6},1.1,pal.skinDark);
    i.line({x:-2,y:1},{x:-1,y:4},1.1,pal.skinDark);
    i.line({x:-.5,y:6.5},{x:4.5,y:6.1},1.4,pal.mouth);
    i.line({x:-2.5,y:-3.7},{x:.5,y:-2.8},1.6,pal.hair);
    i.line({x:-3,y:3},{x:-1,y:5},1.2,pal.skinDark);
    i.poly([[-7,0],[-8,-7],[-4,-10],[-2,-5],[-4,1]],pal.hair);
    i.poly([[-8,-5],[-9,-17],[-1,-25],[7,-18],[9,-6]],pal.mitre);
    i.poly([[-8,-16],[-2,-22],[-2,-6],[-7,-6]],pal.robe2,false);
    i.line({x:-7,y:-7},{x:8,y:-7},3,pal.mitreBand);
    i.line({x:0,y:-20},{x:0,y:-10},2,pal.mitreBand);i.line({x:-3,y:-16},{x:4,y:-16},2,pal.mitreBand);
  });
  arm(J.shR,J.elR,J.hdR,true);
  const v={x:-Math.sin(J.foreR+p.weapon),y:-Math.cos(J.foreR+p.weapon)},n={x:-v.y,y:v.x},tip=along(J.hdR,v,d.blade),back=along(J.hdR,v,-25);
  i.line(back,tip,4,pal.woodDark);i.line(at(back,-.6,0),at(tip,-.6,0),1.7,pal.wood);
  const hook=[tip,along(along(tip,v,6),n,2),along(along(tip,v,9),n,7),along(along(tip,v,5),n,12),along(tip,n,11),along(along(tip,v,-1),n,7)];
  i.path(hook,5,INK);i.path(hook,3,pal.gold);i.hand(J.hdR,4.4,pal.skin,pal.skinDark);
  if(o.blade&&o.toScreen)o.blade(o.toScreen(tip),o.toScreen(mix(J.hdR,tip,.5)));
}

function robot(i:Ink,J:Skeleton,p:Pose,d:Dims,pal:Palette,o:DrawOpts,clown:boolean):void {
  const base=clown?pal.steel:pal.chrome2,light=clown?pal.band:pal.chrome1,shade=clown?pal.steel2:pal.dark;
  const shell=clown?pal.rust:pal.chrome2, accent=clown?pal.hazard:pal.visor;
  const leg=(k:V,f:V,front:boolean)=>{
    i.limb(front?J.hipR:J.hipL,k,clown?16:13,9,base,shade,light,front,'metal');
    i.jewel(k.x,k.y,5,shade);i.jewel(k.x,k.y,2,accent);
    i.limb(k,f,clown?14:11,8,base,shade,light,front,'metal');i.boot(f,clown?13:9,clown?pal.shoe:shade,clown?pal.shoe2:light);
  };
  const arm=(s:V,e:V,h:V,front:boolean)=>{
    i.limb(s,e,clown?18:13,9,base,shade,light,front,'metal');i.jewel(e.x,e.y,4,shade);
    i.limb(e,h,clown?16:11,9,clown?pal.fist:base,shade,clown?pal.hazard:light,front,'metal');
    i.hand(h,clown?7:4.6,clown?pal.fist:base,clown?pal.fist2:shade,true);
  };
  leg(J.kneeL,J.footL,false);arm(J.shL,J.elL,J.hdL,false);
  bodySpace(i,J,()=>{
    const w=clown?19:13,h=d.torso;
    i.poly([[-w,2],[-w+7,-3],[w-5,-3],[w,4],[w-2,19],[w-5,h],[-w+5,h],[-w+2,19]],shell);
    i.poly([[-w+2,3],[-w+8,1],[-w+7,15],[-w+3,22]],shade,false);
    i.poly([[-w+8,0],[w-6,0],[w-2,5],[w-6,11],[-w+6,11]],light);
    i.poly([[-w+6,14],[w-5,14],[w-6,22],[-w+7,22]],shade);
    for(let n=0;n<3;n++)i.line({x:-w+8,y:16+n*2},{x:w-8,y:16+n*2},1,base);
    i.jewel(w-6,7,2,accent);
    if(clown){i.jewel(2,9,3,pal.dot);i.jewel(2,26,3,pal.dot);}
    else {i.poly([[-10,25],[8,25],[8,30],[-10,30]],shade);i.jewel(0,27,2,pal.visor);}
  });
  headSpace(i,J,p,()=>{
    if(clown){
      i.poly([[-8,-4],[-13,-10],[-18,-7],[-17,-2],[-12,3],[-8,2]],pal.hair);
      i.poly([[6,-5],[13,-10],[17,-6],[15,2],[8,3]],pal.hair);
      i.poly([[-9,-6],[-4,-10],[5,-9],[10,-4],[9,7],[4,11],[-5,9],[-10,3]],pal.face);
      i.poly([[-8,-4],[-4,-6],[-3,6],[-5,7],[-8,2]],pal.steel,false);
      i.poly([[-6,-3],[-1,-2],[-1,1],[-6,0]],shade);i.poly([[3,-2],[8,-4],[8,0],[3,1]],shade);
      i.jewel(-3,-1,1.4,pal.eye);i.jewel(5,-1,1.5,pal.eye);
      i.jewel(2,3,3,pal.nose);
      i.poly([[-5,5],[7,4],[5,8],[-3,8]],shade);
      for(let n=0;n<4;n++)i.line({x:-3+n*2.5,y:5},{x:-3+n*2.5,y:7},1,pal.band);
      i.poly([[-7,-9],[-4,-17],[4,-17],[8,-9]],pal.hat);i.line({x:-10,y:-9},{x:10,y:-9},2,pal.hat);i.jewel(0,-18,2,pal.pom);
    }else{
      i.poly([[-9,-5],[-4,-10],[5,-9],[10,-3],[8,6],[3,10],[-5,7],[-9,1]],base);
      i.poly([[-6,-6],[-2,-8],[3,-6],[2,-2],[-6,-1]],light,false);
      i.poly([[-5,-1],[9,-3],[8,2],[-4,4]],shade);
      i.poly([[-3,0],[1,-.5],[1,1.3],[-3,2]],pal.visor,false);i.poly([[3,-1],[8,-2],[7,.5],[3,1]],pal.visor,false);
      i.line({x:-7,y:3},{x:-3,y:6},1.8,pal.chrome1);
      i.poly([[-4,5],[6,4],[3,9],[-2,8]],shade);
      i.line({x:-2,y:6},{x:3,y:5.5},1.4,light);
      i.line({x:-2,y:8},{x:2,y:7.5},1,base);
      i.line({x:-8,y:-4},{x:-12,y:-12},2,shade);i.jewel(-12,-12,1.6,accent);
    }
  });
  leg(J.kneeR,J.footR,true);arm(J.shR,J.elR,J.hdR,true);
  if(!clown){
    const v={x:Math.sin(J.foreR+p.weapon),y:Math.cos(J.foreR+p.weapon)},g=along(J.hdR,v,5),tip=along(g,v,d.blade),n={x:-v.y,y:v.x};
    i.line(along(J.hdR,v,-6),g,3,shade);i.line(along(g,n,-4),along(g,n,4),2,light);
    i.poly([[g.x-n.x*2,g.y-n.y*2],[tip.x,tip.y],[g.x+n.x*3,g.y+n.y*3]],pal.blade);i.hand(J.hdR,4.7,base,shade,true);
    if(o.blade&&o.toScreen)o.blade(o.toScreen(tip),o.toScreen(mix(g,tip,.5)));
  }
}

/** Costume construction shares animation joints, but never shares a generic torso or head. */
export function drawCharacterArt(ctx:Ctx,arch:Archetype,J:Skeleton,p:Pose,d:Dims,pal:Palette,o:DrawOpts):void {
  const i=new Ink(ctx,o);
  switch(arch){
    case 'ninja': ninja(i,J,p,d,pal,o);break;
    case 'brawler': harlequin(i,J,p,d,pal,o);break;
    case 'kingpin': kingpin(i,J,p,d,pal,o);break;
    case 'fiddler': fiddler(i,J,p,d,pal,o);break;
    case 'bat': bat(i,J,p,d,pal,o);break;
    case 'bishop': bishop(i,J,p,d,pal,o);break;
    case 'ninjabot': robot(i,J,p,d,pal,o,false);break;
    case 'clownbot': robot(i,J,p,d,pal,o,true);break;
  }
}
