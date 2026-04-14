export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS'){return res.status(200).end();}
  const body=typeof req.body==='object'?req.body:JSON.parse(req.body||'{}');
  const heliusKey=process.env.HELIUS_API_KEY;
  const rpcs=[
    heliusKey?'https://mainnet.helius-rpc.com/?api-key='+heliusKey:null,
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
  ].filter(Boolean);
  for(const rpc of rpcs){
    try{
      const r=await fetch(rpc,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(6000)
      });
      if(!r.ok)continue;
      const d=await r.json();
      if(d.result!==null&&d.result!==undefined){
        return res.status(200).json(d);
      }
    }catch(e){continue;}
  }
  res.status(200).json({jsonrpc:'2.0',result:null,error:{code:-32000,message:'All RPCs failed'}});
}