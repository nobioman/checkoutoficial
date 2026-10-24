import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { initDb, saveOrder, getOrder, updateOrderStatus, findOrderByProviderId } from './store.js';
import { createPixTransaction, fetchProviderTransaction } from './invictuspay.js';

const app=express(), port=Number(process.env.PORT||3000);
const allowedOrigins=(process.env.FRONTEND_ORIGIN||'http://localhost:5500').split(',').map(s=>s.trim()).filter(Boolean);
initDb(); app.disable('x-powered-by'); app.use(helmet());
app.use(cors({origin(origin,cb){if(!origin||allowedOrigins.includes(origin))return cb(null,true);return cb(new Error('CORS'));},methods:['GET','POST','OPTIONS'],allowedHeaders:['Content-Type']}));
app.use(express.json({limit:'20kb'}));
app.use('/api/',rateLimit({windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false}));

const customerSchema=z.object({
 name:z.string().trim().min(2).max(120),
 email:z.string().trim().email().max(254),
 document:z.string().transform(v=>v.replace(/\D/g,'')).refine(v=>v.length===11||v.length===14,'Informe CPF ou CNPJ.'),
 phone:z.string().transform(v=>v.replace(/\D/g,'')).refine(v=>v.length>=10&&v.length<=13,'Informe telefone brasileiro com DDD.')
});
app.get('/health',(_req,res)=>res.json({ok:true,service:'checkout-api'}));
app.post('/api/orders',async(req,res)=>{
 const parsed=customerSchema.safeParse(req.body?.customer);
 if(!parsed.success)return res.status(400).json({error:'Dados do cliente inválidos.',details:parsed.error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});
 const amount=Number(process.env.PRODUCT_PRICE_CENTS||2990), productId=process.env.PRODUCT_ID||'produto-digital', productName=process.env.PRODUCT_NAME||'Produto Digital';
 if(!Number.isSafeInteger(amount)||amount<100)return res.status(500).json({error:'Preço do produto não configurado corretamente.'});
 try{
  const provider=await createPixTransaction({amount,customer:parsed.data,description:process.env.PRODUCT_DESCRIPTION||productName,expirationInSeconds:Number(process.env.PIX_EXPIRATION_SECONDS||1800)});
  const providerId=provider.id||provider.txId||provider.transactionId||provider.data?.id||provider.data?.txId;
  if(!providerId){console.error('Resposta do provedor sem ID de transação.');return res.status(502).json({error:'O provedor não retornou o identificador da transação.'});}
  const orderId=crypto.randomUUID(), status=normalizeStatus(provider.status||provider.data?.status||'pending');
  saveOrder({id:orderId,providerId:String(providerId),productId,productName,amount,customer:parsed.data,status,providerResponse:provider});
  res.status(201).json({orderId,transactionId:String(providerId),product:{id:productId,name:productName},amount,currency:'BRL',status,payment:extractPixDetails(provider)});
 }catch(err){console.error('Falha ao criar cobrança:',err.message);res.status(err.status||502).json({error:err.publicMessage||'Não foi possível criar a cobrança Pix.'});}
});
app.get('/api/orders/:id',async(req,res)=>{
 const order=getOrder(req.params.id); if(!order)return res.status(404).json({error:'Pedido não encontrado.'});
 try{
  const remote=await fetchProviderTransaction(order.provider_id), status=normalizeStatus(remote.status||remote.data?.status||order.status);
  updateOrderStatus(order.id,status,remote);
  res.json({orderId:order.id,transactionId:order.provider_id,product:{id:order.product_id,name:order.product_name},amount:order.amount,currency:'BRL',status,payment:extractPixDetails(remote)});
 }catch(err){console.error('Falha ao consultar cobrança:',err.message);res.status(502).json({error:'Não foi possível confirmar o status agora.'});}
});
app.post('/api/webhooks/invictuspay',async(req,res)=>{
 const b=req.body||{}, providerId=b.id||b.txId||b.transactionId||b.data?.id||b.data?.txId||b.data?.transactionId;
 if(!providerId)return res.status(400).json({received:false,error:'ID da transação ausente.'});
 try{
  const order=findOrderByProviderId(String(providerId)); if(!order)return res.status(202).json({received:true,ignored:true});
  const remote=await fetchProviderTransaction(order.provider_id), status=normalizeStatus(remote.status||remote.data?.status||order.status);
  updateOrderStatus(order.id,status,remote); return res.json({received:true});
 }catch(err){console.error('Falha ao validar webhook:',err.message);return res.status(502).json({received:false,error:'Não foi possível validar a transação.'});}
});
function extractPixDetails(payload) {
    const p = payload?.data || payload || {};
    const pix = p.pix || p.payment?.pix || p.paymentData || {};

    const qrCode =
        pix.qrCode ||
        pix.qrcode ||
        pix.qr_code ||
        p.qrCode ||
        p.qrcode ||
        null;

    const copyPaste =
        pix.copyPaste ||
        pix.copy_paste ||
        pix.brCode ||
        pix.brcode ||
        pix.pixCopiaECola ||
        p.copyPaste ||
        p.brcode ||
        (typeof qrCode === "string" && qrCode.startsWith("000201")
            ? qrCode
            : null);

    return {
        qrCode,
        copyPaste,
        expiresAt: pix.expiresAt || pix.expirationDate || p.expiresAt || null
    };
}
app.use((err,_req,res,_next)=>{if(err?.message==='CORS')return res.status(403).json({error:'Origem não permitida.'});console.error('Erro inesperado:',err.message);res.status(500).json({error:'Erro interno do servidor.'});});
app.listen(port,()=>console.log(`Checkout API disponível na porta ${port}`));
