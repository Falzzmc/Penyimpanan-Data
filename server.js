import express from 'express';
import session from 'express-session';
import {rateLimit} from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const app=express(), production=process.env.NODE_ENV==='production';
const password=process.env.APP_PASSWORD, secret=process.env.SESSION_SECRET;
if(!password || password.length<12 || !secret || secret.length<32) throw Error('Set APP_PASSWORD minimal 12 karakter dan SESSION_SECRET minimal 32 karakter.');
const dir=path.resolve(process.env.DATA_DIR || path.join(root,'data'));
await fs.mkdir(dir,{recursive:true});
const maxMB=Number(process.env.MAX_FILE_MB || 50);
if(!Number.isFinite(maxMB)||maxMB<=0) throw Error('MAX_FILE_MB tidak valid');
app.disable('x-powered-by');
if(process.env.TRUST_PROXY==='1') app.set('trust proxy',1);
app.use(helmet());
app.use(express.json({limit:'16kb'}));
app.use(session({name:'ruang.sid',secret,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'strict',secure:production,maxAge:8*60*60*1000}}));
app.use('/api', (req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.get('/api/session',(req,res)=>{if(!req.session.csrf)req.session.csrf=crypto.randomBytes(32).toString('hex');res.json({loggedIn:!!req.session.loggedIn,csrf:req.session.csrf,maxMB});});
app.use('/api',(req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&(!req.session.csrf||req.get('X-CSRF-Token')!==req.session.csrf))return res.status(403).json({error:'Sesi kedaluwarsa. Muat ulang halaman.'});next();});
const hash=s=>crypto.createHash('sha256').update(s).digest();
app.post('/api/login',rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Terlalu banyak percobaan. Tunggu 15 menit.'}}),(req,res,next)=>{
 if(typeof req.body.password!=='string'||!crypto.timingSafeEqual(hash(req.body.password),hash(password)))return res.status(401).json({error:'Password salah.'});
 req.session.regenerate(err=>{if(err)return next(err);req.session.loggedIn=true;req.session.csrf=crypto.randomBytes(32).toString('hex');res.json({csrf:req.session.csrf});});
});
app.use('/api',(req,res,next)=>req.session.loggedIn?next():res.status(401).json({error:'Silakan login.'}));
app.post('/api/logout',(req,res,next)=>req.session.destroy(err=>{if(err)return next(err);res.clearCookie('ruang.sid');res.json({ok:true});}));
const valid=id=>/^[0-9a-f-]{36}$/.test(id);
const metadata=id=>path.join(dir,id+'.json');
app.get('/api/files',async(req,res)=>{
 const names=(await fs.readdir(dir)).filter(n=>n.endsWith('.json'));
 const items=await Promise.all(names.map(async n=>{try{return JSON.parse(await fs.readFile(path.join(dir,n),'utf8'));}catch{return null;}}));
 res.json(items.filter(Boolean).sort((a,b)=>b.created.localeCompare(a.created)));
});
const upload=multer({storage:multer.diskStorage({destination:dir,filename:(req,file,cb)=>cb(null,crypto.randomUUID()+'.bin')}),limits:{fileSize:maxMB*1024*1024,files:1,fields:0}});
app.post('/api/files',upload.single('file'),async(req,res,next)=>{
 if(!req.file)return res.status(400).json({error:'Pilih file terlebih dahulu.'});
 const id=req.file.filename.slice(0,-4);
 const item={id,name:path.basename(req.file.originalname).replace(/[\x00-\x1f\x7f]/g,'').slice(0,200)||'file',size:req.file.size,created:new Date().toISOString()};
 try{await fs.writeFile(metadata(id),JSON.stringify(item),{flag:'wx'});res.status(201).json(item);}catch(e){await fs.unlink(req.file.path).catch(()=>{});next(e);}
});
app.get('/api/files/:id/download',async(req,res,next)=>{
 if(!valid(req.params.id))return res.sendStatus(404);
 try{const item=JSON.parse(await fs.readFile(metadata(req.params.id),'utf8'));res.set('Content-Type','application/octet-stream');res.download(path.join(dir,item.id+'.bin'),item.name,err=>{if(err&&!res.headersSent)next(err);});}catch(e){if(e.code==='ENOENT')return res.sendStatus(404);next(e);}
});
app.delete('/api/files/:id',async(req,res)=>{
 const id=req.params.id;if(!valid(id))return res.sendStatus(404);
 try{await fs.access(metadata(id));}catch{return res.status(404).json({error:'File tidak ditemukan.'});}
 await fs.unlink(path.join(dir,id+'.bin')).catch(e=>{if(e.code!=='ENOENT')throw e;});
 await fs.unlink(metadata(id));res.json({ok:true});
});
app.use(express.static(path.join(root,'public'),{index:'index.html',dotfiles:'deny'}));
app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);res.status(err instanceof multer.MulterError?400:500).json({error:err.code==='LIMIT_FILE_SIZE'?`Ukuran maksimal ${maxMB} MB.`:err instanceof multer.MulterError?'Unggah satu file saja.':'Terjadi kesalahan server.'});});
app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('RuangFile berjalan pada port '+(process.env.PORT||3000)));
