const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const styles=['styles.css','labs.css','studio.css'].map(read).join('\n').replace(/@charset\s+"UTF-8";/g,'');
const scripts=['engine.js','time.js','market.js','instruments.js','chart.js','academy.js','training.js','labs.js','studio.js'].map(read).join('\n;\n')+'\n;window.REPLAY_ARCHIVE_CSV='+JSON.stringify(read('data.csv'))+';\n'+read('app.js');
const out=read('index.template.html').replace('/* STYLES */',()=>styles).replace('/* SCRIPTS */',()=>scripts.replace(/<\/script/gi,'<\\/script'));
fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist/index.html'),out);
console.log('Built dist/index.html ('+Buffer.byteLength(out).toLocaleString()+' bytes), self-contained.');
