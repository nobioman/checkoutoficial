const baseUrl = (process.env.INVICTUSPAY_BASE_URL || 'https://api.invictuspayv2.com.br/api/v1').replace(/\/+$/, '');
function apiKey() {
  const key=process.env.INVICTUSPAY_API_KEY;
  if (!key || key==='COLOQUE_SUA_CHAVE_AQUI') {
    const err=new Error('INVICTUSPAY_API_KEY não configurada.'); err.status=500;
    err.publicMessage='O gateway ainda não foi configurado no servidor.'; throw err;
  }
  return key;
}
async function request(path, options={}) {
  const response=await fetch(`${baseUrl}${path}`, {
    ...options, headers:{accept:'application/json','content-type':'application/json','X-Api-Key':apiKey(),...(options.headers||{})},
    signal:AbortSignal.timeout(15000)
  });
  const text=await response.text(); let data;
  try { data=text ? JSON.parse(text) : {}; } catch { data={message:text}; }
  if (!response.ok) {
    const err=new Error(`InvictusPay HTTP ${response.status}`);
    err.status=response.status>=400&&response.status<500?400:502;
    err.publicMessage=response.status===401||response.status===403?'Credenciais do gateway inválidas ou sem permissão.':'O gateway recusou a solicitação ou está indisponível.';
    throw err;
  }
  return data;
}
export async function createPixTransaction({amount,customer,description,expirationInSeconds}) {
  return request('/transactions',{method:'POST',body:JSON.stringify({
    amount,paymentMethod:'pix',customer,items:[{description,quantity:1,amount}],pix:{expirationInSeconds}
  })});
}
export async function fetchProviderTransaction(transactionId) {
  return request(`/transactions/${encodeURIComponent(transactionId)}`,{method:'GET'});
}
