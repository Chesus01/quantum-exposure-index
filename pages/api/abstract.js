export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS') return res.status(200).end();

  // Abstract is zkSync ERA L2 - use JSON-RPC eth_getBalance directly
  // abscan.org API is deprecated V1 - skip it entirely
  const {address,module,action}=req.query;

  if(module==='account'&&action==='balance'&&address){
    const rpcs=[
      'https://api.mainnet.abs.xyz',
      'https://rpc.ankr.com/abstract'
    ];
    for(const rpc of rpcs){
      try{
        const r=await fetch(rpc,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getBalance',params:[address,'latest']}),
          signal:AbortSignal.timeout(5000)
        });
        const d=await r.json();
        if(d.result){
          // Convert hex wei to decimal string (Etherscan-compatible format)
          const wei=BigInt(d.result).toString();
          return res.status(200).json({status:'1',message:'OK',result:wei});
        }
      }catch(e){continue;}
    }
  }
  res.status(200).json({status:'0',message:'NOTOK',result:'0'});
}