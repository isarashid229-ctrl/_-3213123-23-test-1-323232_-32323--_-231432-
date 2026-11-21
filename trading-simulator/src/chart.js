(function (root) {
  'use strict';
  const colors = {up:'#70d9b5',down:'#ee8496',grid:'#1b2d39',text:'#8fa8b8',ema9:'#79a9ee',ema21:'#d2b072'};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const price=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:n<10?3:0,maximumFractionDigits:n<1?6:n<10?3:2});
  const date=t=>new Date(t*1000).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'});
  function create(canvas,tooltip,options) {
    const context=canvas.getContext('2d');
    let visible=80,offset=0,mouse=null,geometry=null,drag=null,levelMode=false,frame=0,disposed=false;
    canvas.tabIndex=0;
    const redraw=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(()=>{frame=0;draw();});};
    function draw(){
      const rect=canvas.parentElement.getBoundingClientRect(),W=rect.width,H=rect.height;
      if(W<120||H<120||!context){geometry=null;tooltip.hidden=true;return;}
      const dpr=Math.min(window.devicePixelRatio||1,2);
      if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}
      const c=context;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);c.fillStyle='#0d1822';c.fillRect(0,0,W,H);
      const data=options.getData(),cursor=Math.min(data.cursor,data.candles.length-1),len=cursor+1;
      if(len<1){geometry=null;tooltip.hidden=true;return;}
      const count=Math.min(visible,len);offset=clamp(offset,0,Math.max(0,len-count));
      const end=cursor-offset,start=Math.max(0,end-count+1),bars=data.candles.slice(start,end+1);
      const left=12,right=W<500?78:82,top=22,bottom=30,volumeH=Math.max(34,H*.14),gap=19;
      const width=W-left-right,height=H-top-bottom-volumeH-gap;
      let hi=Math.max(...bars.map(b=>b.high)),lo=Math.min(...bars.map(b=>b.low));const range=Math.max(hi-lo,hi*.001,1e-8);hi+=range*.15;lo-=range*.14;
      const y=p=>top+(hi-p)/(hi-lo)*height,step=width/bars.length,x=i=>left+(i+.5)*step;
      const volMax=Math.max(...bars.map(b=>b.volume),1);
      c.font='11px ui-monospace, SFMono-Regular, Consolas, monospace';c.textBaseline='middle';
      for(let i=0;i<=4;i++){const row=top+i*height/4;c.strokeStyle=colors.grid;c.lineWidth=1;c.beginPath();c.moveTo(left,row+.5);c.lineTo(W-right,row+.5);c.stroke();c.fillStyle=colors.text;c.textAlign='left';c.fillText(price(hi-i*(hi-lo)/4),W-right+9,row);}
      const axisCount=W<500?3:5;
      for(let i=0;i<axisCount;i++){const j=Math.round(i*(bars.length-1)/(axisCount-1));const col=x(j);c.strokeStyle='#172936';c.beginPath();c.moveTo(col,top);c.lineTo(col,H-bottom);c.stroke();c.fillStyle=colors.text;c.font='10px system-ui';c.textAlign='center';const d=new Date(bars[j].time*1000);const label=bars.at(-1).time-bars[0].time<86400?d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}):d.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});c.fillText(label,clamp(col,34,W-right-22),H-14);}
      for(let i=0;i<bars.length;i++){const b=bars[i],shade=b.close>=b.open?colors.up:colors.down,px=x(i),body=Math.max(1,Math.min(12,step*.62));c.strokeStyle=shade;c.lineWidth=1;c.beginPath();c.moveTo(px,y(b.high));c.lineTo(px,y(b.low));c.stroke();c.fillStyle=shade;c.fillRect(px-body/2,y(Math.max(b.open,b.close)),body,Math.max(1.4,Math.abs(y(b.open)-y(b.close))));c.globalAlpha=.26;const vh=b.volume/volMax*volumeH;c.fillRect(px-body/2,H-bottom-vh,body,vh);c.globalAlpha=1;}
      if(data.ema){for(const [period,color] of [[9,colors.ema9],[21,colors.ema21]]){let v=data.candles[0].close;const k=2/(period+1);c.save();c.beginPath();c.rect(left,top,width,height);c.clip();c.strokeStyle=color;c.lineWidth=1.3;c.beginPath();let began=false;for(let i=0;i<=end;i++){v=i?data.candles[i].close*k+v*(1-k):v;if(i<start)continue;const py=y(v);if(began)c.lineTo(x(i-start),py);else{c.moveTo(x(i-start),py);began=true;}}c.stroke();c.restore();}}
      function line(p,label,color,dashed=true){const py=y(p);if(py<top||py>top+height)return;c.strokeStyle=color;c.lineWidth=1;c.setLineDash(dashed?[4,4]:[]);c.beginPath();c.moveTo(left,py);c.lineTo(W-right,py);c.stroke();c.setLineDash([]);if(label){c.font='10px system-ui';c.fillStyle=color;c.textAlign='left';c.fillText(label,left+5,py-7);}}
      for(const l of data.levels||[])line(l,'Level '+price(l),'#a5b9d6');
      if(data.position){line(data.position.entryPrice,'Entry','#bdd5ff');if(data.position.stop)line(data.position.stop,'Stop',colors.down);if(data.position.target)line(data.position.target,'Target',colors.up);}
      const last=bars.at(-1),lastY=y(last.close),shade=last.close>=last.open?colors.up:colors.down;line(last.close,'',shade);
      c.fillStyle=last.close>=last.open?'#225344':'#6a3948';c.fillRect(W-right+3,lastY-10,right-7,20);c.fillStyle='#eaf5f0';c.font='10px ui-monospace,monospace';c.textAlign='center';c.fillText(price(last.close),W-right/2,lastY);
      geometry={left,right,top,width,height,W,H,lo,hi,start,end,step,priceAt:py=>hi-(clamp(py,top,top+height)-top)/height*(hi-lo)};
      if(mouse&&mouse.x>=left&&mouse.x<W-right&&mouse.y>=top&&mouse.y<top+height){const i=clamp(Math.floor((mouse.x-left)/step),0,bars.length-1),b=bars[i],px=x(i);c.setLineDash([3,4]);c.strokeStyle='#6c8a9e';c.beginPath();c.moveTo(px,top);c.lineTo(px,H-bottom);c.moveTo(left,mouse.y);c.lineTo(W-right,mouse.y);c.stroke();c.setLineDash([]);tooltip.textContent=`${date(b.time)} UTC   O ${price(b.open)}  H ${price(b.high)}  L ${price(b.low)}  C ${price(b.close)}`;tooltip.hidden=false;}else tooltip.hidden=true;
      canvas.setAttribute('aria-label',`Historical candles through ${date(data.candles[cursor].time)} UTC. Latest open ${price(data.candles[cursor].open)}, high ${price(data.candles[cursor].high)}, low ${price(data.candles[cursor].low)}, close ${price(data.candles[cursor].close)}. Future candles are hidden. Focus chart and use plus or minus to zoom.`);
    }
    function pointer(e){const r=canvas.getBoundingClientRect();mouse={x:e.clientX-r.left,y:e.clientY-r.top};if(drag&&geometry){offset=clamp(drag.offset+Math.round((e.clientX-drag.x)/geometry.step),0,options.getData().cursor);drag.moved=drag.moved||Math.abs(e.clientX-drag.x)>4;}redraw();}
    function down(e){if(e.pointerType==='touch')return;if(!levelMode){drag={x:e.clientX,offset,moved:false};canvas.setPointerCapture(e.pointerId);}}
    function up(e){if(levelMode&&geometry){const r=canvas.getBoundingClientRect();const py=e.clientY-r.top,px=e.clientX-r.left;if(px>=geometry.left&&px<geometry.W-geometry.right&&py>=geometry.top&&py<geometry.top+geometry.height)options.onLevel(geometry.priceAt(py));}drag=null;redraw();}
    function leave(){if(!drag){mouse=null;redraw();}}
    function wheel(e){e.preventDefault();visible=clamp(Math.round(visible*(e.deltaY>0?1.15:.87)),20,240);redraw();}
    function keys(e){if(e.key==='+'||e.key==='='){e.preventDefault();zoom(-1);}if(e.key==='-'){e.preventDefault();zoom(1);}if(e.key==='Enter'&&levelMode){e.preventDefault();const d=options.getData(),bar=d.candles[d.cursor];if(bar)options.onLevel(bar.close);}}
    function cancelDrag(){drag=null;mouse=null;redraw();}
    function zoom(direction){visible=clamp(Math.round(visible*(direction>0?1.25:.8)),20,240);redraw();}
    const ro=new ResizeObserver(redraw);ro.observe(canvas.parentElement);
    canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointerleave',leave);canvas.addEventListener('pointercancel',cancelDrag);canvas.addEventListener('lostpointercapture',cancelDrag);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',keys);
    return {draw:redraw,zoom,reset(){visible=80;offset=0;mouse=null;redraw();},latest(){offset=0;redraw();},setLevelMode(value){levelMode=value;canvas.style.cursor=value?'crosshair':'grab';},destroy(){disposed=true;if(frame)cancelAnimationFrame(frame);ro.disconnect();canvas.removeEventListener('pointermove',pointer);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('pointercancel',cancelDrag);canvas.removeEventListener('lostpointercapture',cancelDrag);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',keys);}};
  }
  root.ReplayChart={create};
})(typeof window!=='undefined'?window:globalThis);
