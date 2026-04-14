export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  const body=req.body||await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(JSON.parse(d)));});
  
  // Try multiple public Solana RPCs in order
  const rpcs=[
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana',
    'https://solana.public-rpc.com'
  ];
  
  for(const rpc of rpcs){
    try{
      const r=await fetch(rpc,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(5000)
      });
      const d=await r.json();
      if(d.result!==null && d.result!==undefined){
        return res.status(200).json(d);
      }
    }catch(e){ continue; }
  }
  res.status(200).json({result:null,error:{message:'All RPCs failed'}});
}