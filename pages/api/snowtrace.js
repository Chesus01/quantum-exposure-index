export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  const params=new URLSearchParams(req.query);
  const chainId=params.get('chainid')||'43114';
  params.delete('chainid');
  const routescanKey=process.env.ROUTESCAN_API_KEY;
  if(routescanKey)params.set('apikey',routescanKey);
  else params.delete('apikey');
  const url='https://api.routescan.io/v2/network/mainnet/evm/'+chainId+'/etherscan/api?'+params.toString();
  try{
    const r=await fetch(url,{headers:{'Accept':'application/json'}});
    const data=await r.json();
    res.status(200).json(data);
  }catch(e){
    res.status(500).json({status:'0',message:e.message,result:'0'});
  }
}