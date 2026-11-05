'use strict';
// Create neutral app/tray artwork locally; no image service or font dependency.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const table = Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([len,tag,data,crc]);}
function png(size){
 const raw=Buffer.alloc((size*4+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let r=0,g=0,b=0,a=0;
  for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
   const px=(x+(sx+.5)/4)/size*64,py=(y+(sy+.5)/4)/size*64;
   if((px-32)**2+(py-32)**2>30**2)continue;
   const white=(px>=28&&px<36&&py>=15&&py<49)||(py>=28&&py<36&&px>=15&&px<49);
   r+=white?255:30;g+=white?255:64;b+=white?255:175;a++;
  }
  const i=y*(size*4+1)+1+x*4;if(a){raw[i]=Math.round(r/a);raw[i+1]=Math.round(g/a);raw[i+2]=Math.round(b/a);raw[i+3]=Math.round(a/16*255);}
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const sizes=[16,32,48,256],images=sizes.map(png),header=Buffer.alloc(6+16*sizes.length);
header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
sizes.forEach((size,i)=>{const at=6+16*i;header[at]=size===256?0:size;header[at+1]=header[at];header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(images[i].length,at+8);header.writeUInt32LE(offset,at+12);offset+=images[i].length;});
const dir=path.join(__dirname,'../assets');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'app.ico'),Buffer.concat([header,...images]));
fs.writeFileSync(path.join(dir,'tray.png'),png(32));
console.log('Neutral application and tray icons generated.');
