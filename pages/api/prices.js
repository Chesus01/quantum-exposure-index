const cache={data:null,ts:0};
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  const now=Date.now();
  if(cache.data&&now-cache.ts<60000){
    return res.status(200).json(cache.data);
  }
  const ids=req.query.ids||'bitcoin,ethereum,solana';
  const cgKey=process.env.COINGECKO_API_KEY;
  const baseUrl=cgKey
    ?'https://pro-api.coingecko.com/api/v3'
    :'https://api.coingecko.com/api/v3';
  const headers={'Accept':'application/json'};
  if(cgKey)headers['x-cg-pro-api-key']=cgKey;
  try{
    const r=await fetch(baseUrl+'/simple/price?ids='+ids+'&vs_currencies=usd&include_market_cap=true&include_24hr_change=true',{headers});
    const data=await r.json();
    if(!data.error){cache.data=data;cache.ts=now;}
    res.status(200).json(data);
  }catch(e){
    res.status(500).json({error:e.message});
  }
}